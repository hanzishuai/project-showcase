import logging
from pathlib import Path
from chromadb import PersistentClient
from chromadb.utils import embedding_functions
from pp7rag.config import settings
from pp7rag.knowledge.revision import KnowledgeRevision

logger = logging.getLogger(__name__)

class KnowledgeIndexer:
    def __init__(self):
        self._client = PersistentClient(path=str(settings.chroma_path))
        self._embedding_function = None
        self._collection = None

    @property
    def _ef(self):
        if self._embedding_function is None:
            self._embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=settings.embedding_model
            )
        return self._embedding_function

    def _get_or_create_collection(self):
        name = "knowledge_base"
        try:
            self._collection = self._client.get_collection(name, embedding_function=self._ef)
        except Exception:
            logger.exception("Failed to get Chroma collection, creating new one")
            self._collection = self._client.create_collection(name, embedding_function=self._ef)

    def index_chunks(self, chunks: list[dict]):
        KnowledgeRevision.invalidate()
        self._get_or_create_collection()
        ids = []
        docs = []
        metadatas = []
        for i, ch in enumerate(chunks):
            ids.append(f"chunk_{i}")
            docs.append(ch["text"])
            metadatas.append({"title": ch["title"], "chunk_index": ch["chunk_index"]})
        existing = self._collection.get()["ids"] if self._collection else []
        if existing:
            self._collection.delete(ids=existing)
        if ids:
            self._collection.add(ids=ids, documents=docs, metadatas=metadatas)

    def clear(self):
        KnowledgeRevision.invalidate()
        try:
            self._client.delete_collection("knowledge_base")
        except Exception:
            logger.exception("Failed to clear Chroma collection")

indexer = KnowledgeIndexer()
