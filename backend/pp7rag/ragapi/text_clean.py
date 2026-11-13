"""Strip reference markers such as [1] from model output.

The product no longer shows references, so any marker the model still emits must
never reach the user or the speech synthesizer. A streaming-safe filter is needed
because a marker can be split across token deltas ("[" then "1]").
"""
from __future__ import annotations

import re

_MARKER = re.compile(r"\[\d{1,2}\]")
_TAIL = re.compile(r"\[\d{1,2}$")


def strip_citations(text: str) -> str:
    """Remove complete [n] markers and collapse the space they leave behind."""
    if not text:
        return text
    cleaned = _MARKER.sub("", text)
    return cleaned.replace(" ，", "，").replace(" 。", "。")


class CitationFilter:
    """Incremental filter: emits text while holding back a possible marker tail."""

    def __init__(self) -> None:
        self._pending = ""
        self._skip_space = False

    def feed(self, delta: str) -> str:
        buffer = self._pending + (delta or "")
        if self._skip_space and buffer.startswith(" "):
            buffer = buffer[1:]
        self._skip_space = False
        out: list[str] = []
        index = 0
        length = len(buffer)
        while index < length:
            char = buffer[index]
            if char == "[":
                close = buffer.find("]", index, min(length, index + 4))
                if close != -1 and 1 <= close - index - 1 <= 2 and buffer[index + 1:close].isdigit():
                    index = close + 1  # complete marker: drop it
                    if index < length and buffer[index] == " ":
                        index += 1  # also drop the separator space
                    else:
                        self._skip_space = index >= length
                    continue
                if close == -1 and len(buffer) - index <= 4:
                    break  # might still become a marker: wait for the next delta
            out.append(char)
            index += 1
        self._pending = buffer[index:]
        return "".join(out)

    def flush(self) -> str:
        pending = self._pending
        self._pending = ""
        return strip_citations(pending)
