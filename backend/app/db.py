"""数据库连接与会话管理。"""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI 依赖：请求级会话。"""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _ensure_columns() -> None:
    """为已有 SQLite 库补列，避免 create_all 不迁移旧表。"""
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "developers" not in columns or "advisor" not in columns:
        with engine.begin() as connection:
            if "developers" not in columns:
                connection.execute(
                    text("ALTER TABLE projects ADD COLUMN developers JSON NOT NULL DEFAULT '[]'")
                )
            if "advisor" not in columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN advisor VARCHAR(200)"))


def init_db() -> None:
    from . import models  # noqa: F401  确保模型已注册

    Base.metadata.create_all(bind=engine)
    _ensure_columns()
