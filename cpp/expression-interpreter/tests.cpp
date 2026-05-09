// Minimal sanity tests. Compile with the interpreter sources excluded:
//   g++ -std=c++17 -Wall -Wextra -O2 -DEXPR_TEST_BUILD tests.cpp -o tests
// or use the Makefile: `make test`.

#define EXPR_TEST_BUILD
#include "interpreter.cpp"

#include <cmath>
#include <iostream>

namespace {

int failures = 0;

void check(const std::string& source, double expected) {
  try {
    const double got = evaluate(source);
    if (std::fabs(got - expected) > 1e-9) {
      std::cerr << "FAIL: \"" << source << "\" = " << got << ", expected " << expected << "\n";
      ++failures;
    } else {
      std::cout << "ok:   \"" << source << "\" = " << got << "\n";
    }
  } catch (const std::exception& e) {
    std::cerr << "FAIL: \"" << source << "\" threw: " << e.what() << "\n";
    ++failures;
  }
}

void checkThrows(const std::string& source) {
  try {
    const double got = evaluate(source);
    std::cerr << "FAIL: \"" << source << "\" should have thrown but returned " << got << "\n";
    ++failures;
  } catch (const std::exception&) {
    std::cout << "ok:   \"" << source << "\" rejected as expected\n";
  }
}

} // namespace

int main() {
  // Precedence and associativity.
  check("3 + 4 * 2", 11);
  check("(3 + 4) * 2", 14);
  check("10 - 3 - 2", 5);     // left-associative subtraction
  check("20 / 4 / 2", 2.5);   // left-associative division

  // Unary operators and parentheses.
  check("-3 + 4", 1);
  check("--5", 5);
  check("-(2 + 3) * 2", -10);
  check("+7", 7);

  // Floating point literals and whitespace.
  check("1.5 * 2", 3.0);
  check("   42   ", 42);

  // Errors.
  checkThrows("1 +");
  checkThrows("(1 + 2");
  checkThrows("1 / 0");
  checkThrows("3 4");
  checkThrows("1 + $");

  if (failures == 0) {
    std::cout << "\nall tests passed\n";
    return 0;
  }
  std::cerr << "\n" << failures << " failure(s)\n";
  return 1;
}
