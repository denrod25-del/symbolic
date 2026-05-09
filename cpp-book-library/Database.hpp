#pragma once

#include <sqlite3.h>
#include <stdexcept>
#include <string>

// Thin RAII wrapper around a sqlite3* connection.
//
// Why a class?
//   - Guarantees sqlite3_close is called even if an exception is thrown.
//   - Centralises error handling so callers don't need to check rc everywhere.
//   - Makes the connection non-copyable: two owners closing the same handle
//     would be a use-after-free.
class Database {
public:
    // Opens (or creates) the database file at `path`.
    // SQLite is "embedded": there is no server. The file *is* the database.
    explicit Database(const std::string& path);
    ~Database();

    Database(const Database&)            = delete;
    Database& operator=(const Database&) = delete;

    // Raw handle, needed by repositories that prepare statements directly.
    sqlite3* handle() const { return db_; }

    // Run a one-shot SQL statement (DDL like CREATE TABLE, or PRAGMA).
    // Do NOT use this for user-supplied data: it concatenates SQL and is
    // vulnerable to SQL injection. Use prepared statements for that.
    void exec(const std::string& sql);

private:
    sqlite3* db_ = nullptr;
};
