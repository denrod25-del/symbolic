#pragma once

#include "Book.hpp"
#include "Database.hpp"

#include <optional>
#include <string>
#include <vector>

// Repository pattern: one class is responsible for translating between Book
// objects and rows in the `books` table. Callers never see SQL.
class BookRepository {
public:
    explicit BookRepository(Database& db);

    // Creates the schema if it does not yet exist. Idempotent.
    void initSchema();

    // CRUD operations. Each one uses a prepared statement under the hood.
    int                  create(const Book& book);                      // C
    std::optional<Book>  findById(int id);                              // R
    std::optional<Book>  findByIsbn(const std::string& isbn);           // R
    std::vector<Book>    findAll();                                     // R
    std::vector<Book>    searchByAuthor(const std::string& author);     // R
    bool                 update(const Book& book);                      // U
    bool                 remove(int id);                                // D

private:
    Database& db_;
};
