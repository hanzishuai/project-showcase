"""Hybrid retrieval: vector recall + BM25 keyword recall -> RRF -> rerank.

Why: vectors handle paraphrase, keywords handle exact names/codes. Project docs
are full of both (项目名、编号、技术领域), so a single retriever leaves recall on
the table. Fusion is Reciprocal Rank Fusion (scale free), then DashScope rerank
puts the truly relevant chunk on top. Rerank failure degrades to the fused order.
"""
from __future__ import annotations

import asyncio
import logging
import time

import aiohttp

from pp7rag.config import settings
from pp7rag.engine.keyword_index import keyword_index, tokenize
from pp7rag.engine.retriever import RetrievalError, retriever
from pp7rag.ragapi.providers.http import get_session

logger = logging.getLogger(__name__)

RERANK_URL = "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank"
RRF_K = 60


def _api_key() -> str:
    return settings.dashscope_api_key or settings.omni_api_key or settings.tts_api_key


def _rrf(rank: int) -> float:
    return 1.0 / (RRF_K + rank)


def fuse(vector_docs: list[dict], keyword_docs: list[dict]) -> list[dict]:
    """Reciprocal rank fusion keyed by document id."""
    merged: dict[str, dict] = {}
    for rank, doc in enumerate(vector_docs, start=1):
        entry = merged.setdefault(str(doc["id"]), {**doc, "fused": 0.0, "from_vector": True, "from_keyword": False})
        entry["fused"] += _rrf(rank)
    for rank, doc in enumerate(keyword_docs, start=1):
        key = str(doc["id"])
        entry = merged.get(key)
        if entry is None:
            entry = merged[key] = {**doc, "fused": 0.0, "from_vector": False, "from_keyword": True}
        entry["from_keyword"] = True
        entry["fused"] += _rrf(rank)
    return sorted(merged.values(), key=lambda item: item["fused"], reverse=True)


async def rerank(query: str, docs: list[dict], top_k: int) -> list[dict]:
    """DashScope rerank; returns docs with 'rerank_score' (or unchanged on failure)."""
    if not settings.rag_rerank_enabled or not _api_key() or not docs:
        return docs[:top_k]
    candidates = docs[: max(top_k, 12)]
    payload = {
        "model": settings.rag_rerank_model,
        "input": {"query": query, "documents": [doc.get("text", "") for doc in candidates]},
        "parameters": {"top_n": top_k, "return_documents": False},
    }
    started = time.perf_counter()
    try:
        session = await get_session()
        timeout = aiohttp.ClientTimeout(total=settings.rag_rerank_timeout_ms / 1000)
        async with session.post(
            RERANK_URL,
            json=payload,
            headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
            timeout=timeout,
        ) as response:
            if response.status >= 400:
                body = (await response.text())[:200]
                logger.warning("rerank_failed status=%s body=%s", response.status, body)
                return candidates[:top_k]
            data = await response.json()
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        logger.warning("rerank_unavailable: %s", exc)
        return candidates[:top_k]
    results = ((data.get("output") or {}).get("results") or [])
    ranked: list[dict] = []
    for item in results:
        index = item.get("index")
        if not isinstance(index, int) or index < 0 or index >= len(candidates):
            continue
        doc = dict(candidates[index])
        doc["rerank_score"] = round(float(item.get("relevance_score") or 0.0), 4)
        ranked.append(doc)
    logger.info(
        "rerank_done candidates=%d kept=%d elapsed_ms=%d", len(candidates), len(ranked),
        int((time.perf_counter() - started) * 1000),
    )
    return ranked or candidates[:top_k]


async def search(query: str, top_k: int | None = None) -> tuple[list[dict], bool]:
    """Hybrid search; returns (documents, degraded)."""
    top_k = top_k or settings.rag_top_k
    pool = max(top_k, settings.rag_recall_pool)
    degraded = False

    async def vector_recall() -> list[dict]:
        return await retriever.search(query, top_k=pool)

    if not settings.rag_hybrid_enabled:
        try:
            docs = await retriever.search(query, top_k=top_k)
        except RetrievalError:
            return [], True
        return docs[:top_k], False

    vector_docs: list[dict] = []
    try:
        vector_docs = await vector_recall()
    except RetrievalError:
        degraded = True

    keyword_docs: list[dict] = []
    try:
        await keyword_index.ensure(retriever.all_documents)
        keyword_docs = keyword_index.search(query, limit=pool)
    except Exception as exc:
        logger.warning("keyword_index_failed: %s", exc)

    if not vector_docs and not keyword_docs:
        return [], True

    fused = fuse(vector_docs, keyword_docs)
    ranked = await rerank(query, fused, top_k)
    return ranked[:top_k], degraded


def build_sources(documents: list[dict], query: str) -> list[dict]:
    """Render retrieval hits as citation-friendly sources with a highlightable snippet.

    同一篇文档的多个分块会合并成一条来源（前端只展示「来源：文档名」），
    避免一次回答列出多张指向同一文档的资料卡。提示词用的是原始 documents，不受影响。
    """
    terms = tokenize(query)
    sources: list[dict] = []
    seen: dict[str, dict] = {}
    for doc in documents:
        text = (doc.get("text") or "").strip()
        metadata = doc.get("metadata") or {}
        title = ((metadata.get("title") if isinstance(metadata, dict) else "") or "").strip()
        key = title or str(doc.get("id") or "")
        existing = seen.get(key)
        if existing is not None:
            # 同一文档：保留首个（相关度最高）的结果，只累积检索来源标记。
            existing["retrieval"] = "hybrid"
            continue
        snippet, highlights = _snippet(text, terms, settings.rag_snippet_chars)
        source = {
            "id": doc.get("id"),
            "citation": len(sources) + 1,
            "title": title or f"资料 {len(sources) + 1}",
            "snippet": snippet,
            "text": text[: settings.rag_source_text_chars],
            "terms": highlights,
            "score": doc.get("rerank_score", doc.get("score")),
            "retrieval": "hybrid" if doc.get("from_vector") and doc.get("from_keyword")
                         else ("keyword" if doc.get("from_keyword") else "vector"),
        }
        seen[key] = source
        sources.append(source)
    return sources


def _snippet(text: str, terms: list[str], limit: int) -> tuple[str, list[str]]:
    """Pick a window around the first matched term and report which terms matched."""
    if not text:
        return "", []
    matched = [term for term in terms if term and term in text][:8]
    if not matched:
        return text[:limit] + ("…" if len(text) > limit else ""), []
    first = min(text.find(term) for term in matched if text.find(term) >= 0)
    start = max(0, first - limit // 3)
    end = min(len(text), start + limit)
    if end - start < limit:
        start = max(0, end - limit)
    snippet = text[start:end]
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet, matched
