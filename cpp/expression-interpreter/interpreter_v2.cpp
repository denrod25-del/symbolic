// V2 of the expression interpreter.
//
// V1 was a calculator: numbers, +, -, *, /, parens, unary sign.
// V2 adds the machinery that turns a calculator into a programming language:
//
//   * identifiers and `let` bindings        ── state
//   * comparison operators                  ── booleans-as-numbers
//   * `if cond then a else b` expressions   ── control flow
//   * `fn (params) body` and call syntax    ── first-class functions
//   * lexical scope and closures            ── captured environments
//   * `;`-separated statement sequences     ── more than one thing per line
//   * a few built-in functions              ── escape hatch to the host
//
// The architecture is the same as V1: Lexer → Parser → AST → eval. The big
// internal change is that `Expr::eval` now takes an Environment and returns a
// Value (variant<double, FunctionValue>) instead of a raw double. That single
// type change is what enables variables and first-class functions.
//
// Grammar (changes from V1 marked *):
//   program        := statement (';' statement)* ';'?               *
//   statement      := letStmt | expression                          *
//   letStmt        := 'let' IDENT '=' expression                    *
//   expression     := ifExpr | fnExpr | comparison                  *
//   ifExpr         := 'if' expression 'then' expression 'else' expression  *
//   fnExpr         := 'fn' '(' params? ')' expression               *
//   comparison     := additive (cmpOp additive)?                    *
//   additive       := multiplicative (('+'|'-') multiplicative)*
//   multiplicative := unary (('*'|'/') unary)*
//   unary          := ('+'|'-') unary | call
//   call           := primary ('(' args? ')')*                      *
//   primary        := NUMBER | IDENT
//                   | '(' statement (';' statement)* ')'            *
//
// Build:  g++ -std=c++17 -Wall -Wextra -O2 interpreter_v2.cpp -o interpreter_v2
// Run:    ./interpreter_v2            (REPL, state persists across lines)
//         ./interpreter_v2 "1+2*3"    (one-shot)

#include <cctype>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <variant>
#include <vector>

// -----------------------------------------------------------------------------
// 1. Tokens
// -----------------------------------------------------------------------------

enum class TokenKind {
  Number, Ident,
  Let, Fn, If, Then, Else,
  Plus, Minus, Star, Slash,
  LParen, RParen, Comma, Semi,
  Eq, EqEq, BangEq, Lt, Gt, LtEq, GtEq,
  End,
};

struct Token {
  TokenKind kind;
  double number = 0.0;
  std::string text;
  std::size_t pos = 0;
};

// -----------------------------------------------------------------------------
// 2. Lexer
//
// Two new shapes vs. V1:
//   * identifiers (letters / underscores, then alphanumerics) — also covers
//     keywords, which we recognise by table after reading.
//   * two-character operators (==, !=, <=, >=) — handled with a single char of
//     lookahead. This is the lexer-level analogue of LL(1) parsing.
// -----------------------------------------------------------------------------

class Lexer {
public:
  explicit Lexer(std::string source) : src_(std::move(source)) {}

  std::vector<Token> tokenize() {
    std::vector<Token> tokens;
    while (pos_ < src_.size()) {
      const char c = src_[pos_];
      if (std::isspace(static_cast<unsigned char>(c))) { ++pos_; continue; }
      if (std::isdigit(static_cast<unsigned char>(c)) || c == '.') {
        tokens.push_back(readNumber());
        continue;
      }
      if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
        tokens.push_back(readIdentOrKeyword());
        continue;
      }
      tokens.push_back(readPunctuation());
    }
    tokens.push_back({TokenKind::End, 0.0, "", pos_});
    return tokens;
  }

