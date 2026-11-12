"""应用配置：全部可用环境变量覆盖，默认值面向本机离线运行。"""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
DATA_SEED = REPO_ROOT / "data" / "projects.json"


def _load_dotenv(path: Path) -> None:
    """极简 .env 读取：只补齐尚未设置的环境变量，不覆盖已有值，不引入额外依赖。"""
    if not path.exists():
        return
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key:
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))


# 语音密钥等本地配置放 backend/.env（已在 .gitignore 中忽略，不入库）
_load_dotenv(BACKEND_DIR / ".env")


def _sqlite_url() -> str:
    db_path = Path(os.environ.get("APP_DB_PATH", BACKEND_DIR / "data" / "app.db"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return "sqlite:///" + db_path.as_posix()


DATABASE_URL = os.environ.get("DATABASE_URL", _sqlite_url())
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
APP_TITLE = "项目实践聚合平台 API"
APP_VERSION = "1.0.0"


# 语音（TTS / ASR）与 RAG 问答由 pp7rag 包提供，配置见 backend/.env 与 pp7rag/config.py
