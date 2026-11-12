import re
from pathlib import Path

MAX_SECTION_CHARS = 500
SECTION_OVERLAP = 50


def load_markdown_files(directory: Path) -> list[dict]:
    """Parse markdown files into chunks with metadata. Returns [{text, title, chunk_index}].

    Sections are split by '## ' headings; sections longer than MAX_SECTION_CHARS are
    further windowed so a heading-less PDF/DOCX still produces focused chunks.
    """
    chunks = []
    for md_file in sorted(directory.glob("*.md")):
        text = md_file.read_text(encoding="utf-8")
        title = md_file.stem
        index = 0
        for section in split_by_heading(text):
            section = section.strip()
            if not section:
                continue
            pieces = [section] if len(section) <= MAX_SECTION_CHARS else chunk_text(
                section, max_chars=MAX_SECTION_CHARS, overlap=SECTION_OVERLAP
            )
            for piece in pieces:
                piece = piece.strip()
                if not piece:
                    continue
                chunks.append({"text": piece, "title": title, "chunk_index": index})
                index += 1
    return chunks

def split_by_heading(text: str) -> list[str]:
    """Split markdown by ## headings, keeping heading with content."""
    parts = re.split(r'\n(?=## )', text)
    return [p.strip() for p in parts if p.strip()]

def chunk_text(text: str, max_chars: int = 500, overlap: int = 80) -> list[str]:
    """Split long text into overlapping chunks of max_chars."""
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunks.append(text[start:end])
        start = end - overlap
    return chunks
