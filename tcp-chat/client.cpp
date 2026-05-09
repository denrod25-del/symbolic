// client.cpp - A minimal TCP chat client using POSIX sockets.
//
// Where the server passively waits, the client *initiates* the connection.
// The classic client sequence is:
//     socket() -> connect()  [-> read()/write() -> close()]
//
// connect() is the active half of TCP's three-way handshake:
//   1. Client sends SYN with its initial sequence number.
//   2. Server responds with SYN/ACK (its own sequence number + ack of ours).
//   3. Client sends ACK. Connection is now ESTABLISHED on both sides.
//
// After connect() returns, the socket is full-duplex - either side can send
// data at any time. That's why we use two threads, just like the server.

#include <arpa/inet.h>   // inet_pton(), htons()
#include <netinet/in.h>  // sockaddr_in
#include <sys/socket.h>  // socket(), connect()
#include <unistd.h>      // close(), read(), write()

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <thread>

namespace {

constexpr int kDefaultPort = 5555;
constexpr size_t kBufferSize = 1024;

std::atomic<bool> g_running{true};

void receive_loop(int sock_fd) {
  char buf[kBufferSize];
  while (g_running) {
    ssize_t n = recv(sock_fd, buf, sizeof(buf) - 1, 0);
    if (n > 0) {
      buf[n] = '\0';
      std::cout << "\r[server] " << buf << std::flush;
      if (buf[n - 1] != '\n') std::cout << '\n';
      std::cout << "> " << std::flush;
    } else if (n == 0) {
      std::cout << "\n[client] server closed the connection\n";
      g_running = false;
      break;
    } else {
      std::perror("recv");
      g_running = false;
      break;
    }
  }
}

}  // namespace

int main(int argc, char* argv[]) {
  // Usage: ./client [host] [port]   (defaults to 127.0.0.1:5555)
  const char* host = (argc > 1) ? argv[1] : "127.0.0.1";
  int port = (argc > 2) ? std::atoi(argv[2]) : kDefaultPort;

  // 1) socket(): same as the server - just an endpoint, no connection yet.
  int sock_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (sock_fd < 0) {
    std::perror("socket");
    return 1;
  }

  // 2) Build the destination address.
  //
  //    inet_pton() ("presentation to network") parses a human-readable
  //    string like "127.0.0.1" into the 32-bit network-byte-order integer
  //    that sockaddr_in expects. Use it instead of the older inet_addr(),
  //    which can't signal errors cleanly.
  sockaddr_in server_addr{};
  server_addr.sin_family = AF_INET;
  server_addr.sin_port = htons(port);
  if (inet_pton(AF_INET, host, &server_addr.sin_addr) <= 0) {
    std::cerr << "[client] invalid address: " << host << "\n";
    close(sock_fd);
    return 1;
  }

  // 3) connect(): perform the three-way handshake. Blocks until either the
  //    server accepts or the kernel gives up (default timeout is around a
  //    minute; you can shorten it with setsockopt + SO_SNDTIMEO).
  if (connect(sock_fd, reinterpret_cast<sockaddr*>(&server_addr),
              sizeof(server_addr)) < 0) {
    std::perror("connect");
    close(sock_fd);
    return 1;
  }

  std::cout << "[client] connected to " << host << ":" << port << "\n";
  std::cout << "[client] type messages and press Enter. Ctrl-D to quit.\n> "
            << std::flush;

  // 4) Concurrent send and receive.
  //    Networking is asynchronous by nature: the peer can speak whenever they
  //    want. A single-threaded loop that alternates getline() and recv() would
  //    make the user wait until they pressed Enter before seeing inbound
  //    messages. Two threads is the simplest fix; production code typically
  //    uses select()/poll()/epoll() or async I/O instead of threads.
  std::thread reader(receive_loop, sock_fd);

  std::string line;
  while (g_running && std::getline(std::cin, line)) {
    line += '\n';
    ssize_t sent = send(sock_fd, line.data(), line.size(), 0);
    if (sent < 0) {
      std::perror("send");
      break;
    }
    std::cout << "> " << std::flush;
  }

  // 5) Goodbye. shutdown() sends FIN and unblocks the reader thread's recv(),
  //    which will return 0 and let the thread exit cleanly. close() releases
  //    the file descriptor.
  g_running = false;
  shutdown(sock_fd, SHUT_RDWR);
  reader.join();
  close(sock_fd);
  return 0;
}
