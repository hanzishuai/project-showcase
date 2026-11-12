"""Server-side speakable-clause segmentation for streaming TTS.

Mirrors the SDK policy (packages/rag-avatar/src/utils/text.ts) so the server can
start synthesizing as soon as a short fragment is complete. Keeping the two
policies aligned means the same voice timing whether the client is in SSE mode
(it segments locally) or WS mode (the server segments for it).
"""
from __future__ import annotations

HARD_BREAKS = set("。！？；!?;\n…")
SOFT_BREAKS = set("，,、：:")
CLOSERS = set("”’」』）)】》\"'…")


class Segmenter:
    """Incremental splitter: feed() streamed text, get back speakable fragments."""

    def __init__(
        self,
        *,
        max_chars: int = 24,
        first_min_chars: int = 4,
        first_max_chars: int = 10,
        soft_min_chars: int = 14,
        min_chars: int = 2,
    ) -> None:
        self.max_chars = max(4, max_chars)
        self.first_min_chars = max(1, first_min_chars)
        self.first_max_chars = max(self.first_min_chars, min(first_max_chars, self.max_chars))
        self.soft_min_chars = max(2, min(soft_min_chars, self.max_chars))
        self.min_chars = max(1, min_chars)
        self._buf = ""
        self._emitted = 0

    def feed(self, text: str) -> list[str]:
        if text:
            self._buf += text
        segments: list[str] = []
        while True:
            cut = self._next_cut()
            if cut is None:
                break
            piece = self._buf[:cut].strip()
            self._buf = self._buf[cut:]
            if piece:
                segments.extend(self._chunk(piece, first=self._emitted == 0))
                self._emitted += 1
        return segments

    def flush(self) -> list[str]:
        tail = self._buf.strip()
        self._buf = ""
        if not tail:
            return []
        pieces = self._chunk(tail, first=self._emitted == 0)
        if pieces:
            self._emitted += 1
        return pieces

    # -- internals ---------------------------------------------------------
    def _next_cut(self) -> int | None:
        buf = self._buf
        eager = self._emitted == 0
        for i, ch in enumerate(buf):
            if ch not in HARD_BREAKS and ch not in SOFT_BREAKS:
                continue
            end = i + 1
            while end < len(buf) and buf[end] in CLOSERS:
                end += 1
            candidate = buf[:end].strip()
            required = max(self.min_chars, self.first_min_chars) if eager else self.min_chars
            if len(candidate) < required:
                continue
            if ch in HARD_BREAKS:
                return end
            threshold = self.first_min_chars if eager else self.soft_min_chars
            if len(candidate) >= threshold:
                return end
        # No punctuation yet: force the first fragment out early, later ones at max length.
        if eager and len(buf) >= self.first_max_chars:
            return self.first_max_chars
        if not eager and len(buf) >= self.max_chars:
            return self._soft_cut(buf, self.max_chars)
        return None

    def _soft_cut(self, text: str, limit: int) -> int:
        floor = max(4, int(limit * 0.6))
        last_soft = -1
        for i, ch in enumerate(text[:limit]):
            if ch in SOFT_BREAKS and i + 1 >= floor:
                last_soft = i + 1
        return last_soft if last_soft > 0 else limit

    def _chunk(self, text: str, *, first: bool) -> list[str]:
        text = text.strip()
        if not text:
            return []
        if len(text) <= self.max_chars:
            return [text]
        pieces: list[str] = []
        current = ""
        for ch in text:
            current += ch
            soft = ch in SOFT_BREAKS and len(current) >= max(4, int(self.max_chars * 0.6))
            if soft or len(current) >= self.max_chars:
                piece = current.strip()
                if piece:
                    pieces.append(piece)
                current = ""
        tail = current.strip()
        if tail:
            pieces.append(tail)
        return pieces
