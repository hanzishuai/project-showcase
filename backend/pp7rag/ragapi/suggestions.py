"""Dynamic suggested questions generated from the current knowledge base."""
from __future__ import annotations

import asyncio
import logging
import time

from pp7rag.config import settings
from pp7rag.engine.prompts import SUGGESTIONS_SYSTEM_PROMPT, build_suggestions_prompt
from pp7rag.engine.retriever import retriever
from pp7rag.knowledge.revision import KnowledgeRevision
from pp7rag.ragapi.providers import llm

logger = logging.getLogger(__name__)

FALLBACK = ["平台上有哪些项目？", "介绍一下平台上的项目", "这个平台现在能用了么？"]

_cache: dict = {"revision": -1, "expires": 0.0, "items": []}
_lock = asyncio.Lock()

def _build_context(rows: list[dict]) -> str:
    lines = []
    for row in rows[:12]:
        meta = row.get("metadata") or {}
        title = (meta.get("title") if isinstance(meta, dict) else "") or ""
        text = (row.get("text") or "").strip().replace("\n", " ")[:120]
        lines.append(f"- 标题：{title or '未命名'}；内容：{text}")
    return "\n".join(lines) or "- 暂无资料"


async def _generate(limit: int) -> list[str]:
    rows = await retriever.all_documents()
    messages = [
        {"role": "system", "content": SUGGESTIONS_SYSTEM_PROMPT},
        {"role": "user", "content": build_suggestions_prompt(_build_context(rows), limit)},
    ]
    parts: list[str] = []
    async for delta in llm.stream_chat(messages, max_tokens=200, temperature=0.7):
        parts.append(delta)
    lines = [line.strip(" -·\t") for line in "".join(parts).splitlines()]
    questions = [line for line in lines if 4 <= len(line) <= 30 and not line.startswith(("1", "2", "3", "#"))]
    return questions[:limit]


async def get_suggestions(limit: int = 3) -> dict:
    """Cached per knowledge revision (TTL configurable)."""
    if not settings.rag_suggestions_enabled:
        return {"suggestions": FALLBACK[:limit], "source": "fallback"}
    now = time.monotonic()
    revision = KnowledgeRevision.value
    if _cache["revision"] == revision and _cache["expires"] > now and _cache["items"]:
        return {"suggestions": _cache["items"][:limit], "source": "cache", "revision": revision}
    async with _lock:
        if _cache["revision"] == revision and _cache["expires"] > now and _cache["items"]:
            return {"suggestions": _cache["items"][:limit], "source": "cache", "revision": revision}
        try:
            items = await _generate(limit)
        except Exception as exc:
            logger.warning("suggestions_failed: %s", exc)
            return {"suggestions": FALLBACK[:limit], "source": "fallback", "revision": revision}
        if not items:
            items = FALLBACK[:limit]
        _cache.update(revision=revision, expires=now + settings.rag_suggestions_ttl, items=items)
        return {"suggestions": items, "source": "llm", "revision": revision}
