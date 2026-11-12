class KnowledgeRevision:
    """Process-local generation for invalidating speculative knowledge caches."""
    value = 0

    @classmethod
    def invalidate(cls):
        cls.value += 1
