cmake_minimum_required(VERSION 3.14)
project(cpp_contacts_api CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

include(FetchContent)

FetchContent_Declare(
  httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.18.1
)
FetchContent_MakeAvailable(httplib)

FetchContent_Declare(
  json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.11.3
)
FetchContent_MakeAvailable(json)

add_executable(contacts_api main.cpp)
target_link_libraries(contacts_api PRIVATE httplib::httplib nlohmann_json::nlohmann_json)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
  target_compile_options(contacts_api PRIVATE -Wall -Wextra -Wpedantic)
endif()
