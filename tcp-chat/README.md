# tcp-chat

A minimal two-party TCP chat app in C++ using POSIX sockets. Designed as a teaching example - the source files are heavily commented with the *why* behind each syscall.

## Build

```sh
make
```

Produces two binaries: `./server` and `./client`. Requires a C++17 compiler and a POSIX system (Linux, macOS, WSL).

## Run

In one terminal:

```sh
./server
```

In another:

```sh
./client                    # defaults to 127.0.0.1:5555
./client 192.168.1.42 5555  # connect to a remote host
```

Type a line in either terminal and hit Enter; it appears in the other. `Ctrl-D` (EOF on stdin) closes cleanly. Only one client at a time - this is deliberately simple.

## Networking fundamentals, condensed

| Concept | What it means here |
|---|---|
| **TCP** | Reliable, ordered, byte-stream transport. Lost packets get retransmitted by the kernel; we just see a clean `read`/`write` interface. |
| **Socket** | A file descriptor that names one end of a connection. `read`/`write`/`close` work on it just like a file. |
| **Port** | 16-bit number identifying a service on a host. We use 5555 (anything ≥ 1024 is unprivileged). |
| **`htons` / `ntohs`** | Convert between host and network byte order. Network protocols use big-endian; x86/ARM are little-endian, so a swap is required. |
| **`INADDR_ANY`** | "Bind to every local interface" - loopback, ethernet, wifi, etc. |
| **Three-way handshake** | `connect()` sends SYN, server replies SYN/ACK, client sends ACK. After that, the connection is established. |
| **`accept()`** | Pulls one completed handshake off the listen queue and returns a brand-new socket dedicated to that client. The listening socket keeps listening. |
| **Stream, not messages** | TCP doesn't preserve "send boundaries". One `send()` of 100 bytes might arrive as two `recv()`s of 50, or be coalesced with the next one. Real protocols delimit messages with newlines, length prefixes, etc. We use `\n`. |
| **`recv() == 0`** | The peer closed their end (sent FIN). This is how you detect a graceful disconnect. |
| **Two threads** | A connection is full-duplex - either side can speak any time. A single thread that alternates `getline` and `recv` would block one on the other. Threads are the simplest fix; `select`/`poll`/`epoll` are the scalable one. |
| **`SO_REUSEADDR`** | Skips the post-close `TIME_WAIT` quarantine so you can re-run the server immediately. |

## Files

- `server.cpp` - `socket` → `bind` → `listen` → `accept` → chat loop.
- `client.cpp` - `socket` → `connect` → chat loop.
- `Makefile` - builds both with `-pthread`.

## Limits / next steps

- Single client. To handle many, `accept()` in a loop and spawn a thread (or use `epoll`) per connection.
- No framing: messages over ~1023 bytes get split across reads. Add a length prefix or scan for `\n`.
- No authentication or encryption. For real chat, terminate TLS (e.g. via OpenSSL) on top of the TCP socket.
- No reconnect logic. If the peer dies, the side that's still up just exits.
