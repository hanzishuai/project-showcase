"""HTTP surface for the embeddable RAG API (/api/v1/rag)."""
from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from pp7rag.engine.prompts import PROMPT_VERSION
from pp7rag.engine.retriever import retriever
from pp7rag.ragapi import knowledge_import, qa_log, suggestions
from pp7rag.ragapi.orchestrator import RagStreamSession
from pp7rag.ragapi.providers import asr, llm, tts
from pp7rag.ragapi.service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

MAX_AUDIO_BYTES = 20 * 1024 * 1024

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=64)
    top_k: int | None = Field(default=None, ge=1, le=10)


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    voice: str | None = Field(default=None, max_length=64)
    speed: float | None = Field(default=None, ge=0.5, le=2.0)


class FeedbackRequest(BaseModel):
    request_id: str = Field(..., min_length=1, max_length=64)
    vote: str = Field(..., pattern="^(up|down)$")
    comment: str = Field(default="", max_length=500)


class CommitRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    markdown: str = Field(..., min_length=1, max_length=2_000_000)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# Q&A
# ---------------------------------------------------------------------------


@router.post("/ask")
async def ask(request: AskRequest) -> StreamingResponse:
    """Answer a question with retrieval-augmented streaming text (SSE)."""

    async def event_stream():
        try:
            async for event, data in rag_service.ask(
                request.question, session_id=request.session_id, top_k=request.top_k
            ):
                yield _sse(event, data)
        except Exception:  # never leave the SSE client hanging on an unhandled error
            logger.exception("rag_api_stream_failed")
            yield _sse("error", {"message": "回答生成失败，请稍后重试。"})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/suggestions")
async def suggested_questions(limit: int = 3) -> dict:
    """Questions generated from the current knowledge base (cached per revision)."""
    return await suggestions.get_suggestions(limit=min(max(limit, 1), 6))


@router.post("/feedback")
async def feedback(request: FeedbackRequest) -> dict:
    """Attach 👍/👎 to a logged turn; used to build a bad-case pool."""
    updated = await qa_log.set_feedback(request.request_id, request.vote, request.comment)
    return {"ok": updated}


@router.get("/qa/stats")
async def qa_stats() -> dict:
    return await qa_log.stats()


@router.get("/qa/recent")
async def qa_recent(limit: int = 20, vote: str | None = None) -> dict:
    return {"items": await qa_log.recent(limit=min(max(limit, 1), 100), vote=vote)}


# ---------------------------------------------------------------------------
# Speech
# ---------------------------------------------------------------------------


@router.post("/asr")
async def asr_endpoint(file: UploadFile = File(...)) -> dict:
    """Transcribe one WAV clip (16 kHz mono 16-bit PCM) into text."""
    if not asr.is_configured():
        raise HTTPException(status_code=503, detail="语音识别未配置。")
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="音频内容为空。")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="音频文件过大。")
    try:
        text = await asr.transcribe(audio)
    except asr.ASRError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"text": text}


@router.post("/tts")
async def tts_endpoint(request: TtsRequest) -> Response:
    """Synthesize one sentence into a 24 kHz mono 16-bit WAV file."""
    if not tts.is_configured():
        raise HTTPException(status_code=503, detail="语音合成未配置。")
    try:
        audio = await tts.synthesize(request.text, request.voice, request.speed)
    except tts.TTSError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@router.post("/tts/stream")
