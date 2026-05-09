#include "BookRepository.hpp"

#include <sqlite3.h>
#include <stdexcept>

namespace {

// ---------------------------------------------------------------------------
// PreparedStatement: tiny RAII helper around sqlite3_stmt*.
//
// A prepared statement is SQL that has been parsed and compiled once, with
// "?" placeholders for values. You then bind values to those placeholders and
// execute. Two big wins over string-concatenated SQL:
//
//   1. Safety. Bound values are sent as data, not parsed as SQL, so they
//      cannot inject statements (e.g. a title of `"); DROP TABLE books;--`
//      is just a weird-looking title).
//   2. Performance. The query plan is reused across executions, which matters
//      when running the same statement in a loop.
// ---------------------------------------------------------------------------
class PreparedStatement {
public:
    PreparedStatement(sqlite3* db, const std::string& sql) {
        const int rc = sqlite3_prepare_v2(
            db,
            sql.c_str(),
            -1,         // -1 = read until null terminator.
            &stmt_,
            nullptr);
        if (rc != SQLITE_OK) {
            throw std::runtime_error(
                "prepare failed: " + std::string(sqlite3_errmsg(db)));
        }
    }
    ~PreparedStatement() { sqlite3_finalize(stmt_); }

    PreparedStatement(const PreparedStatement&)            = delete;
    PreparedStatement& operator=(const PreparedStatement&) = delete;

    sqlite3_stmt* get() const { return stmt_; }

    // Parameter indices are 1-based. SQLITE_TRANSIENT tells SQLite to copy
    // the string immediately, so it's safe even if our std::string is freed
    // before the statement executes.
    void bindInt (int idx, int value)              { sqlite3_bind_int (stmt_, idx, value); }
    void bindText(int idx, const std::string& v)   { sqlite3_bind_text(stmt_, idx, v.c_str(), -1, SQLITE_TRANSIENT); }
    void bindBool(int idx, bool value)             { sqlite3_bind_int (stmt_, idx, value ? 1 : 0); }

private:
    sqlite3_stmt* stmt_ = nullptr;
};

// Materialise the current row into a Book. Column indices are 0-based and
// must match the SELECT clause order.
Book readRow(sqlite3_stmt* stmt) {
    Book b;
    b.id        = sqlite3_column_int(stmt, 0);
    b.title     = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
    b.author    = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
    b.year      = sqlite3_column_int(stmt, 3);
    b.available = sqlite3_column_int(stmt, 4) != 0;
    return b;
}

}  // namespace

BookRepository::BookRepository(Database& db) : db_(db) {}

// ---------------------------------------------------------------------------
// Schema design notes
// ---------------------------------------------------------------------------
// - `id INTEGER PRIMARY KEY` is a SQLite-specific alias for ROWID. SQLite will
//   auto-assign a unique integer; AUTOINCREMENT is rarely needed and slower.
// - `NOT NULL` on title/author/year prevents bad data at the storage layer
//   rather than relying on application code.
// - `available INTEGER NOT NULL DEFAULT 1` because SQLite has no native bool;
//   the convention is INTEGER 0/1.
// - `CHECK (year > 0)` is a column-level constraint that rejects nonsense
//   data before it hits disk.
// - The (author, title) index speeds up searchByAuthor and any future
//   alphabetised listings; it's a small space cost for a big read win.
// ---------------------------------------------------------------------------
void BookRepository::initSchema() {
    db_.exec(
        "CREATE TABLE IF NOT EXISTS books ("
        "  id        INTEGER PRIMARY KEY,"
        "  title     TEXT    NOT NULL,"
        "  author    TEXT    NOT NULL,"
        "  year      INTEGER NOT NULL CHECK (year > 0),"
        "  available INTEGER NOT NULL DEFAULT 1"
        ");");
    db_.exec(
        "CREATE INDEX IF NOT EXISTS idx_books_author_title "
        "ON books (author, title);");
}

