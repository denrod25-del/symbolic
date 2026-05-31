// V3 tests. The same language as V2, run through the bytecode VM.

#define EXPR_V3_TEST_BUILD
#include "interpreter_v3.cpp"

#include <cmath>
#include <iostream>

namespace {

int failures = 0;

void checkNum(const std::string& source, double expected) {
  try {
    VM vm;
    const Value v = runSource(vm, source);
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
    VM vm;
    const Value v = runSource(vm, source);
    std::cerr << "FAIL: \"" << source << "\" returned " << valueToString(v) << " (expected throw)\n";
    ++failures;
  } catch (const std::exception&) {
    std::cout << "ok:   \"" << source << "\" rejected as expected\n";
  }
}

} // namespace

int main() {
  // Arithmetic and precedence
  checkNum("3 + 4 * 2", 11);
  checkNum("(3 + 4) * 2", 14);
  checkNum("10 - 3 - 2", 5);
  checkNum("20 / 4 / 2", 2.5);
  checkNum("-(2 + 3) * 2", -10);

  // Variables and sequences
  checkNum("let x = 5; x + 1", 6);
  checkNum("let x = 5; let y = x * 2; x + y", 15);
  checkNum("(let x = 3; let y = 4; x * y)", 12);

  // Comparisons
  checkNum("3 == 3", 1);
  checkNum("3 != 3", 0);
  checkNum("1 + 2 < 4", 1);
  checkNum("5 >= 5", 1);

  // Branching
  checkNum("if 1 then 10 else 20", 10);
  checkNum("if 0 then 10 else 20", 20);
  checkNum("if 3 < 4 then 100 else 200", 100);

  // First-class functions
  checkNum("let sq = fn(x) x * x; sq(7)", 49);
  checkNum("let add = fn(a, b) a + b; add(3, 4)", 7);

  // Closure
  checkNum("let mk = fn(x) fn(y) x + y; let add5 = mk(5); add5(3)", 8);

  // Lexical scope: same canonical test as V2.
  checkNum(
    "let x = 10;"
    "let f = fn() x;"
    "let g = fn() (let x = 99; f());"
    "g()",
    10);

  // Recursion via late-bound global.
  checkNum(
    "let fact = fn(n) if n == 0 then 1 else n * fact(n - 1); fact(6)",
    720);

  // Mutual recursion.
  checkNum(
    "let even = fn(n) if n == 0 then 1 else odd(n - 1);"
    "let odd  = fn(n) if n == 0 then 0 else even(n - 1);"
    "even(10) + odd(7)",
    2);

  // Built-ins
  checkNum("sqrt(16)", 4);
  checkNum("pow(2, 10)", 1024);
  checkNum("abs(-7.5)", 7.5);
  checkNum("min(3, max(1, 2))", 2);

  // Higher-order: function returning function via composition.
  checkNum(
    "let compose = fn(f, g) fn(x) f(g(x));"
    "let inc = fn(x) x + 1;"
    "let dbl = fn(x) x * 2;"
    "compose(inc, dbl)(5)",
    11);

  // REPL-style: state persists across multiple runs against the same VM.
  {
    VM vm;
    runSource(vm, "let counter = 0");
    runSource(vm, "let bump = fn() (let counter = counter + 1; counter)");
    // bump captures the global `counter`, but its own `let` binds a *local*
    // counter in the call env. So bump() returns 1 every time (no mutation).
    const double a = asNumber(runSource(vm, "bump()"), "");
    const double b = asNumber(runSource(vm, "bump()"), "");
    if (a != 1 || b != 1) {
      std::cerr << "FAIL: persistent-vm test, got " << a << ", " << b << "\n";
      ++failures;
    } else {
      std::cout << "ok:   persistent VM: bump() = 1; bump() = 1\n";
    }
  }

  // Errors
  checkThrows("foo");
  checkThrows("let f = fn(x) x; f(1, 2)");
  checkThrows("1(2)");
  checkThrows("let f = fn(x) x; f + 1");
  checkThrows("if then 1 else 2");
  checkThrows("let = 5");
  checkThrows("1 / 0");

  if (failures == 0) {
    std::cout << "\nall v3 tests passed\n";
    return 0;
  }
  std::cerr << "\n" << failures << " failure(s)\n";
  return 1;
}
