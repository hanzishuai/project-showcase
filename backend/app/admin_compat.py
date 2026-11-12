"""管理后台兼容接口（/api/admin）。

PP7 原实现把会话存在 MySQL 里；本项目的问答日志已经是 SQLite（pp7rag.ragapi.qa_log），
这里把管理后台需要的会话/统计接口映射到同一份日志上，不引入 MySQL / Redis。

返回结构与 PP7 前端（frontend/src/admin）保持一致：
- GET  /api/admin/stats                       -> {total_sessions, total_documents, recent_sessions}
- GET  /api/admin/sessions?limit&offset       -> {data, total}
- GET  /api/admin/sessions/search?q           -> {data, total}
- GET  /api/admin/sessions/{sid}/messages     -> {data}
- DELETE /api/admin/sessions/{sid}            -> {status}
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from pp7rag.config import settings

router = APIRouter(prefix="/api/admin", tags=["admin"])

_SCHEMA = """
CREATE TABLE IF NOT EXISTS qa_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    request_id TEXT UNIQUE NOT NULL,
    session_id TEXT,
    question TEXT,
    answer TEXT,
    sources TEXT,
    timings TEXT,
    model TEXT,
    cache_hit INTEGER DEFAULT 0,
    style TEXT,
    history_messages INTEGER DEFAULT 0,
    vote TEXT,
    comment TEXT
);
"""


def _connect() -> sqlite3.Connection:
    path = Path(settings.rag_qa_log_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn


def _iso(ts: float | None) -> str:
    if not ts:
        return "-"
    return datetime.fromtimestamp(float(ts)).isoformat(timespec="seconds")


def _docs_count() -> int:
    docs_dir = Path(settings.data_dir) / "docs"
    if not docs_dir.exists():
        return 0
    return len(list(docs_dir.glob("*.md")))


def _session_rows(limit: int, offset: int, keyword: str | None = None) -> tuple[list[dict], int]:
    conn = _connect()
    try:
        where = "session_id IS NOT NULL AND session_id <> ''"
        params: list = []
        if keyword:
            where += " AND (question LIKE ? OR answer LIKE ?)"
            like = f"%{keyword}%"
            params.extend([like, like])

        total_row = conn.execute(
            f"SELECT COUNT(DISTINCT session_id) AS n FROM qa_log WHERE {where}", params
        ).fetchone()
        total = int(total_row["n"] if total_row else 0)

        rows = conn.execute(
            f"""
            SELECT session_id,
                   MIN(ts) AS started,
                   MAX(ts) AS updated,
                   COUNT(*) AS turns,
                   SUM(CASE WHEN vote IS NOT NULL THEN 1 ELSE 0 END) AS votes
            FROM qa_log
            WHERE {where}
            GROUP BY session_id
            ORDER BY started DESC
            LIMIT ? OFFSET ?
            """,
            [*params, limit, offset],
        ).fetchall()

        sessions: list[dict] = []
        for row in rows:
            first = conn.execute(
                "SELECT question, answer FROM qa_log WHERE session_id = ? ORDER BY ts ASC LIMIT 1",
                (row["session_id"],),
            ).fetchone()
            preview = (first["question"] if first and first["question"] else "") or "（无提问）"
            sessions.append(
                {
                    "id": row["session_id"],
                    "user_name": "",
                    "user_id": "",
                    "preview": preview[:80],
                    "message_count": int(row["turns"]) * 2,
                    "status": "normal",
                    "created_at": _iso(row["started"]),
                    "updated_at": _iso(row["updated"]),
                }
            )
        return sessions, total
    finally:
        conn.close()


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)
) -> dict:
    data, total = _session_rows(limit, offset)
    return {"data": data, "total": total}


@router.get("/sessions/search")
async def search_sessions(q: str = Query(...)) -> dict:
    data, total = _session_rows(100, 0, keyword=q.strip() or None)
    return {"data": data, "total": total}


@router.get("/sessions/{session_id}/messages")
async def session_messages(session_id: str) -> dict:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT request_id, ts, question, answer FROM qa_log "
            "WHERE session_id = ? ORDER BY ts ASC",
            (session_id,),
        ).fetchall()
    finally:
        conn.close()

    messages: list[dict] = []
    for row in rows:
        stamp = _iso(row["ts"])
        if row["question"]:
            messages.append(
                {
                    "id": f"{row['request_id']}-q",
                    "role": "user",
                    "content": row["question"],
                    "created_at": stamp,
                    "status": "normal",
                }
            )
        if row["answer"]:
            messages.append(
                {
                    "id": f"{row['request_id']}-a",
                    "role": "assistant",
                    "content": row["answer"],
                    "created_at": stamp,
                    "status": "normal",
                }
            )
    return {"data": messages}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> dict:
    conn = _connect()
    try:
        conn.execute("DELETE FROM qa_log WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()
    return {"status": "deleted"}


@router.get("/stats")
async def stats() -> dict:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT COUNT(DISTINCT session_id) AS n, COUNT(*) AS turns FROM qa_log "
            "WHERE session_id IS NOT NULL AND session_id <> ''"
        ).fetchone()
    finally:
        conn.close()
    recent, _ = _session_rows(5, 0)
    return {
        "total_sessions": int(row["n"] if row else 0),
        "total_turns": int(row["turns"] if row else 0),
        "total_documents": _docs_count(),
        "recent_sessions": recent,
    }
