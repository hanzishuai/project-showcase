"""Embeddable serial-RAG API for third-party Vue frontends.

Entry points: ``app.ragapi.routes`` (HTTP) and ``app.ragapi.service`` (pipeline).
"""

from pp7rag.ragapi.service import rag_service  # noqa: F401