int BookRepository::create(const Book& book) {
    // Note the "?" placeholders. Compare with the unsafe alternative:
    //   "INSERT ... VALUES ('" + book.title + "', ...)"
    // which would break the moment a title contains an apostrophe and would
    // be a SQL-injection vector for untrusted input.
    PreparedStatement stmt(
        db_.handle(),
        "INSERT INTO books (title, author, year, available) "
        "VALUES (?, ?, ?, ?);");
    stmt.bindText(1, book.title);
    stmt.bindText(2, book.author);
    stmt.bindInt (3, book.year);
    stmt.bindBool(4, book.available);

    // SQLITE_DONE means the statement finished without producing rows
    // (correct for INSERT/UPDATE/DELETE). SQLITE_ROW would mean a row is
    // ready to read (only for SELECT).
    if (sqlite3_step(stmt.get()) != SQLITE_DONE) {
        throw std::runtime_error(
            "insert failed: " + std::string(sqlite3_errmsg(db_.handle())));
    }
    return static_cast<int>(sqlite3_last_insert_rowid(db_.handle()));
}

std::optional<Book> BookRepository::findById(int id) {
    PreparedStatement stmt(
        db_.handle(),
        "SELECT id, title, author, year, available "
        "FROM books WHERE id = ?;");
    stmt.bindInt(1, id);

    // For a single-row query we step once. SQLITE_ROW => found, SQLITE_DONE
    // => no match.
    const int rc = sqlite3_step(stmt.get());
    if (rc == SQLITE_ROW) {
        return readRow(stmt.get());
    }
    if (rc == SQLITE_DONE) {
        return std::nullopt;
    }
    throw std::runtime_error(
        "findById failed: " + std::string(sqlite3_errmsg(db_.handle())));
}

std::vector<Book> BookRepository::findAll() {
    PreparedStatement stmt(
        db_.handle(),
        // ORDER BY author, title takes advantage of idx_books_author_title.
        "SELECT id, title, author, year, available "
        "FROM books ORDER BY author, title;");

    std::vector<Book> out;
    // Step in a loop: each SQLITE_ROW yields one row of the result set.
    while (sqlite3_step(stmt.get()) == SQLITE_ROW) {
        out.push_back(readRow(stmt.get()));
    }
    return out;
}

std::vector<Book> BookRepository::searchByAuthor(const std::string& author) {
    PreparedStatement stmt(
        db_.handle(),
        // LIKE with a bound parameter is still safe. We pass the wildcards
        // as part of the value so a user typing "%" doesn't broaden the
        // search unintentionally — adjust as needed for your UX.
        "SELECT id, title, author, year, available "
        "FROM books WHERE author LIKE ? ORDER BY title;");
    stmt.bindText(1, "%" + author + "%");

    std::vector<Book> out;
    while (sqlite3_step(stmt.get()) == SQLITE_ROW) {
        out.push_back(readRow(stmt.get()));
    }
    return out;
}

bool BookRepository::update(const Book& book) {
    PreparedStatement stmt(
        db_.handle(),
        "UPDATE books "
        "SET title = ?, author = ?, year = ?, available = ? "
        "WHERE id = ?;");
    stmt.bindText(1, book.title);
    stmt.bindText(2, book.author);
    stmt.bindInt (3, book.year);
    stmt.bindBool(4, book.available);
    stmt.bindInt (5, book.id);

    if (sqlite3_step(stmt.get()) != SQLITE_DONE) {
        throw std::runtime_error(
            "update failed: " + std::string(sqlite3_errmsg(db_.handle())));
    }
    // sqlite3_changes returns rows touched by the most recent statement.
    // 0 means the WHERE matched nothing; the caller can treat that as
    // "not found".
    return sqlite3_changes(db_.handle()) > 0;
}

bool BookRepository::remove(int id) {
    PreparedStatement stmt(db_.handle(), "DELETE FROM books WHERE id = ?;");
    stmt.bindInt(1, id);
    if (sqlite3_step(stmt.get()) != SQLITE_DONE) {
        throw std::runtime_error(
            "delete failed: " + std::string(sqlite3_errmsg(db_.handle())));
    }
    return sqlite3_changes(db_.handle()) > 0;
}
