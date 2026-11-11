"""应用配置：全部可用环境变量覆盖，默认值面向本机离线运行。"""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"
DATA_SEED = REPO_ROOT / "data" / "projects.json"


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
