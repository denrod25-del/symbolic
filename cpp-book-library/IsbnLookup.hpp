#pragma once

#include "Book.hpp"

#include <optional>
#include <string>

// Looks up a book's metadata from its ISBN via the Open Library Books API.
//
// We shell out to `curl | jq` rather than linking libcurl + a JSON library.
// That keeps the dependency surface tiny (both binaries ship on every Linux
// distro), at the cost of one extra process per lookup — fine for an
// interactive CLI but you'd want a proper HTTP client in a hot loop.
class IsbnLookup {
public:
    // Returns a Book pre-populated with title/author/year/isbn if Open Library
    // recognises the ISBN, or std::nullopt on a network error, unknown ISBN,
    // or malformed input.
    static std::optional<Book> fetch(const std::string& isbn);
};
