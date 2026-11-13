"""FastAPI 入口：API + 静态前端托管。"""
from __future__ import annotations

import asyncio
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from starlette.middleware.gzip import GZipMiddleware

from .config import APP_TITLE, APP_VERSION, CORS_ORIGINS, FRONTEND_DIST, REPO_ROOT
from .db import SessionLocal, init_db
from .admin_compat import router as admin_router
from .settings_api import apply_overrides
from .settings_api import router as settings_router
from .agent import router as agent_router
from pp7rag.ragapi.routes import router as rag_router

logger = logging.getLogger(__name__)
from .routers.api import router as api_router
from .seed import seed_if_empty


# ── 运行配置（全部可用环境变量覆盖） ────────────────────────────────────────
_LOG_LEVEL = os.environ.get("APP_LOG_LEVEL", "INFO").strip().upper() or "INFO"
if not isinstance(getattr(logging, _LOG_LEVEL, None), int):
    _LOG_LEVEL = "INFO"
logging.basicConfig(level=_LOG_LEVEL)
_LOG_FILE = os.environ.get("APP_LOG_FILE", "").strip()
if _LOG_FILE:
    try:
        _file_handler = logging.FileHandler(_LOG_FILE, encoding="utf-8")
        _file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logging.getLogger().addHandler(_file_handler)
    except OSError as exc:  # 日志文件不可写时不影响启动
        logger.warning("log_file_unavailable: %s", exc)

_ENABLE_DOCS = os.environ.get("APP_ENABLE_DOCS", "1").strip().lower() not in {"0", "false", "no", "off"}
_WARMUP_ENABLED = os.environ.get("APP_WARMUP", "1").strip().lower() not in {"0", "false", "no", "off"}
# 管理口令：设置后 /api/admin、问答日志、知识库管理（以及项目写接口）需要 X-Admin-Token
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()
# 费用型接口限流：每 IP 每分钟最大请求数，0 表示关闭
try:
    _RATE_LIMIT_PER_MIN = int(os.environ.get("APP_RATE_LIMIT_PER_MIN", "120") or "0")
except ValueError:
    _RATE_LIMIT_PER_MIN = 120
_RATE_LIMITED_PREFIXES = (
    "/api/v1/rag/ask",
    "/api/v1/rag/tts",
    "/api/v1/rag/asr",
    "/api/v1/agent/ask",
    "/api/admin/settings/test",
)
_rate_buckets: dict[str, list[float]] = {}
_ADMIN_PROTECTED_PREFIXES = ("/api/admin", "/api/v1/rag/knowledge", "/api/v1/rag/qa")


def _needs_admin(path: str, method: str) -> bool:
    if path.startswith(_ADMIN_PROTECTED_PREFIXES):
        return True
    # 项目数据的写操作也纳入管理面（GET 保持公开，前端只读）
    if path.startswith("/api/projects") and method not in ("GET", "HEAD", "OPTIONS"):
        return True
    return False


def _security_headers(response, path: str) -> None:
    if path.startswith("/assets/"):
        response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
    elif path.startswith("/media/"):
        response.headers.setdefault("Cache-Control", "public, max-age=86400")
    elif path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    elif path == "/" or response.headers.get("content-type", "").startswith("text/html"):
        # index.html 不缓存，保证重新构建后浏览器能拿到新的 hash 资源
        response.headers.setdefault("Cache-Control", "no-cache")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    # Swagger UI 依赖 CDN 与内联脚本，不放宽 CSP 会白屏；生产建议直接关闭 /docs
    if not path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; "
            "connect-src 'self' ws: wss:; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
        )


async def _warm_encoder() -> None:
    try:
        from pp7rag.engine.retriever import get_shared_encoder

        await asyncio.to_thread(get_shared_encoder)
        logger.info("rag_warmup_encoder_ready")
    except Exception as exc:
        logger.warning("rag_warmup_encoder_failed: %s", exc)


async def _warm_providers() -> None:
    try:
        from pp7rag.ragapi.providers import http as rag_http
        from pp7rag.ragapi.providers import llm, tts

        await asyncio.gather(llm.warmup(), rag_http.warmup(), tts.warmup(), return_exceptions=True)
        logger.info("rag_warmup_providers_ready")
    except Exception as exc:
        logger.warning("rag_warmup_providers_failed: %s", exc)


async def _warm_agent() -> None:
    try:
        from .agent import warm_agent_llm

        await warm_agent_llm()
        logger.info("rag_warmup_agent_ready")
    except Exception as exc:
        logger.warning("rag_warmup_agent_failed: %s", exc)


# 启动时应用 settings.json 里的覆盖值（管理后台改过的参数）
apply_overrides()


async def _ensure_knowledge_index() -> None:
    """全新部署没有 chroma 索引：docs/ 有文档但集合为空时自动重建一次。"""
    try:
        from pp7rag.engine.retriever import retriever
        from pp7rag.ragapi import knowledge_import

        docs = await asyncio.to_thread(knowledge_import.list_documents)
        if not docs:
            return
        count = 0
        try:
            collection = await asyncio.to_thread(
                lambda: retriever._client.get_collection(
                    "knowledge_base", embedding_function=retriever._ef
                )
            )
            count = await asyncio.to_thread(collection.count)
        except Exception:
            count = 0
        if count == 0:
            logger.warning("knowledge_index_empty_rebuilding")
            await asyncio.to_thread(knowledge_import.rebuild)
            logger.info("knowledge_index_rebuilt")
    except Exception as exc:
        logger.warning("knowledge_index_bootstrap_failed: %s", exc)