private:
  Token readNumber() {
    const std::size_t start = pos_;
    bool seenDot = false;
    while (pos_ < src_.size()) {
      const char c = src_[pos_];
      if (std::isdigit(static_cast<unsigned char>(c))) { ++pos_; }
      else if (c == '.' && !seenDot) { seenDot = true; ++pos_; }
      else break;
    }
    const std::string lexeme = src_.substr(start, pos_ - start);
    if (lexeme == ".") {
      throw std::runtime_error("invalid number literal at position " + std::to_string(start));
    }
    return {TokenKind::Number, std::stod(lexeme), lexeme, start};
  }

  Token readIdentOrKeyword() {
    const std::size_t start = pos_;
    while (pos_ < src_.size() &&
           (std::isalnum(static_cast<unsigned char>(src_[pos_])) || src_[pos_] == '_')) {
      ++pos_;
    }
    std::string text = src_.substr(start, pos_ - start);
    static const std::unordered_map<std::string, TokenKind> kw = {
        {"let",  TokenKind::Let},
        {"fn",   TokenKind::Fn},
        {"if",   TokenKind::If},
        {"then", TokenKind::Then},
        {"else", TokenKind::Else},
    };
    const auto it = kw.find(text);
    const TokenKind k = (it != kw.end()) ? it->second : TokenKind::Ident;
    return {k, 0.0, std::move(text), start};
  }

  Token readPunctuation() {
    const std::size_t start = pos_;
    const char c = src_[pos_++];
    const auto maybeTwo = [&](char expected, TokenKind two, TokenKind one) {
      if (pos_ < src_.size() && src_[pos_] == expected) {
        ++pos_;
        return Token{two, 0.0, "", start};
      }
      return Token{one, 0.0, "", start};
    };
    switch (c) {
      case '+': return {TokenKind::Plus,   0.0, "", start};
      case '-': return {TokenKind::Minus,  0.0, "", start};
      case '*': return {TokenKind::Star,   0.0, "", start};
      case '/': return {TokenKind::Slash,  0.0, "", start};
      case '(': return {TokenKind::LParen, 0.0, "", start};
      case ')': return {TokenKind::RParen, 0.0, "", start};
      case ',': return {TokenKind::Comma,  0.0, "", start};
      case ';': return {TokenKind::Semi,   0.0, "", start};
      case '=': return maybeTwo('=', TokenKind::EqEq,  TokenKind::Eq);
      case '<': return maybeTwo('=', TokenKind::LtEq,  TokenKind::Lt);
      case '>': return maybeTwo('=', TokenKind::GtEq,  TokenKind::Gt);
      case '!':
        if (pos_ < src_.size() && src_[pos_] == '=') {
          ++pos_;
          return {TokenKind::BangEq, 0.0, "", start};
        }
        throw std::runtime_error("expected '!=' at position " + std::to_string(start));
    }
    throw std::runtime_error(
        std::string("unexpected character '") + c + "' at position " + std::to_string(start));
  }

  std::string src_;
  std::size_t pos_ = 0;
};

// -----------------------------------------------------------------------------
// 3. Values and Environments
//
// A Value is what an expression evaluates to. In V1 that was always a double.
// Here it's a tagged union of `double` and `FunctionValue`, which is what
// "first-class functions" literally means: functions live in the same value
// space as numbers — you can put them in variables, pass them as arguments,
// return them from other functions.
//
// An Environment is a name→Value table with a pointer to its parent. This
// linked-list-of-tables structure is the *scope chain*. Lookup walks parents
// until it finds the name or runs out of links (→ "undefined variable").
//
// A closure is a function plus the environment it was *defined* in (not the
// one it's *called* in). That's what "lexical scope" means. We capture it
// when we evaluate the `fn(...)` expression. See FunctionExpr::eval below.
// -----------------------------------------------------------------------------

struct Expr;
class Environment;
struct FunctionValue;

using ExprPtr = std::shared_ptr<const Expr>;
using EnvPtr = std::shared_ptr<Environment>;
using Value = std::variant<double, std::shared_ptr<FunctionValue>>;

class Environment {
public:
  Environment() = default;
  explicit Environment(EnvPtr parent) : parent_(std::move(parent)) {}

  void define(const std::string& name, Value v) { vars_[name] = std::move(v); }

  const Value& lookup(const std::string& name) const {
    const auto it = vars_.find(name);
    if (it != vars_.end()) return it->second;
    if (parent_) return parent_->lookup(name);
    throw std::runtime_error("undefined variable: " + name);
  }

private:
  std::unordered_map<std::string, Value> vars_;
  EnvPtr parent_;
};

using BuiltinFn = std::function<Value(const std::vector<Value>&)>;

struct FunctionValue {
  std::string name;                   // for error messages and printing
  std::vector<std::string> params;    // user-defined functions only
  ExprPtr body;                       // user-defined: AST to evaluate
  EnvPtr closure;                     // user-defined: captured definition env
  BuiltinFn builtin;                  // built-ins only

  bool isBuiltin() const { return body == nullptr; }
};

