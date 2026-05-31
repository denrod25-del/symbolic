// V4 tests: same language as V2/V3, plus folding + slot-resolved verification.

#define EXPR_V4_TEST_BUILD
#include "interpreter_v4.cpp"

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
    std::cerr << "FAIL: \"" << source << "\" returned " << valueToString(v) << "\n";
    ++failures;
  } catch (const std::exception&) {
    std::cout << "ok:   \"" << source << "\" rejected as expected\n";
  }
}

// Verify a piece of source compiles to bytecode containing `expected` as a
// substring (after folding). Useful for asserting an optimization fired.
void checkAsmContains(const std::string& source, const std::string& needle) {
  try {
    VM vm;
    std::string asmStr;
    runSource(vm, source, &asmStr);
    if (asmStr.find(needle) == std::string::npos) {
      std::cerr << "FAIL: asm for \"" << source << "\" missing \"" << needle << "\":\n" << asmStr << "\n";
      ++failures;
    } else {
      std::cout << "ok:   asm for \"" << source << "\" contains \"" << needle << "\"\n";
    }
  } catch (const std::exception& e) {
    std::cerr << "FAIL: asm probe \"" << source << "\" threw: " << e.what() << "\n";
    ++failures;
  }
}

// And the opposite — assert a substring is *absent*.
void checkAsmLacks(const std::string& source, const std::string& needle) {
  try {
    VM vm;
    std::string asmStr;
    runSource(vm, source, &asmStr);
    if (asmStr.find(needle) != std::string::npos) {
      std::cerr << "FAIL: asm for \"" << source << "\" unexpectedly contains \"" << needle << "\":\n" << asmStr << "\n";
      ++failures;
    } else {
      std::cout << "ok:   asm for \"" << source << "\" lacks \"" << needle << "\"\n";
    }
  } catch (const std::exception& e) {
    std::cerr << "FAIL: asm probe \"" << source << "\" threw: " << e.what() << "\n";
    ++failures;
  }
}

} // namespace

int main() {
  // ── Correctness: all the V3 tests should still pass ──
  checkNum("3 + 4 * 2", 11);
  checkNum("(3 + 4) * 2", 14);
  checkNum("10 - 3 - 2", 5);
  checkNum("20 / 4 / 2", 2.5);
  checkNum("-(2 + 3) * 2", -10);

  checkNum("let x = 5; x + 1", 6);
  checkNum("let x = 5; let y = x * 2; x + y", 15);
  checkNum("(let x = 3; let y = 4; x * y)", 12);

  checkNum("3 == 3", 1);
  checkNum("3 != 3", 0);
  checkNum("5 >= 5", 1);

  checkNum("if 1 then 10 else 20", 10);
  checkNum("if 0 then 10 else 20", 20);

  // Functions, closures, recursion
  checkNum("let sq = fn(x) x * x; sq(7)", 49);
  checkNum("let add = fn(a, b) a + b; add(3, 4)", 7);
  checkNum("let mk = fn(x) fn(y) x + y; let add5 = mk(5); add5(3)", 8);
  checkNum("let x = 10; let f = fn() x;"
           "let g = fn() (let x = 99; f()); g()", 10);
  checkNum("let fact = fn(n) if n == 0 then 1 else n * fact(n - 1); fact(6)", 720);
  checkNum("let even = fn(n) if n == 0 then 1 else odd(n - 1);"
           "let odd  = fn(n) if n == 0 then 0 else even(n - 1);"
           "even(10) + odd(7)", 2);

  // Deeply nested closures with chained upvalues
  checkNum("let f = fn(x) fn(y) fn(z) x + y + z; f(1)(2)(3)", 6);
  checkNum("let f = fn(x) fn(y) fn(z) x * y * z; f(2)(3)(4)", 24);

  // Higher-order composition
  checkNum("let compose = fn(f, g) fn(x) f(g(x));"
           "let inc = fn(x) x + 1;"
           "let dbl = fn(x) x * 2;"
           "compose(inc, dbl)(5)", 11);

  // Builtins
  checkNum("sqrt(16)", 4);
  checkNum("pow(2, 10)", 1024);
  checkNum("abs(-7.5)", 7.5);
  checkNum("min(3, max(1, 2))", 2);

  // Errors
  checkThrows("foo");
  checkThrows("let f = fn(x) x; f(1, 2)");
  checkThrows("1(2)");
  checkThrows("let f = fn(x) x; f + 1");
  checkThrows("if then 1 else 2");
  checkThrows("let = 5");

  // ── Constant folding ──
  // 2 + 3 * 4 → 14. Bytecode should contain only one CONST (= 14), not three.
  checkAsmContains("2 + 3 * 4", "14");
  checkAsmLacks   ("2 + 3 * 4", "ADD");
  checkAsmLacks   ("2 + 3 * 4", "MUL");

  // -(1 + 2) → -3.
  checkAsmContains("-(1 + 2)", "-3");
  checkAsmLacks   ("-(1 + 2)", "NEG");

  // `if 1 then a else b` collapses to `a` (no JUMP).
  checkAsmLacks   ("if 1 then 42 else 99", "JUMP");
  checkAsmContains("if 1 then 42 else 99", "42");
  checkAsmLacks   ("if 0 then 42 else 99", "JUMP");
  checkAsmContains("if 0 then 42 else 99", "99");

  // Folding mixes with variable references — `x + (2 * 3)` keeps `x` as a
  // LOAD but folds the RHS to a single CONST 6.
  checkAsmContains("let x = 1; x + (2 * 3)", "6");
  checkAsmLacks   ("let x = 1; x + (2 * 3)", "MUL");

  // And folded results compute correctly at runtime.
  checkNum("2 + 3 * 4", 14);
  checkNum("-(1 + 2) * 5", -15);
  checkNum("if 5 < 10 then 1 + 2 else 99", 3);
  checkNum("let x = 3; x * (2 + 5)", 21);

  // ── Slot-resolved locals ──
  // A function's body should use LOAD_LOCAL for its params, not LOAD_GLOBAL.
  checkAsmContains("let sq = fn(x) x * x; sq(7)", "LOAD_LOCAL");
  // Inner closure should see outer's `x` as LOAD_UPVALUE, not LOAD_GLOBAL.
  checkAsmContains("let mk = fn(x) fn(y) x + y; mk(1)(2)", "LOAD_UPVALUE");

  // Top-level lets are globals; references to them outside scopes use LOAD_GLOBAL.
  checkAsmContains("let g = 5; g + 1", "LOAD_GLOBAL");

  if (failures == 0) { std::cout << "\nall v4 tests passed\n"; return 0; }
  std::cerr << "\n" << failures << " failure(s)\n";
  return 1;
}