async def tts_stream_endpoint(request: TtsRequest) -> StreamingResponse:
    """Stream raw PCM chunks (24 kHz mono 16-bit little-endian) while synthesizing."""
    if not tts.is_configured():
        raise HTTPException(status_code=503, detail="语音合成未配置。")

    async def pcm_stream():
        try:
            async for chunk in tts.synthesize_stream(request.text, request.voice, request.speed):
                yield chunk
        except tts.TTSError:
            logger.warning("tts_stream_failed")
        except Exception:  # pragma: no cover - defensive
            logger.exception("tts_stream_unexpected_error")

    return StreamingResponse(
        pcm_stream(),
        media_type="audio/L16",
        headers={
            "X-Sample-Rate": str(tts.SAMPLE_RATE),
            "X-Channels": str(tts.CHANNELS),
            "X-Bits-Per-Sample": str(tts.BITS_PER_SAMPLE),
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/health")
async def health() -> dict:
    """Capability probe used by embedding frontends before showing features."""
    try:
        chroma_ok = await retriever.healthy()
    except Exception:
        chroma_ok = False
    return {
        "status": "ok" if chroma_ok else "degraded",
        "llm": llm.is_configured(),
        "chroma": chroma_ok,
        "asr": asr.is_configured(),
        "tts": tts.is_configured(),
        "hybrid": True,
        "qa_log": bool(qa_log.log_path()),
        "prompt_version": PROMPT_VERSION,
    }


# ---------------------------------------------------------------------------
# Knowledge base management (upload -> preview -> commit)
# ---------------------------------------------------------------------------


@router.post("/knowledge/preview")
async def knowledge_preview(file: UploadFile = File(...)) -> dict:
    """Parse a docx/pdf/md upload and return chunk preview without touching the index."""
    from urllib.parse import unquote

    data = await file.read()
    filename = unquote(file.filename or "upload")
    try:
        return await asyncio.to_thread(knowledge_import.preview, filename, data)
    except knowledge_import.ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("knowledge_preview_failed")
        raise HTTPException(status_code=500, detail="解析失败，请检查文件格式。") from exc


@router.post("/knowledge/commit")
async def knowledge_commit(request: CommitRequest) -> dict:
    """Write the confirmed markdown into docs/ and rebuild the index."""
    try:
        result = await asyncio.to_thread(knowledge_import.commit, request.filename, request.markdown)
    except Exception as exc:
        logger.exception("knowledge_commit_failed")
        raise HTTPException(status_code=500, detail=f"入库失败：{exc}") from exc
    return {"status": "committed", **result}


@router.post("/knowledge/rebuild")
async def knowledge_rebuild() -> dict:
    return await asyncio.to_thread(knowledge_import.rebuild)


@router.get("/knowledge/documents")
async def knowledge_documents() -> dict:
    return {"data": await asyncio.to_thread(knowledge_import.list_documents)}


@router.delete("/knowledge/documents/{name}")
async def knowledge_delete(name: str) -> dict:
    ok = await asyncio.to_thread(knowledge_import.delete_document, name)
    if not ok:
        raise HTTPException(status_code=404, detail="文档不存在或文件名非法。")
    return {"status": "deleted", "filename": name}


# ---------------------------------------------------------------------------
# Streaming endpoint: JSON events + binary PCM frames
# ---------------------------------------------------------------------------


@router.websocket("/stream")
async def rag_stream_ws(ws: WebSocket) -> None:
    await ws.accept()
    send_lock = asyncio.Lock()
    task: asyncio.Task | None = None

    async def send_json(payload: dict) -> None:
        async with send_lock:
            await ws.send_json(payload)

    async def run_ask(data: dict) -> None:
        session = RagStreamSession()
        try:
            async for kind, payload in session.run(
                question=data.get("question", ""),
                session_id=data.get("session_id"),
                top_k=data.get("top_k"),
                voice=data.get("voice"),
                speed=data.get("speed"),
            ):
                async with send_lock:
                    if kind == "event":
                        await ws.send_json(payload)
                    else:
                        await ws.send_bytes(payload)
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception:  # pragma: no cover - defensive
            logger.exception("rag_stream_ws_failed")

    await send_json({
        "type": "ready",
        "protocol": 2,
        "prompt_version": PROMPT_VERSION,
        "audio": {
            "sample_rate": tts.SAMPLE_RATE,
            "channels": tts.CHANNELS,
            "bits": tts.BITS_PER_SAMPLE,
            "encoding": "pcm_s16le",
        },
        "lead_ins": [],
        "features": {
            "tts": tts.is_configured(),
            "asr_stream": asr.is_configured(),
            "citations": True,
            "sources_highlight": True,
            "asr_partial": True,
            "suggestions": True,
            "feedback": True,
            "voice": True,
            "speed": True,
        },
        "voices": ["Cherry", "Serena", "Ethan", "Chelsie"],
        "speeds": [0.8, 1.0, 1.2, 1.5],
    })
    try:
        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            text = message.get("text")
            if not text:
                continue
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            kind = data.get("type")
            if kind == "ask":
                if task is not None and not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                task = asyncio.create_task(run_ask(data))
            elif kind == "abort":
                if task is not None and not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                await send_json({"type": "aborted"})
            elif kind == "ping":
                await send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


@router.websocket("/asr/stream")
async def rag_asr_stream_ws(ws: WebSocket) -> None:
    """Stream microphone PCM and forward partial transcripts as they arrive."""
    await ws.accept()
    if not asr.is_configured():
        await ws.send_json({"type": "error", "message": "语音识别未配置。"})
        await ws.close()
        return

    send_lock = asyncio.Lock()

    async def send(payload: dict) -> None:
        async with send_lock:
            await ws.send_json(payload)

    def on_partial(text: str) -> None:
        asyncio.create_task(send({"type": "partial", "text": text}))

    transcriber = asr.StreamingTranscriber(on_partial=on_partial)
    try:
        await send({"type": "connecting"})
        try:
            await transcriber.open()
        except asr.ASRError as exc:
            await send({"type": "error", "message": str(exc)})
            await ws.close()
            return
        await send({"type": "ready"})

        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            chunk = message.get("bytes")
            if chunk:
                try:
                    await transcriber.push(chunk)
                except asr.ASRError as exc:
                    await send({"type": "error", "message": str(exc)})
                    break
                continue
            text = message.get("text")
            if not text:
                continue
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                continue
            kind = data.get("type")
            if kind == "stop":
                try:
                    transcript = await transcriber.finish()
                except asr.ASRError as exc:
                    await send({"type": "error", "message": str(exc)})
                    break
                await send({"type": "final", "text": transcript})
                break
            if kind == "cancel":
                break
    except WebSocketDisconnect:
        pass
    finally:
        await transcriber.close()
