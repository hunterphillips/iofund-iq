---
name: pdf-extract
description: Extract text from a PDF file when the Read tool fails because poppler/pdftoppm isn't installed. Useful for customer-supplied notes PDFs, SOWs, and other engagement materials. Auto-falls back to pypdf if pdftotext is unavailable.
---

# pdf-extract — Local PDF Text Extraction

## Overview

Bash wrapper that prints PDF text to stdout. Tries tools in this order:

1. `pdftotext` (poppler) — preserves layout best
2. `pypdf` (Python) — pure-Python fallback; auto-installed via `pip --user` on first run

Use this whenever the built-in Read tool errors with a poppler/pdftoppm message and the user hasn't installed poppler.

## Usage

```bash
.claude/skills/pdf-extract/pdf-extract.sh <pdf-path> [pages]
```

**Args:**
| Arg | Meaning | Example |
|---|---|---|
| `<pdf-path>` | Path to PDF (absolute or relative). Quote if it has spaces. | `"Discovery Workshops - notes.pdf"` |
| `[pages]` | Optional. Single page (`3`) or range (`1-5`). 1-indexed. | `1-3` |

## Examples

```bash
# Whole document
.claude/skills/pdf-extract/pdf-extract.sh "Discovery Workshops - notes.pdf"

# Pages 1–5 only
.claude/skills/pdf-extract/pdf-extract.sh customer-discovery/docs/project-files/SOW.pdf 1-5

# Single page
.claude/skills/pdf-extract/pdf-extract.sh notes.pdf 7
```

## Output

Plain text to stdout. Page boundaries marked `--- Page N ---` when using the pypdf fallback. Pipe to a file or grep as needed.

## First-Run Behavior

If neither `pdftotext` nor `pypdf` is present, the script will `pip install --user pypdf` (with `--break-system-packages` on Python 3.12+). One-time, ~1 MB. Prefer `brew install poppler` for better layout fidelity if the user is open to it.

## Limitations

- Image-only / scanned PDFs return little or no text — needs OCR (out of scope for this skill).
- Complex multi-column layouts may interleave columns when using pypdf; pdftotext handles them better with `-layout`.
