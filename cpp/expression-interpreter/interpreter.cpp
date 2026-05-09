// A tiny expression interpreter: tokenizer + recursive-descent parser + evaluator.
//
// Grammar (operator precedence climbs as we descend):
//   expression := term   (('+' | '-') term)*
//   term       := factor (('*' | '/') factor)*
//   factor     := NUMBER | '(' expression ')' | ('+' | '-') factor
//
// Build:  g++ -std=c++17 -Wall -Wextra -O2 interpreter.cpp -o interpreter
// Run:    ./interpreter            (REPL)
//         ./interpreter "1+2*3"    (one-shot)

#include <cctype>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

// -----------------------------------------------------------------------------
// 1. Tokens — the alphabet of our language.
// -----------------------------------------------------------------------------

enum class TokenKind {
  Number,
  Plus,
  Minus,
  Star,
  Slash,
  LParen,
  RParen,
  End,
};

struct Token {
  TokenKind kind;
  double value = 0.0; // only meaningful when kind == Number
  std::size_t pos = 0; // index into the source, useful for diagnostics
};

// -----------------------------------------------------------------------------
// 2. Lexer — turns a flat string into a stream of tokens.
//
// The lexer's job is to skip noise (whitespace) and recognise lexemes
// (numbers, operators, parentheses). It performs no semantic checks; it just
// classifies characters.
// -----------------------------------------------------------------------------

class Lexer {
public:
  explicit Lexer(std::string source) : src_(std::move(source)) {}

  std::vector<Token> tokenize() {
    std::vector<Token> tokens;
    while (pos_ < src_.size()) {
      char c = src_[pos_];
      if (std::isspace(static_cast<unsigned char>(c))) {
        ++pos_;
        continue;
      }
      if (std::isdigit(static_cast<unsigned char>(c)) || c == '.') {
        tokens.push_back(readNumber());
        continue;
      }
      tokens.push_back(readPunctuation());
    }
    tokens.push_back({TokenKind::End, 0.0, pos_});
    return tokens;
  }

private:
  Token readNumber() {
    std::size_t start = pos_;
    bool seenDot = false;
    while (pos_ < src_.size()) {
      char c = src_[pos_];
      if (std::isdigit(static_cast<unsigned char>(c))) {
        ++pos_;
      } else if (c == '.' && !seenDot) {
        seenDot = true;
        ++pos_;
      } else {
        break;
      }
    }
    const std::string lexeme = src_.substr(start, pos_ - start);
    if (lexeme == ".") {
      throw std::runtime_error("invalid number literal at position " + std::to_string(start));
    }
    return {TokenKind::Number, std::stod(lexeme), start};
  }

  Token readPunctuation() {
    const std::size_t start = pos_;
    const char c = src_[pos_++];
    switch (c) {
      case '+': return {TokenKind::Plus,   0.0, start};
      case '-': return {TokenKind::Minus,  0.0, start};
      case '*': return {TokenKind::Star,   0.0, start};
      case '/': return {TokenKind::Slash,  0.0, start};
      case '(': return {TokenKind::LParen, 0.0, start};
      case ')': return {TokenKind::RParen, 0.0, start};
    }
    throw std::runtime_error(
        std::string("unexpected character '") + c + "' at position " + std::to_string(start));
  }

  std::string src_;
  std::size_t pos_ = 0;
};

// -----------------------------------------------------------------------------
// 3. AST — the Abstract Syntax Tree.
//
// Each node represents an operation or a value. The tree's *shape* encodes
// precedence and associativity: deeper subtrees are evaluated first. Once we
// have a tree, evaluation is a simple post-order traversal.
// -----------------------------------------------------------------------------

struct Expr {
  virtual ~Expr() = default;
  virtual double eval() const = 0;
  virtual std::string toString() const = 0;
};

using ExprPtr = std::unique_ptr<Expr>;

struct NumberExpr final : Expr {
  double value;
  explicit NumberExpr(double v) : value(v) {}
  double eval() const override { return value; }
  std::string toString() const override { return std::to_string(value); }
};

struct UnaryExpr final : Expr {
  char op;
  ExprPtr operand;
  UnaryExpr(char o, ExprPtr e) : op(o), operand(std::move(e)) {}
  double eval() const override {
    const double v = operand->eval();
    return op == '-' ? -v : v;
  }
  std::string toString() const override {
    return std::string("(") + op + operand->toString() + ")";
  }
};