async def _warmup_rag() -> None:
    """预热数字人后端：嵌入模型、LLM/TTS 连接、Agent 模型链路、知识索引自检。"""
    await asyncio.gather(
        _warm_encoder(), _warm_providers(), _warm_agent(), _ensure_knowledge_index(),
        return_exceptions=True,
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 监听非本机地址时 fail-closed：没配管理口令且没有反向代理时拒绝启动
    bind_host = os.environ.get("APP_HOST", "").strip().lower()
    allow_insecure = os.environ.get("ALLOW_INSECURE", "").strip().lower() in ("1", "true", "yes")
    if bind_host and bind_host not in ("127.0.0.1", "localhost", "::1") and not ADMIN_TOKEN and not allow_insecure:
        raise RuntimeError(
            "APP_HOST 不是本机地址时必须设置 ADMIN_TOKEN；"
            "如果已由反向代理做登录鉴权，请设置 ALLOW_INSECURE=1"
        )
    init_db()
    try:
        with SessionLocal() as session:
            seed_if_empty(session)
    except Exception as exc:  # 种子数据损坏不应导致整站起不来
        logger.exception("seed_failed: %s", exc)
    warmup_task = asyncio.create_task(_warmup_rag()) if _WARMUP_ENABLED else None
    try:
        yield
    finally:
        if warmup_task is not None:
            warmup_task.cancel()
        try:
            from .agent import close_http_client

            await close_http_client()
        except Exception:
            pass


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if _ENABLE_DOCS else None,
    redoc_url="/redoc" if _ENABLE_DOCS else None,
    openapi_url="/openapi.json" if _ENABLE_DOCS else None,
)

# 生产静态资源压缩：前端 bundle 原始约 2.6MB，gzip 后约 750KB；
# Starlette 会跳过 text/event-stream 与音频/图片，不影响 SSE 流式。
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

# 默认只放行本地 Vite 开发服务器；上线同源部署时浏览器不会走 CORS。
_ALLOW_ALL_ORIGINS = (not CORS_ORIGINS) or CORS_ORIGINS == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    # 通配符 + credentials 是非法组合，浏览器会直接拒绝
    allow_credentials=not _ALLOW_ALL_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def launch_guard(request: Request, call_next):
    """鉴权 / 限流 / 缓存与安全响应头（合并成一个中间件，减少对 SSE 的影响）。"""
    path = request.url.path
    method = request.method

    # 1) 管理面鉴权（仅当配置了 ADMIN_TOKEN 时启用）
    if ADMIN_TOKEN and method != "OPTIONS" and _needs_admin(path, method):
        supplied = (
            request.headers.get("X-Admin-Token")
            or request.cookies.get("admin_token")
            or request.query_params.get("token")
            or ""
        )
        if not supplied or not secrets.compare_digest(supplied.encode("utf-8"), ADMIN_TOKEN.encode("utf-8")):
            response = JSONResponse(
                {"detail": "需要管理员口令（请求头 X-Admin-Token）"},
                status_code=401,
            )
            _security_headers(response, path)
            return response

    # 2) 费用型接口限流（每 IP 每分钟）
    if (
        _RATE_LIMIT_PER_MIN > 0
        and method == "POST"
        and path.startswith(_RATE_LIMITED_PREFIXES)
    ):
        host = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = _rate_buckets.setdefault(host, [])
        cutoff = now - 60.0
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)
        if len(bucket) >= _RATE_LIMIT_PER_MIN:
            response = JSONResponse(
                {"detail": "请求过于频繁，请稍后再试"},
                status_code=429,
                headers={"Retry-After": "60"},
            )
            _security_headers(response, path)
            return response
        bucket.append(now)
        if len(_rate_buckets) > 2000:
            for key in [key for key, items in _rate_buckets.items() if not items or items[-1] < cutoff]:
                _rate_buckets.pop(key, None)

    response = await call_next(request)
    _security_headers(response, path)
    return response


app.include_router(api_router)
# 数字人：RAG 问答 + TTS/ASR + 知识库管理（移植自 pp7，前缀 /api/v1/rag）
app.include_router(rag_router)
# 管理后台：会话/统计（映射到 RAG 的 SQLite 问答日志）
app.include_router(admin_router)
# 系统设置：模型 / 语音 / 检索 / 数字人参数（在线修改，立即生效）
app.include_router(settings_router)
# 实验：语义操作界面的 Agent（白名单动作 + LLM function calling）
app.include_router(agent_router)

MEDIA_DIR = REPO_ROOT / "assets" / "images"
if MEDIA_DIR.exists():
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

if FRONTEND_DIST.exists() and (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")


@app.get("/", include_in_schema=False)
def index():
    dist_index = FRONTEND_DIST / "index.html"
    if dist_index.exists():
        return FileResponse(dist_index)
    return JSONResponse(
        {
            "service": APP_TITLE,
            "hint": "前端尚未构建：在 frontend 目录执行 npm install && npm run build",
            "docs": "/docs",
        }
    )


@app.get("/api/ready", include_in_schema=False)
def ready():
    """就绪检查：数据库可读写即视为就绪；供部署/负载均衡拨测。"""
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("ready_check_failed: %s", exc)
        return JSONResponse({"status": "not_ready", "db": False}, status_code=503)
    return {"status": "ok", "db": True}


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "media/", "assets/")):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    if not _ENABLE_DOCS and full_path.rstrip("/") in ("docs", "redoc", "openapi.json"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    # 带扩展名的静态请求（favicon、robots.txt 等）不再回退成 HTML
    suffix = Path(full_path).suffix.lower()
    if suffix and suffix != ".html":
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    dist_index = FRONTEND_DIST / "index.html"
    if dist_index.exists():
        return FileResponse(dist_index)
    return JSONResponse({"detail": "Not Found"}, status_code=404)
