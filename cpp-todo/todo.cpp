// ─── C++ To-Do List App ──────────────────────────────────────────────────────
//
// FILE I/O LESSON:
//   std::ifstream  – read from a file
//   std::ofstream  – write (overwrite) a file
//   std::getline   – read one line at a time, stripping '\n'
//
// STRING PARSING LESSON:
//   std::string::find()   – locate a character/substring; returns npos on miss
//   std::string::substr() – extract a substring by position + length
//   std::stoi()           – convert a string to int
//
// Storage format (tasks.txt) – one task per line:
//   0|Buy groceries
//   1|Read a book        ← '1' = done, '0' = pending; '|' is the delimiter
// ─────────────────────────────────────────────────────────────────────────────

#include <fstream>
#include <iostream>
#include <string>
#include <vector>

const std::string FILE_NAME = "tasks.txt";

struct Task {
    bool done;
    std::string description;
};

// ── File I/O: load ────────────────────────────────────────────────────────────
// Opens the file for reading. If it doesn't exist yet (first run), ifstream
// fails silently and we return an empty list — no crash.
std::vector<Task> loadTasks() {
    std::vector<Task> tasks;

    std::ifstream file(FILE_NAME); // mode: read-only by default
    if (!file.is_open()) return tasks;

    std::string line;
    while (std::getline(file, line)) { // reads until '\n', strips it
        if (line.empty()) continue;

        // String parsing: split "0|Buy groceries" on the first '|'
        size_t sep = line.find('|');          // returns npos if '|' is absent
        if (sep == std::string::npos) continue;

        Task t;
        t.done        = (line.substr(0, sep) == "1"); // chars before '|'
        t.description = line.substr(sep + 1);         // chars after  '|'
        tasks.push_back(t);
    }
    return tasks; // file closed automatically when ifstream goes out of scope
}

// ── File I/O: save ────────────────────────────────────────────────────────────
// ofstream without extra flags opens in truncate mode — it wipes the old file
// and writes from scratch. We rebuild every line each time we save.
void saveTasks(const std::vector<Task>& tasks) {
    std::ofstream file(FILE_NAME); // truncates existing file
    for (const auto& t : tasks) {
        file << (t.done ? '1' : '0') << '|' << t.description << '\n';
    }
    // ofstream destructor flushes + closes — no explicit close needed
}

// ── Commands ──────────────────────────────────────────────────────────────────

void listTasks(const std::vector<Task>& tasks) {
    if (tasks.empty()) {
        std::cout << "No tasks yet. Try: todo add <description>\n";
        return;
    }
    for (size_t i = 0; i < tasks.size(); ++i) {
        // Print 1-based index so users don't have to think in 0-based terms
        std::cout << (i + 1) << ". [" << (tasks[i].done ? 'x' : ' ') << "] "
                  << tasks[i].description << '\n';
    }
}

void addTask(std::vector<Task>& tasks, const std::string& description) {
    tasks.push_back({false, description});
    saveTasks(tasks);
    std::cout << "Added: " << description << '\n';
}

void markDone(std::vector<Task>& tasks, int index) {
    if (index < 1 || index > static_cast<int>(tasks.size())) {
        std::cerr << "Error: no task #" << index << '\n';
        return;
    }
    tasks[index - 1].done = true;
    saveTasks(tasks);
    std::cout << "Done: " << tasks[index - 1].description << '\n';
}

void deleteTask(std::vector<Task>& tasks, int index) {
    if (index < 1 || index > static_cast<int>(tasks.size())) {
        std::cerr << "Error: no task #" << index << '\n';
        return;
    }
    std::string desc = tasks[index - 1].description;
    tasks.erase(tasks.begin() + (index - 1)); // erase by iterator
    saveTasks(tasks);
    std::cout << "Deleted: " << desc << '\n';
}

void printUsage() {
    std::cout << "Usage:\n"
              << "  todo list\n"
              << "  todo add <description>\n"
              << "  todo done <number>\n"
              << "  todo delete <number>\n";
}

// ── Entry point ───────────────────────────────────────────────────────────────
// argc  = argument count (includes the program name itself)
// argv  = argument vector: argv[0]="todo", argv[1]="add", argv[2]="Buy milk"…
int main(int argc, char* argv[]) {
    if (argc < 2) {
        printUsage();
        return 1;
    }

    std::string command = argv[1];
    std::vector<Task> tasks = loadTasks(); // read file once at startup

    if (command == "list") {
        listTasks(tasks);

    } else if (command == "add") {
        if (argc < 3) { std::cerr << "Provide a description.\n"; return 1; }

        // Join all remaining argv tokens so "todo add Buy milk" works without quotes
        std::string desc = argv[2];
        for (int i = 3; i < argc; ++i) desc += ' ' + std::string(argv[i]);
        addTask(tasks, desc);

    } else if (command == "done") {
        if (argc < 3) { std::cerr << "Provide a task number.\n"; return 1; }
        // std::stoi converts "2" → 2; throws std::invalid_argument on bad input
        markDone(tasks, std::stoi(argv[2]));

    } else if (command == "delete") {
        if (argc < 3) { std::cerr << "Provide a task number.\n"; return 1; }
        deleteTask(tasks, std::stoi(argv[2]));

    } else {
        printUsage();
        return 1;
    }

    return 0;
}
