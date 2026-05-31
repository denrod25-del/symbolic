CXX      ?= g++
CXXFLAGS ?= -std=c++17 -Wall -Wextra -Wpedantic -O2

.PHONY: all test test_v1 test_v2 test_v3 test_v4 clean run run_v2 run_v3 run_v4

all: interpreter interpreter_v2 interpreter_v3 interpreter_v4

interpreter_v4: interpreter_v4.cpp
	$(CXX) $(CXXFLAGS) interpreter_v4.cpp -o interpreter_v4

tests_v4: tests_v4.cpp interpreter_v4.cpp
	$(CXX) $(CXXFLAGS) tests_v4.cpp -o tests_v4

test_v4: tests_v4
	./tests_v4

run_v4: interpreter_v4
	./interpreter_v4


interpreter: interpreter.cpp
	$(CXX) $(CXXFLAGS) interpreter.cpp -o interpreter

interpreter_v2: interpreter_v2.cpp
	$(CXX) $(CXXFLAGS) interpreter_v2.cpp -o interpreter_v2

interpreter_v3: interpreter_v3.cpp
	$(CXX) $(CXXFLAGS) interpreter_v3.cpp -o interpreter_v3

tests: tests.cpp interpreter.cpp
	$(CXX) $(CXXFLAGS) tests.cpp -o tests

tests_v2: tests_v2.cpp interpreter_v2.cpp
	$(CXX) $(CXXFLAGS) tests_v2.cpp -o tests_v2

tests_v3: tests_v3.cpp interpreter_v3.cpp
	$(CXX) $(CXXFLAGS) tests_v3.cpp -o tests_v3

test_v1: tests
	./tests

test_v2: tests_v2
	./tests_v2

test_v3: tests_v3
	./tests_v3

test: test_v1 test_v2 test_v3 test_v4

run: interpreter
	./interpreter

run_v2: interpreter_v2
	./interpreter_v2

run_v3: interpreter_v3
	./interpreter_v3

clean:
	rm -f interpreter interpreter_v2 interpreter_v3 interpreter_v4 tests tests_v2 tests_v3 tests_v4
