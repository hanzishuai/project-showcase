"""FastAPI 入口：API + 静态前端托管。"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import APP_TITLE, APP_VERSION, CORS_ORIGINS, FRONTEND_DIST, REPO_ROOT
from .db import SessionLocal, init_db
from .admin_compat import router as admin_router
from .agent import router as agent_router
from pp7rag.ragapi.routes import router as rag_router

logger = logging.getLogger(__name__)
from .routers.api import router as api_router
from .seed import seed_if_empty


async def _warmup_rag() -> None:
    """预热数字人后端：嵌入模型 + LLM/TTS/HTTP 连接，避免重启后第一次提问冷启动失败。"""
    try:
        from pp7rag.engine.retriever import get_shared_encoder

        await asyncio.to_thread(get_shared_encoder)
        logger.info("rag_warmup_encoder_ready")
    except Exception as exc:  # 预热失败不影响服务启动
        logger.warning("rag_warmup_encoder_failed: %s", exc)
    try:
        from pp7rag.ragapi.providers import http as rag_http
        from pp7rag.ragapi.providers import llm, tts

        await asyncio.gather(llm.warmup(), rag_http.warmup(), tts.warmup(), return_exceptions=True)
        logger.info("rag_warmup_providers_ready")
    except Exception as exc:
        logger.warning("rag_warmup_providers_failed: %s", exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    with SessionLocal() as session:
        seed_if_empty(session)
    warmup_task = asyncio.create_task(_warmup_rag())
    try:
        yield
    finally:
        warmup_task.cancel()


app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
# 数字人：RAG 问答 + TTS/ASR + 知识库管理（移植自 pp7，前缀 /api/v1/rag）
app.include_router(rag_router)
# 管理后台：会话/统计（映射到 RAG 的 SQLite 问答日志）
app.include_router(admin_router)
# 实验：语义操作界面的 Agent（白名单动作 + LLM function calling）
app.include_router(agent_router)

MEDIA_DIR = REPO_ROOT / "assets" / "images"
if MEDIA_DIR.exists():
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

if FRONTEND_DIST.exists():
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


@app.get("/{full_path:path}", include_in_schema=False)
def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "media/", "assets/")):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    dist_index = FRONTEND_DIST / "index.html"
    if dist_index.exists():
        return FileResponse(dist_index)
    return JSONResponse({"detail": "Not Found"}, status_code=404)
