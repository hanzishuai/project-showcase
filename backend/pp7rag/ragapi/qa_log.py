"""QA log in sqlite: every answered turn + user feedback.

No external dependency (sqlite3 from the stdlib). Writes happen in a worker thread
so logging never delays a streamed answer.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
from pathlib import Path

from pp7rag.config import settings

logger = logging.getLogger(__name__)

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
CREATE INDEX IF NOT EXISTS idx_qa_ts ON qa_log(ts);
CREATE INDEX IF NOT EXISTS idx_qa_vote ON qa_log(vote);
"""

_lock = asyncio.Lock()


def log_path() -> Path:
    return Path(settings.rag_qa_log_path)


def _connect() -> sqlite3.Connection:
    path = log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(_SCHEMA)
    return conn


def _log_sync(record: dict) -> None:
    conn = _connect()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO qa_log
               (ts, request_id, session_id, question, answer, sources, timings, model,
                cache_hit, style, history_messages)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                time.time(),
                record["request_id"],
                record.get("session_id"),
                record.get("question"),
                record.get("answer"),
                json.dumps(record.get("sources") or [], ensure_ascii=False),
                json.dumps(record.get("timings") or {}, ensure_ascii=False),
                record.get("model"),
                1 if record.get("cache_hit") else 0,
                record.get("style"),
                int(record.get("history_messages") or 0),
            ),
        )
        conn.commit()
    finally:
        conn.close()


async def log_turn(
    *,
    request_id: str,
    session_id: str,
    question: str,
    answer: str,
    sources: list[dict],
    timings: dict,
    model: str,
    cache_hit: bool = False,
    style: str = "short",
    history_messages: int = 0,
) -> None:
    if not settings.rag_qa_log_enabled or not request_id:
        return
    record = {
        "request_id": request_id,
        "session_id": session_id,
        "question": question,
        "answer": answer,
        "sources": sources,
        "timings": timings,
        "model": model,
        "cache_hit": cache_hit,
        "style": style,
        "history_messages": history_messages,
    }
    try:
        async with _lock:
            await asyncio.to_thread(_log_sync, record)
    except Exception as exc:  # logging must never break answering
        logger.warning("qa_log_failed: %s", exc)


def _feedback_sync(request_id: str, vote: str, comment: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute(
            "UPDATE qa_log SET vote = ?, comment = ? WHERE request_id = ?",
            (vote, comment, request_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


async def set_feedback(request_id: str, vote: str, comment: str = "") -> bool:
    async with _lock:
        return await asyncio.to_thread(_feedback_sync, request_id, vote, comment)


def _recent_sync(limit: int, vote: str | None = None) -> list[dict]:
    conn = _connect()
    try:
        if vote:
            rows = conn.execute(
                "SELECT request_id, ts, question, substr(answer, 1, 300), vote, comment, model "
                "FROM qa_log WHERE vote = ? ORDER BY ts DESC LIMIT ?",
                (vote, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT request_id, ts, question, substr(answer, 1, 300), vote, comment, model "
                "FROM qa_log ORDER BY ts DESC LIMIT ?",
                (limit,),
            ).fetchall()
    finally:
        conn.close()
    return [
        {
            "request_id": row[0],
            "ts": row[1],
            "question": row[2],
            "answer": row[3],
            "vote": row[4],
            "comment": row[5],
            "model": row[6],
        }
        for row in rows
    ]


async def recent(limit: int = 20, vote: str | None = None) -> list[dict]:
    return await asyncio.to_thread(_recent_sync, limit, vote)


def _stats_sync() -> dict:
    conn = _connect()
    try:
        total = conn.execute("SELECT COUNT(*) FROM qa_log").fetchone()[0]
        up = conn.execute("SELECT COUNT(*) FROM qa_log WHERE vote = 'up'").fetchone()[0]
        down = conn.execute("SELECT COUNT(*) FROM qa_log WHERE vote = 'down'").fetchone()[0]
        avg = conn.execute("SELECT AVG(json_extract(timings, '$.llm_ttft')) FROM qa_log").fetchone()[0]
    finally:
        conn.close()
    return {"total": total, "up": up, "down": down, "avg_llm_ttft_ms": round(avg or 0, 1)}


async def stats() -> dict:
    return await asyncio.to_thread(_stats_sync)
