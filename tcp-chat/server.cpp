// server.cpp - A minimal TCP chat server using POSIX sockets.
//
// Networking fundamentals at play here:
//
//   * TCP (Transmission Control Protocol) gives us a reliable, ordered, byte-stream
//     connection between two endpoints. Unlike UDP, TCP guarantees that every byte
//     arrives, in order, exactly once - the kernel handles retransmission, reordering,
//     and flow control for us.
//
//   * A "socket" is the OS-level handle that represents one end of a network
//     connection. On POSIX systems it's just a file descriptor (an int), and the
//     same read()/write() syscalls that work on files work on sockets.
//
//   * A server's job is to bind to a well-known port and passively wait for clients
//     to initiate connections. The classic sequence is:
//         socket() -> bind() -> listen() -> accept()  [-> read()/write() -> close()]
//
//   * A "port" is a 16-bit number that distinguishes different services on the same
//     host. Ports below 1024 are privileged (require root); we'll use 5555.

#include <arpa/inet.h>   // htons(), inet_ntop()
#include <netinet/in.h>  // sockaddr_in, INADDR_ANY
#include <sys/socket.h>  // socket(), bind(), listen(), accept()
#include <unistd.h>      // close(), read(), write()

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <thread>

namespace {

constexpr int kPort = 5555;
constexpr int kBacklog = 1;          // pending-connection queue depth
constexpr size_t kBufferSize = 1024; // bytes read per recv() call

// Shared flag so either thread can signal the other to stop. std::atomic<bool>
// is safe to read/write from multiple threads without a mutex.
std::atomic<bool> g_running{true};

// Reads from the connected socket and prints whatever the peer sends.
// This runs on its own thread so we can simultaneously read stdin in main().
//
// recv() blocks until data arrives. It returns:
//   >  0 : number of bytes read (may be less than requested - TCP is a stream,
//          not a message protocol, so one send() may arrive as several recv()s
//          or vice versa).
//   == 0 : peer performed an orderly shutdown (closed their end of the connection).
//   <  0 : error (errno tells you why).
void receive_loop(int conn_fd) {
  char buf[kBufferSize];
  while (g_running) {
    ssize_t n = recv(conn_fd, buf, sizeof(buf) - 1, 0);
    if (n > 0) {
      buf[n] = '\0';
      std::cout << "\r[client] " << buf << std::flush;
      if (buf[n - 1] != '\n') std::cout << '\n';
      std::cout << "> " << std::flush;
    } else if (n == 0) {
      std::cout << "\n[server] client disconnected\n";
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

int main() {
  // 1) socket(): ask the kernel for a new endpoint.
  //
  //    AF_INET     -> IPv4 address family (use AF_INET6 for IPv6).
  //    SOCK_STREAM -> connection-oriented byte stream (i.e. TCP).
  //    0           -> let the kernel pick the default protocol for that
  //                   (family, type) pair, which is TCP for SOCK_STREAM.
  //
  //    The return value is a file descriptor; -1 means failure.
  int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (listen_fd < 0) {
    std::perror("socket");
    return 1;
  }

  // SO_REUSEADDR lets us re-bind to the port immediately after the server exits.
  // Without this you'll often hit "Address already in use" because the kernel
  // keeps the socket in TIME_WAIT for ~60s after close to absorb stray packets.
  int yes = 1;
  setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));

  // 2) bind(): attach the socket to a specific (IP, port) pair on this host.
  //
  //    sockaddr_in is the IPv4-flavoured address struct. Three fields matter:
  //      sin_family : must match the address family from socket().
  //      sin_addr   : which local interface to listen on. INADDR_ANY (0.0.0.0)
  //                   means "every interface" - loopback, ethernet, wifi, etc.
  //      sin_port   : the port. Network byte order is big-endian, but x86 is
  //                   little-endian, so we run the value through htons()
  //                   ("host to network short") to byte-swap it.
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_ANY);
  addr.sin_port = htons(kPort);

  if (bind(listen_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
    std::perror("bind");
    close(listen_fd);
    return 1;
  }

  // 3) listen(): mark the socket as passive - it will accept incoming
  //    connections rather than initiate outgoing ones. The backlog is the
  //    max number of half-finished connections the kernel will queue while
  //    we're busy handling another accept().
  if (listen(listen_fd, kBacklog) < 0) {
    std::perror("listen");
    close(listen_fd);
    return 1;
  }

  std::cout << "[server] listening on 0.0.0.0:" << kPort << " ...\n";

  // 4) accept(): block until a client completes the TCP three-way handshake
  //    (SYN -> SYN/ACK -> ACK). Returns a *new* socket dedicated to that one
  //    client; listen_fd keeps listening for further connections (we ignore
  //    them in this minimal demo - one client at a time).
  sockaddr_in client_addr{};
  socklen_t client_len = sizeof(client_addr);
  int conn_fd = accept(listen_fd, reinterpret_cast<sockaddr*>(&client_addr),
                       &client_len);
  if (conn_fd < 0) {
    std::perror("accept");
    close(listen_fd);
    return 1;
  }

  char ip_str[INET_ADDRSTRLEN];
  inet_ntop(AF_INET, &client_addr.sin_addr, ip_str, sizeof(ip_str));
  std::cout << "[server] client connected from " << ip_str << ":"
            << ntohs(client_addr.sin_port) << "\n";
  std::cout << "[server] type messages and press Enter. Ctrl-D to quit.\n> "
            << std::flush;

  // Spawn a reader thread so receiving and sending can happen concurrently.
  // Without this the server would only see new messages between its own
  // sends, since a single thread can't block on both stdin and recv() at once.
  std::thread reader(receive_loop, conn_fd);

  // 5) Main thread: read stdin, send each line to the client.
  //    send() is just write() with extra flags. It returns how many bytes the
  //    kernel actually buffered for transmission (which may be less than what
  //    you asked for if the send buffer fills up - production code should
  //    loop until everything is sent).
  std::string line;
  while (g_running && std::getline(std::cin, line)) {
    line += '\n';
    ssize_t sent = send(conn_fd, line.data(), line.size(), 0);
    if (sent < 0) {
      std::perror("send");
      break;
    }
    std::cout << "> " << std::flush;
  }

  // 6) close(): TCP's "FIN" goodbye. Tells the peer we're done sending,
  //    flushes any buffered data, and frees the file descriptor.
  g_running = false;
  shutdown(conn_fd, SHUT_RDWR);  // unblock the reader's recv()
  reader.join();
  close(conn_fd);
  close(listen_fd);
  return 0;
}
