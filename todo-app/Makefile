CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Wpedantic

server: server.cpp
	$(CXX) $(CXXFLAGS) server.cpp -o server

run: server
	./server

clean:
	rm -f server todos.json

.PHONY: run clean
