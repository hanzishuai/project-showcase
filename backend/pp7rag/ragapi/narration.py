"""Load ordered narration from saved Markdown, independently of the vector index."""
from pathlib import Path
import re
import unicodedata

from pp7rag.config import settings

MAX_CHARS = 2_000_000
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")
TERMINATOR = re.compile(r"[。！？!?；;]+[”’」』）)]*|\.(?=\s|$)")


def script_directory() -> Path:
    return settings.data_dir / "narration"


def normalize_title(value: str) -> str:
    value = re.sub(r"\.md$", "", value.strip(), flags=re.I)
    return re.sub(r"[\s《》「」“”\"']+", "", unicodedata.normalize("NFKC", value)).casefold()


def _plain(line: str) -> str:
    line = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", line)
    line = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", line)
    line = re.sub(r"^(?:>\s*|[-+*]\s+|\d+[.)]\s+)", "", line)
    line = re.sub(r"([*_~`]+)(.+?)\1", r"\2", line)
    return line.strip()


def _segments(text: str):
    start = 0
    for end in [m.end() for m in TERMINATOR.finditer(text)] + [len(text)]:
        sentence = text[start:end].strip()
        start = end
        for offset in range(0, len(sentence), 500):
            yield sentence[offset:offset + 500]


def document_parts(markdown: str) -> list[dict]:
    sections: list[dict] = []
    current = {"title": "正文", "segments": []}
    for raw in markdown.splitlines():
        line = raw.strip()
        if not line or line.startswith(("```", "~~~")) or re.fullmatch(r"[-|: ]{3,}", line):
            continue
        if match := HEADING.match(line):
            if current["segments"]:
                sections.append(current)
            current = {"title": _plain(match[1]), "segments": []}
            line = match[1]
        current["segments"].extend(_segments(_plain(line)))
    if current["segments"]:
        sections.append(current)
    return sections


def load_document(title: str, source: str | None = None) -> dict:
    requested = normalize_title(title)
    if not requested:
        raise LookupError("请告诉我想朗读哪篇文档。")
    roots = {"script": script_directory(), "document": settings.data_dir / "docs"}
    exact, partial = [], []
    for kind, directory in roots.items():
        if source and kind != source:
            continue
        for path in sorted(directory.glob("*.md")):
            if not path.is_file() or path.resolve().parent != directory.resolve():
                continue
            try:
                with path.open(encoding="utf-8-sig") as handle:
                    first = handle.read(2048)
            except (OSError, UnicodeError):
                continue
            header = next((match[1] for line in first.splitlines() if (match := HEADING.match(line.strip()))), "")
            aliases = [normalize_title(path.stem), normalize_title(header)]
            candidate = (path, kind, header or path.stem)
            if requested in aliases:
                exact.append(candidate)
            elif any(requested in alias for alias in aliases):
                partial.append(candidate)
    matches = exact or partial
    if title.strip().lower().endswith(".md"):
        named_files = [match for match in matches if normalize_title(match[0].name) == requested]
        matches = named_files or matches
    if not matches:
        raise LookupError("没找到这篇文档，请确认标题。")
    if len(matches) > 1:
        options = "、".join(f"《{name}》（{'讲解稿' if kind == 'script' else '知识库'}，{path.stem}）"
                           for path, kind, name in matches[:5])
        raise LookupError(f"找到了多篇，请指定其中一篇：{options}")
    path, kind, name = matches[0]
    with path.open(encoding="utf-8-sig") as handle:
        markdown = handle.read(MAX_CHARS + 1)
    if len(markdown) > MAX_CHARS:
        raise ValueError("文档超出朗读长度上限。")
    sections = document_parts(markdown)
    if not sections:
        raise ValueError("没有提取到可朗读的正文。")
    return {"title": name, "source": kind, "sections": sections}
