"""Shared outbound HTTP sessions for model providers.

Two pools on purpose:

* the general pool (LLM) keeps connections for 25 s - long enough to reuse them
  across turns, short enough to avoid reusing a socket the server already closed;
* the TTS pool recycles aggressively (4 s). DashScope closes idle TTS sockets
  quickly, and a half-open socket used to stall the first sentence for ~10 s
  (sock_read timeout) before the retry kicked in.
"""
from __future__ import annotations

import logging

import aiohttp

logger = logging.getLogger(__name__)

_session: aiohttp.ClientSession | None = None
_tts_session: aiohttp.ClientSession | None = None


def _make_session(*, keepalive_timeout: float, limit: int) -> aiohttp.ClientSession:
    connector = aiohttp.TCPConnector(
        limit=limit,
        ttl_dns_cache=300,
        keepalive_timeout=keepalive_timeout,
        enable_cleanup_closed=True,
    )
    return aiohttp.ClientSession(
        connector=connector,
        timeout=aiohttp.ClientTimeout(total=180, sock_read=120),
    )


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = _make_session(keepalive_timeout=25, limit=64)
    return _session


async def get_tts_session() -> aiohttp.ClientSession:
    """Short-lived keep-alive pool for TTS (see module docstring)."""
    global _tts_session
    if _tts_session is None or _tts_session.closed:
        _tts_session = _make_session(keepalive_timeout=4, limit=8)
    return _tts_session


async def close_session() -> None:
    global _session, _tts_session
    for name in ("_session", "_tts_session"):
        session = globals()[name]
        if session is not None and not session.closed:
            await session.close()
        globals()[name] = None


async def warmup() -> None:
    """Best-effort DNS/TLS preconnect; never raises."""
    try:
        session = await get_session()
        async with session.get("https://dashscope.aliyuncs.com/", timeout=aiohttp.ClientTimeout(total=8)) as resp:
            await resp.read()
        logger.info("http_warmup_done")
    except Exception as exc:  # warmup is optional
        logger.warning("http_warmup_failed: %s", exc)
