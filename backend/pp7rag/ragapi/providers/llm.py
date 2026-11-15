"""OpenAI-compatible streaming chat completion client.

Works with DeepSeek (default), DashScope compatible-mode, or any endpoint that
exposes ``POST /chat/completions`` with ``stream: true``.

A secondary endpoint can be configured through ``LLM_FALLBACK_*``; it is only
used when the primary endpoint fails before emitting any token (out of balance,
bad key, network error), so callers never see duplicated text. Failed targets
are skipped for a short cooldown to avoid paying the failed round trip on every
request.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import AsyncIterator

import aiohttp

from pp7rag.config import settings
from pp7rag.ragapi.providers.http import get_session

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_FALLBACK_MODEL = "qwen-flash"
FAILURE_COOLDOWN_S = 60.0
# Auth/quota errors will not heal within a minute: park the target for longer so
# we do not pay a failed round trip on almost every request. A dead primary used
# to add ~0.3-0.5 s to the first answer every 10 minutes; an hour is safer and
# still recovers quickly after a top-up.
FATAL_COOLDOWN_S = float(settings.llm_fatal_cooldown_s)
FATAL_MARKERS = ("HTTP 401", "HTTP 402", "HTTP 403", "HTTP 404", "insufficient_balance")

# "url#model" -> monotonic deadline until which that target is skipped.
# Keying on model too lets the fallback share the same endpoint (DashScope).
_failed_until: dict[str, float] = {}


def target_key(target: "LLMTarget") -> str:
    return f"{target.url}#{target.model}"


class LLMError(Exception):
    """Text generation is unavailable or failed."""


@dataclass(frozen=True)
class LLMTarget:
    base_url: str
    model: str
    api_key: str

    @property
    def url(self) -> str:
        base = (self.base_url or DEFAULT_BASE_URL).strip().rstrip("/")
        if not base:
            base = DEFAULT_BASE_URL
        if base.endswith("/v1") or "/compatible-mode/" in base:
            return f"{base}/chat/completions"
        return f"{base}/v1/chat/completions"


def _speech_key() -> str:
    """Speech key (DashScope) doubles as the fallback LLM key."""
    return settings.dashscope_api_key or settings.omni_api_key


def primary_target() -> LLMTarget:
    return LLMTarget(
        base_url=settings.llm_base_url or DEFAULT_BASE_URL,
        model=settings.llm_model or DEFAULT_MODEL,
        api_key=settings.llm_api_key or _speech_key(),
    )


def fallback_target() -> LLMTarget | None:
    base = (settings.llm_fallback_base_url or "").strip()
    if not base:
        return None
    key = settings.llm_fallback_api_key or _speech_key()
    if not key:
        return None
    return LLMTarget(
        base_url=base,
        model=settings.llm_fallback_model or DEFAULT_FALLBACK_MODEL,
        api_key=key,
    )


def _available(target: LLMTarget) -> bool:
    key = target_key(target)
    deadline = _failed_until.get(key, 0.0)
    if deadline <= time.monotonic():
        _failed_until.pop(key, None)
        return True
    return False


def targets() -> list[LLMTarget]:
    primary = primary_target()
    candidates = [primary] if primary.api_key else []
    fallback = fallback_target()
    if fallback and target_key(fallback) != target_key(primary):
        candidates.append(fallback)
    available = [target for target in candidates if _available(target)]
    # Never end up with nothing: retry all targets if every one is cooling down.
    return available or candidates


def chat_url(base_url: str | None = None) -> str:
    return LLMTarget(
        base_url=base_url or settings.llm_base_url or DEFAULT_BASE_URL,
        model=settings.llm_model or DEFAULT_MODEL,
        api_key="",
    ).url


def is_configured() -> bool:
    primary = primary_target()
    return bool(primary.api_key or fallback_target())


def _thinking_params(target: LLMTarget) -> dict:
    """Provider-specific "do not think" switches.

    DeepSeek's deepseek-flash reasons by default (2-4 s TTFT); it honours
    reasoning_effort=none. DashScope Qwen3 models honour enable_thinking.
    """
    url = target.url
    params: dict = {}
    if settings.llm_reasoning_effort and ("deepseek" in url or "dashscope" in url):
        params["reasoning_effort"] = settings.llm_reasoning_effort
    if "dashscope" in url and settings.llm_enable_thinking is not None:
        params["enable_thinking"] = bool(settings.llm_enable_thinking)
    return params


async def _stream_one(
    target: LLMTarget,
    messages: list[dict],
    *,
    max_tokens: int | None,
    temperature: float | None,
    timeout_s: float,
) -> AsyncIterator[str]:
    payload = {
        "model": target.model,
        "messages": messages,
        "stream": True,
        "max_tokens": settings.llm_max_tokens if max_tokens is None else max_tokens,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        **_thinking_params(target),
    }
    headers = {
        "Authorization": f"Bearer {target.api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    try:
        client = await get_session()
        async with client.post(
            target.url,
            json=payload,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=timeout_s, sock_connect=10, sock_read=45),
        ) as resp:
            if resp.status >= 400:
                body = (await resp.text())[:300]
                raise LLMError(f"文本模型请求失败（HTTP {resp.status}）：{body}")
            async for raw_line in resp.content:
                line = raw_line.decode("utf-8", "ignore").strip()
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    return
                try:
                    obj = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if obj.get("error"):
                    raise LLMError(f"文本模型返回错误：{obj['error']}")
                choices = obj.get("choices") or []
                if not choices:
                    continue
                delta = (choices[0].get("delta") or {}).get("content")
                if delta:
                    yield delta
    except aiohttp.ClientError as exc:
        raise LLMError("文本模型连接失败，请检查网络与服务配置。") from exc
    except TimeoutError as exc:
        raise LLMError("文本模型响应超时。") from exc


async def stream_chat(
    messages: list[dict],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    timeout_s: float = 120.0,
) -> AsyncIterator[str]:
    """Yield incremental answer text from the primary (then fallback) endpoint."""
    candidates = targets()
    if not candidates:
        raise LLMError("未配置 LLM_API_KEY，无法生成回答。")
    last_error: LLMError | None = None
    for target in candidates:
        emitted = False
        try:
            async for delta in _stream_one(
                target,
                messages,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout_s=timeout_s,
            ):
                emitted = True
                yield delta
            _failed_until.pop(target_key(target), None)
            return
        except LLMError as exc:
            if emitted:
                raise
            message = str(exc)
            cooldown = (
                FATAL_COOLDOWN_S
                if any(marker in message for marker in FATAL_MARKERS)
                else FAILURE_COOLDOWN_S
            )
            _failed_until[target_key(target)] = time.monotonic() + cooldown
            logger.warning("llm_target_failed url=%s model=%s cooldown=%.0fs: %s",
                           target.url, target.model, cooldown, exc)
            last_error = exc
    raise last_error or LLMError("文本模型不可用。")


async def warmup() -> None:
    """Best-effort tiny request so the first user turn does not pay cold start."""
    try:
        async for _ in stream_chat([{"role": "user", "content": "你好"}], max_tokens=4):
            break
        logger.info("llm_warmup_done")
    except Exception as exc:  # warmup must never break startup
        logger.warning("llm_warmup_failed: %s", exc)


def reset_circuit_breaker() -> None:
    _failed_until.clear()
