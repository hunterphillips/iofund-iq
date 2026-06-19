#!/usr/bin/env bash
# Copies the repo-root data/*.md files into chat/_data/ so the Next.js build
# can bundle them. Runs in both predev and prebuild; idempotent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHAT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$CHAT_DIR/../data"
DEST="$CHAT_DIR/_data"

if [ ! -d "$SRC" ]; then
  echo "copy-data: source dir $SRC not found; skipping (data may not exist in this environment)"
  exit 0
fi

mkdir -p "$DEST"

# Copy markdown docs at the data/ root.
shopt -s nullglob
md_files=("$SRC"/*.md)
if [ ${#md_files[@]} -gt 0 ]; then
  cp "${md_files[@]}" "$DEST/"
fi

# NOTE: distilled article bodies are no longer copied — they live in Postgres
# (articles.body) and render live; data/articles/ was removed 2026-06-19.

# Copy weekly digest files if any exist.
if [ -d "$SRC/digests" ]; then
  mkdir -p "$DEST/digests"
  shopt -s nullglob
  digest_files=("$SRC/digests"/*.md)
  if [ ${#digest_files[@]} -gt 0 ]; then
    cp "${digest_files[@]}" "$DEST/digests/"
  fi
fi

echo "copy-data: synced data/ → chat/_data/"
