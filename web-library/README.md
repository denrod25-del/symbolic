# web-library

Phone-friendly view of the book library. Single HTML file, no build step.
Runs in one of two modes — the app picks the right one automatically.

## Two ways to run

### 1. Server mode — shares one database with the C++ CLI (recommended)

```bash
cd web-library
python3 server.py           # defaults: ../cpp-book-library/library.db on :8000
# or:
python3 server.py --port 8443 --db /path/to/library.db
```

On your phone (same Wi-Fi), open `http://<your-computer-ip>:8000/`.
Find the IP with `ip addr` (Linux/WSL) or `ifconfig` (macOS) — look for a
`192.168.x.x` or `10.x.x.x` line.

Every add/edit/delete on the phone writes straight into `library.db`. The C++
CLI reads the same file, so scans on either side are instantly visible on
the other. Search on the phone searches the SQLite database.

The server also serves the static `index.html`, so you don't need
`python3 -m http.server`. And it adds one nullable `metadata` column to the
`books` table on first run for web-only fields (notes, status, cover URL);
the C++ CLI ignores that column.

### 2. Local mode — standalone in the browser, no server

```bash
cd web-library
python3 -m http.server 8000
```

Same URL from the phone, but the app falls back to `localStorage`. Each
device keeps its own copy; no sync. Useful if you don't want to run the
Python server, or you want to try the app before wiring it to the DB.

The app decides which mode it's in by pinging `GET /api/books` on load — if
that responds, it's server mode; otherwise localStorage. Check your browser
console for a `Store: server mode` / `Store: local mode` line if you're
unsure.

## Camera scanning needs HTTPS

Browsers only grant `getUserMedia` (camera access) on **HTTPS** or
**localhost**. Plain HTTP to a LAN IP loads the page fine but the live
"Start Camera" button will fail with a permission error. Options:

1. **Use one of the non-live routes** — they all work over plain HTTP:
   manual ISBN entry, upload a photo of the barcode from your gallery,
   search Open Library, or (optional) AI cover ID.
2. **HTTPS via `caddy` + `mkcert`** — one-time local cert setup, then serve:
   ```bash
   mkcert -install
   mkcert your-computer.local 192.168.1.x
   # Then reverse-proxy from https to server.py, or use caddy for both.
   ```
3. **HTTPS via `ngrok`** — easiest if you have it: `ngrok http 8000` prints a
   public `https://...` URL you can open on the phone.

## Adding books without a barcode

The Add Book tab has three routes for books that aren't easy to scan live:

1. **Upload barcode photo** — pick a photo of the back-cover barcode from
   your gallery. Runs the same ZXing decoder on a still image. Handy when
   the live camera won't focus on small paperbacks or glossy covers.
2. **Search Open Library** — type the title and/or author. Free, no API key
   required. Results show as cards; tap one to add it.
3. **Identify cover (AI)** *(optional)* — paste an Anthropic API key on the
   Stats tab and a new button appears in Add Book. Snap the cover, the app
   sends the image to Claude Vision, extracts title/author/ISBN, and either
   looks it up (if an ISBN was visible) or hands the extracted text to the
   Open Library search step so you can pick the right edition.

The AI key is stored only in your browser's `localStorage` and sent directly
to `api.anthropic.com`. Anthropic requires the
`anthropic-dangerous-direct-browser-access: true` header for browser-origin
requests — the app sends it automatically. This is a personal-use pattern;
don't reuse it for a public web app you'd deploy for other users.

## One-shot import from library.db (local mode only)

If you'd rather stay in local mode but seed the browser with your existing
SQLite books:

```bash
python3 import-from-sqlite.py         # writes ./library.json
# or with custom paths:
python3 import-from-sqlite.py /path/to/library.db /path/to/out.json
```

Then in the web app: **Stats** tab → **Import** → **Choose JSON file** →
pick `library.json`. Books are matched by ISBN; duplicates are skipped so
re-importing is safe. Not needed in server mode — the app already reads
directly from the database.

## Files

- `index.html` — the entire app (HTML/CSS/JS in one file)
- `server.py` — Python HTTP server (stdlib only) that hosts the app and
  exposes `library.db` over `/api/books`
- `import-from-sqlite.py` — SQLite → JSON converter, for local-mode seeding
