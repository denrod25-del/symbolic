CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Wpedantic -O2

.PHONY: all test test_v1 test_v2 clean run run_v2

all: interpreter interpreter_v2

interpreter: interpreter.cpp
	$(CXX) $(CXXFLAGS) interpreter.cpp -o interpreter

interpreter_v2: interpreter_v2.cpp
	$(CXX) $(CXXFLAGS) interpreter_v2.cpp -o interpreter_v2

tests: tests.cpp interpreter.cpp
	$(CXX) $(CXXFLAGS) tests.cpp -o tests

tests_v2: tests_v2.cpp interpreter_v2.cpp
	$(CXX) $(CXXFLAGS) tests_v2.cpp -o tests_v2

test_v1: tests
	./tests

test_v2: tests_v2
	./tests_v2

test: test_v1 test_v2

run: interpreter
	./interpreter

run_v2: interpreter_v2
	./interpreter_v2

clean:
	rm -f interpreter interpreter_v2 tests tests_v2