namespace {

double asNumber(const Value& v, const std::string& ctx) {
  if (!std::holds_alternative<double>(v)) {
    throw std::runtime_error("expected number in " + ctx + ", got function");
  }
  return std::get<double>(v);
}

std::string valueToString(const Value& v) {
  if (std::holds_alternative<double>(v)) {
    std::ostringstream os;
    os << std::get<double>(v);
    return os.str();
  }
  const auto& fn = std::get<std::shared_ptr<FunctionValue>>(v);
  return "<fn " + fn->name + ">";
}

} // namespace

// -----------------------------------------------------------------------------
// 4. AST
//
// Each node knows how to evaluate itself in an environment. The eval methods
// are the entire semantics of the language — read them top to bottom and you
// have a precise specification of what each construct *means*.
// -----------------------------------------------------------------------------

struct Expr {
  virtual ~Expr() = default;
  virtual Value eval(const EnvPtr& env) const = 0;
  virtual std::string toString() const = 0;
};

struct NumberExpr final : Expr {
  double value;
  explicit NumberExpr(double v) : value(v) {}
  Value eval(const EnvPtr&) const override { return value; }
  std::string toString() const override {
    std::ostringstream os; os << value; return os.str();
  }
};

struct IdentExpr final : Expr {
  std::string name;
  explicit IdentExpr(std::string n) : name(std::move(n)) {}
  Value eval(const EnvPtr& env) const override { return env->lookup(name); }
  std::string toString() const override { return name; }
};

struct UnaryExpr final : Expr {
  char op;
  ExprPtr operand;
  UnaryExpr(char o, ExprPtr e) : op(o), operand(std::move(e)) {}
  Value eval(const EnvPtr& env) const override {
    const double v = asNumber(operand->eval(env), "unary operand");
    return op == '-' ? -v : v;
  }
  std::string toString() const override {
    return std::string("(") + op + operand->toString() + ")";
  }
};

struct BinaryExpr final : Expr {
  std::string op;
  ExprPtr lhs, rhs;
  BinaryExpr(std::string o, ExprPtr l, ExprPtr r)
      : op(std::move(o)), lhs(std::move(l)), rhs(std::move(r)) {}
  Value eval(const EnvPtr& env) const override {
    const double a = asNumber(lhs->eval(env), "left operand of " + op);
    const double b = asNumber(rhs->eval(env), "right operand of " + op);
    if (op == "+") return a + b;
    if (op == "-") return a - b;
    if (op == "*") return a * b;
    if (op == "/") {
      if (b == 0.0) throw std::runtime_error("division by zero");
      return a / b;
    }
    if (op == "==") return a == b ? 1.0 : 0.0;
    if (op == "!=") return a != b ? 1.0 : 0.0;
    if (op == "<")  return a <  b ? 1.0 : 0.0;
    if (op == ">")  return a >  b ? 1.0 : 0.0;
    if (op == "<=") return a <= b ? 1.0 : 0.0;
    if (op == ">=") return a >= b ? 1.0 : 0.0;
    throw std::runtime_error("unknown operator '" + op + "'");
  }
  std::string toString() const override {
    return "(" + lhs->toString() + " " + op + " " + rhs->toString() + ")";
  }
};

struct LetExpr final : Expr {
  std::string name;
  ExprPtr expr;
  LetExpr(std::string n, ExprPtr e) : name(std::move(n)), expr(std::move(e)) {}
  Value eval(const EnvPtr& env) const override {
    Value v = expr->eval(env);
    env->define(name, v);
    return v;
  }
  std::string toString() const override {
    return "(let " + name + " = " + expr->toString() + ")";
  }
};

struct IfExpr final : Expr {
  ExprPtr cond, thenBranch, elseBranch;
  IfExpr(ExprPtr c, ExprPtr t, ExprPtr e)
      : cond(std::move(c)), thenBranch(std::move(t)), elseBranch(std::move(e)) {}
  Value eval(const EnvPtr& env) const override {
    const double c = asNumber(cond->eval(env), "if condition");
    return (c != 0.0 ? thenBranch : elseBranch)->eval(env);
  }
  std::string toString() const override {
    return "(if " + cond->toString() + " then " + thenBranch->toString()
         + " else " + elseBranch->toString() + ")";
  }
};

struct FunctionExpr final : Expr {
  std::vector<std::string> params;
  ExprPtr body;
  FunctionExpr(std::vector<std::string> p, ExprPtr b)
      : params(std::move(p)), body(std::move(b)) {}
  // Evaluating a function literal is the moment closures are born: we snapshot
  // the current environment and stash it inside the FunctionValue.
  Value eval(const EnvPtr& env) const override {
    auto f = std::make_shared<FunctionValue>();
    f->name = "<anon>";
    f->params = params;
    f->body = body;
    f->closure = env;
    return f;
  }
  std::string toString() const override {
    std::string s = "(fn(";
    for (std::size_t i = 0; i < params.size(); ++i) {
      if (i) s += ", ";
      s += params[i];
    }
    s += ") " + body->toString() + ")";
    return s;
  }
};

