#include <httplib.h>
#include <nlohmann/json.hpp>

#include <fstream>
#include <mutex>
#include <string>

using json = nlohmann::json;

namespace {

constexpr const char* kDataFile = "contacts.json";
constexpr const char* kJsonMime = "application/json";

std::mutex g_store_mutex;

json load_contacts() {
  std::ifstream in(kDataFile);
  if (!in.good()) {
    return json::array();
  }
  json data;
  in >> data;
  if (!data.is_array()) {
    return json::array();
  }
  return data;
}

void save_contacts(const json& contacts) {
  std::ofstream out(kDataFile);
  out << contacts.dump(2);
}

int next_id(const json& contacts) {
  int max_id = 0;
  for (const auto& c : contacts) {
    if (c.contains("id") && c["id"].is_number_integer()) {
      max_id = std::max(max_id, c["id"].get<int>());
    }
  }
  return max_id + 1;
}

void send_json(httplib::Response& res, int status, const json& body) {
  res.status = status;
  res.set_content(body.dump(), kJsonMime);
}

}  // namespace

int main() {
  httplib::Server server;

  // GET /contacts — list every contact.
  // Safe and idempotent: repeated calls return the same data and never mutate
  // the store. Returns 200 with a JSON array (possibly empty).
  server.Get("/contacts", [](const httplib::Request&, httplib::Response& res) {
    std::lock_guard<std::mutex> lock(g_store_mutex);
    send_json(res, 200, load_contacts());
  });

  // GET /contacts/:id — fetch a single contact.
  // 200 with the contact when found, 404 when no contact has that id.
  server.Get(R"(/contacts/(\d+))",
             [](const httplib::Request& req, httplib::Response& res) {
               const int id = std::stoi(req.matches[1]);
               std::lock_guard<std::mutex> lock(g_store_mutex);
               const auto contacts = load_contacts();
               for (const auto& c : contacts) {
                 if (c.value("id", -1) == id) {
                   send_json(res, 200, c);
                   return;
                 }
               }
               send_json(res, 404, {{"error", "contact not found"}});
             });

  // POST /contacts — create a contact.
  // Not idempotent: each call appends a new record. The server assigns the id,
  // so the client must not send one. Returns 201 Created with the stored
  // resource (including its new id) so the client can use it without a refetch.
  server.Post("/contacts", [](const httplib::Request& req,
                              httplib::Response& res) {
    json body;
    if (!json::accept(req.body)) {
      send_json(res, 400, {{"error", "body must be valid JSON"}});
      return;
    }
    body = json::parse(req.body);

    if (!body.is_object() || !body.contains("name") ||
        !body["name"].is_string() || body["name"].get<std::string>().empty()) {
      send_json(res, 400, {{"error", "field 'name' is required"}});
      return;
    }

    std::lock_guard<std::mutex> lock(g_store_mutex);
    auto contacts = load_contacts();

    if (body.contains("email") && body["email"].is_string()) {
      const auto email = body["email"].get<std::string>();
      for (const auto& c : contacts) {
        if (c.value("email", std::string{}) == email) {
          send_json(res, 409, {{"error", "email already exists"}});
          return;
        }
      }
    }

    json contact = {
        {"id", next_id(contacts)},
        {"name", body["name"]},
        {"email", body.value("email", "")},
        {"phone", body.value("phone", "")},
    };
    contacts.push_back(contact);
    save_contacts(contacts);

    send_json(res, 201, contact);
  });

  server.set_exception_handler(
      [](const httplib::Request&, httplib::Response& res, std::exception_ptr) {
        send_json(res, 500, {{"error", "internal server error"}});
      });

  const char* host = "0.0.0.0";
  const int port = 8080;
  std::printf("listening on http://%s:%d\n", host, port);
  server.listen(host, port);
  return 0;
}
