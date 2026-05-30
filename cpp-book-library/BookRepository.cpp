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

// Safely read a TEXT column. sqlite3_column_text returns nullptr when the
// column value is NULL; passing that to std::string is undefined behaviour.
std::string textCol(sqlite3_stmt* stmt, int idx) {
    const unsigned char* p = sqlite3_column_text(stmt, idx);
    return p ? std::string(reinterpret_cast<const char*>(p)) : std::string{};
}

// Materialise the current row into a Book. Column indices are 0-based and
// must match the SELECT clause order.
Book readRow(sqlite3_stmt* stmt) {
    Book b;
    b.id        = sqlite3_column_int(stmt, 0);
    b.title     = textCol(stmt, 1);
    b.author    = textCol(stmt, 2);
    b.year      = sqlite3_column_int(stmt, 3);
    b.available = sqlite3_column_int(stmt, 4) != 0;
    b.isbn      = textCol(stmt, 5);
    b.format    = textCol(stmt, 6);
    b.filePath  = textCol(stmt, 7);
    return b;
}

// Standard SELECT column list, kept in one place so it can't drift from
// readRow. Every SELECT in this file must use these columns in this order.
constexpr const char* kCols =
    "id, title, author, year, available, isbn, format, file_path";

// PRAGMA table_info returns one row per column with (cid, name, type, ...).
bool hasColumn(sqlite3* db, const std::string& column) {
    PreparedStatement stmt(db, "PRAGMA table_info(books);");
    while (sqlite3_step(stmt.get()) == SQLITE_ROW) {
        if (textCol(stmt.get(), 1) == column) {
            return true;
        }
    }
    return false;
}

}  // namespace

BookRepository::BookRepository(Database& db) : db_(db) {}

// ---------------------------------------------------------------------------
// Schema design notes
// ---------------------------------------------------------------------------
// - `id INTEGER PRIMARY KEY` is a SQLite-specific alias for ROWID. SQLite will
//   auto-assign a unique integer; AUTOINCREMENT is rarely needed and slower.
// - `NOT NULL` on required fields stops bad data at the storage layer rather
//   than relying on application code.
// - `available INTEGER NOT NULL DEFAULT 1` because SQLite has no native bool;
//   the convention is INTEGER 0/1.
// - `CHECK (year > 0)` is a column-level constraint that rejects nonsense
//   data before it hits disk.
// - `format TEXT NOT NULL DEFAULT 'physical' CHECK (...)` is a poor man's
//   enum: SQLite has no ENUM type, but a CHECK constraint achieves the same.
// - `file_path` is NULL for physical books; required by app logic for digital
//   formats (we validate that in the CLI rather than the schema).
// - The (author, title) index speeds up searchByAuthor and any future
//   alphabetised listings; it's a small space cost for a big read win.
// - The (isbn) index speeds up the duplicate check we run on every scan.
//
// Migrations: on first run we CREATE the table with all current columns. On a
// pre-existing DB the CREATE is a no-op, so we ALTER TABLE to add anything
// missing. SQLite's ALTER TABLE is limited (it can only ADD COLUMN), but for
// additive schemas that's plenty.
// ---------------------------------------------------------------------------
void BookRepository::initSchema() {
    db_.exec(
        "CREATE TABLE IF NOT EXISTS books ("
        "  id        INTEGER PRIMARY KEY,"
        "  title     TEXT    NOT NULL,"
        "  author    TEXT    NOT NULL,"
        "  year      INTEGER NOT NULL CHECK (year > 0),"
        "  available INTEGER NOT NULL DEFAULT 1,"
        "  isbn      TEXT,"
        "  format    TEXT    NOT NULL DEFAULT 'physical'"
        "    CHECK (format IN ('physical', 'pdf', 'ebook')),"
        "  file_path TEXT"
        ");");

    // Bring legacy databases up to the current schema.
    if (!hasColumn(db_.handle(), "isbn")) {
        db_.exec("ALTER TABLE books ADD COLUMN isbn TEXT;");
    }
    if (!hasColumn(db_.handle(), "format")) {
        db_.exec("ALTER TABLE books ADD COLUMN format TEXT NOT NULL DEFAULT 'physical';");
    }
    if (!hasColumn(db_.handle(), "file_path")) {
        db_.exec("ALTER TABLE books ADD COLUMN file_path TEXT;");
    }

    db_.exec("CREATE INDEX IF NOT EXISTS idx_books_author_title "
             "ON books (author, title);");
    db_.exec("CREATE INDEX IF NOT EXISTS idx_books_isbn "
             "ON books (isbn);");
}

int BookRepository::create(const Book& book) {
    // Note the "?" placeholders. Compare with the unsafe alternative:
    //   "INSERT ... VALUES ('" + book.title + "', ...)"
    // which would break the moment a title contains an apostrophe and would
    // be a SQL-injection vector for untrusted input.
    PreparedStatement stmt(
        db_.handle(),
        "INSERT INTO books "
        "(title, author, year, available, isbn, format, file_path) "
        "VALUES (?, ?, ?, ?, ?, ?, ?);");
    stmt.bindText(1, book.title);
    stmt.bindText(2, book.author);
    stmt.bindInt (3, book.year);
    stmt.bindBool(4, book.available);
    stmt.bindText(5, book.isbn);
    stmt.bindText(6, book.format);
    stmt.bindText(7, book.filePath);

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
        std::string("SELECT ") + kCols + " FROM books WHERE id = ?;");
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

std::optional<Book> BookRepository::findByIsbn(const std::string& isbn) {
    PreparedStatement stmt(
        db_.handle(),
        std::string("SELECT ") + kCols + " FROM books WHERE isbn = ? LIMIT 1;");
    stmt.bindText(1, isbn);
    const int rc = sqlite3_step(stmt.get());
    if (rc == SQLITE_ROW) {
        return readRow(stmt.get());
    }
    if (rc == SQLITE_DONE) {
        return std::nullopt;
    }
    throw std::runtime_error(
        "findByIsbn failed: " + std::string(sqlite3_errmsg(db_.handle())));
}

std::vector<Book> BookRepository::findAll() {
    PreparedStatement stmt(
        db_.handle(),
        // ORDER BY author, title takes advantage of idx_books_author_title.
        std::string("SELECT ") + kCols + " FROM books ORDER BY author, title;");

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
        std::string("SELECT ") + kCols +
        " FROM books WHERE author LIKE ? ORDER BY title;");
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
        "UPDATE books SET "
        "  title = ?, author = ?, year = ?, available = ?, "
        "  isbn = ?, format = ?, file_path = ? "
        "WHERE id = ?;");
    stmt.bindText(1, book.title);
    stmt.bindText(2, book.author);
    stmt.bindInt (3, book.year);
    stmt.bindBool(4, book.available);
    stmt.bindText(5, book.isbn);
    stmt.bindText(6, book.format);
    stmt.bindText(7, book.filePath);
    stmt.bindInt (8, book.id);

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
