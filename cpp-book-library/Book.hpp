#pragma once

#include <string>

// Plain-old-data record that mirrors a row in the `books` table.
// Keeping the domain model decoupled from SQLite types means the rest of the
// program never has to know about sqlite3_stmt or column indices.
struct Book {
    int         id        = 0;     // PRIMARY KEY, assigned by SQLite on insert.
    std::string title;
    std::string author;
    int         year      = 0;     // Publication year.
    bool        available = true;  // false when checked out.
};
