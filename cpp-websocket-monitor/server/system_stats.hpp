#pragma once

#include <cstdint>
#include <fstream>
#include <sstream>
#include <string>

namespace ws {

struct CpuTimes {
  std::uint64_t total = 0;
  std::uint64_t idle = 0;
};

// Reads the aggregate "cpu" line from /proc/stat. CPU usage is computed from
// the delta between two samples, so a single reading carries no meaning.
inline bool read_cpu_times(CpuTimes& out) {
  std::ifstream f("/proc/stat");
  if (!f) return false;
  std::string label;
  f >> label;
  if (label != "cpu") return false;

  std::uint64_t user = 0, nice = 0, system = 0, idle = 0, iowait = 0,
                irq = 0, softirq = 0, steal = 0, guest = 0, guest_nice = 0;
  f >> user >> nice >> system >> idle >> iowait >> irq >> softirq
    >> steal >> guest >> guest_nice;

  out.idle = idle + iowait;
  out.total = user + nice + system + idle + iowait + irq + softirq + steal;
  return true;
}

// Returns CPU usage as a percentage (0.0 - 100.0) given two samples.
inline double cpu_percent(const CpuTimes& prev, const CpuTimes& cur) {
  const std::uint64_t total_diff = cur.total - prev.total;
  const std::uint64_t idle_diff = cur.idle - prev.idle;
  if (total_diff == 0) return 0.0;
  const double busy = static_cast<double>(total_diff - idle_diff);
  return (busy / static_cast<double>(total_diff)) * 100.0;
}

struct MemInfo {
  std::uint64_t total_kb = 0;
  std::uint64_t available_kb = 0;
};

// Parses /proc/meminfo for MemTotal and MemAvailable. MemAvailable is the
// kernel's own estimate of memory free for new allocations; it accounts for
// reclaimable cache, so it's a better signal than MemFree.
inline bool read_mem_info(MemInfo& out) {
  std::ifstream f("/proc/meminfo");
  if (!f) return false;
  std::string line;
  bool got_total = false, got_avail = false;
  while (std::getline(f, line)) {
    std::istringstream iss(line);
    std::string key;
    std::uint64_t value = 0;
    std::string unit;
    iss >> key >> value >> unit;
    if (key == "MemTotal:")          { out.total_kb = value;     got_total = true; }
    else if (key == "MemAvailable:") { out.available_kb = value; got_avail = true; }
    if (got_total && got_avail) break;
  }
  return got_total && got_avail;
}

inline double mem_used_percent(const MemInfo& m) {
  if (m.total_kb == 0) return 0.0;
  const double used = static_cast<double>(m.total_kb - m.available_kb);
  return (used / static_cast<double>(m.total_kb)) * 100.0;
}

}  // namespace ws
