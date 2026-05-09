#include "Database.hpp"

Database::Database(const std::string& path) {
    // sqlite3_open_v2 lets us request explicit flags. READWRITE | CREATE means
    // "open if it exists, create otherwise". The default uses the same flags,
    // but spelling them out documents intent.
    const int rc = sqlite3_open_v2(
        path.c_str(),
        &db_,
        SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE,
        nullptr);

    if (rc != SQLITE_OK) {
        // sqlite3_errmsg works even on a partially-opened handle, but we still
        // need to close it to release memory.
        const std::string msg = db_ ? sqlite3_errmsg(db_) : "unknown error";
        sqlite3_close(db_);
        throw std::runtime_error("Failed to open database: " + msg);
    }

    // Foreign keys are OFF by default in SQLite (legacy compatibility).
    // Turn them on per-connection so any FK constraints we add are enforced.
    exec("PRAGMA foreign_keys = ON;");
}

Database::~Database() {
    // sqlite3_close is safe on a null pointer.
    sqlite3_close(db_);
}

void Database::exec(const std::string& sql) {
    char* err = nullptr;
    const int rc = sqlite3_exec(db_, sql.c_str(), nullptr, nullptr, &err);
    if (rc != SQLITE_OK) {
        const std::string msg = err ? err : "unknown error";
        sqlite3_free(err);  // Errors must be freed with sqlite3_free, not delete.
        throw std::runtime_error("SQL exec failed: " + msg);
    }
}
