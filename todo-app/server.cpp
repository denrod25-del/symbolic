// A tiny educational HTTP server in C++ using POSIX sockets.
// It serves:
//   - Static files from ./public (the frontend)
//   - A JSON REST API at /api/todos    (the backend)
//
// HTTP at a glance:
//   The browser opens a TCP connection and sends a text request like:
//     GET /api/todos HTTP/1.1\r\n
//     Host: localhost:8080\r\n
//     \r\n
//   We send back a text response like:
//     HTTP/1.1 200 OK\r\n
//     Content-Type: application/json\r\n
//     Content-Length: 42\r\n
//     \r\n
//     [{"id":1,"text":"hi","done":false}]
//
// That's literally it. fetch() in the browser is just a friendly wrapper
// around this same plain-text protocol.

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <atomic>
#include <cctype>
#include <cstring>
#include <fstream>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

constexpr int kPort = 8080;
constexpr const char* kDataFile = "todos.json";

struct Todo {
  int id;
  std::string text;
  bool done;
};

std::vector<Todo> g_todos;
std::atomic<int> g_next_id{1};
std::mutex g_mutex;

// ---------- tiny JSON helpers (just enough for this app) ----------

// Escape a string so it's safe inside a JSON string literal.
std::string json_escape(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 2);
  for (char c : s) {
    switch (c) {
      case '"':  out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof(buf), "\\u%04x", c);
          out += buf;
        } else {
          out += c;
        }
    }
  }
  return out;
}

std::string todo_to_json(const Todo& t) {
  std::ostringstream o;
  o << "{\"id\":" << t.id
    << ",\"text\":\"" << json_escape(t.text) << "\""
    << ",\"done\":" << (t.done ? "true" : "false") << "}";
  return o.str();
}

std::string todos_to_json() {
  std::ostringstream o;
  o << "[";
  for (size_t i = 0; i < g_todos.size(); ++i) {
    if (i) o << ",";
    o << todo_to_json(g_todos[i]);
  }
  o << "]";
  return o.str();
}

// Skip JSON whitespace.
size_t skip_ws(const std::string& s, size_t i) {
  while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
  return i;
}

// Read a JSON string starting at the opening quote. Fills `out`, returns
// the index past the closing quote, or std::string::npos on error.
size_t parse_json_string(const std::string& s, size_t i, std::string& out) {
  if (i >= s.size() || s[i] != '"') return std::string::npos;
  ++i;
  out.clear();
  while (i < s.size() && s[i] != '"') {
    if (s[i] == '\\' && i + 1 < s.size()) {
      char n = s[i + 1];
      if      (n == 'n')  out += '\n';
      else if (n == 'r')  out += '\r';
      else if (n == 't')  out += '\t';
      else if (n == '"')  out += '"';
      else if (n == '\\') out += '\\';
      else                out += n;
      i += 2;
    } else {
      out += s[i++];
    }
  }
  if (i >= s.size()) return std::string::npos;
  return i + 1;
}

// Look up a key at the top level of a flat JSON object. Supports string and
// boolean values — that's all this app needs.
bool json_get_string(const std::string& body, const std::string& key, std::string& out) {
  std::string needle = "\"" + key + "\"";
  size_t k = body.find(needle);
  if (k == std::string::npos) return false;
  size_t i = skip_ws(body, k + needle.size());
  if (i >= body.size() || body[i] != ':') return false;
  i = skip_ws(body, i + 1);
  return parse_json_string(body, i, out) != std::string::npos;
}

bool json_get_bool(const std::string& body, const std::string& key, bool& out) {
  std::string needle = "\"" + key + "\"";
  size_t k = body.find(needle);
  if (k == std::string::npos) return false;
  size_t i = skip_ws(body, k + needle.size());
  if (i >= body.size() || body[i] != ':') return false;
  i = skip_ws(body, i + 1);
  if (body.compare(i, 4, "true") == 0)  { out = true;  return true; }
  if (body.compare(i, 5, "false") == 0) { out = false; return true; }
  return false;
}

// ---------- persistence (so todos survive restarts) ----------

void save_todos() {
  std::ofstream f(kDataFile);
  f << todos_to_json();
}