struct BinaryExpr final : Expr {
  char op;
  ExprPtr lhs;
  ExprPtr rhs;
  BinaryExpr(char o, ExprPtr l, ExprPtr r)
      : op(o), lhs(std::move(l)), rhs(std::move(r)) {}
  double eval() const override {
    const double a = lhs->eval();
    const double b = rhs->eval();
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b == 0.0) throw std::runtime_error("division by zero");
        return a / b;
    }
    throw std::runtime_error(std::string("unknown operator '") + op + "'");
  }
  std::string toString() const override {
    return "(" + lhs->toString() + " " + op + " " + rhs->toString() + ")";
  }
};

// -----------------------------------------------------------------------------
// 4. Parser — recursive descent.
//
// One function per grammar rule. Each function consumes tokens left-to-right
// and returns a subtree. Lower-precedence rules call higher-precedence rules,
// which is why `*` and `/` bind tighter than `+` and `-` in the output tree.
// -----------------------------------------------------------------------------

class Parser {
public:
  explicit Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)) {}

  ExprPtr parse() {
    ExprPtr expr = parseExpression();
    expect(TokenKind::End, "trailing input after expression");
    return expr;
  }

private:
  // expression := term (('+' | '-') term)*
  ExprPtr parseExpression() {
    ExprPtr lhs = parseTerm();
    while (peek().kind == TokenKind::Plus || peek().kind == TokenKind::Minus) {
      const char op = peek().kind == TokenKind::Plus ? '+' : '-';
      advance();
      ExprPtr rhs = parseTerm();
      lhs = std::make_unique<BinaryExpr>(op, std::move(lhs), std::move(rhs));
    }
    return lhs;
  }

  // term := factor (('*' | '/') factor)*
  ExprPtr parseTerm() {
    ExprPtr lhs = parseFactor();
    while (peek().kind == TokenKind::Star || peek().kind == TokenKind::Slash) {
      const char op = peek().kind == TokenKind::Star ? '*' : '/';
      advance();
      ExprPtr rhs = parseFactor();
      lhs = std::make_unique<BinaryExpr>(op, std::move(lhs), std::move(rhs));
    }
    return lhs;
  }

  // factor := NUMBER | '(' expression ')' | ('+' | '-') factor
  ExprPtr parseFactor() {
    const Token& t = peek();
    if (t.kind == TokenKind::Number) {
      advance();
      return std::make_unique<NumberExpr>(t.value);
    }
    if (t.kind == TokenKind::LParen) {
      advance();
      ExprPtr inner = parseExpression();
      expect(TokenKind::RParen, "missing ')'");
      return inner;
    }
    if (t.kind == TokenKind::Plus || t.kind == TokenKind::Minus) {
      const char op = t.kind == TokenKind::Plus ? '+' : '-';
      advance();
      return std::make_unique<UnaryExpr>(op, parseFactor());
    }
    throw std::runtime_error("expected number, '(' or unary sign at position " + std::to_string(t.pos));
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
// 5. Driver — REPL or one-shot evaluation.
// -----------------------------------------------------------------------------

namespace {

double evaluate(const std::string& source, std::string* astOut = nullptr) {
  Lexer lexer(source);
  Parser parser(lexer.tokenize());
  ExprPtr ast = parser.parse();
  if (astOut) *astOut = ast->toString();
  return ast->eval();
}

[[maybe_unused]] void runRepl() {
  std::cout << "expr> entering REPL. Ctrl-D to exit. Prefix with ':ast ' to see the parse tree.\n";
  std::string line;
  while (std::cout << "expr> " && std::getline(std::cin, line)) {
    if (line.empty()) continue;
    bool showAst = false;
    std::string source = line;
    if (source.rfind(":ast ", 0) == 0) {
      showAst = true;
      source = source.substr(5);
    }
    try {
      std::string ast;
      const double result = evaluate(source, showAst ? &ast : nullptr);
      if (showAst) std::cout << "ast = " << ast << "\n";
      std::cout << "= " << result << "\n";
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  std::cout << "\n";
}

} // namespace

#ifndef EXPR_TEST_BUILD
int main(int argc, char** argv) {
  if (argc > 1) {
    std::string source;
    for (int i = 1; i < argc; ++i) {
      if (i > 1) source += ' ';
      source += argv[i];
    }
    try {
      std::cout << evaluate(source) << "\n";
      return 0;
    } catch (const std::exception& e) {
      std::cerr << "error: " << e.what() << "\n";
      return 1;
    }
  }
  runRepl();
  return 0;
}
#endif // EXPR_TEST_BUILD
