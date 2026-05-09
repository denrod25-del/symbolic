#pragma once

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <optional>
#include <string>
#include <unistd.h>

#include "base64.hpp"
#include "sha1.hpp"

// Tiny RFC 6455 helper: handshake + text-frame framing for server-to-client
// pushes. Only what the dashboard needs — no extensions, no fragmentation,
// no permessage-deflate. Reads incoming frames just well enough to honor
// close (0x8) and ping (0x9) opcodes.
namespace ws {

inline constexpr const char* kGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

inline std::string accept_key(const std::string& client_key) {
  const std::string concat = client_key + kGuid;
  const auto digest = Sha1::hash(concat);
  return base64_encode(digest.data(), digest.size());
}

// Lowercase ASCII for case-insensitive header matching.
inline std::string ascii_lower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return s;
}

// Trims surrounding ASCII whitespace.
inline std::string trim(const std::string& s) {
  std::size_t start = 0, end = s.size();
  while (start < end && std::isspace(static_cast<unsigned char>(s[start]))) ++start;
  while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) --end;
  return s.substr(start, end - start);
}

// Pulls the Sec-WebSocket-Key out of an HTTP request. Returns nullopt if the
// upgrade isn't a valid WebSocket request — caller responds 400 in that case.
inline std::optional<std::string> parse_websocket_key(const std::string& request) {
  std::size_t pos = 0;
  bool upgrade_websocket = false;
  bool connection_upgrade = false;
  std::optional<std::string> key;

  while (pos < request.size()) {
    std::size_t eol = request.find("\r\n", pos);
    if (eol == std::string::npos) break;
    std::string line = request.substr(pos, eol - pos);
    pos = eol + 2;
    if (line.empty()) break;

    std::size_t colon = line.find(':');
    if (colon == std::string::npos) continue;
    std::string name = ascii_lower(trim(line.substr(0, colon)));
    std::string value = trim(line.substr(colon + 1));

    if (name == "upgrade" && ascii_lower(value).find("websocket") != std::string::npos) {
      upgrade_websocket = true;
    } else if (name == "connection" && ascii_lower(value).find("upgrade") != std::string::npos) {
      connection_upgrade = true;
    } else if (name == "sec-websocket-key") {
      key = value;
    }
  }

  if (!upgrade_websocket || !connection_upgrade || !key) return std::nullopt;
  return key;
}

inline std::string handshake_response(const std::string& client_key) {
  std::string response;
  response += "HTTP/1.1 101 Switching Protocols\r\n";
  response += "Upgrade: websocket\r\n";
  response += "Connection: Upgrade\r\n";
  response += "Sec-WebSocket-Accept: " + accept_key(client_key) + "\r\n";
  response += "\r\n";
  return response;
}

// Encodes a single unfragmented text frame for server-to-client delivery.
// Server frames MUST NOT be masked (RFC 6455 §5.1), so the MASK bit is 0 and
// the payload follows the length header directly.
inline std::string encode_text_frame(const std::string& payload) {
  std::string frame;
  frame.push_back(static_cast<char>(0x81));  // FIN=1, opcode=0x1 (text)

  const std::size_t len = payload.size();
  if (len < 126) {
    frame.push_back(static_cast<char>(len));
  } else if (len <= 0xFFFF) {
    frame.push_back(static_cast<char>(126));
    frame.push_back(static_cast<char>((len >> 8) & 0xFF));
    frame.push_back(static_cast<char>(len & 0xFF));
  } else {
    frame.push_back(static_cast<char>(127));
    for (int i = 7; i >= 0; --i) {
      frame.push_back(static_cast<char>((static_cast<std::uint64_t>(len) >> (i * 8)) & 0xFF));
    }
  }
  frame.append(payload);
  return frame;
}

inline std::string encode_close_frame() {
  // FIN=1, opcode=0x8, zero-length payload.
  return std::string{static_cast<char>(0x88), static_cast<char>(0x00)};
}

}  // namespace ws