void load_todos() {
  std::ifstream f(kDataFile);
  if (!f) return;
  std::stringstream buf;
  buf << f.rdbuf();
  std::string s = buf.str();
  size_t i = skip_ws(s, 0);
  if (i >= s.size() || s[i] != '[') return;
  ++i;
  int max_id = 0;
  while (true) {
    i = skip_ws(s, i);
    if (i >= s.size() || s[i] == ']') break;
    if (s[i] != '{') break;
    size_t end = s.find('}', i);
    if (end == std::string::npos) break;
    std::string obj = s.substr(i, end - i + 1);
    Todo t{};
    std::string id_needle = "\"id\":";
    size_t p = obj.find(id_needle);
    if (p != std::string::npos) t.id = std::atoi(obj.c_str() + p + id_needle.size());
    json_get_string(obj, "text", t.text);
    json_get_bool(obj, "done", t.done);
    g_todos.push_back(t);
    if (t.id > max_id) max_id = t.id;
    i = end + 1;
    i = skip_ws(s, i);
    if (i < s.size() && s[i] == ',') ++i;
  }
  g_next_id = max_id + 1;
}

// ---------- HTTP plumbing ----------

struct Request {
  std::string method;   // "GET", "POST", ...
  std::string path;     // "/api/todos/3"
  std::string body;     // request body for POST/PATCH
  std::unordered_map<std::string, std::string> headers;
};

struct Response {
  int status = 200;
  std::string content_type = "text/plain";
  std::string body;
};

std::string status_text(int code) {
  switch (code) {
    case 200: return "OK";
    case 201: return "Created";
    case 204: return "No Content";
    case 400: return "Bad Request";
    case 404: return "Not Found";
    case 405: return "Method Not Allowed";
    case 500: return "Internal Server Error";
    default:  return "OK";
  }
}

// Read until we have the full request (headers + Content-Length bytes of body).
bool read_request(int fd, Request& req) {
  std::string buf;
  char tmp[4096];
  // First, read until we see the end-of-headers marker "\r\n\r\n".
  size_t header_end = std::string::npos;
  while (header_end == std::string::npos) {
    ssize_t n = recv(fd, tmp, sizeof(tmp), 0);
    if (n <= 0) return false;
    buf.append(tmp, n);
    header_end = buf.find("\r\n\r\n");
    if (buf.size() > 1 << 20) return false;  // 1 MB cap, plenty for a todo
  }

  // Parse the request line: METHOD PATH HTTP/1.1
  size_t line_end = buf.find("\r\n");
  std::istringstream line(buf.substr(0, line_end));
  std::string http_version;
  line >> req.method >> req.path >> http_version;

  // Parse headers into a map.
  size_t pos = line_end + 2;
  while (pos < header_end) {
    size_t eol = buf.find("\r\n", pos);
    size_t colon = buf.find(':', pos);
    if (colon != std::string::npos && colon < eol) {
      std::string name = buf.substr(pos, colon - pos);
      size_t v = colon + 1;
      while (v < eol && std::isspace(static_cast<unsigned char>(buf[v]))) ++v;
      std::string value = buf.substr(v, eol - v);
      for (char& c : name) c = std::tolower(static_cast<unsigned char>(c));
      req.headers[name] = value;
    }
    pos = eol + 2;
  }

  // Read the body if Content-Length says there is one.
  size_t body_start = header_end + 4;
  size_t content_length = 0;
  auto it = req.headers.find("content-length");
  if (it != req.headers.end()) content_length = std::stoul(it->second);
  req.body = buf.substr(body_start);
  while (req.body.size() < content_length) {
    ssize_t n = recv(fd, tmp, sizeof(tmp), 0);
    if (n <= 0) return false;
    req.body.append(tmp, n);
  }
  if (req.body.size() > content_length) req.body.resize(content_length);
  return true;
}

void write_response(int fd, const Response& res) {
  std::ostringstream o;
  o << "HTTP/1.1 " << res.status << " " << status_text(res.status) << "\r\n"
    << "Content-Type: " << res.content_type << "\r\n"
    << "Content-Length: " << res.body.size() << "\r\n"
    << "Connection: close\r\n"
    // CORS: tells browsers it's OK for any origin to call this API. Handy
    // when the frontend is opened from file:// or a different port.
    << "Access-Control-Allow-Origin: *\r\n"
    << "Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS\r\n"
    << "Access-Control-Allow-Headers: Content-Type\r\n"
    << "\r\n"
    << res.body;
  std::string s = o.str();
  send(fd, s.data(), s.size(), 0);
}

// ---------- routing ----------

