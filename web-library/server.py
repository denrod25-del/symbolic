#!/usr/bin/env python3
"""
Tiny HTTP server that serves the web-library static files and exposes
GET/PUT /api/books backed by the C++ CLI's SQLite database.

Run alongside the CLI on the same machine; the phone connects over LAN
(or via ngrok/mkcert if you need HTTPS for live camera scanning).

Usage:
    python3 server.py                 # defaults below
    python3 server.py --port 8443
    python3 server.py --db /some/path/library.db
"""

import argparse
import json
import mimetypes
import re
import sqlite3
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

# Set in main(). Threaded server + one connection per request means we
# don't have to juggle a shared connection across threads.
DB_PATH = None
STATIC_ROOT = Path(__file__).parent


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_metadata_column():
    """Add a nullable `metadata TEXT` column once, for web-only fields
    (notes, status, cover URL, etc.). The C++ CLI never touches it."""
    conn = connect()
    try:
        cols = [row["name"] for row in conn.execute("PRAGMA table_info(books)")]
        if "metadata" not in cols:
            conn.execute("ALTER TABLE books ADD COLUMN metadata TEXT")
            conn.commit()
    finally:
        conn.close()


def parse_year(value):
    """Extract a 4-digit year from anything the client sends."""
    if value is None:
        return 0
    m = re.search(r"\d{4}", str(value))
    return int(m.group(0)) if m else 0


def row_to_book(row):
    """SQLite row -> the JSON shape the web app already speaks."""
    md = {}
    if row["metadata"]:
        try:
            md = json.loads(row["metadata"])
        except json.JSONDecodeError:
            md = {}

    # Author is a single TEXT column in the C++ schema; the web app
    # thinks in arrays. Split on '; ' for round-tripping.
    author_str = row["author"] or ""
    authors = [a.strip() for a in author_str.split(";") if a.strip()]

    # If metadata carries a status, prefer that (owned/reading/lent/wishlist/resale);
    # otherwise fall back to the C++ CLI's available bool.
    status = md.get("status") or ("owned" if row["available"] else "lent")

    # C++ CHECK (year > 0) means we stored 1 when the year was unknown.
    # Metadata remembers whether that 1 was real or a placeholder.
    year_known = md.get("yearKnown", True)
    year = row["year"] if year_known else 0

    return {
        "id": f"b_{row['id']}",
        "isbn": row["isbn"] or "",
        "title": row["title"] or "",
        "authors": authors,
        "publishYear": str(year) if year else "",
        "cover": md.get("cover"),
        "status": status,
        "notes": md.get("notes", ""),
        "dateAdded": md.get("dateAdded", 0),
        "source": md.get("source", "server"),
        "publishers": md.get("publishers", []),
        "subjects": md.get("subjects", []),
        "pageCount": md.get("pageCount"),
        # Passed through so the web app can eventually surface digital books.
        "format": row["format"] or "physical",
        "filePath": row["file_path"] or "",
    }


def book_to_row(book):
    """Web-app Book -> (columns dict, metadata dict for JSON serialisation)."""
    authors = book.get("authors") or []
    status = book.get("status") or "owned"
    y = parse_year(book.get("publishYear"))
    year_known = y > 0

    columns = {
        "title": book.get("title") or "",
        "author": "; ".join(authors),
        # C++ schema has CHECK (year > 0); default to 1 for unknowns and
        # remember the truth in metadata.yearKnown.
        "year": y if year_known else 1,
        "available": 0 if status == "lent" else 1,
        "isbn": book.get("isbn") or "",
        "format": book.get("format") or "physical",
        "file_path": book.get("filePath") or None,
    }
    metadata = {
        "status": status,
        "notes": book.get("notes") or "",
        "cover": book.get("cover"),
        "dateAdded": book.get("dateAdded") or int(time.time() * 1000),
        "source": book.get("source") or "web",
        "publishers": book.get("publishers") or [],
        "subjects": book.get("subjects") or [],
        "pageCount": book.get("pageCount"),
        "yearKnown": year_known,
    }
    return columns, metadata


