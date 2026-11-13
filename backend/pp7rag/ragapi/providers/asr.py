"""Speech recognition via DashScope Qwen3-ASR-Flash realtime (OpenAI-Realtime compatible).

The browser sends a single WAV comment; we stream its PCM payload to DashScope
over one short-lived WebSocket session and return the final transcript.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import wave

import aiohttp

from pp7rag.config import settings
from pp7rag.ragapi.providers.http import get_session

logger = logging.getLogger(__name__)

REALTIME_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
DEFAULT_MODEL = "qwen3-asr-flash-realtime"
SAMPLE_RATE = 16000
CHUNK_BYTES = 3200  # 100 ms of 16 kHz 16-bit mono PCM


class ASRError(Exception):
    """Speech recognition is unavailable or failed."""


def _api_key() -> str:
    return settings.dashscope_api_key or settings.omni_api_key


def is_configured() -> bool:
    return bool(settings.asr_enabled and _api_key())


def wav_to_pcm(data: bytes) -> bytes:
    """Extract PCM frames from a mono 16-bit WAV file."""
    try:
        with wave.open(io.BytesIO(data), "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
                raise ASRError("仅支持单声道 16bit PCM WAV 音频。")
            if wf.getframerate() != SAMPLE_RATE:
                raise ASRError(f"采样率需为 {SAMPLE_RATE}Hz，当前 {wf.getframerate()}Hz。")
            return wf.readframes(wf.getnframes())
    except (wave.Error, EOFError) as exc:
        raise ASRError("音频文件不是有效的 WAV。") from exc


async def _wait_for(ws: aiohttp.ClientWebSocketResponse, expected: set[str], timeout_s: float) -> dict:
    while True:
        try:
            msg = await asyncio.wait_for(ws.receive(), timeout=timeout_s)
        except asyncio.TimeoutError as exc:
            raise ASRError("语音识别超时，请重试。") from exc
        if msg.type != aiohttp.WSMsgType.TEXT:
            raise ASRError("语音识别连接已断开。")
        event = json.loads(msg.data)
        event_type = event.get("type", "")
        if event_type == "error":
            detail = (event.get("error") or {}).get("message", str(event))
            raise ASRError(f"语音识别服务出错：{detail}")
        if event_type in expected:
            return event


async def transcribe(audio: bytes, *, timeout_s: float = 40.0) -> str:
    """Transcribe WAV (16 kHz mono 16-bit) audio into text."""
    if not is_configured():
        raise ASRError("未配置语音识别密钥（DASHSCOPE_API_KEY / TTS_API_KEY）。")

    pcm = wav_to_pcm(audio) if audio[:4] == b"RIFF" else audio
    if not pcm:
        raise ASRError("音频内容为空。")
    if len(pcm) % 2:
        pcm = pcm[:-1]

    url = f"{REALTIME_URL}?model={settings.asr_model or DEFAULT_MODEL}"
    headers = {"Authorization": f"Bearer {_api_key()}"}
    transcripts: list[str] = []

    # Shared keep-alive session: no TLS handshake per utterance.
    http = await get_session()
    try:
        ws = await http.ws_connect(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15))
    except aiohttp.ClientError as exc:
        raise ASRError("语音识别连接失败，请检查网络与服务配置。") from exc
    try:
        created = await _wait_for(ws, {"session.created"}, 10.0)
        if created.get("type") == "error":
            raise ASRError("语音识别会话创建失败。")
        # Manual turn control: one commit == one transcript.
        await ws.send_json({"type": "session.update", "session": {"turn_detection": None}})
        for offset in range(0, len(pcm), CHUNK_BYTES):
            chunk = pcm[offset:offset + CHUNK_BYTES]
            await ws.send_json({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(chunk).decode("ascii"),
            })
        await ws.send_json({"type": "input_audio_buffer.commit"})

        deadline = asyncio.get_running_loop().time() + timeout_s
        while asyncio.get_running_loop().time() < deadline:
            event = await _wait_for(
                ws,
                {"conversation.item.input_audio_transcription.completed"},
                max(1.0, deadline - asyncio.get_running_loop().time()),
            )
            text = (event.get("transcript") or "").strip()
            if text:
                transcripts.append(text)
            break
    except aiohttp.ClientError as exc:
        raise ASRError("语音识别连接异常。") from exc
    finally:
        await ws.close()

    return "".join(transcripts).strip()


class StreamingTranscriber:
    """One live utterance: open early, push PCM while speaking, emit partial text.

    The DashScope realtime session is established when the microphone opens, so
    only the final commit + inference is left after the user stops talking.
    A background reader task forwards `text`/`stash` deltas so the UI can render
    a live transcript while the user is still speaking.
    """

    def __init__(self, *, timeout_s: float = 40.0, on_partial=None) -> None:
        self._timeout_s = timeout_s
        self._on_partial = on_partial
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._ready = False
        self._reader: asyncio.Task | None = None
        self._final: str | None = None
        self._final_event = asyncio.Event()
        self._last_partial = ""
        self._error: str | None = None

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def partial(self) -> str:
        return self._last_partial

    async def open(self) -> None:
        if not is_configured():
            raise ASRError("未配置语音识别密钥（DASHSCOPE_API_KEY / TTS_API_KEY）。")
        url = f"{REALTIME_URL}?model={settings.asr_model or DEFAULT_MODEL}"
        headers = {"Authorization": f"Bearer {_api_key()}"}
        http = await get_session()
        try:
            self._ws = await http.ws_connect(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15))
            await _wait_for(self._ws, {"session.created"}, 10.0)
            await self._ws.send_json({"type": "session.update", "session": {"turn_detection": None}})
            self._ready = True
            self._reader = asyncio.create_task(self._read_loop())
        except aiohttp.ClientError as exc:
            raise ASRError("语音识别连接失败，请检查网络与服务配置。") from exc

    def _handle_event(self, event: dict) -> None:
        event_type = event.get("type", "")
        if event_type == "conversation.item.input_audio_transcription.text":
            # Partial: confirmed text plus the unstable tail in `stash`.
            text = ((event.get("text") or "") + (event.get("stash") or "")).strip()
            if text and text != self._last_partial:
                self._last_partial = text
                if self._on_partial is not None:
                    try:
                        self._on_partial(text)
                    except Exception:  # callback must never break the reader
                        pass
        elif event_type.endswith("conversation.item.input_audio_transcription.completed"):
            self._final = (event.get("transcript") or "").strip()
            self._final_event.set()
        elif event_type == "error":
            detail = (event.get("error") or {}).get("message", str(event))
            self._error = detail
            logger.warning("asr_stream_error: %s", detail)
            self._final_event.set()

    async def _read_loop(self) -> None:
        ws = self._ws
        if ws is None:
            return
        try:
            async for msg in ws:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    if msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                        break
                    continue
                try:
                    event = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                self._handle_event(event)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # socket closed while speaking
            logger.warning("asr_reader_stopped: %s", exc)
        finally:
            self._final_event.set()

    async def push(self, pcm: bytes) -> None:
        if not self._ready or self._ws is None:
            raise ASRError("语音识别会话未就绪。")
        if len(pcm) % 2:
            pcm = pcm[:-1]
        for offset in range(0, len(pcm), CHUNK_BYTES):
            await self._ws.send_json({
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm[offset:offset + CHUNK_BYTES]).decode("ascii"),
            })

    async def finish(self) -> str:
        if not self._ready or self._ws is None:
            raise ASRError("语音识别会话未就绪。")
        await self._ws.send_json({"type": "input_audio_buffer.commit"})
        try:
            await asyncio.wait_for(self._final_event.wait(), timeout=self._timeout_s)
        except asyncio.TimeoutError:
            raise ASRError("语音识别超时，请重试。")
        if self._error and not self._final:
            raise ASRError(f"语音识别服务出错：{self._error}")
        return (self._final or self._last_partial or "").strip()

    async def close(self) -> None:
        self._ready = False
        reader = self._reader
        self._reader = None
        if reader is not None and not reader.done():
            reader.cancel()
            await asyncio.gather(reader, return_exceptions=True)
        if self._ws is not None and not self._ws.closed:
            try:
                await self._ws.close()
            except Exception:  # pragma: no cover - best effort
                pass
        self._ws = None
