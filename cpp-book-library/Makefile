CXX      := g++
CXXFLAGS := -std=c++17 -Wall -Wextra -Wpedantic -O2
LDLIBS   := -lsqlite3

SRC := main.cpp Database.cpp BookRepository.cpp
OBJ := $(SRC:.cpp=.o)
BIN := library

$(BIN): $(OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDLIBS)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

run: $(BIN)
	./$(BIN)

clean:
	rm -f $(OBJ) $(BIN) library.db

.PHONY: run clean
