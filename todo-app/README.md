# Todo: a hand-built full stack

A minimal, dependency-free todo app:

- **Backend**: a single-file C++ HTTP server (`server.cpp`) using POSIX sockets.
- **Frontend**: plain HTML, CSS, and JS in `public/` — no React, no build step.

The whole point is to make the wire between frontend and backend visible.

## Run it

```sh
cd todo-app
make run
```

Then open <http://localhost:8080>.

Todos persist to `todos.json` in the working directory.

## How frontend and backend talk to each other

### 1. They are two separate programs

The C++ server is a process that listens on TCP port 8080. The frontend is HTML
and JavaScript that runs inside your browser. They share **no memory and no
variables**. The only thing they share is a network protocol: HTTP.

When you load <http://localhost:8080>, the browser opens a TCP connection to
the C++ process and sends a plain-text request. The server sends back the HTML
file. The HTML loads `app.js`, which then makes more HTTP requests to fetch and
modify todos.

### 2. HTTP is just text

A request is a few lines of text:

```
GET /api/todos HTTP/1.1
Host: localhost:8080

```

A response is a few more lines, plus a body:

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 38

[{"id":1,"text":"buy milk","done":false}]
```

Every browser request — every page load, every image, every `fetch()` —
follows that same pattern. If you run `curl -v http://localhost:8080/api/todos`
you'll see the exact bytes.

`server.cpp` reads those bytes (`recv`), parses out the method and path,
decides what to do, and writes a response back (`send`). That's it. Frameworks
like Express or Spring exist to make this less tedious, but the underlying
protocol is what you see here.

### 3. JSON is the shared language

The frontend speaks JavaScript objects. The backend speaks C++ structs. They
don't understand each other directly, so both sides agree to encode their data
as **JSON text** before sending it.

| Side     | In memory                              | On the wire                       |
| -------- | -------------------------------------- | --------------------------------- |
| Frontend | `{ id: 1, text: 'hi', done: false }`   | `{"id":1,"text":"hi","done":false}` |
| Backend  | `Todo { id: 1, text: "hi", done: false }` | same string                       |

`JSON.stringify` / `JSON.parse` do the conversion in the browser. In C++ we do
it by hand (`todo_to_json` and the small `json_get_*` helpers).

### 4. The four operations (CRUD over REST)

The server exposes one resource — `todos` — at one URL — `/api/todos` — and
uses the HTTP method to mean different things:

| What you want         | HTTP method | URL                | Request body            | Response                |
| --------------------- | ----------- | ------------------ | ----------------------- | ----------------------- |
| List all todos        | `GET`       | `/api/todos`       | _(none)_                | `[{...}, {...}]`        |
| Create a todo         | `POST`      | `/api/todos`       | `{"text":"buy milk"}`   | the new `{id,text,done}` |
| Update a todo         | `PATCH`     | `/api/todos/3`     | `{"done":true}`         | the updated todo        |
| Delete a todo         | `DELETE`    | `/api/todos/3`     | _(none)_                | _(empty, status 204)_   |

This style is called REST. The convention: same URL, different method = different action.

### 5. Walking through one click

Open devtools → Network tab and tick the checkbox next to a todo. Here is what
happens:

1. The checkbox's `change` event fires in `app.js` and calls `toggle(todo)`.
2. `fetch('/api/todos/3', { method: 'PATCH', body: '{"done":true}' })` builds
   this text and sends it over TCP:

   ```
   PATCH /api/todos/3 HTTP/1.1
   Host: localhost:8080
   Content-Type: application/json
   Content-Length: 13

   {"done":true}
   ```

3. `server.cpp` is sitting in `accept()`. It wakes up, calls `read_request`,
   which fills a `Request` struct: `method="PATCH"`, `path="/api/todos/3"`,
   `body="{\"done\":true}"`.
4. Routing in `handle_api` matches `/api/todos/<id>` + `PATCH`, finds the todo
   with id 3, parses `done` out of the body, sets `it->done = true`, writes the
   list back to `todos.json`, and builds a `Response` with status 200 and the
   updated todo as JSON.
5. `write_response` formats those headers and the body as text and `send()`s
   them back. The TCP connection closes (`Connection: close`).
6. Back in the browser, the `fetch` Promise resolves. `app.js` calls `load()`,
   which does `GET /api/todos`, gets the new list, and re-renders the `<ul>`.

Every interaction in this app is a small variation on those six steps.

### 6. Why CORS shows up

If you open `public/index.html` directly from your filesystem (`file://...`)
instead of through `http://localhost:8080`, the browser treats them as two
different "origins" and will block the API calls **unless** the server tells
it the cross-origin call is allowed. That's what the
`Access-Control-Allow-Origin: *` header in `write_response` is for. Browsers
also send a preflight `OPTIONS` request before some calls, which we handle in
`handle_connection`. None of this matters for the server — it's a browser
safety feature.

### 7. What this server is not

Deliberately omitted so the code stays readable:

- No threading. One request at a time. Real servers use thread pools or
  `epoll`/`kqueue`.
- Hand-rolled JSON. Real C++ projects pull in something like `nlohmann/json`.
- No auth, no validation beyond "text is not empty", no rate limiting.
- No keep-alive. Each request opens and closes a fresh TCP connection.

If you want to extend this, those are the natural next steps.

## File map

```
todo-app/
├── server.cpp        # the HTTP server + JSON API
├── Makefile          # `make run` to build and start the server
├── public/
│   ├── index.html    # the page
│   ├── styles.css    # styling
│   └── app.js        # fetch() calls and DOM rendering
└── todos.json        # created at runtime; the "database"
```
