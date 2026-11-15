"""Serial RAG pipeline: hybrid retrieval → prompt → streaming LLM.

Adds on top of the plain vector pipeline:
  * hybrid recall (vector + BM25) with DashScope rerank;
  * citation-ready sources (numbered snippet + highlight terms + expandable text);
  * answer style: short by default, detailed when the user asks for it;
  * lightweight topic-shift detection so a new topic does not inherit stale history;
  * QA logging (sqlite) with request ids for the feedback endpoint.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import time
import uuid
from collections import OrderedDict
from typing import AsyncIterator

from pp7rag.config import settings
from pp7rag.engine.prompts import build_messages, build_style_instruction
from pp7rag.engine.retriever import get_shared_encoder
from pp7rag.knowledge.revision import KnowledgeRevision
from pp7rag.ragapi import qa_log, retrieval
from pp7rag.ragapi.providers import llm
from pp7rag.ragapi.text_clean import CitationFilter, strip_citations

logger = logging.getLogger(__name__)

MAX_SESSIONS = 500
CACHE_STREAM_CHUNK = 24

DETAIL_TRIGGERS = (
    "详细", "展开", "具体说", "具体讲", "多说", "深入", "讲细", "细说",
    "为什么", "原理", "对比", "区别", "总结", "梳理", "罗列", "一一",
)


def trim_history(history: list[dict]) -> list[dict]:
    """Keep a short, bounded window: last N turns, capped per message and in total.

    Newest messages win: we walk backwards until the character budget is used up,
    so a long previous answer can never crowd out the question right before this one.
    """
    if not history:
        return []
    turns = max(0, settings.rag_history_turns)
    window = history[-turns * 2:] if turns else []
    capped: list[dict] = []
    for item in window:
        content = (item.get("content") or "").strip()
        if not content:
            continue
        if len(content) > settings.rag_history_message_chars:
            content = content[: settings.rag_history_message_chars] + "…"
        capped.append({"role": item.get("role", "user"), "content": content})

    budget = max(200, settings.rag_history_budget_chars)
    total = 0
    kept: list[dict] = []
    for item in reversed(capped):
        size = len(item["content"])
        if kept and total + size > budget:
            break
        kept.append(item)
        total += size
    return list(reversed(kept))


def detect_answer_style(question: str) -> str:
    """'detailed' when the user explicitly asks for depth, otherwise 'short'."""
    text = question or ""
    return "detailed" if any(trigger in text for trigger in DETAIL_TRIGGERS) else "short"




def _normalize_question(question: str) -> str:
    return " ".join(question.split())


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


REFERENCE_MARKERS = (
    "它", "他", "她", "这个", "那个", "该", "其", "上述", "上面", "刚才", "前面",
    "这些", "那些", "此", "后者", "前者", "这样", "那样", "这", "那",
)


async def topic_related(history: list[dict], question: str) -> bool:
    """Is the new question close enough to the previous user turn to keep history?

    Pronoun/short questions ("它现在什么进度？") are the *reason* we keep history and
    are naturally dissimilar to the previous question text, so they always keep it.
    Only self-contained new questions are compared by embedding similarity.
    """
    if not settings.rag_topic_switch_enabled or not history:
        return True
    text = (question or "").strip()
    if len(text) < 8 or any(marker in text for marker in REFERENCE_MARKERS):
        return True
    previous = ""
    for item in reversed(history):
        if item.get("role") == "user":
            previous = (item.get("content") or "").strip()
            break
    if not previous:
        return True
    try:
        encoder = get_shared_encoder()
        vectors = await asyncio.to_thread(encoder.encode, [previous, question])
        similarity = _cosine(list(vectors[0]), list(vectors[1]))
    except Exception as exc:  # never let the heuristic break answering
        logger.warning("topic_similarity_failed: %s", exc)
        return True
    logger.info("topic_similarity=%.3f threshold=%.2f", similarity, settings.rag_topic_switch_threshold)
    return similarity >= settings.rag_topic_switch_threshold


async def prepare_turn(
    question: str,
    history: list[dict],
    top_k: int | None = None,
) -> dict:
    """Shared pre-generation pipeline for both SSE and WS paths."""
    style = detect_answer_style(question)
    history_used = history
    if history and not await topic_related(history, question):
        history_used = []
        logger.info("topic_switch_detected: dropping %d history messages", len(history))

    retrieval_started = time.perf_counter()
    documents, degraded = await retrieval.search(question, top_k=top_k)
    retrieval_ms = int((time.perf_counter() - retrieval_started) * 1000)
    sources = retrieval.build_sources(documents, question)
    return {
        "documents": documents,
        "sources": sources,
        "degraded": degraded,
        "style": style,
        "history_used": history_used,
        "history_dropped": len(history) - len(history_used),
        "retrieval_ms": retrieval_ms,
    }


class AnswerCache:
    """Exact-match question cache (only used for the first turn of a session)."""

    def __init__(self, max_entries: int = 128, ttl: int = 300):
        self._entries: OrderedDict[tuple[str, int], tuple[list[dict], str, float, int]] = OrderedDict()
        self._max_entries = max_entries
        self._ttl = ttl
        self._revision = KnowledgeRevision.value

    def _check_revision(self) -> None:
        if self._revision != KnowledgeRevision.value:
            self._entries.clear()
            self._revision = KnowledgeRevision.value

    def get(self, question: str, top_k: int) -> tuple[list[dict], str, list[str]] | None:
        if not settings.rag_answer_cache_enabled:
            return None
        self._check_revision()
        key = (_normalize_question(question), top_k)
        entry = self._entries.get(key)
        if entry is None:
            return None
        sources, answer, expires, segments = entry
        if expires <= time.monotonic():
            self._entries.pop(key, None)
            return None
        self._entries.move_to_end(key)
        return sources, answer, segments

    def put(
        self,
        question: str,
        top_k: int,
        sources: list[dict],
        answer: str,
        segments: list[str] | None = None,
    ) -> None:
        if not settings.rag_answer_cache_enabled or not answer:
            return
        self._check_revision()
        key = (_normalize_question(question), top_k)
        self._entries[key] = (
            sources,
            answer,
            time.monotonic() + settings.rag_answer_cache_ttl,
            list(segments or []),
        )
        self._entries.move_to_end(key)
        while len(self._entries) > settings.rag_answer_cache_max:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()

    def stats(self) -> dict:
        return {"entries": len(self._entries), "enabled": bool(settings.rag_answer_cache_enabled)}


class RagService:
    """Session-scoped in-memory history + serial retrieval pipeline."""

    def __init__(self, max_sessions: int = MAX_SESSIONS):
        self._histories: OrderedDict[str, list[dict]] = OrderedDict()
        self._max_sessions = max_sessions
        self.cache = AnswerCache(
            max_entries=settings.rag_answer_cache_max,
            ttl=settings.rag_answer_cache_ttl,
        )

    def _history(self, session_id: str) -> list[dict]:
        history = self._histories.get(session_id)
        if not history:
            return []
        self._histories.move_to_end(session_id)
        return list(history)

    def _remember(self, session_id: str, role: str, content: str) -> None:
        if not session_id or not content:
            return
        history = self._histories.setdefault(session_id, [])
        history.append({"role": role, "content": content})
        self._histories.move_to_end(session_id)
        while len(self._histories) > self._max_sessions:
            self._histories.popitem(last=False)

    def reset_session(self, session_id: str) -> None:
        self._histories.pop(session_id, None)

    # Public aliases so the streaming orchestrator can share the same history store.
    def history(self, session_id: str) -> list[dict]:
        return self._history(session_id)

    def remember(self, session_id: str, role: str, content: str) -> None:
        self._remember(session_id, role, content)

    async def ask(
        self,
        question: str,
        session_id: str | None = None,
        top_k: int | None = None,
    ) -> AsyncIterator[tuple[str, dict]]:
        started = time.perf_counter()
        question = (question or "").strip()
        sid = (session_id or "").strip() or uuid.uuid4().hex[:12]
        request_id = uuid.uuid4().hex[:12]
        if not question:
            yield "meta", {"session_id": sid, "request_id": request_id}
            yield "error", {"message": "问题不能为空。"}
            return

        requested_top_k = top_k or settings.rag_top_k
        history = self._history(sid)

        # Fast path: identical first-turn question answered from cache.
        cached = self.cache.get(question, requested_top_k) if not history else None
        yield "meta", {
            "session_id": sid,
            "request_id": request_id,
            "cache_hit": cached is not None,
        }
        if cached is not None:
            cached_sources, cached_answer, _cached_segments = cached
            yield "sources", {"sources": cached_sources, "degraded": False, "cached": True}
            for offset in range(0, len(cached_answer), CACHE_STREAM_CHUNK):
                yield "token", {"text": cached_answer[offset:offset + CACHE_STREAM_CHUNK]}
            total_ms = int((time.perf_counter() - started) * 1000)
            self._remember(sid, "user", question)
            self._remember(sid, "assistant", cached_answer)
            yield "done", {
                "session_id": sid,
                "elapsed_ms": total_ms,
                "answer_chars": len(cached_answer),
                "cache_hit": True,
                "timings_ms": {"retrieval": 0, "llm_ttft": 0, "total": total_ms},
            }
            return

        turn = await prepare_turn(question, history, requested_top_k)
        yield "sources", {
            "sources": turn["sources"],
            "degraded": turn["degraded"],
            "style": turn["style"],
            "history_dropped": turn["history_dropped"],
        }

        messages = build_messages(question, turn["documents"], turn["history_used"], turn["style"])
        parts: list[str] = []
        ttft_ms: int | None = None
        citation_filter = CitationFilter()
        try:
            async for delta in llm.stream_chat(messages):
                if ttft_ms is None:
                    ttft_ms = int((time.perf_counter() - started) * 1000)
                clean = citation_filter.feed(delta)
                if clean:
                    parts.append(clean)
                    yield "token", {"text": clean}
            tail = citation_filter.flush()
            if tail:
                parts.append(tail)
                yield "token", {"text": tail}
        except llm.LLMError as exc:
            logger.warning("rag_api_llm_failed: %s", exc)
            yield "error", {"message": str(exc)}
            return

        answer = strip_citations("".join(parts)).strip()
        if not answer:
            # 模型没有返回任何正文（常见于冷启动超时/被上游中断）：让前端显示错误而不是「空回答」。
            logger.warning("rag_api_empty_answer request_id=%s", request_id)
            yield "error", {"message": "模型这次没有返回内容，请再问一次。"}
            return
        if not turn["history_used"]:
            self.cache.put(question, requested_top_k, turn["sources"], answer)
        self._remember(sid, "user", question)
        self._remember(sid, "assistant", answer)
        total_ms = int((time.perf_counter() - started) * 1000)
        timings = {
            "retrieval": turn["retrieval_ms"],
            "llm_ttft": ttft_ms if ttft_ms is not None else total_ms,
            "total": total_ms,
        }
        await qa_log.log_turn(
            request_id=request_id,
            session_id=sid,
            question=question,
            answer=answer,
            sources=turn["sources"],
            timings=timings,
            model=settings.llm_model,
            cache_hit=False,
            style=turn["style"],
            history_messages=len(turn["history_used"]),
        )
        citations: list[int] = []  # references are no longer shown to users
        yield "done", {
            "session_id": sid,
            "request_id": request_id,
            "elapsed_ms": total_ms,
            "answer_chars": len(answer),
            "style": turn["style"],
            "citations": citations,
            "cache_hit": False,
            "timings_ms": timings,
        }


def _citations_in(answer: str, source_count: int) -> list[int]:
    """Citation numbers the model used ([1], [2] ...), filtered to valid sources."""
    import re

    used: list[int] = []
    for match in re.finditer(r"\[(\d{1,2})\]", answer or ""):
        index = int(match.group(1))
        if 1 <= index <= source_count and index not in used:
            used.append(index)
    return used


rag_service = RagService()
