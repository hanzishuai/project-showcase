"""Streaming answer orchestrator: hybrid retrieval -> LLM -> segments -> TTS -> PCM.

One connection carries JSON events (text) and binary PCM frames (audio), so the
client never round-trips per sentence and the server can start synthesizing the
moment a short fragment is complete.

Protocol (docs/rag-stream-protocol.md):

  client -> server JSON
    {"type":"ask","question":..,"session_id":..,"top_k":3,"voice":"Cherry","speed":1.0}
    {"type":"abort"}  {"type":"ping"}
  server -> client JSON
    {"type":"meta", session_id, request_id, cache_hit, history_messages, history_chars, style}
    {"type":"sources", sources:[{citation,title,snippet,text,terms,score}], degraded, style, history_dropped}
    {"type":"token","text":...}
    {"type":"segment","index":n,"text":...} {"type":"segment_end","index":n}
    {"type":"text_done",...} {"type":"done",...,citations:[...]} {"type":"error","message":...}
  server -> client binary: raw PCM s16le, 24 kHz mono, in segment order
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from typing import Any, AsyncIterator

from pp7rag.config import settings
from pp7rag.ragapi import qa_log
from pp7rag.ragapi.providers import llm, tts
from pp7rag.ragapi.segmenter import Segmenter
from pp7rag.ragapi.service import (
    CACHE_STREAM_CHUNK,
    build_messages,
    prepare_turn,
    rag_service,
    trim_history,
)
from pp7rag.ragapi.text_clean import CitationFilter, strip_citations

logger = logging.getLogger(__name__)

_END = object()
_CHUNK_QUEUE_MAX = 96  # ~3 MB of 24 kHz PCM queued per segment ahead of playback
_CITATION_RE = re.compile(r"\[(\d{1,2})\]")


def _citations_in(answer: str, source_count: int) -> list[int]:
    """Citation numbers the model actually used, filtered to valid sources."""
    used: list[int] = []
    for match in _CITATION_RE.finditer(answer or ""):
        index = int(match.group(1))
        if 1 <= index <= source_count and index not in used:
            used.append(index)
    return used


class RagStreamSession:
    """One ask() call, multiplexing text events and PCM audio chunks."""

    def __init__(self) -> None:
        self.out: asyncio.Queue[Any] = asyncio.Queue(maxsize=512)
        self.seg_q: asyncio.Queue[int | None] = asyncio.Queue()
        self.audio_q: dict[int, asyncio.Queue[bytes | None]] = {}
        self._tts_sem = asyncio.Semaphore(max(1, settings.rag_tts_concurrency))
        self._tts_tasks: list[asyncio.Task] = []
        self._started = time.perf_counter()
        self._first_audio_ms: int | None = None
        self._first_segment_ms: int | None = None
        self._tts_first_chunk_ms: int | None = None
        self._segments = 0
        self._segment_texts: list[str] = []
        self._voice: str | None = None
        self._speed: float | None = None
        self._history_msgs = 0

    # -- helpers -----------------------------------------------------------
    def _ms(self) -> int:
        return int((time.perf_counter() - self._started) * 1000)

    async def _emit(self, kind: str, payload: Any) -> None:
        await self.out.put((kind, payload))

    async def _event(self, event: dict) -> None:
        await self._emit("event", event)

    def _timings(self, retrieval_ms: int, ttft_ms: int | None, total_ms: int | None = None,
                 extra: dict | None = None) -> dict:
        timings = {
            "retrieval": retrieval_ms,
            "llm_ttft": ttft_ms if ttft_ms is not None else -1,
            "first_segment": self._first_segment_ms if self._first_segment_ms is not None else -1,
            "first_audio": self._first_audio_ms if self._first_audio_ms is not None else -1,
            "tts_first_chunk": self._tts_first_chunk_ms if self._tts_first_chunk_ms is not None else -1,
            "history_messages": self._history_msgs,
            "total": total_ms if total_ms is not None else self._ms(),
            "segments": self._segments,
        }
        if extra:
            timings.update(extra)
        return timings

    # -- stages ------------------------------------------------------------
    def _spawn_tts(self, index: int, text: str) -> None:
        queue: asyncio.Queue[bytes | None] = asyncio.Queue(maxsize=_CHUNK_QUEUE_MAX)
        self.audio_q[index] = queue

        async def produce() -> None:
            try:
                async with self._tts_sem:
                    async for chunk in tts.synthesize_stream(text, self._voice, self._speed):
                        if self._tts_first_chunk_ms is None:
                            self._tts_first_chunk_ms = self._ms()
                        await queue.put(chunk)
            except Exception as exc:
                logger.warning("tts_segment_failed index=%d: %s", index, exc)
            finally:
                await queue.put(None)

        self._tts_tasks.append(asyncio.create_task(produce()))

    async def _publish_segment(self, text: str) -> None:
        index = self._segments
        self._segments += 1
        self._segment_texts.append(text)
        if self._first_segment_ms is None:
            self._first_segment_ms = self._ms()
        await self._event({"type": "segment", "index": index, "text": text})
        self._spawn_tts(index, text)
        await self.seg_q.put(index)

    async def _audio_stage(self) -> None:
        while True:
            index = await self.seg_q.get()
            if index is None:
                return
            queue = self.audio_q.get(index)
            if queue is None:
                continue
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                if self._first_audio_ms is None:
                    self._first_audio_ms = self._ms()
                await self._emit("audio", chunk)
            await self._event({"type": "segment_end", "index": index})

    async def _answer_stage(
        self,
        *,
        question: str,
        turn: dict,
        sid: str,
        request_id: str,
        started: float,
    ) -> None:
        history = turn["history_used"]
        self._history_msgs = len(history)
        style = turn["style"]
        await self._event({
            "type": "sources",
            "sources": turn["sources"],
            "degraded": turn["degraded"],
            "style": style,
            "history_dropped": turn["history_dropped"],
            "cached": False,
        })

        messages = build_messages(question, turn["documents"], history, style)
        segmenter = Segmenter(
            max_chars=settings.rag_segment_max_chars,
            first_min_chars=settings.rag_segment_first_min_chars,
            first_max_chars=settings.rag_segment_first_max_chars,
            soft_min_chars=settings.rag_segment_soft_min_chars,
        )
        parts: list[str] = []
        ttft_ms: int | None = None
        citation_filter = CitationFilter()
        try:
            async for delta in llm.stream_chat(messages):
                if ttft_ms is None:
                    ttft_ms = self._ms()
                clean = citation_filter.feed(delta)
                if not clean:
                    continue
                parts.append(clean)
                await self._event({"type": "token", "text": clean})
                for segment in segmenter.feed(clean):
                    await self._publish_segment(segment)
            tail = citation_filter.flush()
            if tail:
                parts.append(tail)
                await self._event({"type": "token", "text": tail})
                for segment in segmenter.feed(tail):
                    await self._publish_segment(segment)
            for segment in segmenter.flush():
                await self._publish_segment(segment)
        except llm.LLMError as exc:
            logger.warning("rag_stream_llm_failed: %s", exc)
            await self._event({"type": "error", "message": str(exc)})
            await self.seg_q.put(None)
            return

        answer = strip_citations("".join(parts)).strip()
        citations: list[int] = []  # references are no longer shown to users
        if not history:
            rag_service.cache.put(question, settings.rag_top_k, turn["sources"], answer, self._segment_texts)
        rag_service.remember(sid, "user", question)
        rag_service.remember(sid, "assistant", answer)
        await self.seg_q.put(None)
        self._answer = answer
        self._citations = citations
        self._retrieval_ms = turn["retrieval_ms"]
        self._ttft_ms = ttft_ms
        self._style = style
        timings = self._timings(turn["retrieval_ms"], ttft_ms)
        await self._event({
            "type": "text_done",
            "session_id": sid,
            "answer_chars": len(answer),
            "style": style,
            "citations": citations,
            "cache_hit": False,
            "timings_ms": timings,
        })
        await qa_log.log_turn(
            request_id=request_id,
            session_id=sid,
            question=question,
            answer=answer,
            sources=turn["sources"],
            timings=timings,
            model=settings.llm_model,
            cache_hit=False,
            style=style,
            history_messages=len(history),
        )

    async def _cached_stage(
        self,
        question: str,
        sid: str,
        sources: list[dict],
        answer: str,
        segments: list[str] | None = None,
        *,
        request_id: str,
        style: str = "short",
    ) -> None:
        await self._event({"type": "sources", "sources": sources, "degraded": False,
                           "style": style, "history_dropped": 0, "cached": True})
        for offset in range(0, len(answer), CACHE_STREAM_CHUNK):
            await self._event({"type": "token", "text": answer[offset:offset + CACHE_STREAM_CHUNK]})
        if segments:
            for segment in segments:
                await self._publish_segment(segment)
        else:
            segmenter = Segmenter(
                max_chars=settings.rag_segment_max_chars,
                first_min_chars=settings.rag_segment_first_min_chars,
                first_max_chars=settings.rag_segment_first_max_chars,
                soft_min_chars=settings.rag_segment_soft_min_chars,
            )
            for segment in segmenter.feed(answer) + segmenter.flush():
                await self._publish_segment(segment)
        await self.seg_q.put(None)
        rag_service.remember(sid, "user", question)
        rag_service.remember(sid, "assistant", answer)
        self._answer = answer
        self._citations = []
        self._retrieval_ms = 0
        self._ttft_ms = 0
        self._style = style
        await self._event({
            "type": "text_done",
            "session_id": sid,
            "answer_chars": len(answer),
            "style": style,
            "citations": self._citations,
            "cache_hit": True,
            "timings_ms": self._timings(0, 0),
        })
        await qa_log.log_turn(
            request_id=request_id, session_id=sid, question=question, answer=answer,
            sources=sources, timings={"retrieval": 0, "llm_ttft": 0, "total": self._ms()},
            model=settings.llm_model, cache_hit=True, style=style, history_messages=0,
        )

    # -- producer ----------------------------------------------------------
    async def _produce(
        self,
        *,
        question: str,
        sid: str,
        history: list[dict],
        top_k: int,
        request_id: str,
        started: float,
    ) -> None:
        audio_task: asyncio.Task | None = None
        try:
            cached = rag_service.cache.get(question, top_k) if not history else None
            turn = None
            style = "short"
            if cached is not None:
                style = "short"
            else:
                turn = await prepare_turn(question, history, top_k)
                style = turn["style"]
            used_history = trim_history(turn["history_used"]) if turn is not None else trim_history(history)
            await self._event({
                "type": "meta",
                "session_id": sid,
                "request_id": request_id,
                "cache_hit": cached is not None,
                "style": style,
                "history_messages": len(used_history),
                "history_chars": sum(len(item["content"]) for item in used_history),
                "history_dropped": turn["history_dropped"] if turn is not None else 0,
            })
            audio_task = asyncio.create_task(self._audio_stage())

            if cached is not None:
                cached_sources, cached_answer, cached_segments = cached
                await self._cached_stage(
                    question, sid, cached_sources, cached_answer, cached_segments,
                    request_id=request_id, style=style,
                )
            else:
                assert turn is not None
                await self._answer_stage(question=question, turn=turn, sid=sid,
                                         request_id=request_id, started=started)
            if audio_task is not None:
                await audio_task
            if hasattr(self, "_answer"):
                timings = self._timings(
                    getattr(self, "_retrieval_ms", 0),
                    getattr(self, "_ttft_ms", None),
                )
                await self._event({
                    "type": "done",
                    "session_id": sid,
                    "request_id": request_id,
                    "answer_chars": len(self._answer),
                    "style": getattr(self, "_style", "short"),
                    "citations": getattr(self, "_citations", []),
                    "cache_hit": cached is not None,
                    "timings_ms": timings,
                })
                logger.info("rag_stream_done %s", timings)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("rag_stream_failed")
            await self._event({"type": "error", "message": "回答生成失败，请稍后重试。"})
        finally:
            if audio_task is not None and not audio_task.done():
                audio_task.cancel()
            for task in self._tts_tasks:
                if not task.done():
                    task.cancel()
            await self.out.put(_END)

    # -- public ------------------------------------------------------------
    async def run(
        self,
        *,
        question: str,
        session_id: str | None = None,
        top_k: int | None = None,
        voice: str | None = None,
        speed: float | None = None,
    ) -> AsyncIterator[tuple[str, Any]]:
        question = (question or "").strip()
        sid = (session_id or "").strip() or uuid.uuid4().hex[:12]
        request_id = uuid.uuid4().hex[:12]
        self._voice = (voice or "").strip() or None
        try:
            self._speed = float(speed) if speed is not None else None
        except (TypeError, ValueError):
            self._speed = None
        if self._speed is not None:
            self._speed = min(max(self._speed, 0.5), 2.0)
        if not question:
            yield "event", {"type": "meta", "session_id": sid, "request_id": request_id}
            yield "event", {"type": "error", "message": "问题不能为空。"}
            return

        history = rag_service.history(sid)
        producer = asyncio.create_task(
            self._produce(
                question=question,
                sid=sid,
                history=history,
                top_k=top_k or settings.rag_top_k,
                request_id=request_id,
                started=self._started,
            )
        )
        try:
            while True:
                item = await self.out.get()
                if item is _END:
                    break
                yield item
        finally:
            if not producer.done():
                producer.cancel()
