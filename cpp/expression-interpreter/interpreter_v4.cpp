// V4 of the expression interpreter.
//
// Changes from V3:
//   1. Slot-resolved locals. Names are resolved at *compile time* to slot
//      indices into the operand stack. LOAD_LOCAL n is now `stack[base+n]` —
//      a pointer addition, no hash lookup. This is Python's LOAD_FAST.
//   2. Upvalues. Closures over enclosing-function locals are resolved at
//      compile time to upvalue indices. When the enclosing function returns
//      we "close" the upvalue: copy the captured slot to the heap so the
//      surviving closure can keep using it. Lua/CPython style.
//   3. Constant folding pre-pass. The AST is walked once and constant
//      subexpressions are reduced before compilation. `2 + 3 * 4` becomes
//      `14` in the bytecode — one CONST instead of three CONSTs and two
//      arithmetic ops. `if true then a else b` collapses to `a`.
//
// CALL convention changes: callee stays on the stack at frame.base + 0, args
// at base+1..base+argc. RETURN pops the frame back to base and pushes the
// result, automatically closing any upvalues that pointed into the frame.
//
// Build: g++ -std=c++17 -Wall -Wextra -O2 interpreter_v4.cpp -o interpreter_v4

#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <variant>
#include <vector>

// ─── 1. Tokens & Lexer (unchanged from V3) ───────────────────────────────────

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