struct CallExpr final : Expr {
  ExprPtr callee;
  std::vector<ExprPtr> args;
  CallExpr(ExprPtr c, std::vector<ExprPtr> a)
      : callee(std::move(c)), args(std::move(a)) {}
  Value eval(const EnvPtr& env) const override {
    Value calleeVal = callee->eval(env);
    if (!std::holds_alternative<std::shared_ptr<FunctionValue>>(calleeVal)) {
      throw std::runtime_error("attempt to call a non-function");
    }
    const auto fn = std::get<std::shared_ptr<FunctionValue>>(calleeVal);

    std::vector<Value> argVals;
    argVals.reserve(args.size());
    for (const auto& a : args) argVals.push_back(a->eval(env));

    if (fn->isBuiltin()) return fn->builtin(argVals);

    if (argVals.size() != fn->params.size()) {
      throw std::runtime_error(
          "arity mismatch calling " + fn->name + ": expected " +
          std::to_string(fn->params.size()) + " arg(s), got " +
          std::to_string(argVals.size()));
    }
    // New scope, parent = the closure's captured env (lexical scope), NOT the
    // caller's env. Swap `fn->closure` for `env` here and you have dynamic
    // scope, which is what early Lisps and bash do.
    auto callEnv = std::make_shared<Environment>(fn->closure);
    for (std::size_t i = 0; i < fn->params.size(); ++i) {
      callEnv->define(fn->params[i], argVals[i]);
    }
    return fn->body->eval(callEnv);
  }
  std::string toString() const override {
    std::string s = callee->toString() + "(";
    for (std::size_t i = 0; i < args.size(); ++i) {
      if (i) s += ", ";
      s += args[i]->toString();
    }
    return s + ")";
  }
};

struct SequenceExpr final : Expr {
  std::vector<ExprPtr> exprs;
  Value eval(const EnvPtr& env) const override {
    Value v = 0.0;
    for (const auto& e : exprs) v = e->eval(env);
    return v;
  }
  std::string toString() const override {
    std::string s = "(";
    for (std::size_t i = 0; i < exprs.size(); ++i) {
      if (i) s += "; ";
      s += exprs[i]->toString();
    }
    return s + ")";
  }
};

// -----------------------------------------------------------------------------
// 5. Parser — recursive descent, extended.
// -----------------------------------------------------------------------------

class Parser {
public:
  explicit Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)) {}

  std::vector<ExprPtr> parseProgram() {
    std::vector<ExprPtr> stmts;
    if (peek().kind == TokenKind::End) return stmts;
    stmts.push_back(parseStatement());
    while (peek().kind == TokenKind::Semi) {
      advance();
      if (peek().kind == TokenKind::End) break;
      stmts.push_back(parseStatement());
    }
    expect(TokenKind::End, "trailing input after program");
    return stmts;
  }

