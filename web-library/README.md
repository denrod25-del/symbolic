# web-library

Phone-friendly view of the book library. Single HTML file, no build step,
data lives in browser `localStorage`.

## Run it on your phone over Wi-Fi

```bash
cd web-library
python3 -m http.server 8000
```

On your phone (same Wi-Fi), open `http://<your-computer-ip>:8000/`.
Find the IP with `ip addr` (Linux/WSL) or `ifconfig` (macOS) — look for a
`192.168.x.x` or `10.x.x.x` line.

## Camera scanning needs HTTPS

Browsers only grant `getUserMedia` (camera access) on **HTTPS** or
**localhost**. Plain HTTP to a LAN IP will load the page fine but the
"Start Camera" button will fail. Three workable options:

1. **Manual ISBN entry** — works over plain HTTP. Type the 13 digits printed
   above the barcode.
2. **HTTPS via `caddy` + `mkcert`** — one-time local cert setup:
   ```bash
   mkcert -install
   mkcert your-computer.local 192.168.1.x
   caddy file-server --listen :8443 --cert ./your-computer.local+1.pem --key ./your-computer.local+1-key.pem
   ```
3. **HTTPS via `ngrok`** — easiest if you have it: `ngrok http 8000` prints a
   public `https://...` URL you can open on the phone.

## Importing your existing library.db

The C++ CLI in `../cpp-book-library/` stores books in SQLite. To copy them
into the web app:

```bash
cd web-library
python3 import-from-sqlite.py
# default: reads ../cpp-book-library/library.db, writes ./library.json
```

Then in the web app: **Stats** tab -> **Import** -> **Choose JSON file** ->
pick `library.json`. Books are matched by ISBN; duplicates are skipped so
re-importing is safe.

Custom paths:

```bash
python3 import-from-sqlite.py /path/to/library.db /path/to/out.json
```

## Where the data lives

Each browser keeps its own copy in `localStorage` (~5 MB, comfortably enough
for thousands of book records). There is **no server and no sync between
devices** — use **Stats -> Export JSON** to back up or move data manually.

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

The key is stored only in your browser's `localStorage` and sent directly to
`api.anthropic.com`. Anthropic requires the
`anthropic-dangerous-direct-browser-access: true` header for browser-origin
requests — the app sends it automatically. This is a personal-use pattern;
don't reuse it for a public web app you'd deploy for other users.

## Files

- `index.html` — the entire app (HTML/CSS/JS in one file)
- `import-from-sqlite.py` — SQLite -> JSON converter (Python 3, stdlib only)
