import asyncio
import logging
import time

# Chroma 0.5.x 的遥测依赖旧版 posthog，会持续刷 ERROR 日志；这里直接关掉客户端遥测。
try:
    import posthog

    posthog.disabled = True
except Exception:
    pass
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)

from chromadb import PersistentClient
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
from pp7rag.config import settings

logger = logging.getLogger(__name__)


class RetrievalError(Exception):
    """The knowledge index could not be searched."""


# Shared embedding model — loaded once and reused across requests
_shared_encoder: SentenceTransformer | None = None


def get_shared_encoder() -> SentenceTransformer:
    global _shared_encoder
    if _shared_encoder is None:
        logger.info(f"Loading shared embedding model: {settings.embedding_model}")
        _shared_encoder = SentenceTransformer(settings.embedding_model)
    return _shared_encoder


class Retriever:
    def __init__(self):
        # 关闭 Chroma 匿名遥测（0.5.x 默认开启且会报错刷屏）
        self._client = PersistentClient(
            path=str(settings.chroma_path),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._embedding_function = None

    @property
    def _ef(self):
        if self._embedding_function is None:
            self._embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.embedding_model
            )
        return self._embedding_function

    async def search(self, query: str, top_k: int = 5) -> list[dict]:
        try:
            t0 = time.perf_counter()
            col = self._client.get_collection("knowledge_base", embedding_function=self._ef)
            t1 = time.perf_counter()

            loop = asyncio.get_event_loop()

            def _query():
                return col.query(query_texts=[query], n_results=top_k)

            results = await loop.run_in_executor(None, _query)
            t2 = time.perf_counter()
            docs = []
            if results["ids"] and results["ids"][0]:
                distances = results.get("distances") or []
                for i, doc_id in enumerate(results["ids"][0]):
                    distance = None
                    if distances and distances[0] and i < len(distances[0]):
                        distance = distances[0][i]
                    docs.append({
                        "id": doc_id,
                        "text": results["documents"][0][i] if results["documents"] else "",
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": distance,
                        "score": round(1.0 / (1.0 + float(distance)), 4) if distance is not None else None,
                    })
            logger.info(f"Retrieve: get_col={1000*(t1-t0):.0f}ms embed+query={1000*(t2-t1):.0f}ms total={1000*(t2-t0):.0f}ms results={len(docs)}")
            return docs
        except Exception as exc:
            logger.exception("Chroma retrieval failed")
            raise RetrievalError("知识库暂时不可用，请稍后再试。") from exc

    async def all_documents(self) -> list[dict]:
        """Whole corpus (ids/documents/metadatas) for the keyword index."""

        def _get():
            col = self._client.get_collection("knowledge_base", embedding_function=self._ef)
            data = col.get(include=["documents", "metadatas"])
            return data

        data = await asyncio.get_event_loop().run_in_executor(None, _get)
        ids = data.get("ids") or []
        docs = data.get("documents") or []
        metas = data.get("metadatas") or []
        rows = []
        for index, doc_id in enumerate(ids):
            text = docs[index] if index < len(docs) else ""
            meta = metas[index] if index < len(metas) else {}
            rows.append({"id": doc_id, "text": text or "", "metadata": meta or {}})
        return rows

    async def healthy(self) -> bool:
        """Whether the knowledge collection can be opened."""
        try:
            await asyncio.to_thread(lambda: self._client.get_collection("knowledge_base").count())
            return True
        except Exception:
            logger.warning("Chroma health check failed")
            return False

retriever = Retriever()
