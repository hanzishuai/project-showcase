"""Lightweight BM25 keyword index over the indexed corpus.

Vector search alone misses exact tokens (project codes, names, rare nouns) in
Chinese project documents. This module keeps a small in-memory BM25 index built
from the same chunks that live in Chroma, refreshed whenever the knowledge
revision changes. No external dependency: jieba for tokenisation.
"""
from __future__ import annotations

import asyncio
import logging
import math
from collections import Counter

import jieba

from pp7rag.knowledge.revision import KnowledgeRevision

logger = logging.getLogger(__name__)

# Chinese stop words that carry no retrieval signal.
_STOPWORDS = set("""
的 了 和 与 及 或 在 是 有 为 对 从 到 把 被 让 这 那 它 他 她 我 你 您 我们 你们
这个 那个 这些 那些 一个 一些 什么 怎么 如何 哪些 哪个 多少 是否 可以 能 会 要 就 也 都 还 又 再 更 很
吗 呢 吧 啊 呀 哦 嗯 请问 一下 帮 我 说 讲 吗 嘛
""".split())


def tokenize(text: str) -> list[str]:
    """Search-mode tokenisation: "哪些项目" -> 哪些 + 项目, which matches better."""
    tokens = []
    for raw in jieba.lcut_for_search((text or "").lower()):
        token = raw.strip()
        if not token or token in _STOPWORDS:
            continue
        if len(token) == 1 and not token.isascii():
            continue
        tokens.append(token)
    return tokens


class KeywordIndex:
    """Okapi BM25 over a list of documents, rebuilt from the knowledge base."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._revision: int | None = None
        self._ids: list[str] = []
        self._docs: list[str] = []
        self._metas: list[dict] = []
        self._tf: list[Counter] = []
        self._lengths: list[int] = []
        self._df: Counter = Counter()
        self._avg_len = 0.0

    async def ensure(self, loader) -> None:
        """Rebuild if the knowledge revision changed (loader returns corpus rows)."""
        revision = KnowledgeRevision.value
        if self._revision == revision:
            return
        async with self._lock:
            if self._revision == revision:
                return
            try:
                rows = await loader()
            except Exception as exc:  # index unavailable: keep keyword recall empty
                logger.warning("keyword_index_unavailable: %s", exc)
                return
            self._build(rows)
            self._revision = revision
            logger.info("keyword_index_built docs=%d", len(self._docs))

    def _build(self, rows: list[dict]) -> None:
        self._ids = [str(row.get("id", "")) for row in rows]
        self._docs = [str(row.get("text", "") or "") for row in rows]
        self._metas = [row.get("metadata") or {} for row in rows]
        self._tf = []
        self._lengths = []
        self._df = Counter()
        for text in self._docs:
            tokens = tokenize(text)
            counter = Counter(tokens)
            self._tf.append(counter)
            self._lengths.append(len(tokens))
            self._df.update(counter.keys())
        total = len(self._lengths)
        self._avg_len = (sum(self._lengths) / total) if total else 0.0

    def search(self, query: str, limit: int = 16) -> list[dict]:
        if not self._docs:
            return []
        q_tokens = tokenize(query)
        if not q_tokens:
            return []
        total = len(self._docs)
        avg_len = self._avg_len or 1.0
        k1, b = 1.5, 0.75
        scored: list[tuple[float, int]] = []
        for index, tf in enumerate(self._tf):
            score = 0.0
            length = self._lengths[index] or 1
            for token in q_tokens:
                freq = tf.get(token)
                if not freq:
                    continue
                idf = math.log(1 + (total - self._df[token] + 0.5) / (self._df[token] + 0.5))
                score += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * length / avg_len))
            if score > 0:
                scored.append((score, index))
        scored.sort(reverse=True)
        results = []
        for score, index in scored[:limit]:
            results.append({
                "id": self._ids[index],
                "text": self._docs[index],
                "metadata": self._metas[index],
                "score": round(score, 4),
            })
        return results


keyword_index = KeywordIndex()