def id_from_client(cid):
    """Return the SQLite int id if the client's id looks like ours, else None."""
    if not cid:
        return None
    m = re.match(r"^b_(\d+)$", str(cid))
    return int(m.group(1)) if m else None


def reconcile_full_list(books):
    """PUT /api/books body: full array from the client. Update rows we
    already have, insert the rest, delete anything not in the array.
    Return the fresh full list so the client sees server-assigned ids."""
    conn = connect()
    try:
        existing = {row["id"]: row for row in conn.execute("SELECT * FROM books")}
        seen_ids = set()

        insert_sql = (
            "INSERT INTO books "
            "(title, author, year, available, isbn, format, file_path, metadata) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        update_sql = (
            "UPDATE books SET title=?, author=?, year=?, available=?, "
            "isbn=?, format=?, file_path=?, metadata=? WHERE id=?"
        )

        for book in books:
            cols, md = book_to_row(book)
            payload = (cols["title"], cols["author"], cols["year"],
                       cols["available"], cols["isbn"], cols["format"],
                       cols["file_path"], json.dumps(md))
            existing_id = id_from_client(book.get("id"))
            if existing_id is not None and existing_id in existing:
                conn.execute(update_sql, payload + (existing_id,))
                seen_ids.add(existing_id)
            else:
                cur = conn.execute(insert_sql, payload)
                seen_ids.add(cur.lastrowid)

        for stale_id in set(existing.keys()) - seen_ids:
            conn.execute("DELETE FROM books WHERE id=?", (stale_id,))

        conn.commit()
        return [row_to_book(r) for r in
                conn.execute("SELECT * FROM books ORDER BY id DESC")]
    finally:
        conn.close()


class Handler(BaseHTTPRequestHandler):
    # Silence the default one-line-per-request access log; keep 4xx/5xx.
    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    # ---- helpers ----
    def _json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        n = int(self.headers.get("content-length", 0))
        return json.loads(self.rfile.read(n)) if n else None

    # ---- routes ----
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET, PUT, OPTIONS")
        self.send_header("access-control-allow-headers", "content-type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/books":
            conn = connect()
            try:
                rows = conn.execute("SELECT * FROM books ORDER BY id DESC").fetchall()
            finally:
                conn.close()
            self._json([row_to_book(r) for r in rows])
            return
        if path == "/api/health":
            self._json({"ok": True, "db": DB_PATH})
            return
        self._serve_static(path)

    def do_PUT(self):
        if self.path == "/api/books":
            body = self._read_json()
            if not isinstance(body, list):
                self._json({"error": "expected JSON array"}, 400)
                return
            try:
                self._json(reconcile_full_list(body))
            except sqlite3.IntegrityError as e:
                self._json({"error": str(e)}, 400)
            return
        self.send_error(404)

    def _serve_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/")
        full = (STATIC_ROOT / rel).resolve()
        # Guard against path traversal.
        try:
            full.relative_to(STATIC_ROOT.resolve())
        except ValueError:
            self.send_error(403)
            return
        if not full.is_file():
            self.send_error(404)
            return
        ct = mimetypes.guess_type(str(full))[0] or "application/octet-stream"
        data = full.read_bytes()
        self.send_response(200)
        self.send_header("content-type", ct)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    global DB_PATH
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default="../cpp-book-library/library.db",
                    help="path to the SQLite database (default: %(default)s)")
    ap.add_argument("--host", default="0.0.0.0",
                    help="interface to bind (0.0.0.0 = all)")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    DB_PATH = str(Path(args.db).resolve())
    if not Path(DB_PATH).exists():
        print(f"error: database not found: {DB_PATH}", file=sys.stderr)
        print("       run the C++ CLI once to create it, or pass --db",
              file=sys.stderr)
        sys.exit(1)
    ensure_metadata_column()

    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"serving {STATIC_ROOT}")
    print(f"database: {DB_PATH}")
    print(f"open http://{args.host}:{args.port}/ on this machine, "
          f"or http://<LAN-IP>:{args.port}/ from your phone")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
