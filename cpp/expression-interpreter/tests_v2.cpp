// V2 tests. Compile with the Makefile: `make test_v2`.

#define EXPR_V2_TEST_BUILD
#include "interpreter_v2.cpp"

#include <cmath>
#include <iostream>

namespace {

int failures = 0;

void checkNum(const std::string& source, double expected) {
  try {
    auto env = makeGlobalEnv();
    const Value v = runSource(source, env);
    const double got = asNumber(v, "test result");
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
    auto env = makeGlobalEnv();
    const Value v = runSource(source, env);
    std::cerr << "FAIL: \"" << source << "\" should have thrown but returned "
              << valueToString(v) << "\n";
    ++failures;
  } catch (const std::exception&) {
    std::cout << "ok:   \"" << source << "\" rejected as expected\n";
  }
}

} // namespace

int main() {
  // V1 sanity: precedence, associativity, parens.
  checkNum("3 + 4 * 2", 11);
  checkNum("(3 + 4) * 2", 14);
  checkNum("10 - 3 - 2", 5);
  checkNum("-(2 + 3) * 2", -10);

  // Variables and sequences.
  checkNum("let x = 5; x + 1", 6);
  checkNum("let x = 5; let y = x * 2; x + y", 15);
  checkNum("(let x = 3; let y = 4; x * y)", 12);

  // Comparisons (1 = true, 0 = false).
  checkNum("3 == 3", 1);
  checkNum("3 != 3", 0);
  checkNum("1 + 2 < 4", 1);
  checkNum("5 >= 5", 1);

  // if/else as an expression.
  checkNum("if 1 then 10 else 20", 10);
  checkNum("if 0 then 10 else 20", 20);
  checkNum("if 3 < 4 then 100 else 200", 100);

  // First-class functions and calls.
  checkNum("let sq = fn(x) x * x; sq(7)", 49);
  checkNum("let add = fn(a, b) a + b; add(3, 4)", 7);

  // Closures: inner function captures outer's `x`.
  checkNum("let mk = fn(x) fn(y) x + y; let add5 = mk(5); add5(3)", 8);

  // Lexical scope: `f`'s closure was captured in the global env. Calling it
  // from inside `g`, where a *different* local `x = 99` exists, must still see
  // the global `x = 10` — because closures look up names where the function
  // was defined, not where it was called. Swap that and you have dynamic
  // scope, which is what bash and early Lisps do.
  checkNum(
    "let x = 10;"
    "let f = fn() x;"
    "let g = fn() (let x = 99; f());"
    "g()",
    10);

  // Recursion. The closure for `fact` captures the env where `fact` itself
  // will be defined, so its body can call `fact` when it runs.
  checkNum(
    "let fact = fn(n) if n == 0 then 1 else n * fact(n - 1); fact(6)",
    720);

  // Mutual-ish recursion via late binding.
  checkNum(
    "let even = fn(n) if n == 0 then 1 else odd(n - 1);"
    "let odd  = fn(n) if n == 0 then 0 else even(n - 1);"
    "even(10) + odd(7)",
    2); // even(10)=1, odd(7)=1

  // Built-ins.
  checkNum("sqrt(16)", 4);
  checkNum("pow(2, 10)", 1024);
  checkNum("abs(-7.5)", 7.5);
  checkNum("min(3, max(1, 2))", 2);

  // Errors.
  checkThrows("foo");                       // undefined variable
  checkThrows("let f = fn(x) x; f(1, 2)");  // arity mismatch
  checkThrows("1(2)");                      // calling a non-function
  checkThrows("let f = fn(x) x; f + 1");    // arithmetic on a function
  checkThrows("if then 1 else 2");          // syntax error
  checkThrows("let = 5");                   // missing name in let

  if (failures == 0) {
    std::cout << "\nall v2 tests passed\n";
    return 0;
  }
  std::cerr << "\n" << failures << " failure(s)\n";
  return 1;
}
