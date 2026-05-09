CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic -pthread
TARGET   := monitor-server

SRCS := main.cpp
HDRS := sha1.hpp base64.hpp websocket.hpp system_stats.hpp

$(TARGET): $(SRCS) $(HDRS)
	$(CXX) $(CXXFLAGS) -o $@ $(SRCS)

.PHONY: clean run
run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET)
