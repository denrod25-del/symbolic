#pragma once

#include <array>
#include <cstdint>
#include <cstring>
#include <string>

// Minimal SHA-1 (FIPS 180-4) for the WebSocket handshake.
// Not constant-time; only used to compute Sec-WebSocket-Accept.
namespace ws {

class Sha1 {
public:
  Sha1() {
    h_[0] = 0x67452301; h_[1] = 0xEFCDAB89; h_[2] = 0x98BADCFE;
    h_[3] = 0x10325476; h_[4] = 0xC3D2E1F0;
  }

  void update(const unsigned char* data, std::size_t len) {
    total_bits_ += static_cast<std::uint64_t>(len) * 8;
    for (std::size_t i = 0; i < len; ++i) {
      buffer_[buffer_len_++] = data[i];
      if (buffer_len_ == 64) {
        process(buffer_);
        buffer_len_ = 0;
      }
    }
  }

  std::array<unsigned char, 20> finalize() {
    const std::uint64_t bits = total_bits_;
    buffer_[buffer_len_++] = 0x80;
    if (buffer_len_ > 56) {
      while (buffer_len_ < 64) buffer_[buffer_len_++] = 0;
      process(buffer_);
      buffer_len_ = 0;
    }
    while (buffer_len_ < 56) buffer_[buffer_len_++] = 0;
    for (int i = 7; i >= 0; --i) {
      buffer_[buffer_len_++] = static_cast<unsigned char>((bits >> (i * 8)) & 0xFF);
    }
    process(buffer_);

    std::array<unsigned char, 20> out{};
    for (int i = 0; i < 5; ++i) {
      out[i * 4 + 0] = static_cast<unsigned char>((h_[i] >> 24) & 0xFF);
      out[i * 4 + 1] = static_cast<unsigned char>((h_[i] >> 16) & 0xFF);
      out[i * 4 + 2] = static_cast<unsigned char>((h_[i] >> 8) & 0xFF);
      out[i * 4 + 3] = static_cast<unsigned char>(h_[i] & 0xFF);
    }
    return out;
  }

  static std::array<unsigned char, 20> hash(const std::string& s) {
    Sha1 h;
    h.update(reinterpret_cast<const unsigned char*>(s.data()), s.size());
    return h.finalize();
  }

private:
  static std::uint32_t rol(std::uint32_t x, int n) {
    return (x << n) | (x >> (32 - n));
  }

  void process(const unsigned char* block) {
    std::uint32_t w[80];
    for (int i = 0; i < 16; ++i) {
      w[i] = (static_cast<std::uint32_t>(block[i * 4]) << 24)
           | (static_cast<std::uint32_t>(block[i * 4 + 1]) << 16)
           | (static_cast<std::uint32_t>(block[i * 4 + 2]) << 8)
           | static_cast<std::uint32_t>(block[i * 4 + 3]);
    }
    for (int i = 16; i < 80; ++i) {
      w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    std::uint32_t a = h_[0], b = h_[1], c = h_[2], d = h_[3], e = h_[4];
    for (int i = 0; i < 80; ++i) {
      std::uint32_t f, k;
      if (i < 20)      { f = (b & c) | ((~b) & d);            k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d;                       k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d);     k = 0x8F1BBCDC; }
      else             { f = b ^ c ^ d;                       k = 0xCA62C1D6; }
      std::uint32_t t = rol(a, 5) + f + e + k + w[i];
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h_[0] += a; h_[1] += b; h_[2] += c; h_[3] += d; h_[4] += e;
  }

  std::uint32_t h_[5]{};
  unsigned char buffer_[64]{};
  std::size_t buffer_len_ = 0;
  std::uint64_t total_bits_ = 0;
};

}  // namespace ws