private:
  ExprPtr parseStatement() {
    if (peek().kind == TokenKind::Let) return parseLet();
    return parseExpression();
  }

  ExprPtr parseLet() {
    advance(); // 'let'
    const Token name = peek();
    if (name.kind != TokenKind::Ident) {
      throw std::runtime_error("expected identifier after 'let' at position " + std::to_string(name.pos));
    }
    advance();
    expect(TokenKind::Eq, "expected '=' in let binding");
    return std::make_shared<LetExpr>(name.text, parseExpression());
  }

  ExprPtr parseExpression() {
    if (peek().kind == TokenKind::If) return parseIf();
    if (peek().kind == TokenKind::Fn) return parseFn();
    return parseComparison();
  }

  ExprPtr parseIf() {
    advance(); // 'if'
    ExprPtr cond = parseExpression();
    expect(TokenKind::Then, "expected 'then' in if expression");
    ExprPtr thenBranch = parseExpression();
    expect(TokenKind::Else, "expected 'else' in if expression");
    ExprPtr elseBranch = parseExpression();
    return std::make_shared<IfExpr>(std::move(cond), std::move(thenBranch), std::move(elseBranch));
  }

  ExprPtr parseFn() {
    advance(); // 'fn'
    expect(TokenKind::LParen, "expected '(' after 'fn'");
    std::vector<std::string> params;
    if (peek().kind != TokenKind::RParen) {
      while (true) {
        const Token p = peek();
        if (p.kind != TokenKind::Ident) {
          throw std::runtime_error("expected parameter name at position " + std::to_string(p.pos));
        }
        advance();
        params.push_back(p.text);
        if (peek().kind == TokenKind::Comma) { advance(); continue; }
        break;
      }
    }
    expect(TokenKind::RParen, "expected ')' after parameter list");
    return std::make_shared<FunctionExpr>(std::move(params), parseExpression());
  }

  // Non-associative: `a < b < c` is a syntax error, mirroring how Python
  // chained comparisons are special-cased rather than parsed as binary trees.
  ExprPtr parseComparison() {
    ExprPtr lhs = parseAdditive();
    const TokenKind k = peek().kind;
    const char* op = nullptr;
    switch (k) {
      case TokenKind::EqEq:   op = "==";  break;
      case TokenKind::BangEq: op = "!=";  break;
      case TokenKind::Lt:     op = "<";   break;
      case TokenKind::Gt:     op = ">";   break;
      case TokenKind::LtEq:   op = "<=";  break;
      case TokenKind::GtEq:   op = ">=";  break;
      default: return lhs;
    }
    advance();
    ExprPtr rhs = parseAdditive();
    return std::make_shared<BinaryExpr>(op, std::move(lhs), std::move(rhs));
  }

  ExprPtr parseAdditive() {
    ExprPtr lhs = parseMultiplicative();
    while (peek().kind == TokenKind::Plus || peek().kind == TokenKind::Minus) {
      const char* op = peek().kind == TokenKind::Plus ? "+" : "-";
      advance();
      ExprPtr rhs = parseMultiplicative();
      lhs = std::make_shared<BinaryExpr>(op, std::move(lhs), std::move(rhs));
    }
    return lhs;
  }

  ExprPtr parseMultiplicative() {
    ExprPtr lhs = parseUnary();
    while (peek().kind == TokenKind::Star || peek().kind == TokenKind::Slash) {
      const char* op = peek().kind == TokenKind::Star ? "*" : "/";
      advance();
      ExprPtr rhs = parseUnary();
      lhs = std::make_shared<BinaryExpr>(op, std::move(lhs), std::move(rhs));
    }
    return lhs;
  }

  ExprPtr parseUnary() {
    if (peek().kind == TokenKind::Plus || peek().kind == TokenKind::Minus) {
      const char op = peek().kind == TokenKind::Plus ? '+' : '-';
      advance();
      return std::make_shared<UnaryExpr>(op, parseUnary());
    }
    return parseCall();
  }

  // Calls are postfix; chain them so `f()(x)` works.
  ExprPtr parseCall() {
    ExprPtr expr = parsePrimary();
    while (peek().kind == TokenKind::LParen) {
      advance(); // '('
      std::vector<ExprPtr> args;
      if (peek().kind != TokenKind::RParen) {
        while (true) {
          args.push_back(parseExpression());
          if (peek().kind == TokenKind::Comma) { advance(); continue; }
          break;
        }
      }
      expect(TokenKind::RParen, "expected ')' after arguments");
      expr = std::make_shared<CallExpr>(std::move(expr), std::move(args));
    }
    return expr;
  }

  ExprPtr parsePrimary() {
    const Token t = peek();
    if (t.kind == TokenKind::Number) {
      advance();
      return std::make_shared<NumberExpr>(t.number);
    }
    if (t.kind == TokenKind::Ident) {
      advance();
      return std::make_shared<IdentExpr>(t.text);
    }
    if (t.kind == TokenKind::LParen) {
      advance();
      ExprPtr first = parseStatement();
      if (peek().kind == TokenKind::Semi) {
        auto seq = std::make_shared<SequenceExpr>();
        seq->exprs.push_back(std::move(first));
        while (peek().kind == TokenKind::Semi) {
          advance();
          if (peek().kind == TokenKind::RParen) break;
          seq->exprs.push_back(parseStatement());
        }
        expect(TokenKind::RParen, "missing ')' in sequence");
        return seq;
      }
      expect(TokenKind::RParen, "missing ')'");
      return first;
    }
    throw std::runtime_error("expected expression at position " + std::to_string(t.pos));
  }

  const Token& peek() const { return tokens_[pos_]; }
  void advance() { ++pos_; }
  void expect(TokenKind k, const std::string& msg) {
    if (peek().kind != k) {
      throw std::runtime_error(msg + " at position " + std::to_string(peek().pos));
    }
    advance();
  }

  std::vector<Token> tokens_;
  std::size_t pos_ = 0;
};

