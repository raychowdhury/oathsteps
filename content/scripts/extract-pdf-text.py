#!/usr/bin/env python3
"""Extract text from the official USCIS question-bank PDFs.

Reproduces content/sources/*.txt from the PDFs. Run with:
    uv run --with pypdf python3 content/scripts/extract-pdf-text.py
Pure text extraction; no interpretation happens here. The ingest step
(content/scripts/ingest.ts) parses the resulting text.
"""
from pathlib import Path

import pypdf

SOURCES = Path(__file__).resolve().parent.parent / "sources"

for name in ("2025-128q.pdf", "2008-100q.pdf"):
    reader = pypdf.PdfReader(SOURCES / name)
    text = "\n".join(
        f"=== PAGE {i + 1} ===\n" + (page.extract_text() or "")
        for i, page in enumerate(reader.pages)
    )
    (SOURCES / name.replace(".pdf", ".txt")).write_text(text)
    print(name, len(reader.pages), "pages", len(text), "chars")