const char* mime_type(const std::string& path) {
  if (path.size() >= 5 && path.compare(path.size() - 5, 5, ".html") == 0) return "text/html; charset=utf-8";
  if (path.size() >= 3 && path.compare(path.size() - 3, 3, ".js")   == 0) return "application/javascript; charset=utf-8";
  if (path.size() >= 4 && path.compare(path.size() - 4, 4, ".css")  == 0) return "text/css; charset=utf-8";
  if (path.size() >= 4 && path.compare(path.size() - 4, 4, ".ico")  == 0) return "image/x-icon";
  return "application/octet-stream";
}

Response serve_static(const std::string& path) {
  std::string rel = (path == "/") ? "/index.html" : path;
  // Prevent escaping the public/ directory with "..".
  if (rel.find("..") != std::string::npos) return {404, "text/plain", "Not Found"};
  std::string full = "public" + rel;
  std::ifstream f(full, std::ios::binary);
  if (!f) return {404, "text/plain", "Not Found"};
  std::stringstream buf;
  buf << f.rdbuf();
  return {200, mime_type(rel), buf.str()};
}

// Extract an int id from "/api/todos/<id>". Returns -1 if not present.
int extract_id(const std::string& path) {
  const std::string prefix = "/api/todos/";
  if (path.compare(0, prefix.size(), prefix) != 0) return -1;
  std::string rest = path.substr(prefix.size());
  if (rest.empty()) return -1;
  for (char c : rest) if (!std::isdigit(static_cast<unsigned char>(c))) return -1;
  return std::stoi(rest);
}

Response handle_api(const Request& req) {
  std::lock_guard<std::mutex> lock(g_mutex);

  // GET /api/todos  ->  list every todo
  if (req.method == "GET" && req.path == "/api/todos") {
    return {200, "application/json", todos_to_json()};
  }

  // POST /api/todos  body: {"text":"..."}  ->  create
  if (req.method == "POST" && req.path == "/api/todos") {
    std::string text;
    if (!json_get_string(req.body, "text", text) || text.empty()) {
      return {400, "application/json", "{\"error\":\"text is required\"}"};
    }
    Todo t{g_next_id++, text, false};
    g_todos.push_back(t);
    save_todos();
    return {201, "application/json", todo_to_json(t)};
  }

  // /api/todos/<id> -> update or delete
  int id = extract_id(req.path);
  if (id > 0) {
    auto it = g_todos.begin();
    while (it != g_todos.end() && it->id != id) ++it;
    if (it == g_todos.end()) {
      return {404, "application/json", "{\"error\":\"not found\"}"};
    }

    if (req.method == "PATCH") {
      std::string new_text;
      bool new_done;
      if (json_get_string(req.body, "text", new_text)) it->text = new_text;
      if (json_get_bool(req.body, "done", new_done))   it->done = new_done;
      save_todos();
      return {200, "application/json", todo_to_json(*it)};
    }

    if (req.method == "DELETE") {
      g_todos.erase(it);
      save_todos();
      return {204, "application/json", ""};
    }

    return {405, "application/json", "{\"error\":\"method not allowed\"}"};
  }

  return {404, "application/json", "{\"error\":\"not found\"}"};
}

void handle_connection(int fd) {
  Request req;
  if (!read_request(fd, req)) {
    close(fd);
    return;
  }

  // Browsers send a "preflight" OPTIONS request before some cross-origin
  // calls. Answer it with the CORS headers and an empty body.
  if (req.method == "OPTIONS") {
    write_response(fd, {204, "text/plain", ""});
    close(fd);
    return;
  }

  std::cout << req.method << " " << req.path << "\n";

  Response res = (req.path.compare(0, 5, "/api/") == 0)
                     ? handle_api(req)
                     : serve_static(req.path);
  write_response(fd, res);
  close(fd);
}

}  // namespace

int main() {
  load_todos();

  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) { std::perror("socket"); return 1; }

  int yes = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = INADDR_ANY;
  addr.sin_port = htons(kPort);

  if (bind(server_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
    std::perror("bind"); return 1;
  }
  if (listen(server_fd, 16) < 0) {
    std::perror("listen"); return 1;
  }

  std::cout << "todo server listening on http://localhost:" << kPort << "\n";

  while (true) {
    sockaddr_in client{};
    socklen_t len = sizeof(client);
    int client_fd = accept(server_fd, reinterpret_cast<sockaddr*>(&client), &len);
    if (client_fd < 0) continue;
    handle_connection(client_fd);
  }
}
