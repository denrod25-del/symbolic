#include "BookRepository.hpp"
#include "Database.hpp"

#include <iostream>
#include <limits>
#include <string>

namespace {

void printMenu() {
    std::cout << "\n=== Book Library ===\n"
              << "  1) List all books\n"
              << "  2) Find book by id\n"
              << "  3) Search by author\n"
              << "  4) Add a book\n"
              << "  5) Update a book\n"
              << "  6) Delete a book\n"
              << "  0) Quit\n"
              << "Choose: ";
}

void printBook(const Book& b) {
    std::cout << "  [" << b.id << "] \"" << b.title << "\" by " << b.author
              << " (" << b.year << ") "
              << (b.available ? "[available]" : "[checked out]") << "\n";
}

// std::getline after std::cin >> int leaves a stray newline in the buffer;
// drain it so the next getline doesn't return an empty string.
void flushLine() {
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
}

int promptInt(const std::string& label) {
    std::cout << label;
    int v = 0;
    std::cin >> v;
    flushLine();
    return v;
}

std::string promptString(const std::string& label) {
    std::cout << label;
    std::string s;
    std::getline(std::cin, s);
    return s;
}

Book promptBook(int idForUpdate = 0) {
    Book b;
    b.id        = idForUpdate;
    b.title     = promptString("  Title: ");
    b.author    = promptString("  Author: ");
    b.year      = promptInt   ("  Year: ");
    b.available = promptInt   ("  Available (1 = yes, 0 = no): ") != 0;
    return b;
}

}  // namespace

int main() {
    try {
        // The file is created on first run. Pass ":memory:" for an ephemeral
        // in-memory database (handy in tests).
        Database       db("library.db");
        BookRepository repo(db);
        repo.initSchema();

        while (true) {
            printMenu();
            const int choice = promptInt("");

            if (choice == 0) {
                break;
            }
            if (choice == 1) {
                const auto books = repo.findAll();
                if (books.empty()) {
                    std::cout << "  (no books yet)\n";
                }
                for (const auto& b : books) {
                    printBook(b);
                }
            } else if (choice == 2) {
                const auto book = repo.findById(promptInt("  Id: "));
                if (book) {
                    printBook(*book);
                } else {
                    std::cout << "  Not found.\n";
                }
            } else if (choice == 3) {
                const auto books = repo.searchByAuthor(promptString("  Author contains: "));
                if (books.empty()) {
                    std::cout << "  No matches.\n";
                }
                for (const auto& b : books) {
                    printBook(b);
                }
            } else if (choice == 4) {
                const int id = repo.create(promptBook());
                std::cout << "  Created book " << id << ".\n";
            } else if (choice == 5) {
                const int  id      = promptInt("  Id to update: ");
                const auto current = repo.findById(id);
                if (!current) {
                    std::cout << "  Not found.\n";
                    continue;
                }
                const bool ok = repo.update(promptBook(id));
                std::cout << (ok ? "  Updated.\n" : "  Update affected no rows.\n");
            } else if (choice == 6) {
                const bool ok = repo.remove(promptInt("  Id to delete: "));
                std::cout << (ok ? "  Deleted.\n" : "  Not found.\n");
            } else {
                std::cout << "  Unknown choice.\n";
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "fatal: " << e.what() << "\n";
        return 1;
    }
    return 0;
}
