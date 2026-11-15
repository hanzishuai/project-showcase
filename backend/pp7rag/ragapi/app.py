"""Standalone FastAPI app that serves only the embeddable RAG API.

Use it when the digital-human backend (WebSocket / admin / MySQL) is not needed::

    uvicorn app.ragapi.app:app --host 0.0.0.0 --port 8010

It keeps a small footprint: Chroma + embedding model, no
MySQL / Redis / Omni connection at startup.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pp7rag.config import settings
from pp7rag.logging_setup import setup_logging
from pp7rag.ragapi.routes import router as rag_router

setup_logging(level=settings.log_level, fmt=settings.log_format)

_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()] or ["*"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-open outbound HTTP/TTS connections and warm the LLM so the first
    # user turn does not pay DNS/TLS/model cold-start costs.
    from pp7rag.ragapi.providers import http, llm, tts

    warmup_tasks = []
    if settings.llm_warmup_on_startup:
        warmup_tasks.append(asyncio.create_task(llm.warmup()))
        warmup_tasks.append(asyncio.create_task(http.warmup()))
        warmup_tasks.append(asyncio.create_task(tts.warmup()))
        if settings.rag_suggestions_enabled:
            from pp7rag.ragapi.suggestions import get_suggestions

            warmup_tasks.append(asyncio.create_task(get_suggestions(3)))
    yield
    for task in warmup_tasks:
        if not task.done():
            task.cancel()
    await http.close_session()


def create_app() -> FastAPI:
    app = FastAPI(title="RAG Avatar API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(rag_router)
    return app


app = create_app()
