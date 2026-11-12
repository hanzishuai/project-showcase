"""Speech synthesis via DashScope Qwen TTS (qwen3-tts-flash).

Uses DashScope's SSE HTTP endpoint directly over a shared keep-alive session
(~0.3 s to first audio chunk instead of ~0.6-0.9 s with a fresh connection per
call), strips the WAV header DashScope puts in the first streamed chunk, and
caches synthesized audio for repeated phrases.

Two modes:
* ``synthesize`` returns a complete WAV file (24 kHz mono 16-bit PCM).
* ``synthesize_stream`` yields raw PCM chunks as soon as they arrive.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import struct
import time
from collections import OrderedDict

import aiohttp

from pp7rag.config import settings
from pp7rag.ragapi.providers.http import get_tts_session

logger = logging.getLogger(__name__)

SAMPLE_RATE = 24000
CHANNELS = 1
BITS_PER_SAMPLE = 16
MAX_TEXT_CHARS = 600
TTS_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
STREAM_CHUNK_BYTES = 32 * 1024

# text -> (pcm bytes, expires_at)
_cache: "OrderedDict[str, tuple[bytes, float]]" = OrderedDict()

# DashScope applies a fairly tight per-account QPS limit to TTS; concurrent
# requests trigger HTTP 429 and leave gaps in the speech. Space requests out and
# back off when throttled.
_rate_lock = asyncio.Lock()
_last_request_at = 0.0


async def _pace() -> None:
    global _last_request_at
    async with _rate_lock:
        now = time.monotonic()
        wait_s = settings.tts_min_interval_ms / 1000.0 - (now - _last_request_at)
        if wait_s > 0:
            await asyncio.sleep(wait_s)
        _last_request_at = time.monotonic()


class TTSError(Exception):
    """Speech synthesis is unavailable or failed."""


def _api_key() -> str:
    return settings.dashscope_api_key or settings.omni_api_key


def is_configured() -> bool:
    return bool(settings.tts_enabled and _api_key())


def _normalize_text(text: str) -> str:
    content = (text or "").strip()
    if not content:
        raise TTSError("朗读文本为空。")
    if len(content) > MAX_TEXT_CHARS:
        content = content[:MAX_TEXT_CHARS]
    return content


def _voice(voice: str | None) -> str:
    return (voice or settings.tts_voice or "Cherry").strip()


def pcm_to_wav(pcm: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    byte_rate = sample_rate * CHANNELS * BITS_PER_SAMPLE // 8
    block_align = CHANNELS * BITS_PER_SAMPLE // 8
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        CHANNELS,
        sample_rate,
        byte_rate,
        block_align,
        BITS_PER_SAMPLE,
        b"data",
        data_size,
    )
    return header + pcm


def _strip_wav_header(chunk: bytes) -> bytes:
    """DashScope puts one WAV header at the start of the first streamed chunk."""
    if not chunk.startswith(b"RIFF"):
        return chunk
    index = chunk.find(b"data")
    if index < 0:
        return chunk
    return chunk[index + 8:]


def _cache_get(key: str) -> bytes | None:
    if not settings.tts_cache_enabled:
        return None
    entry = _cache.get(key)
    if entry is None:
        return None
    pcm, expires = entry
    if expires <= time.monotonic():
        _cache.pop(key, None)
        return None
    _cache.move_to_end(key)
    return pcm


def _cache_put(key: str, pcm: bytes) -> None:
    if not settings.tts_cache_enabled or not pcm:
        return
    _cache[key] = (pcm, time.monotonic() + settings.tts_cache_ttl)
    _cache.move_to_end(key)
    while len(_cache) > settings.tts_cache_max:
        _cache.popitem(last=False)


def cache_stats() -> dict:
    return {"entries": len(_cache), "enabled": bool(settings.tts_cache_enabled)}


async def _stream_pcm(text: str, voice: str, speed: float | None = None):
    """Yield PCM chunks from DashScope's SSE response.

    `speed` maps to DashScope's `parameters.speech_rate` (0.5-2.0); the response
    already comes back at the requested rate, so no client-side resampling.
    """
    if not _api_key():
        raise TTSError("未配置语音合成密钥（DASHSCOPE_API_KEY / TTS_API_KEY）。")
    payload = {
        "model": settings.tts_model or "qwen3-tts-flash",
        "input": {"text": text, "voice": voice},
    }
    if speed is not None and abs(speed - 1.0) > 0.01:
        payload["parameters"] = {"speech_rate": round(float(speed), 2)}
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
        "X-DashScope-SSE": "enable",
    }
    session = await get_tts_session()
    try:
        async with session.post(
            TTS_URL,
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=60, sock_read=10),
        ) as response:
            if response.status >= 400:
                body = (await response.text())[:300]
                raise TTSError(f"语音合成请求失败（HTTP {response.status}）：{body}")
            first = True
            async for raw_line in response.content:
                line = raw_line.decode("utf-8", "ignore").strip()
                if not line.startswith("data:"):
                    continue
                body = line[5:].strip()
                if not body or body == "[DONE]":
                    continue
                try:
                    event = json.loads(body)
                except json.JSONDecodeError:
                    continue
                output = event.get("output") or {}
                audio = output.get("audio") or {}
                data = audio.get("data") or ""
                if not data:
                    continue
                try:
                    chunk = base64.b64decode(data)
                except (ValueError, TypeError):
                    continue
                if first:
                    chunk = _strip_wav_header(chunk)
                    first = False
                if chunk:
                    yield chunk
    except aiohttp.ClientError as exc:
        raise TTSError("语音合成连接失败，请稍后重试。") from exc
    except TimeoutError as exc:
        raise TTSError("语音合成超时，请稍后重试。") from exc


async def synthesize_stream(text: str, voice: str | None = None, speed: float | None = None):
    """Yield raw 24 kHz mono 16-bit PCM chunks as they are synthesized."""
    if not is_configured():
        raise TTSError("未配置语音合成密钥（DASHSCOPE_API_KEY / TTS_API_KEY）。")
    content = _normalize_text(text)
    target_voice = _voice(voice)
    rate = round(float(speed), 2) if speed else 1.0
    key = f"{target_voice}\x00{rate}\x00{content}"
    cached = _cache_get(key)
    if cached is not None:
        for offset in range(0, len(cached), STREAM_CHUNK_BYTES):
            yield cached[offset:offset + STREAM_CHUNK_BYTES]
        return

    collected = bytearray()
    attempt = 0
    while True:
        emitted = 0
        try:
            await _pace()
            async for chunk in _stream_pcm(content, target_voice, rate):
                emitted += len(chunk)
                collected.extend(chunk)
                yield chunk
            break
        except TTSError as exc:
            # A 429/5xx that arrives before any audio can safely be retried;
            # once audio has been streamed, replaying would duplicate speech.
            message = str(exc)
            retryable = emitted == 0 and (
                "HTTP 429" in message
                or "HTTP 5" in message
                or "连接失败" in message
                or "超时" in message
            )
            if not retryable or attempt >= 3:
                raise
            attempt += 1
            backoff = (0.5, 1.5, 3.0)[min(attempt - 1, 2)]
            logger.warning("tts_retry attempt=%d backoff=%.1fs reason=%s", attempt, backoff, str(exc)[:120])
            await asyncio.sleep(backoff)
    _cache_put(key, bytes(collected))


async def synthesize(text: str, voice: str | None = None, speed: float | None = None) -> bytes:
    """Synthesize one sentence into WAV bytes."""
    if not is_configured():
        raise TTSError("未配置语音合成密钥（DASHSCOPE_API_KEY / TTS_API_KEY）。")
    content = _normalize_text(text)
    target_voice = _voice(voice)
    rate = round(float(speed), 2) if speed else 1.0
    key = f"{target_voice}\x00{rate}\x00{content}"
    cached = _cache_get(key)
    if cached is not None:
        return pcm_to_wav(cached)
    try:
        collected = bytearray()
        async for chunk in _stream_pcm(content, target_voice, rate):
            collected.extend(chunk)
    except TTSError:
        raise
    except Exception as exc:  # defensive: never leave the caller hanging
        logger.exception("TTS synthesis failed")
        raise TTSError("语音合成失败，请稍后重试。") from exc
    pcm = bytes(collected)
    if not pcm:
        raise TTSError("语音合成返回空音频。")
    _cache_put(key, pcm)
    return pcm_to_wav(pcm)


async def warmup() -> None:
    """Pre-open the TTS connection with a very short phrase (best effort)."""
    if not is_configured():
        return
    try:
        async for _ in synthesize_stream("你好"):
            break
        logger.info("tts_warmup_done")
    except Exception as exc:
        logger.warning("tts_warmup_failed: %s", exc)