class Lexer {
public:
  explicit Lexer(std::string source) : src_(std::move(source)) {}
  std::vector<Token> tokenize() {
    std::vector<Token> tokens;
    while (pos_ < src_.size()) {
      const char c = src_[pos_];
      if (std::isspace(static_cast<unsigned char>(c))) { ++pos_; continue; }
      if (std::isdigit(static_cast<unsigned char>(c)) || c == '.') {
        tokens.push_back(readNumber()); continue;
      }
      if (std::isalpha(static_cast<unsigned char>(c)) || c == '_') {
        tokens.push_back(readIdentOrKeyword()); continue;
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
    if (lexeme == ".") throw std::runtime_error("invalid number literal at position " + std::to_string(start));
    return {TokenKind::Number, std::stod(lexeme), lexeme, start};
  }
  Token readIdentOrKeyword() {
    const std::size_t start = pos_;
    while (pos_ < src_.size() &&
           (std::isalnum(static_cast<unsigned char>(src_[pos_])) || src_[pos_] == '_')) ++pos_;
    std::string text = src_.substr(start, pos_ - start);
    static const std::unordered_map<std::string, TokenKind> kw = {
        {"let", TokenKind::Let}, {"fn", TokenKind::Fn},
        {"if", TokenKind::If}, {"then", TokenKind::Then}, {"else", TokenKind::Else},
    };
    const auto it = kw.find(text);
    return {it != kw.end() ? it->second : TokenKind::Ident, 0.0, std::move(text), start};
  }
  Token readPunctuation() {
    const std::size_t start = pos_;
    const char c = src_[pos_++];
    const auto maybeTwo = [&](char expected, TokenKind two, TokenKind one) {
      if (pos_ < src_.size() && src_[pos_] == expected) { ++pos_; return Token{two, 0.0, "", start}; }
      return Token{one, 0.0, "", start};
    };
    switch (c) {
      case '+': return {TokenKind::Plus, 0.0, "", start};
      case '-': return {TokenKind::Minus, 0.0, "", start};
      case '*': return {TokenKind::Star, 0.0, "", start};
      case '/': return {TokenKind::Slash, 0.0, "", start};
      case '(': return {TokenKind::LParen, 0.0, "", start};
      case ')': return {TokenKind::RParen, 0.0, "", start};
      case ',': return {TokenKind::Comma, 0.0, "", start};
      case ';': return {TokenKind::Semi, 0.0, "", start};
      case '=': return maybeTwo('=', TokenKind::EqEq, TokenKind::Eq);
      case '<': return maybeTwo('=', TokenKind::LtEq, TokenKind::Lt);
      case '>': return maybeTwo('=', TokenKind::GtEq, TokenKind::Gt);
      case '!':
        if (pos_ < src_.size() && src_[pos_] == '=') { ++pos_; return {TokenKind::BangEq, 0.0, "", start}; }
        throw std::runtime_error("expected '!=' at position " + std::to_string(start));
    }
    throw std::runtime_error(std::string("unexpected character '") + c + "' at position " + std::to_string(start));
  }
  std::string src_;
  std::size_t pos_ = 0;
};

// ─── 2. AST ──────────────────────────────────────────────────────────────────

class Compiler;

struct Expr {
  virtual ~Expr() = default;
  virtual void compile(Compiler& c) const = 0;
};

using ExprPtr = std::shared_ptr<const Expr>;

struct NumberExpr final : Expr {
  double value;
  explicit NumberExpr(double v) : value(v) {}
  void compile(Compiler& c) const override;
};

struct IdentExpr final : Expr {
  std::string name;
  explicit IdentExpr(std::string n) : name(std::move(n)) {}
  void compile(Compiler& c) const override;
};

struct UnaryExpr final : Expr {
  char op;
  ExprPtr operand;
  UnaryExpr(char o, ExprPtr e) : op(o), operand(std::move(e)) {}
  void compile(Compiler& c) const override;
};

struct BinaryExpr final : Expr {
  std::string op;
  ExprPtr lhs, rhs;
  BinaryExpr(std::string o, ExprPtr l, ExprPtr r)
      : op(std::move(o)), lhs(std::move(l)), rhs(std::move(r)) {}
  void compile(Compiler& c) const override;
};

struct LetExpr final : Expr {
  std::string name;
  ExprPtr expr;
  LetExpr(std::string n, ExprPtr e) : name(std::move(n)), expr(std::move(e)) {}
  void compile(Compiler& c) const override;
};

struct IfExpr final : Expr {
  ExprPtr cond, thenBranch, elseBranch;
  IfExpr(ExprPtr c, ExprPtr t, ExprPtr e)
      : cond(std::move(c)), thenBranch(std::move(t)), elseBranch(std::move(e)) {}
  void compile(Compiler& c) const override;
};

struct FunctionExpr final : Expr {
  std::vector<std::string> params;
  ExprPtr body;
  FunctionExpr(std::vector<std::string> p, ExprPtr b)
      : params(std::move(p)), body(std::move(b)) {}
  void compile(Compiler& c) const override;
};

struct CallExpr final : Expr {
  ExprPtr callee;
  std::vector<ExprPtr> args;
  CallExpr(ExprPtr c, std::vector<ExprPtr> a)
      : callee(std::move(c)), args(std::move(a)) {}
  void compile(Compiler& c) const override;
};

struct SequenceExpr final : Expr {
  std::vector<ExprPtr> exprs;
  void compile(Compiler& c) const override;
};

// ─── 3. Parser (unchanged from V3) ───────────────────────────────────────────

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
    advance();
    const Token name = peek();
    if (name.kind != TokenKind::Ident)
      throw std::runtime_error("expected identifier after 'let' at position " + std::to_string(name.pos));
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
    advance();
    ExprPtr cond = parseExpression();
    expect(TokenKind::Then, "expected 'then'");
    ExprPtr t = parseExpression();
    expect(TokenKind::Else, "expected 'else'");
    ExprPtr e = parseExpression();
    return std::make_shared<IfExpr>(std::move(cond), std::move(t), std::move(e));
  }
  ExprPtr parseFn() {
    advance();
    expect(TokenKind::LParen, "expected '(' after 'fn'");
    std::vector<std::string> params;
    if (peek().kind != TokenKind::RParen) {
      while (true) {
        const Token p = peek();
        if (p.kind != TokenKind::Ident)
          throw std::runtime_error("expected parameter name at position " + std::to_string(p.pos));
        advance();
        params.push_back(p.text);
        if (peek().kind == TokenKind::Comma) { advance(); continue; }
        break;
      }
    }
    expect(TokenKind::RParen, "expected ')'");
    return std::make_shared<FunctionExpr>(std::move(params), parseExpression());
  }
  ExprPtr parseComparison() {
    ExprPtr lhs = parseAdditive();
    const char* op = nullptr;
    switch (peek().kind) {
      case TokenKind::EqEq:   op = "=="; break;
      case TokenKind::BangEq: op = "!="; break;
      case TokenKind::Lt:     op = "<";  break;
      case TokenKind::Gt:     op = ">";  break;
      case TokenKind::LtEq:   op = "<="; break;
      case TokenKind::GtEq:   op = ">="; break;
      default: return lhs;
    }
    advance();
    return std::make_shared<BinaryExpr>(op, std::move(lhs), parseAdditive());
  }
  ExprPtr parseAdditive() {
    ExprPtr lhs = parseMultiplicative();
    while (peek().kind == TokenKind::Plus || peek().kind == TokenKind::Minus) {
      const char* op = peek().kind == TokenKind::Plus ? "+" : "-";
      advance();
      lhs = std::make_shared<BinaryExpr>(op, std::move(lhs), parseMultiplicative());
    }
    return lhs;
  }
  ExprPtr parseMultiplicative() {
    ExprPtr lhs = parseUnary();
    while (peek().kind == TokenKind::Star || peek().kind == TokenKind::Slash) {
      const char* op = peek().kind == TokenKind::Star ? "*" : "/";
      advance();
      lhs = std::make_shared<BinaryExpr>(op, std::move(lhs), parseUnary());
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
  ExprPtr parseCall() {
    ExprPtr expr = parsePrimary();
    while (peek().kind == TokenKind::LParen) {
      advance();
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
    if (t.kind == TokenKind::Number) { advance(); return std::make_shared<NumberExpr>(t.number); }
    if (t.kind == TokenKind::Ident)  { advance(); return std::make_shared<IdentExpr>(t.text); }
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
    if (peek().kind != k) throw std::runtime_error(msg + " at position " + std::to_string(peek().pos));
    advance();
  }
  std::vector<Token> tokens_;
  std::size_t pos_ = 0;
};

// ─── 4. Constant folding (AST → AST pass) ────────────────────────────────────
//
// A bottom-up rewrite. Each node tries to evaluate itself when all of its
// inputs are known statically. The result is a smaller AST with fewer
// runtime ops to compile. This is the simplest "optimizer" worth writing.

namespace folding {

ExprPtr fold(ExprPtr e);

ExprPtr foldUnary(const UnaryExpr& u) {
  auto inner = fold(u.operand);
  if (auto n = std::dynamic_pointer_cast<const NumberExpr>(inner)) {
    return std::make_shared<NumberExpr>(u.op == '-' ? -n->value : n->value);
  }
  return std::make_shared<UnaryExpr>(u.op, std::move(inner));
}

ExprPtr foldBinary(const BinaryExpr& b) {
  auto l = fold(b.lhs);
  auto r = fold(b.rhs);
  auto ln = std::dynamic_pointer_cast<const NumberExpr>(l);
  auto rn = std::dynamic_pointer_cast<const NumberExpr>(r);
  if (ln && rn) {
    const double a = ln->value, c = rn->value;
    const std::string& op = b.op;
    if (op == "+")  return std::make_shared<NumberExpr>(a + c);
    if (op == "-")  return std::make_shared<NumberExpr>(a - c);
    if (op == "*")  return std::make_shared<NumberExpr>(a * c);
    if (op == "/") {
      if (c == 0.0) throw std::runtime_error("division by zero (constant folded)");
      return std::make_shared<NumberExpr>(a / c);
    }
    if (op == "==") return std::make_shared<NumberExpr>(a == c ? 1.0 : 0.0);
    if (op == "!=") return std::make_shared<NumberExpr>(a != c ? 1.0 : 0.0);
    if (op == "<")  return std::make_shared<NumberExpr>(a <  c ? 1.0 : 0.0);
    if (op == ">")  return std::make_shared<NumberExpr>(a >  c ? 1.0 : 0.0);
    if (op == "<=") return std::make_shared<NumberExpr>(a <= c ? 1.0 : 0.0);
    if (op == ">=") return std::make_shared<NumberExpr>(a >= c ? 1.0 : 0.0);
  }
  return std::make_shared<BinaryExpr>(b.op, std::move(l), std::move(r));
}

ExprPtr foldIf(const IfExpr& i) {
  auto c = fold(i.cond);
  auto t = fold(i.thenBranch);
  auto e = fold(i.elseBranch);
  // If the condition is a known constant, we can pick a branch and discard
  // the other. Safe because constants have no side effects.
  if (auto cn = std::dynamic_pointer_cast<const NumberExpr>(c)) {
    return cn->value != 0.0 ? t : e;
  }
  return std::make_shared<IfExpr>(std::move(c), std::move(t), std::move(e));
}

ExprPtr fold(ExprPtr e) {
  if (!e) return e;
  if (auto u = std::dynamic_pointer_cast<const UnaryExpr>(e))    return foldUnary(*u);
  if (auto b = std::dynamic_pointer_cast<const BinaryExpr>(e))   return foldBinary(*b);
  if (auto i = std::dynamic_pointer_cast<const IfExpr>(e))       return foldIf(*i);
  if (auto l = std::dynamic_pointer_cast<const LetExpr>(e))      return std::make_shared<LetExpr>(l->name, fold(l->expr));
  if (auto f = std::dynamic_pointer_cast<const FunctionExpr>(e)) return std::make_shared<FunctionExpr>(f->params, fold(f->body));
  if (auto c = std::dynamic_pointer_cast<const CallExpr>(e)) {
    std::vector<ExprPtr> args;
    args.reserve(c->args.size());
    for (auto& a : c->args) args.push_back(fold(a));
    return std::make_shared<CallExpr>(fold(c->callee), std::move(args));
  }
  if (auto s = std::dynamic_pointer_cast<const SequenceExpr>(e)) {
    auto out = std::make_shared<SequenceExpr>();
    out->exprs.reserve(s->exprs.size());
    for (auto& sub : s->exprs) out->exprs.push_back(fold(sub));
    return out;
  }
  return e; // NumberExpr, IdentExpr
}

} // namespace folding

// ─── 5. Bytecode ─────────────────────────────────────────────────────────────

enum class Op : uint8_t {
  Const,             // [u8 const_idx]
  Pop,
  LoadLocal,         // [u8 slot]            push stack[base + slot]
  LoadUpvalue,       // [u8 idx]             push *closure.upvalues[idx]
  LoadGlobal,        // [u8 name_idx]
  DefineGlobal,      // [u8 name_idx]        peek, store; value stays on stack
  Neg,
  Add, Sub, Mul, Div,
  Eq, Neq, Lt, Gt, Le, Ge,
  Jump,              // [i16 offset]
  JumpIfFalse,       // [i16 offset]
  MakeClosure,       // [u8 proto_idx]       upvalue specs read from proto
  Call,              // [u8 argc]
  Return,
  Halt,
  CloseScopeKeepTop, // [u8 n]               drop n locals below top, keep top
};

const char* opName(Op op) {
  switch (op) {
    case Op::Const:             return "CONST";
    case Op::Pop:               return "POP";
    case Op::LoadLocal:         return "LOAD_LOCAL";
    case Op::LoadUpvalue:       return "LOAD_UPVALUE";
    case Op::LoadGlobal:        return "LOAD_GLOBAL";
    case Op::DefineGlobal:      return "DEFINE_GLOBAL";
    case Op::Neg:               return "NEG";
    case Op::Add: return "ADD"; case Op::Sub: return "SUB";
    case Op::Mul: return "MUL"; case Op::Div: return "DIV";
    case Op::Eq:  return "EQ";  case Op::Neq: return "NEQ";
    case Op::Lt:  return "LT";  case Op::Gt:  return "GT";
    case Op::Le:  return "LE";  case Op::Ge:  return "GE";
    case Op::Jump:              return "JUMP";
    case Op::JumpIfFalse:       return "JUMP_IF_FALSE";
    case Op::MakeClosure:       return "MAKE_CLOSURE";
    case Op::Call:              return "CALL";
    case Op::Return:            return "RETURN";
    case Op::Halt:              return "HALT";
    case Op::CloseScopeKeepTop: return "CLOSE_SCOPE";
  }
  return "?";
}

struct UpvalueSpec {
  uint8_t index;
  bool isLocal;
};

struct FunctionProto {
  std::string name = "<main>";
  std::vector<std::string> params;
  int arity = 0;
  std::vector<uint8_t> code;
  std::vector<double> constants;
  std::vector<std::string> names;
  std::vector<std::shared_ptr<FunctionProto>> protos;
  std::vector<UpvalueSpec> upvalues;
};

// ─── 6. Compiler ─────────────────────────────────────────────────────────────

class Compiler {
public:
  explicit Compiler(Compiler* enclosing = nullptr)
      : enclosing_(enclosing), proto_(std::make_shared<FunctionProto>()) {}

  std::shared_ptr<FunctionProto> compileProgram(const std::vector<ExprPtr>& program) {
    proto_->name = "<main>";
    if (program.empty()) {
      emit(Op::Const, addConst(0.0));
    } else {
      for (std::size_t i = 0; i < program.size(); ++i) {
        program[i]->compile(*this);
        if (i + 1 < program.size()) emit(Op::Pop);
      }
    }
    emit(Op::Halt);
    return proto_;
  }

  // The top-level of main is the only place where `let` becomes a global.
  // Everywhere else (inside any scope or any sub-function), `let` is a local.
  bool inMainGlobalScope() const { return enclosing_ == nullptr && depth_ == 0; }

  void emit(Op op) { proto_->code.push_back(static_cast<uint8_t>(op)); }
  void emit(Op op, uint8_t arg) {
    proto_->code.push_back(static_cast<uint8_t>(op));
    proto_->code.push_back(arg);
  }
  std::size_t emitJump(Op op) {
    proto_->code.push_back(static_cast<uint8_t>(op));
    proto_->code.push_back(0xff);
    proto_->code.push_back(0xff);
    return proto_->code.size() - 2;
  }
  void patchJump(std::size_t at) {
    const std::ptrdiff_t offset =
        static_cast<std::ptrdiff_t>(proto_->code.size()) - static_cast<std::ptrdiff_t>(at) - 2;
    if (offset > 32767 || offset < -32768)
      throw std::runtime_error("jump too large to encode in 16 bits");
    const uint16_t u = static_cast<uint16_t>(static_cast<int16_t>(offset));
    proto_->code[at]     = static_cast<uint8_t>((u >> 8) & 0xff);
    proto_->code[at + 1] = static_cast<uint8_t>(u & 0xff);
  }

  uint8_t addConst(double v) {
    proto_->constants.push_back(v);
    if (proto_->constants.size() > 256) throw std::runtime_error("too many constants");
    return static_cast<uint8_t>(proto_->constants.size() - 1);
  }
  uint8_t addName(const std::string& name) {
    for (std::size_t i = 0; i < proto_->names.size(); ++i)
      if (proto_->names[i] == name) return static_cast<uint8_t>(i);
    proto_->names.push_back(name);
    if (proto_->names.size() > 256) throw std::runtime_error("too many names");
    return static_cast<uint8_t>(proto_->names.size() - 1);
  }

  // ── Scopes & locals ──────────────────────────────────────────────────────
  void beginScope() { ++depth_; }
  void endScope() {
    int n = 0;
    while (!locals_.empty() && locals_.back().depth >= depth_) {
      ++n;
      locals_.pop_back();
    }
    if (n > 0) {
      if (n > 255) throw std::runtime_error("too many locals in one scope");
      emit(Op::CloseScopeKeepTop, static_cast<uint8_t>(n));
    }
    --depth_;
  }
  // Add a local at the current depth and return its slot index.
  int addLocal(const std::string& name) {
    if (locals_.size() >= 256) throw std::runtime_error("too many locals in one function");
    locals_.push_back({name, depth_, false});
    return static_cast<int>(locals_.size() - 1);
  }
  int resolveLocal(const std::string& name) const {
    for (int i = static_cast<int>(locals_.size()) - 1; i >= 0; --i) {
      if (locals_[i].name == name) return i;
    }
    return -1;
  }

  // ── Upvalues ─────────────────────────────────────────────────────────────
  int resolveUpvalue(const std::string& name) {
    if (!enclosing_) return -1;
    const int localSlot = enclosing_->resolveLocal(name);
    if (localSlot != -1) {
      enclosing_->locals_[localSlot].isCaptured = true;
      return addUpvalue(static_cast<uint8_t>(localSlot), true);
    }
    const int up = enclosing_->resolveUpvalue(name);
    if (up != -1) return addUpvalue(static_cast<uint8_t>(up), false);
    return -1;
  }
  int addUpvalue(uint8_t index, bool isLocal) {
    for (std::size_t i = 0; i < proto_->upvalues.size(); ++i) {
      if (proto_->upvalues[i].index == index && proto_->upvalues[i].isLocal == isLocal)
        return static_cast<int>(i);
    }
    if (proto_->upvalues.size() >= 256) throw std::runtime_error("too many upvalues");
    proto_->upvalues.push_back({index, isLocal});
    return static_cast<int>(proto_->upvalues.size() - 1);
  }

  // ── Sub-function compilation ─────────────────────────────────────────────
  std::shared_ptr<FunctionProto> compileSubfunction(
      const std::vector<std::string>& params, const Expr& body,
      const std::string& fname = "<anon>") {
    Compiler sub(this);
    sub.proto_->name = fname;
    sub.proto_->params = params;
    sub.proto_->arity = static_cast<int>(params.size());
    // Slot 0 is the callee placeholder. Params follow at slots 1..arity.
    sub.addLocal("");
    for (const auto& p : params) sub.addLocal(p);
    body.compile(sub);
    sub.emit(Op::Return);
    return sub.proto_;
  }

  uint8_t addProto(std::shared_ptr<FunctionProto> p) {
    proto_->protos.push_back(std::move(p));
    if (proto_->protos.size() > 256) throw std::runtime_error("too many sub-functions");
    return static_cast<uint8_t>(proto_->protos.size() - 1);
  }

private:
  struct Local { std::string name; int depth; bool isCaptured; };

  Compiler* enclosing_;
  std::shared_ptr<FunctionProto> proto_;
  std::vector<Local> locals_;
  int depth_ = 0;
};

// ─── 7. AST::compile bodies ──────────────────────────────────────────────────

void NumberExpr::compile(Compiler& c) const {
  c.emit(Op::Const, c.addConst(value));
}

void IdentExpr::compile(Compiler& c) const {
  const int slot = c.resolveLocal(name);
  if (slot != -1) { c.emit(Op::LoadLocal, static_cast<uint8_t>(slot)); return; }
  const int up = c.resolveUpvalue(name);
  if (up != -1)  { c.emit(Op::LoadUpvalue, static_cast<uint8_t>(up)); return; }
  c.emit(Op::LoadGlobal, c.addName(name));
}

void UnaryExpr::compile(Compiler& c) const {
  operand->compile(c);
  if (op == '-') c.emit(Op::Neg);
}

void BinaryExpr::compile(Compiler& c) const {
  lhs->compile(c);
  rhs->compile(c);
  if      (op == "+")  c.emit(Op::Add);
  else if (op == "-")  c.emit(Op::Sub);
  else if (op == "*")  c.emit(Op::Mul);
  else if (op == "/")  c.emit(Op::Div);
  else if (op == "==") c.emit(Op::Eq);
  else if (op == "!=") c.emit(Op::Neq);
  else if (op == "<")  c.emit(Op::Lt);
  else if (op == ">")  c.emit(Op::Gt);
  else if (op == "<=") c.emit(Op::Le);
  else if (op == ">=") c.emit(Op::Ge);
  else throw std::runtime_error("unknown operator: " + op);
}

void LetExpr::compile(Compiler& c) const {
  expr->compile(c);
  if (c.inMainGlobalScope()) {
    c.emit(Op::DefineGlobal, c.addName(name));
    // DefineGlobal peeks (doesn't pop); the value stays on the operand stack.
  } else {
    // No opcode for declaring a local — the value that just got pushed *is*
    // the slot. We only need to register the name → slot mapping.
    c.addLocal(name);
  }
}

void IfExpr::compile(Compiler& c) const {
  cond->compile(c);
  const std::size_t elseAt = c.emitJump(Op::JumpIfFalse);
  thenBranch->compile(c);
  const std::size_t endAt = c.emitJump(Op::Jump);
  c.patchJump(elseAt);
  elseBranch->compile(c);
  c.patchJump(endAt);
}

void FunctionExpr::compile(Compiler& c) const {
  auto proto = c.compileSubfunction(params, *body);
  const uint8_t pi = c.addProto(std::move(proto));
  c.emit(Op::MakeClosure, pi);
}

void CallExpr::compile(Compiler& c) const {
  callee->compile(c);
  for (const auto& a : args) a->compile(c);
  if (args.size() > 255) throw std::runtime_error("too many arguments");
  c.emit(Op::Call, static_cast<uint8_t>(args.size()));
}

void SequenceExpr::compile(Compiler& c) const {
  if (exprs.empty()) { c.emit(Op::Const, c.addConst(0.0)); return; }
  c.beginScope();
  for (std::size_t i = 0; i < exprs.size(); ++i) {
    exprs[i]->compile(c);
    if (i + 1 < exprs.size()) {
      const bool isLet = (dynamic_cast<const LetExpr*>(exprs[i].get()) != nullptr);
      // Inside a scope, lets leave their value on the stack *as* the local
      // slot — we must NOT pop it. Other statements' values are discarded.
      if (!isLet) c.emit(Op::Pop);
    }
  }
  // If the last statement is a let, its value is "the local". Load a fresh
  // copy onto the top so endScope has something to keep above the locals.
  if (auto last = dynamic_cast<const LetExpr*>(exprs.back().get())) {
    const int slot = c.resolveLocal(last->name);
    if (slot >= 0) c.emit(Op::LoadLocal, static_cast<uint8_t>(slot));
  }
  c.endScope();
}

// ─── 8. Runtime types ────────────────────────────────────────────────────────

struct ClosureValue;
struct OpenUpvalue;
class Environment;

using Value = std::variant<double, std::shared_ptr<ClosureValue>>;
using UpvaluePtr = std::shared_ptr<OpenUpvalue>;

class Environment {
public:
  void define(const std::string& name, Value v) { vars_[name] = std::move(v); }
  bool has(const std::string& name) const { return vars_.count(name) != 0; }
  const Value& lookup(const std::string& name) const {
    const auto it = vars_.find(name);
    if (it == vars_.end()) throw std::runtime_error("undefined variable: " + name);
    return it->second;
  }
private:
  std::unordered_map<std::string, Value> vars_;
};

// An upvalue is either "open" (referring to a live stack slot) or "closed"
// (the value has been moved to a heap cell because the slot it was pointing
// at is gone). Multiple closures can share one upvalue.
struct OpenUpvalue {
  bool isOpen = true;
  std::size_t stackIndex = 0; // valid when isOpen
  Value closed = 0.0;          // valid when !isOpen
};

using BuiltinFn = std::function<Value(const std::vector<Value>&)>;

struct ClosureValue {
  std::string name;
  std::shared_ptr<FunctionProto> proto; // null for built-ins
  std::vector<UpvaluePtr> upvalues;
  BuiltinFn builtin;
  bool isBuiltin() const { return proto == nullptr; }
};

namespace {

double asNumber(const Value& v, const std::string& ctx) {
  if (!std::holds_alternative<double>(v))
    throw std::runtime_error("expected number in " + ctx + ", got function");
  return std::get<double>(v);
}

std::string valueToString(const Value& v) {
  if (std::holds_alternative<double>(v)) {
    std::ostringstream os; os << std::get<double>(v); return os.str();
  }
  return "<fn " + std::get<std::shared_ptr<ClosureValue>>(v)->name + ">";
}

} // namespace

// ─── 9. Disassembler ─────────────────────────────────────────────────────────

namespace {

void disassemble(const FunctionProto& proto, std::ostream& os) {
  os << "function " << proto.name << "(";
  for (std::size_t i = 0; i < proto.params.size(); ++i) {
    if (i) os << ", ";
    os << proto.params[i];
  }
  os << ")\n";
  if (!proto.upvalues.empty()) {
    os << "  upvalues:\n";
    for (std::size_t i = 0; i < proto.upvalues.size(); ++i) {
      os << "    [" << i << "] " << (proto.upvalues[i].isLocal ? "local" : "upvalue")
         << " " << static_cast<int>(proto.upvalues[i].index) << "\n";
    }
  }
  if (!proto.constants.empty()) {
    os << "  constants:\n";
    for (std::size_t i = 0; i < proto.constants.size(); ++i)
      os << "    [" << i << "] " << proto.constants[i] << "\n";
  }
  if (!proto.names.empty()) {
    os << "  names:\n";
    for (std::size_t i = 0; i < proto.names.size(); ++i)
      os << "    [" << i << "] " << proto.names[i] << "\n";
  }
  std::size_t ip = 0;
  while (ip < proto.code.size()) {
    os << "    " << std::setw(4) << ip << "  ";
    const Op op = static_cast<Op>(proto.code[ip++]);
    os << std::left << std::setw(14) << opName(op) << std::right;
    switch (op) {
      case Op::Const: {
        const uint8_t idx = proto.code[ip++];
        os << " " << static_cast<int>(idx) << "    ; " << proto.constants[idx];
        break;
      }
      case Op::LoadLocal:
      case Op::LoadUpvalue:
      case Op::Call:
      case Op::CloseScopeKeepTop: {
        os << " " << static_cast<int>(proto.code[ip++]);
        break;
      }
      case Op::LoadGlobal:
      case Op::DefineGlobal: {
        const uint8_t idx = proto.code[ip++];
        os << " " << static_cast<int>(idx) << "    ; " << proto.names[idx];
        break;
      }
      case Op::MakeClosure: {
        const uint8_t idx = proto.code[ip++];
        os << " " << static_cast<int>(idx) << "    ; " << proto.protos[idx]->name;
        break;
      }
      case Op::Jump:
      case Op::JumpIfFalse: {
        const uint8_t hi = proto.code[ip++];
        const uint8_t lo = proto.code[ip++];
        const int16_t off = static_cast<int16_t>(static_cast<uint16_t>((hi << 8) | lo));
        os << " " << off << "    ; -> " << (static_cast<std::ptrdiff_t>(ip) + off);
        break;
      }
      default: break;
    }
    os << "\n";
  }
  for (const auto& sub : proto.protos) { os << "\n"; disassemble(*sub, os); }
}

} // namespace

// ─── 10. VM ──────────────────────────────────────────────────────────────────

class VM {
public:
  VM() : globalEnv_(std::make_shared<Environment>()) { installBuiltins(); }

  Value run(std::shared_ptr<FunctionProto> main) {
    auto mainClosure = std::make_shared<ClosureValue>();
    mainClosure->name = "<main>";
    mainClosure->proto = main;
    frames_.clear();
    stack_.clear();
    openUpvalues_.clear();
    pushFrame(mainClosure, 0);

    while (true) {
      Frame& f = frames_.back();
      const Op op = static_cast<Op>(readByte(f));
      switch (op) {
        case Op::Const: {
          stack_.push_back(f.closure->proto->constants[readByte(f)]);
          break;
        }
        case Op::Pop: stack_.pop_back(); break;
        case Op::LoadLocal: {
          const uint8_t s = readByte(f);
          stack_.push_back(stack_[f.base + s]);
          break;
        }
        case Op::LoadUpvalue: {
          const uint8_t idx = readByte(f);
          const auto& u = f.closure->upvalues[idx];
          stack_.push_back(u->isOpen ? stack_[u->stackIndex] : u->closed);
          break;
        }
        case Op::LoadGlobal: {
          const uint8_t idx = readByte(f);
          stack_.push_back(globalEnv_->lookup(f.closure->proto->names[idx]));
          break;
        }
        case Op::DefineGlobal: {
          const uint8_t idx = readByte(f);
          globalEnv_->define(f.closure->proto->names[idx], stack_.back());
          break;
        }
        case Op::Neg:  stack_.back() = -asNumber(stack_.back(), "neg"); break;
        case Op::Add:  binNum([](double a, double b){ return a + b; }); break;
        case Op::Sub:  binNum([](double a, double b){ return a - b; }); break;
        case Op::Mul:  binNum([](double a, double b){ return a * b; }); break;
        case Op::Div: {
          const double b = asNumber(stack_.back(), "div rhs"); stack_.pop_back();
          const double a = asNumber(stack_.back(), "div lhs"); stack_.pop_back();
          if (b == 0.0) throw std::runtime_error("division by zero");
          stack_.push_back(a / b);
          break;
        }
        case Op::Eq:  binCmp([](double a, double b){ return a == b; }); break;
        case Op::Neq: binCmp([](double a, double b){ return a != b; }); break;
        case Op::Lt:  binCmp([](double a, double b){ return a <  b; }); break;
        case Op::Gt:  binCmp([](double a, double b){ return a >  b; }); break;
        case Op::Le:  binCmp([](double a, double b){ return a <= b; }); break;
        case Op::Ge:  binCmp([](double a, double b){ return a >= b; }); break;
        case Op::Jump: {
          const int16_t off = readShort(f);
          f.ip = static_cast<std::size_t>(static_cast<std::ptrdiff_t>(f.ip) + off);
          break;
        }
        case Op::JumpIfFalse: {
          const int16_t off = readShort(f);
          const double v = asNumber(stack_.back(), "if cond");
          stack_.pop_back();
          if (v == 0.0) f.ip = static_cast<std::size_t>(static_cast<std::ptrdiff_t>(f.ip) + off);
          break;
        }
        case Op::MakeClosure: {
          const uint8_t pi = readByte(f);
          auto proto = f.closure->proto->protos[pi];
          auto cl = std::make_shared<ClosureValue>();
          cl->name = proto->name;
          cl->proto = proto;
          cl->upvalues.reserve(proto->upvalues.size());
          for (const auto& spec : proto->upvalues) {
            if (spec.isLocal) {
              cl->upvalues.push_back(captureUpvalue(f.base + spec.index));
            } else {
              cl->upvalues.push_back(f.closure->upvalues[spec.index]);
            }
          }
          stack_.push_back(std::move(cl));
          break;
        }
        case Op::Call: {
          const uint8_t argc = readByte(f);
          callTop(argc);
          break;
        }
        case Op::Return: {
          Value result = std::move(stack_.back());
          stack_.pop_back();
          closeUpvaluesAt(frames_.back().base);
          stack_.resize(frames_.back().base);
          frames_.pop_back();
          stack_.push_back(std::move(result));
          break;
        }
        case Op::Halt: {
          Value result = stack_.empty() ? Value(0.0) : stack_.back();
          stack_.clear(); frames_.clear(); openUpvalues_.clear();
          return result;
        }
        case Op::CloseScopeKeepTop: {
          const uint8_t n = readByte(f);
          Value top = std::move(stack_.back());
          stack_.pop_back();
          closeUpvaluesAt(stack_.size() - n);
          stack_.resize(stack_.size() - n);
          stack_.push_back(std::move(top));
          break;
        }
      }
    }
  }

private:
  struct Frame {
    std::shared_ptr<ClosureValue> closure;
    std::size_t ip = 0;
    std::size_t base = 0;
  };

  void pushFrame(std::shared_ptr<ClosureValue> cl, std::size_t base) {
    Frame f; f.closure = std::move(cl); f.base = base; frames_.push_back(std::move(f));
  }
  uint8_t readByte(Frame& f) { return f.closure->proto->code[f.ip++]; }
  int16_t readShort(Frame& f) {
    const uint8_t hi = f.closure->proto->code[f.ip++];
    const uint8_t lo = f.closure->proto->code[f.ip++];
    return static_cast<int16_t>(static_cast<uint16_t>((hi << 8) | lo));
  }
  template <typename F> void binNum(F op) {
    const double b = asNumber(stack_.back(), "rhs"); stack_.pop_back();
    const double a = asNumber(stack_.back(), "lhs"); stack_.pop_back();
    stack_.push_back(op(a, b));
  }
  template <typename F> void binCmp(F op) {
    const double b = asNumber(stack_.back(), "rhs"); stack_.pop_back();
    const double a = asNumber(stack_.back(), "lhs"); stack_.pop_back();
    stack_.push_back(op(a, b) ? 1.0 : 0.0);
  }

  void callTop(uint8_t argc) {
    if (stack_.size() < static_cast<std::size_t>(argc) + 1)
      throw std::runtime_error("internal: stack underflow on CALL");
    const std::size_t calleeIdx = stack_.size() - argc - 1;
    Value calleeVal = stack_[calleeIdx];
    if (!std::holds_alternative<std::shared_ptr<ClosureValue>>(calleeVal))
      throw std::runtime_error("attempt to call a non-function");
    const auto callee = std::get<std::shared_ptr<ClosureValue>>(calleeVal);

    if (callee->isBuiltin()) {
      std::vector<Value> args(stack_.begin() + calleeIdx + 1, stack_.end());
      stack_.erase(stack_.begin() + calleeIdx, stack_.end());
      stack_.push_back(callee->builtin(args));
      return;
    }
    if (callee->proto->arity != static_cast<int>(argc))
      throw std::runtime_error("arity mismatch calling " + callee->name + ": expected "
          + std::to_string(callee->proto->arity) + ", got " + std::to_string(argc));
    // Callee stays at slot 0, args at slots 1..argc.
    pushFrame(callee, calleeIdx);
  }

  UpvaluePtr captureUpvalue(std::size_t stackIdx) {
    for (const auto& u : openUpvalues_) {
      if (u->isOpen && u->stackIndex == stackIdx) return u;
    }
    auto u = std::make_shared<OpenUpvalue>();
    u->isOpen = true; u->stackIndex = stackIdx;
    openUpvalues_.push_back(u);
    return u;
  }
  // Close any open upvalues pointing into stack positions >= lowInclusive.
  // "Closing" copies the live stack value into the upvalue's heap slot so
  // the closure that holds it can keep using it after the frame is gone.
  void closeUpvaluesAt(std::size_t lowInclusive) {
    for (auto it = openUpvalues_.begin(); it != openUpvalues_.end();) {
      if ((*it)->isOpen && (*it)->stackIndex >= lowInclusive) {
        (*it)->closed = stack_[(*it)->stackIndex];
        (*it)->isOpen = false;
        it = openUpvalues_.erase(it);
      } else {
        ++it;
      }
    }
  }

  void installBuiltins() {
    const auto reg = [&](const std::string& nm, int arity, BuiltinFn body) {
      auto cl = std::make_shared<ClosureValue>();
      cl->name = nm;
      cl->builtin = [nm, arity, body = std::move(body)](const std::vector<Value>& a) -> Value {
        if (arity >= 0 && static_cast<int>(a.size()) != arity)
          throw std::runtime_error("arity mismatch calling " + nm);
        return body(a);
      };
      globalEnv_->define(nm, cl);
    };
    reg("sqrt", 1, [](const std::vector<Value>& a){ return std::sqrt(asNumber(a[0],"sqrt")); });
    reg("pow",  2, [](const std::vector<Value>& a){ return std::pow(asNumber(a[0],"pow"), asNumber(a[1],"pow")); });
    reg("abs",  1, [](const std::vector<Value>& a){ return std::fabs(asNumber(a[0],"abs")); });
    reg("min",  2, [](const std::vector<Value>& a){ return std::fmin(asNumber(a[0],"min"), asNumber(a[1],"min")); });
    reg("max",  2, [](const std::vector<Value>& a){ return std::fmax(asNumber(a[0],"max"), asNumber(a[1],"max")); });
    reg("print",1, [](const std::vector<Value>& a){ std::cout << valueToString(a[0]) << "\n"; return a[0]; });
  }

  std::vector<Value> stack_;
  std::vector<Frame> frames_;
  std::vector<UpvaluePtr> openUpvalues_;
  std::shared_ptr<Environment> globalEnv_;
};

// ─── 11. Driver ──────────────────────────────────────────────────────────────

namespace {

Value runSource(VM& vm, const std::string& source, std::string* asmOut = nullptr,
                bool foldConstants = true) {
  Lexer lexer(source);
  Parser parser(lexer.tokenize());
  std::vector<ExprPtr> program = parser.parseProgram();
  if (foldConstants) {
    for (auto& e : program) e = folding::fold(e);
  }
  Compiler compiler;
  auto proto = compiler.compileProgram(program);
  if (asmOut) {
    std::ostringstream oss; disassemble(*proto, oss); *asmOut = oss.str();
  }
  return vm.run(proto);
}

[[maybe_unused]] void runRepl() {
  std::cout << "expr v4> slot-resolved locals + upvalues + constant folding. "
               ":asm to disassemble, :raw to skip folding. Ctrl-D to exit.\n";
  VM vm;
  std::string line;
  while (std::cout << "expr v4> " && std::getline(std::cin, line)) {
    if (line.empty()) continue;
    bool showAsm = false, fold = true;
    std::string source = line;
    while (true) {
      if (source.rfind(":asm ", 0) == 0) { showAsm = true; source = source.substr(5); continue; }
      if (source.rfind(":raw ", 0) == 0) { fold = false;   source = source.substr(5); continue; }
      break;
    }
    try {
      std::string asmStr;
      const Value result = runSource(vm, source, showAsm ? &asmStr : nullptr, fold);
      if (showAsm) std::cout << asmStr;
      std::cout << "= " << valueToString(result) << "\n";
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  std::cout << "\n";
}

} // namespace

#ifndef EXPR_V4_TEST_BUILD
int main(int argc, char** argv) {
  if (argc > 1) {
    std::string source;
    for (int i = 1; i < argc; ++i) { if (i > 1) source += ' '; source += argv[i]; }
    try {
      VM vm;
      std::cout << valueToString(runSource(vm, source)) << "\n";
      return 0;
    } catch (const std::exception& e) {
      std::cerr << "error: " << e.what() << "\n";
      return 1;
    }
  }
  runRepl();
  return 0;
}
#endif
