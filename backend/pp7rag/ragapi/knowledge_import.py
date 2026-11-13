"""Import DOCX/PDF/Markdown into the knowledge base with a preview step.

Flow: upload -> parse to markdown -> chunk preview (nothing written) -> commit
(write docs/<name>.md and rebuild the index). Parsing is best effort: DOCX headings
map to markdown headings so the existing heading-based chunker works well.
"""
from __future__ import annotations

import io
import logging
import re
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from pp7rag.config import settings
from pp7rag.knowledge.indexer import indexer
from pp7rag.knowledge.loader import MAX_SECTION_CHARS, SECTION_OVERLAP, chunk_text, load_markdown_files, split_by_heading

logger = logging.getLogger(__name__)

SUPPORTED_SUFFIXES = {".md", ".markdown", ".txt", ".docx", ".pdf"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_CHUNK_CHARS = 900


class ImportError_(Exception):
    """Uploaded file could not be converted into markdown."""


def _docx_to_markdown(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    document = Document(io.BytesIO(data))
    blocks: list[str] = []
    for paragraph in document.paragraphs:
        text = (paragraph.text or "").strip()
        if not text:
            continue
        style = (paragraph.style.name if paragraph.style is not None else "") or ""
        match = re.match(r"^Heading (\d)$", style) or re.match(r"^标题 (\d)$", style)
        if match:
            level = min(max(int(match.group(1)), 1), 4)
            blocks.append("#" * level + " " + text)
        elif style.lower().startswith("title"):
            blocks.append("# " + text)
        else:
            blocks.append(text)
    if document.tables:
        for table in document.tables:
            rows = []
            for row in table.rows:
                cells = [(cell.text or "").strip().replace("\n", " ") for cell in row.cells]
                rows.append("| " + " | ".join(cells) + " |")
            if rows:
                blocks.append("\n".join(rows))
        warnings.append(f"已将 {len(document.tables)} 个表格按纯文本行导入")
    if document.inline_shapes:
        warnings.append(f"图片未导入（{len(document.inline_shapes)} 个），如需展示请自行补充说明文字")
    return "\n\n".join(blocks), warnings


def _pdf_to_markdown(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:  # some pages fail to extract
            warnings.append(f"第 {index} 页解析失败：{exc}")
            continue
        if text:
            pages.append(text)
    if not pages:
        raise ImportError_("PDF 中没有可提取的文字（可能是扫描件）")
    if len(reader.pages) > 1:
        warnings.append(f"PDF 共 {len(reader.pages)} 页，已按页拼接")
    return "\n\n".join(pages), warnings


def parse_document(filename: str, data: bytes) -> tuple[str, str, list[str]]:
    """Return (title, markdown, warnings)."""
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise ImportError_(f"不支持的文件类型：{suffix or '(无扩展名)'}，支持 md/txt/docx/pdf")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ImportError_("文件超过 20MB 上限")
    if not data:
        raise ImportError_("文件内容为空")
    title = Path(filename).stem.strip() or "未命名文档"
    if suffix in (".md", ".markdown", ".txt"):
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("gbk", errors="replace")
            return title, text, ["文件不是 UTF-8，已按 GBK 解码，请检查是否乱码"]
        return title, text, []
    if suffix == ".docx":
        markdown, warnings = _docx_to_markdown(data)
        return title, markdown, warnings
    markdown, warnings = _pdf_to_markdown(data)
    return title, markdown, warnings


def chunk_markdown(markdown: str, title: str) -> list[dict]:
    """Preview chunks — uses the same rules as the indexer so preview == index."""
    text = (markdown or "").strip()
    chunks: list[dict] = []
    for section in split_by_heading(text):
        section = section.strip()
        if not section:
            continue
        heading = ""
        first_line = section.splitlines()[0]
        if first_line.startswith("#"):
            heading = first_line.lstrip("# ").strip()
        pieces = [section] if len(section) <= MAX_SECTION_CHARS else chunk_text(
            section, max_chars=MAX_SECTION_CHARS, overlap=SECTION_OVERLAP
        )
        for piece in pieces:
            piece = piece.strip()
            if piece:
                chunks.append({"title": heading or title, "text": piece, "chars": len(piece)})
    return chunks


def preview(filename: str, data: bytes) -> dict:
    title, markdown, warnings = parse_document(filename, data)
    chunks = chunk_markdown(markdown, title)
    return {
        "filename": filename,
        "title": title,
        "markdown": markdown[:20000],
        "markdown_chars": len(markdown),
        "chunks": [{"index": index, "title": chunk["title"], "text": chunk["text"], "chars": chunk["chars"]}
                   for index, chunk in enumerate(chunks)],
        "warnings": warnings,
    }


def _docs_dir() -> Path:
    return Path(settings.data_dir) / "docs"


def commit(filename: str, markdown: str) -> dict:
    """Write docs/<safe-name>.md and rebuild the index. Blocking: call in a thread."""
    docs_dir = _docs_dir()
    docs_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(filename).stem.strip() or "未命名文档"
    safe = re.sub(r'[\\/:*?"<>|]+', "_", stem)[:80]
    target = docs_dir / f"{safe}.md"
    target.write_text(markdown.strip() + "\n", encoding="utf-8")
    chunks = load_markdown_files(docs_dir)
    indexer.index_chunks(chunks)
    logger.info("knowledge_committed file=%s chunks=%d", target.name, len(chunks))
    return {"filename": target.name, "path": str(target), "chunks": len(chunks),
            "documents": len(list(docs_dir.glob("*.md")))}


def rebuild() -> dict:
    """Rebuild the whole index from docs/ (blocking: call in a thread)."""
    docs_dir = _docs_dir()
    docs_dir.mkdir(parents=True, exist_ok=True)
    chunks = load_markdown_files(docs_dir)
    if not chunks:
        return {"status": "no_docs", "chunks": 0}
    indexer.index_chunks(chunks)
    return {"status": "rebuilt", "chunks": len(chunks), "documents": len(list(docs_dir.glob("*.md")))}


def list_documents() -> list[dict]:
    docs_dir = _docs_dir()
    rows = []
    for path in sorted(docs_dir.glob("*.md")):
        stat = path.stat()
        rows.append({"name": path.name, "size": stat.st_size, "modified_at": stat.st_mtime})
    return rows


def delete_document(name: str) -> bool:
    docs_dir = _docs_dir()
    candidate = (docs_dir / name).resolve()
    if docs_dir.resolve() not in candidate.parents or candidate.suffix.lower() != ".md":
        return False
    if not candidate.exists():
        return False
    candidate.unlink()
    rebuild()
    return True
