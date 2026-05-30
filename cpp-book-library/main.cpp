#include "BookRepository.hpp"
#include "Database.hpp"
#include "IsbnLookup.hpp"

#include <filesystem>
#include <iostream>
#include <limits>
#include <string>

namespace {

void printMenu() {
    std::cout << "\n=== Book Library ===\n"
              << "  1) List all books\n"
              << "  2) Find book by id\n"
              << "  3) Search by author\n"
              << "  4) Add a book (manual)\n"
              << "  5) Update a book\n"
              << "  6) Delete a book\n"
              << "  7) Scan ISBNs (batch)\n"
              << "  8) Register PDF / ebook\n"
              << "  0) Quit\n"
              << "Choose: ";
}

void printBook(const Book& b) {
    std::cout << "  [" << b.id << "] \"" << b.title << "\" by " << b.author
              << " (" << b.year << ") "
              << (b.available ? "[available]" : "[checked out]")
              << " <" << b.format << ">";
    if (!b.isbn.empty()) {
        std::cout << " ISBN:" << b.isbn;
    }
    if (!b.filePath.empty()) {
        std::cout << " @" << b.filePath;
    }
    std::cout << "\n";
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

bool promptYesNo(const std::string& label, bool defaultYes = true) {
    std::cout << label << (defaultYes ? " [Y/n]: " : " [y/N]: ");
    std::string s;
    std::getline(std::cin, s);
    if (s.empty()) {
        return defaultYes;
    }
    return s[0] == 'y' || s[0] == 'Y';
}

Book promptBook(int idForUpdate = 0) {
    Book b;
    b.id        = idForUpdate;
    b.title     = promptString("  Title: ");
    b.author    = promptString("  Author: ");
    b.year      = promptInt   ("  Year: ");
    b.available = promptInt   ("  Available (1 = yes, 0 = no): ") != 0;
    b.isbn      = promptString("  ISBN (optional, Enter to skip): ");
    return b;
}

// Batch scan loop. The NADAMOO scanner acts as a USB keyboard: each scan
// "types" the ISBN and presses Enter, which arrives here as one getline().
// An empty line ends the loop.
void runBatchScan(BookRepository& repo) {
    std::cout << "  Scan ISBNs one after another. Empty line to stop.\n";
    int added = 0;
    int skipped = 0;
    while (true) {
        const std::string raw = promptString("  > ");
        if (raw.empty()) {
            break;
        }

        // Duplicate check on what the scanner gave us. If you genuinely own
        // two copies of the same book, answer "yes" to add another row.
        const auto existing = repo.findByIsbn(raw);
        if (existing) {
            std::cout << "    Already in library:\n";
            printBook(*existing);
            if (!promptYesNo("    Add another copy?", false)) {
                ++skipped;
                continue;
            }
        }

        std::cout << "    Looking up...\n";
        const auto fetched = IsbnLookup::fetch(raw);
        if (!fetched) {
            std::cout << "    No metadata found. Enter manually? ";
            if (!promptYesNo("", false)) {
                ++skipped;
                continue;
            }
            Book manual = promptBook();
            manual.isbn = raw;
            const int id = repo.create(manual);
            std::cout << "    Added book " << id << ".\n";
            ++added;
            continue;
        }

        std::cout << "    Found: \"" << fetched->title << "\" by "
                  << fetched->author << " (" << fetched->year << ")\n";
        const int id = repo.create(*fetched);
        std::cout << "    Added book " << id << ".\n";
        ++added;
    }
    std::cout << "  Done. " << added << " added, " << skipped << " skipped.\n";
}

void registerDigitalBook(BookRepository& repo) {
    const std::string path = promptString("  Path to file: ");
    std::error_code ec;
    if (!std::filesystem::exists(path, ec) || ec) {
        std::cout << "  File not found: " << path << "\n";
        return;
    }
    // Canonical = absolute + symlinks resolved. Storing the canonical path
    // means renaming the parent directory of the CLI doesn't break lookups.
    const std::string absolute =
        std::filesystem::canonical(path, ec).string();

    Book b;
    b.filePath = ec ? path : absolute;
    b.title    = promptString("  Title: ");
    b.author   = promptString("  Author: ");
    b.year     = promptInt   ("  Year: ");
    b.isbn     = promptString("  ISBN (optional): ");

    // The CHECK constraint in the schema only allows these three values.
    const std::string fmt = promptString("  Format (pdf / ebook): ");
    b.format = (fmt == "ebook") ? "ebook" : "pdf";

    const int id = repo.create(b);
    std::cout << "  Registered as book " << id << ".\n";
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
                Book edited = promptBook(id);
                // Preserve format/filePath; menu 5 only edits the core fields.
                edited.format   = current->format;
                edited.filePath = current->filePath;
                const bool ok = repo.update(edited);
                std::cout << (ok ? "  Updated.\n" : "  Update affected no rows.\n");
            } else if (choice == 6) {
                const bool ok = repo.remove(promptInt("  Id to delete: "));
                std::cout << (ok ? "  Deleted.\n" : "  Not found.\n");
            } else if (choice == 7) {
                runBatchScan(repo);
            } else if (choice == 8) {
                registerDigitalBook(repo);
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
