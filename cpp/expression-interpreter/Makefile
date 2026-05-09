CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Wpedantic -O2

.PHONY: all test clean run

all: interpreter

interpreter: interpreter.cpp
	$(CXX) $(CXXFLAGS) interpreter.cpp -o interpreter

tests: tests.cpp interpreter.cpp
	$(CXX) $(CXXFLAGS) tests.cpp -o tests

test: tests
	./tests

run: interpreter
	./interpreter

clean:
	rm -f interpreter tests
