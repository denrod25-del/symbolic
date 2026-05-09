#pragma once

#include <cstddef>
#include <string>

namespace ws {

inline std::string base64_encode(const unsigned char* data, std::size_t len) {
  static constexpr char kAlphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  std::string out;
  out.reserve(((len + 2) / 3) * 4);

  std::size_t i = 0;
  while (i + 3 <= len) {
    std::uint32_t v = (static_cast<std::uint32_t>(data[i]) << 16)
                    | (static_cast<std::uint32_t>(data[i + 1]) << 8)
                    | static_cast<std::uint32_t>(data[i + 2]);
    out.push_back(kAlphabet[(v >> 18) & 0x3F]);
    out.push_back(kAlphabet[(v >> 12) & 0x3F]);
    out.push_back(kAlphabet[(v >> 6) & 0x3F]);
    out.push_back(kAlphabet[v & 0x3F]);
    i += 3;
  }

  if (i < len) {
    std::uint32_t v = static_cast<std::uint32_t>(data[i]) << 16;
    if (i + 1 < len) v |= static_cast<std::uint32_t>(data[i + 1]) << 8;
    out.push_back(kAlphabet[(v >> 18) & 0x3F]);
    out.push_back(kAlphabet[(v >> 12) & 0x3F]);
    if (i + 1 < len) {
      out.push_back(kAlphabet[(v >> 6) & 0x3F]);
      out.push_back('=');
    } else {
      out.push_back('=');
      out.push_back('=');
    }
  }
  return out;
}

}  // namespace ws
