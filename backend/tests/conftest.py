"""测试用临时数据库：不污染 backend/data/app.db。"""
from __future__ import annotations

import os
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
TMP_DIR = TESTS_DIR / "_tmp"
TMP_DIR.mkdir(exist_ok=True)
DB_FILE = TMP_DIR / "test_app.db"
if DB_FILE.exists():
    DB_FILE.unlink()
os.environ["APP_DB_PATH"] = str(DB_FILE)

sys.path.insert(0, str(TESTS_DIR.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
