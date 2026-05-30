#include "IsbnLookup.hpp"

#include <array>
#include <cctype>
#include <cstdio>
#include <memory>
#include <sstream>

namespace {

// Runs a shell command and returns its captured stdout.
// popen pipes the child's stdout through a FILE* we can fgets() from.
std::string runCommand(const std::string& cmd) {
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) {
        return {};
    }
    std::ostringstream out;
    std::array<char, 512> buf{};
    while (std::fgets(buf.data(), static_cast<int>(buf.size()), pipe)) {
        out << buf.data();
    }
    pclose(pipe);
    return out.str();
}

// Strips everything that isn't an ISBN digit (0-9 or trailing X for ISBN-10).
// This is the line between "user-controlled string" and "shell command" —
// without it, a malicious or fat-fingered "isbn" of `'; rm -rf ~ #` would run
// as a command. Whitelisting digits makes interpolation safe.
std::string sanitizeIsbn(const std::string& raw) {
    std::string out;
    for (char c : raw) {
        if (std::isdigit(static_cast<unsigned char>(c)) || c == 'X' || c == 'x') {
            out += c;
        }
    }
    return out;
}

std::string trim(const std::string& s) {
    const auto a = s.find_first_not_of(" \t\r\n");
    const auto b = s.find_last_not_of(" \t\r\n");
    return (a == std::string::npos) ? std::string{} : s.substr(a, b - a + 1);
}

// Open Library returns publish_date as free-form text ("2004", "April 2004",
// "2004-04-12", "Apr 04, 2004"). Pull the first 4-digit run as the year.
int extractYear(const std::string& date) {
    for (size_t i = 0; i + 4 <= date.size(); ++i) {
        bool all = true;
        for (int k = 0; k < 4; ++k) {
            if (!std::isdigit(static_cast<unsigned char>(date[i + k]))) {
                all = false;
                break;
            }
        }
        if (all) {
            return std::stoi(date.substr(i, 4));
        }
    }
    return 0;
}

}  // namespace

std::optional<Book> IsbnLookup::fetch(const std::string& isbnRaw) {
    const std::string isbn = sanitizeIsbn(isbnRaw);
    if (isbn.size() != 10 && isbn.size() != 13) {
        return std::nullopt;
    }

    // jq emits the three fields we care about on separate lines. The `// ""`
    // fallback turns JSON nulls into empty strings so we don't get the
    // literal text "null" through.
    const std::string url =
        "https://openlibrary.org/api/books?bibkeys=ISBN:" + isbn +
        "&format=json&jscmd=data";

    const std::string cmd =
        "curl -fsSL --max-time 10 '" + url + "' 2>/dev/null | "
        "jq -r --arg k \"ISBN:" + isbn + "\" '"
        ".[$k] | (.title // \"\"),"
        "        (.authors[0].name // \"\"),"
        "        (.publish_date // \"\")' 2>/dev/null";

    const std::string raw = runCommand(cmd);
    std::istringstream is(raw);
    std::string title, author, date;
    std::getline(is, title);
    std::getline(is, author);
    std::getline(is, date);

    title  = trim(title);
    author = trim(author);
    date   = trim(date);

    if (title.empty()) {
        return std::nullopt;
    }

    Book b;
    b.title  = title;
    b.author = author.empty() ? "Unknown" : author;
    b.year   = extractYear(date);
    b.isbn   = isbn;
    b.format = "physical";
    return b;
}
