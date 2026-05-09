# cpp-contacts-api

A minimal REST API in C++ for a contact book, built with
[cpp-httplib](https://github.com/yhirose/cpp-httplib) and
[nlohmann/json](https://github.com/nlohmann/json). Data is persisted to
`contacts.json` in the working directory.

## Build & run

```sh
cmake -S . -B build
cmake --build build -j
./build/contacts_api
```

The first configure pulls both libraries via `FetchContent` (network required).

## Endpoints

| Method | Path             | Purpose                  | Success | Errors          |
| ------ | ---------------- | ------------------------ | ------- | --------------- |
| GET    | `/contacts`      | List every contact       | `200`   | —               |
| GET    | `/contacts/{id}` | Fetch one contact by id  | `200`   | `404`           |
| POST   | `/contacts`      | Create a contact         | `201`   | `400`, `409`    |

### Why these methods?

- **GET** is *safe* (no side effects) and *idempotent* (same result every call),
  so caches and retries are free. Use it for reads only.
- **POST** is neither safe nor idempotent. It is the right verb when the server
  decides the resource id, which is true here. Two POSTs create two contacts.

### Why server-assigned ids?

If clients picked ids, two concurrent clients could collide. The server holds
the source of truth, picks the next id under a mutex, and returns the created
resource so the client knows the id without a follow-up `GET`.

## Examples

```sh
# create
curl -i -X POST http://localhost:8080/contacts \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","phone":"+1-555-0100"}'

# list
curl -s http://localhost:8080/contacts | jq

# fetch one
curl -s http://localhost:8080/contacts/1 | jq

# duplicate email -> 409
curl -i -X POST http://localhost:8080/contacts \
  -H 'content-type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com"}'
```
