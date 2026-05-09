CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -O2 -pthread

all: server client

server: server.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

client: client.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

clean:
	rm -f server client

.PHONY: all clean
