# C++ WebSocket System Monitor

A from-scratch C++17 WebSocket server (RFC 6455) that samples CPU and memory
usage from `/proc` once per second and pushes JSON snapshots to a Chart.js
dashboard. No external libraries — just POSIX sockets and the standard library.

```
┌──────────────┐     TCP / WS      ┌────────────────┐
│ Browser tab  │ ◄──── frames ──── │ C++ server     │
│ Chart.js UI  │ ──── frames ────► │ (port 8080)    │
└──────────────┘                   │  ┌──────────┐  │
                                   │  │ sampler  │──┼──► /proc/stat
                                   │  │ thread   │──┼──► /proc/meminfo
                                   │  └──────────┘  │
                                   └────────────────┘
```

## Build & run

```sh
cd server
make
./monitor-server          # listens on 0.0.0.0:8080
./monitor-server 9000     # custom port
```

Open `client/index.html` directly in a browser, or serve it from anywhere.
The page connects to `ws://<this-host>:8080`.

If you need to serve the static page over HTTP (e.g. browsers blocking
`file://` WebSocket connections), any one-liner works:

```sh
cd client && python3 -m http.server 8000
```

Requires Linux for `/proc` access. The WebSocket layer itself is portable.

## What's actually in the box

| File | Purpose |
| --- | --- |
| `server/sha1.hpp` | FIPS 180-4 SHA-1 used by the handshake |
| `server/base64.hpp` | Base64 encoder for `Sec-WebSocket-Accept` |
| `server/websocket.hpp` | Handshake parsing + RFC 6455 frame encoding |
| `server/system_stats.hpp` | `/proc/stat` and `/proc/meminfo` readers |
| `server/main.cpp` | TCP accept loop, sampler thread, broadcast hub |
| `client/index.html` | Chart.js dashboard with auto-reconnect |

---

## The WebSocket protocol, briefly

WebSocket is defined by **RFC 6455**. It runs over a normal TCP connection on
the same ports as HTTP (80/443) and starts life as an HTTP request. Once the
upgrade is complete, the connection becomes a full-duplex message-oriented
channel — the server can push to the client at any time, no polling needed.

### 1. The handshake (`websocket.hpp::handshake_response`)

The client opens a TCP connection and sends an HTTP/1.1 request:

```
GET / HTTP/1.1
Host: localhost:8080
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

The server validates the `Upgrade` and `Connection` headers, takes the
`Sec-WebSocket-Key`, appends the magic GUID
`258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, SHA-1s the result, base64-encodes the
20-byte digest, and replies:

```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

The GUID dance is intentionally pointless cryptographically — it exists so a
non-WebSocket-aware HTTP cache can't accidentally produce a valid `Accept`
value and trick a browser into thinking a plain HTTP server speaks WebSocket.

### 2. Frame format (`websocket.hpp::encode_text_frame`)

After the handshake, both sides exchange **frames**, not HTTP messages:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+-------------------------------+
|     Extended payload length continued, if payload len == 127  |
+-------------------------------+-------------------------------+
|                  Masking-key, if MASK set to 1                |
+-------------------------------+-------------------------------+
|                          Payload Data                         |
+---------------------------------------------------------------+
```

- **FIN** = 1 means "this is the final frame of a message". We never fragment.
- **Opcode**: `0x1` text, `0x2` binary, `0x8` close, `0x9` ping, `0xA` pong.
  This server only emits `0x1` and `0x8`.
- **MASK**: client→server frames *must* be masked with a 4-byte XOR key.
  Server→client frames *must not* be masked. Masking exists to defeat a
  cache-poisoning attack against intermediate proxies, not for confidentiality.
- **Payload length** uses a clever variable encoding to keep small frames
  small: 0–125 fits in 7 bits, 126 means "next 2 bytes are the real length",
  127 means "next 8 bytes are the real length".

A 50-byte text frame from this server is just `0x81 0x32` followed by the
50-byte UTF-8 payload. That's the whole "protocol" once handshake is done.

### 3. What we *don't* implement

Real-world WebSocket libraries also handle:

- **Fragmentation**: opcode `0x0` continuation frames + the FIN bit let you
  stream a single message in chunks. Not needed here — every snapshot fits
  comfortably in one frame.
- **Ping/pong** (`0x9`/`0xA`): keepalive. Browsers handle this transparently.
- **`permessage-deflate`**: the standard compression extension, negotiated
  via `Sec-WebSocket-Extensions`. Worth it for chatty text traffic; overkill
  for ~80 bytes/sec.
- **TLS** (`wss://`): you'd terminate it at a reverse proxy (nginx, Caddy)
  rather than re-implementing TLS in this server.

---

## Real-time architecture

There are three concurrent actors:

```
                 ┌─────────────────────┐
                 │  ClientHub          │
                 │  - mutex            │
                 │  - set<int> fds     │◄─ broadcast(frame)
                 └──┬──────────────────┘
   register fd ─►   │   ▲
   unregister fd ─► │   │
                 ┌──┴───┴───────────┐    ┌─────────────────────┐
                 │ accept loop      │    │ sampler thread      │
                 │ (main thread)    │    │ - reads /proc/stat  │
                 │ spawns one       │    │ - reads /proc/meminfo│
                 │ thread per conn  │    │ - encodes 1 frame   │
                 └──────────────────┘    │ - hub.broadcast()   │
                          │              └─────────────────────┘
                          ▼
                 ┌──────────────────┐
                 │ per-client thread│
                 │ - handshake      │
                 │ - register fd    │
                 │ - drain inbound  │
                 │   (close detect) │
                 └──────────────────┘
```

### Why one sampler, many clients?

CPU usage is a **delta** — `(busy_now - busy_then) / (total_now - total_then)`.
If every client thread sampled independently, they'd all read `/proc/stat`
and compute slightly different intervals. Worse, with five clients you'd hit
`/proc` five times a second instead of once.

The sampler thread reads `/proc` once per tick, formats one JSON payload,
encodes it into one WebSocket frame, and the `ClientHub` fans that single
frame out to every registered socket. Clients are write-only from the
server's perspective.

### Why thread-per-connection?

For a system monitor with maybe a handful of viewers, this is the simplest
correct model. Each thread blocks in `recv()` so we get OS-level
notification when the peer closes — no polling, no timer wheel. The cost is
linear in client count, which is fine until you'd want hundreds of dashboards
open simultaneously. At that point you'd switch to `epoll` + a small thread
pool, but you wouldn't change anything else: the sampler/hub split is the
same shape either way.

### Backpressure

If a client's TCP send buffer fills (slow network, paused JS tab),
`send()` blocks. The current implementation accepts that blocking under the
hub's mutex, which means a single slow client briefly stalls broadcasts to
others. For a single-digit number of dashboards on a LAN this is invisible;
for a public deployment you'd want a per-client outbound queue with a drop
policy (e.g. coalesce into the latest sample and drop intermediate frames —
losing a stat sample is fine, falling further behind is not).

### Sampling cadence

The dashboard updates once per second, which matches the sampler tick. The
window holds 60 samples (one minute of history) and slides forward — a
fixed-size ring on the client, never an unbounded array. Chart.js renders
with `animation: false` so each update is a paint, not a tween.

### Reconnection

Browsers don't reconnect on close — the page does, with a 500 ms → 8 s
exponential backoff. That makes the dashboard survive `make && ./monitor-server`
restarts without a manual refresh.