// -----------------------------------------------------------------------------
// 6. Built-ins
//
// The interpreter is sandboxed by default: numbers and arithmetic, nothing
// else. Built-ins are how we widen the keyhole to the host platform. Every
// real language has them — Python's `len`, JS's `Math.sqrt`, C's libc.
// -----------------------------------------------------------------------------

namespace {

std::shared_ptr<FunctionValue> makeBuiltin(std::string name, int arity, BuiltinFn body) {
  auto f = std::make_shared<FunctionValue>();
  f->name = name;
  f->builtin = [name, arity, body = std::move(body)](const std::vector<Value>& args) -> Value {
    if (arity >= 0 && static_cast<int>(args.size()) != arity) {
      throw std::runtime_error(
          "arity mismatch calling " + name + ": expected " + std::to_string(arity)
          + " arg(s), got " + std::to_string(args.size()));
    }
    return body(args);
  };
  return f;
}

EnvPtr makeGlobalEnv() {
  auto env = std::make_shared<Environment>();
  const auto num = [](const Value& v, const std::string& fn) {
    return asNumber(v, "argument to " + fn);
  };
  env->define("sqrt", makeBuiltin("sqrt", 1, [&](const std::vector<Value>& a) -> Value {
    return std::sqrt(num(a[0], "sqrt"));
  }));
  env->define("pow", makeBuiltin("pow", 2, [&](const std::vector<Value>& a) -> Value {
    return std::pow(num(a[0], "pow"), num(a[1], "pow"));
  }));
  env->define("abs", makeBuiltin("abs", 1, [&](const std::vector<Value>& a) -> Value {
    return std::fabs(num(a[0], "abs"));
  }));
  env->define("min", makeBuiltin("min", 2, [&](const std::vector<Value>& a) -> Value {
    return std::fmin(num(a[0], "min"), num(a[1], "min"));
  }));
  env->define("max", makeBuiltin("max", 2, [&](const std::vector<Value>& a) -> Value {
    return std::fmax(num(a[0], "max"), num(a[1], "max"));
  }));
  // print returns its argument so it works inside larger expressions.
  env->define("print", makeBuiltin("print", 1, [](const std::vector<Value>& a) -> Value {
    std::cout << valueToString(a[0]) << "\n";
    return a[0];
  }));
  return env;
}

} // namespace

// -----------------------------------------------------------------------------
// 7. Driver
// -----------------------------------------------------------------------------

namespace {

// Returns the last statement's value. Used by tests and the one-shot CLI.
Value runSource(const std::string& source, const EnvPtr& env, std::string* lastAst = nullptr) {
  Lexer lexer(source);
  Parser parser(lexer.tokenize());
  std::vector<ExprPtr> program = parser.parseProgram();
  if (program.empty()) return 0.0;
  Value v = 0.0;
  for (std::size_t i = 0; i < program.size(); ++i) {
    v = program[i]->eval(env);
    if (lastAst && i + 1 == program.size()) *lastAst = program[i]->toString();
  }
  return v;
}

[[maybe_unused]] void runRepl() {
  std::cout << "expr v2> bindings persist across lines. Prefix with ':ast ' to print the parse tree. Ctrl-D to exit.\n";
  auto env = makeGlobalEnv();
  std::string line;
  while (std::cout << "expr v2> " && std::getline(std::cin, line)) {
    if (line.empty()) continue;
    bool showAst = false;
    std::string source = line;
    if (source.rfind(":ast ", 0) == 0) {
      showAst = true;
      source = source.substr(5);
    }
    try {
      std::string ast;
      const Value result = runSource(source, env, showAst ? &ast : nullptr);
      if (showAst) std::cout << "ast = " << ast << "\n";
      std::cout << "= " << valueToString(result) << "\n";
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  std::cout << "\n";
}

} // namespace

#ifndef EXPR_V2_TEST_BUILD
int main(int argc, char** argv) {
  if (argc > 1) {
    std::string source;
    for (int i = 1; i < argc; ++i) {
      if (i > 1) source += ' ';
      source += argv[i];
    }
    try {
      auto env = makeGlobalEnv();
      std::cout << valueToString(runSource(source, env)) << "\n";
      return 0;
    } catch (const std::exception& e) {
      std::cerr << "error: " << e.what() << "\n";
      return 1;
    }
  }
  runRepl();
  return 0;
}
#endif // EXPR_V2_TEST_BUILD
