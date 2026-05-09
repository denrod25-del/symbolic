#include <arpa/inet.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <signal.h>
#include <sys/socket.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

#include "system_stats.hpp"
#include "websocket.hpp"

namespace {

std::atomic<bool> g_running{true};

void install_signal_handlers() {
  // Treat Ctrl-C / SIGTERM as a graceful shutdown signal. SIGPIPE is ignored
  // so writes to a half-closed peer socket return EPIPE instead of killing us.
  std::signal(SIGINT,  [](int) { g_running = false; });
  std::signal(SIGTERM, [](int) { g_running = false; });
  std::signal(SIGPIPE, SIG_IGN);
}

// Reads bytes until "\r\n\r\n" or until the buffer grows past a sane cap.
// The cap protects against a peer that opens a connection and never finishes
// its request line.
bool read_http_request(int fd, std::string& out, std::size_t cap = 16 * 1024) {
  out.clear();
  char buf[2048];
  while (out.size() < cap) {
    ssize_t n = ::recv(fd, buf, sizeof(buf), 0);
    if (n <= 0) return false;
    out.append(buf, static_cast<std::size_t>(n));
    if (out.find("\r\n\r\n") != std::string::npos) return true;
  }
  return false;
}

bool send_all(int fd, const char* data, std::size_t len) {
  while (len > 0) {
    ssize_t n = ::send(fd, data, len, 0);
    if (n <= 0) return false;
    data += n;
    len -= static_cast<std::size_t>(n);
  }
  return true;
}

// Hub of connected clients. The sampler thread broadcasts; per-client threads
// register on connect and unregister on disconnect. Writes happen under the
// mutex so a slow client can't interleave a half-frame with another payload.
class ClientHub {
public:
  void add(int fd) {
    std::lock_guard<std::mutex> lock(mu_);
    fds_.insert(fd);
  }

  void remove(int fd) {
    std::lock_guard<std::mutex> lock(mu_);
    fds_.erase(fd);
  }

  // Sends a pre-encoded WebSocket frame to every active client. Failed sends
  // mark the client for removal so the next sampler tick won't retry them.
  void broadcast(const std::string& frame) {
    std::vector<int> dead;
    {
      std::lock_guard<std::mutex> lock(mu_);
      for (int fd : fds_) {
        if (!send_all(fd, frame.data(), frame.size())) {
          dead.push_back(fd);
        }
      }
      for (int fd : dead) fds_.erase(fd);
    }
    for (int fd : dead) {
      ::shutdown(fd, SHUT_RDWR);
      ::close(fd);
    }
  }

  std::size_t size() {
    std::lock_guard<std::mutex> lock(mu_);
    return fds_.size();
  }

private:
  std::mutex mu_;
  std::unordered_set<int> fds_;
};

std::string format_payload(double cpu_pct, const ws::MemInfo& mem, double mem_pct) {
  // Hand-rolled JSON: avoids pulling in a JSON dependency for three fields.
  std::ostringstream os;
  os.setf(std::ios::fixed);
  os.precision(2);
  const auto epoch_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::system_clock::now().time_since_epoch())
                            .count();
  os << "{\"t\":" << epoch_ms
     << ",\"cpu\":" << cpu_pct
     << ",\"mem\":" << mem_pct
     << ",\"mem_total_mb\":" << (mem.total_kb / 1024)
     << ",\"mem_used_mb\":" << ((mem.total_kb - mem.available_kb) / 1024)
     << "}";
  return os.str();
}

// Samples /proc once per second and broadcasts a JSON snapshot. The first
// CPU reading is discarded — usage is a delta, not an instantaneous value.
void sampler_loop(ClientHub& hub) {
  ws::CpuTimes prev{};
  if (!ws::read_cpu_times(prev)) {
    std::cerr << "[sampler] failed to read /proc/stat — is this Linux?\n";
    return;
  }

  while (g_running) {
    std::this_thread::sleep_for(std::chrono::seconds(1));
    if (!g_running) break;

    ws::CpuTimes cur{};
    ws::MemInfo mem{};
    if (!ws::read_cpu_times(cur) || !ws::read_mem_info(mem)) continue;

    const double cpu_pct = ws::cpu_percent(prev, cur);
    const double mem_pct = ws::mem_used_percent(mem);
    prev = cur;

    if (hub.size() == 0) continue;  // skip framing cost when nobody listens

    const std::string payload = format_payload(cpu_pct, mem, mem_pct);
    const std::string frame = ws::encode_text_frame(payload);
    hub.broadcast(frame);
  }
}

void handle_client(int fd, ClientHub& hub) {
  std::string request;
  if (!read_http_request(fd, request)) {
    ::close(fd);
    return;
  }

  auto key = ws::parse_websocket_key(request);
  if (!key) {
    const char* resp = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n";
    send_all(fd, resp, std::strlen(resp));
    ::close(fd);
    return;
  }

  const std::string response = ws::handshake_response(*key);
  if (!send_all(fd, response.data(), response.size())) {
    ::close(fd);
    return;
  }

  hub.add(fd);

  // Drain inbound frames so the kernel buffer doesn't fill up. We only inspect
  // the opcode: 0x8 (close) -> exit; everything else is dropped on the floor
  // since the dashboard never sends application data.
  unsigned char buf[1024];
  while (g_running) {
    ssize_t n = ::recv(fd, buf, sizeof(buf), 0);
    if (n <= 0) break;
    if (n >= 1 && (buf[0] & 0x0F) == 0x8) break;
  }

  hub.remove(fd);
  send_all(fd, ws::encode_close_frame().data(), 2);
  ::shutdown(fd, SHUT_RDWR);
  ::close(fd);
}

int run_server(std::uint16_t port) {
  int listen_fd = ::socket(AF_INET, SOCK_STREAM, 0);
  if (listen_fd < 0) {
    std::perror("socket");
    return 1;
  }

  int yes = 1;
  ::setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  addr.sin_port = htons(port);

  if (::bind(listen_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
    std::perror("bind");
    ::close(listen_fd);
    return 1;
  }
  if (::listen(listen_fd, 32) < 0) {
    std::perror("listen");
    ::close(listen_fd);
    return 1;
  }

  std::cout << "WebSocket monitor listening on ws://0.0.0.0:" << port << "\n";

  ClientHub hub;
  std::thread sampler([&hub] { sampler_loop(hub); });

  while (g_running) {
    sockaddr_in peer{};
    socklen_t plen = sizeof(peer);
    int client_fd = ::accept(listen_fd, reinterpret_cast<sockaddr*>(&peer), &plen);
    if (client_fd < 0) {
      if (g_running) std::perror("accept");
      continue;
    }
    int one = 1;
    ::setsockopt(client_fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));
    std::thread(handle_client, client_fd, std::ref(hub)).detach();
  }

  ::close(listen_fd);
  if (sampler.joinable()) sampler.join();
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  install_signal_handlers();
  std::uint16_t port = 8080;
  if (argc > 1) {
    int parsed = std::atoi(argv[1]);
    if (parsed > 0 && parsed < 65536) port = static_cast<std::uint16_t>(parsed);
  }
  return run_server(port);
}
