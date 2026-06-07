#!/usr/bin/env python3
"""
Convert the C++ CLI's library.db into a JSON file that the web app can import.

Usage:
    python3 import-from-sqlite.py [db_path] [out_path]

Defaults:
    db_path  = ../cpp-book-library/library.db
    out_path = ./library.json

Then in the web app: Stats tab -> Import -> Choose JSON file.
"""

import json
import sqlite3
import sys
import time
from pathlib import Path


def book_from_row(row, index, now_ms):
    isbn = (row["isbn"] or "").strip()

    # Open Library serves covers at this URL; default=false makes it actually
    # 404 when no cover exists (otherwise it returns a 1x1 transparent that
    # bypasses the web app's onerror fallback).
    cover = (
        f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false"
        if isbn else None
    )

    # The C++ schema's `available` bool maps to the web app's status enum.
    # Anything more nuanced (lent to whom, reading progress) lives in `notes`.
    status = "owned" if row["available"] else "lent"

    # The web app has no first-class field for digital books, so we stash the
    # format tag and file path in notes.
    notes_parts = []
    fmt = row["format"] or "physical"
    if fmt != "physical":
        notes_parts.append(f"[{fmt}]")
    if row["file_path"]:
        notes_parts.append(row["file_path"])
    notes = " ".join(notes_parts)

    return {
        # Prefix keeps imported ids from colliding with browser-generated ones.
        "id": f"b_sqlite_{row['id']}",
        "isbn": isbn,
        "title": row["title"],
        "authors": [row["author"]] if row["author"] else [],
        "publishYear": str(row["year"]) if row["year"] else "",
        "cover": cover,
        "status": status,
        "notes": notes,
        # Stagger by 1 ms per book so "newest" sort preserves insertion order.
        "dateAdded": now_ms + index,
        "source": "sqlite-import",
    }


def main():
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("../cpp-book-library/library.db")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("library.json")

    if not db_path.exists():
        print(f"error: {db_path} not found", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, title, author, year, available, isbn, format, file_path "
        "FROM books ORDER BY id"
    ).fetchall()

    now_ms = int(time.time() * 1000)
    books = [book_from_row(r, i, now_ms) for i, r in enumerate(rows)]

    out_path.write_text(json.dumps(books, indent=2, ensure_ascii=False))
    print(f"exported {len(books)} books -> {out_path}")


if __name__ == "__main__":
    main()
