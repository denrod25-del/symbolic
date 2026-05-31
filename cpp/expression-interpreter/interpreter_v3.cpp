// V3 of the expression interpreter.
//
// Same source language as V2; entirely different runtime.
//
// V2 was a *tree-walking interpreter*: every operation went through a virtual
// method call on an AST node, and every function call recursed in C++.
//
// V3 is a *bytecode compiler + stack VM*:
//   * Compiler walks the AST once and emits a flat array of opcodes (Chunks).
//   * VM is a single while-loop with a switch that pops/pushes a value stack
//     and reads opcodes from the current frame's instruction pointer.
//   * Function calls are managed via an explicit call stack (`Frame`s), not
//     the C++ stack. RETURN restores the caller without unwinding C++.
//
// Why this matters:
//   * A dispatch loop with linear bytecode is friendlier to the CPU's
//     instruction cache than chasing virtual pointers through an AST.
//   * The same opcode stream can be optimised, serialised to disk (think
//     `.pyc` files), reordered, or JIT-compiled. The AST is throw-away.
//   * Architecturally, this is what CPython, the JVM, .NET CLR, Lua, Ruby
//     (MRI/YARV), and pre-JIT JavaScriptCore all do.
//
// Try `./interpreter_v3` and prefix a line with `:asm ` to print the bytecode
// next to the result.
//
// Build:  g++ -std=c++17 -Wall -Wextra -O2 interpreter_v3.cpp -o interpreter_v3

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

// -----------------------------------------------------------------------------
// 1. Tokens + Lexer (identical to V2; the front end doesn't care what the back
//    end is)
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
        {"let",  TokenKind::Let}, {"fn",   TokenKind::Fn},
        {"if",   TokenKind::If},  {"then", TokenKind::Then},
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
      case '=': return maybeTwo('=', TokenKind::EqEq, TokenKind::Eq);
      case '<': return maybeTwo('=', TokenKind::LtEq, TokenKind::Lt);
      case '>': return maybeTwo('=', TokenKind::GtEq, TokenKind::Gt);
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
// 2. AST (data-only; compile() is defined after Compiler is known)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 3. Parser (identical to V2)
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
    advance();
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
        if (p.kind != TokenKind::Ident) {
          throw std::runtime_error("expected parameter name at position " + std::to_string(p.pos));
        }
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
    if (peek().kind != k) {
      throw std::runtime_error(msg + " at position " + std::to_string(peek().pos));
    }
    advance();
  }
  std::vector<Token> tokens_;
  std::size_t pos_ = 0;
};

// -----------------------------------------------------------------------------
// 4. Bytecode (Opcodes + FunctionProto)
//
// Each opcode is one byte. Inline operands follow. The whole language uses
// ~20 opcodes, each doing one tiny step of the language's semantics. This is
// roughly Python-bytecode-shaped; real VMs grow to 100s of opcodes mostly for
// specialised fast paths (LOAD_FAST vs LOAD_NAME, BINARY_ADD vs BINARY_OP …).
//
// A FunctionProto is the compile-time representation of one function: its
// code, its constant pool (numeric literals), its name pool (variable names
// referenced), and its nested function templates. Closures pair a Proto with
// a captured Environment at runtime.
// -----------------------------------------------------------------------------

enum class Op : uint8_t {
  Const,        // [u8 const_idx]    push constants[idx]
  Pop,          //                   pop and discard
  GetVar,       // [u8 name_idx]     push env.lookup(names[idx])
  DefineVar,    // [u8 name_idx]     env.define(names[idx], peek); value stays
  Neg,          //                   negate top
  Add, Sub, Mul, Div,
  Eq, Neq, Lt, Gt, Le, Ge,
  Jump,         // [i16 offset]      ip += offset
  JumpIfFalse,  // [i16 offset]      pop; if zero, ip += offset
  MakeFn,       // [u8 proto_idx]    push Closure(protos[idx], current_env)
  Call,         // [u8 argc]
  Return,
  Halt,
};

const char* opName(Op op) {
  switch (op) {
    case Op::Const:       return "CONST";
    case Op::Pop:         return "POP";
    case Op::GetVar:      return "GET_VAR";
    case Op::DefineVar:   return "DEFINE_VAR";
    case Op::Neg:         return "NEG";
    case Op::Add:         return "ADD";
    case Op::Sub:         return "SUB";
    case Op::Mul:         return "MUL";
    case Op::Div:         return "DIV";
    case Op::Eq:          return "EQ";
    case Op::Neq:         return "NEQ";
    case Op::Lt:          return "LT";
    case Op::Gt:          return "GT";
    case Op::Le:          return "LE";
    case Op::Ge:          return "GE";
    case Op::Jump:        return "JUMP";
    case Op::JumpIfFalse: return "JUMP_IF_FALSE";
    case Op::MakeFn:      return "MAKE_FN";
    case Op::Call:        return "CALL";
    case Op::Return:      return "RETURN";
    case Op::Halt:        return "HALT";
  }
  return "?";
}

struct FunctionProto {
  std::string name = "<main>";
  std::vector<std::string> params;
  std::vector<uint8_t> code;
  std::vector<double> constants;
  std::vector<std::string> names;
  std::vector<std::shared_ptr<FunctionProto>> protos;
};

// -----------------------------------------------------------------------------
// 5. Compiler — AST → bytecode
// -----------------------------------------------------------------------------

class Compiler {
public:
  Compiler() : proto_(std::make_shared<FunctionProto>()) {}

  std::shared_ptr<FunctionProto> compileProgram(const std::vector<ExprPtr>& program) {
    proto_->name = "<main>";
    if (program.empty()) {
      emit(Op::Const, addConst(0.0));
    } else {
      for (std::size_t i = 0; i < program.size(); ++i) {
        program[i]->compile(*this);
        // Every statement except the last leaves a value we don't want — discard it
        // so the operand stack stays balanced at end-of-program.
        if (i + 1 < program.size()) emit(Op::Pop);
      }
    }
    emit(Op::Halt);
    return proto_;
  }

  void emit(Op op) { proto_->code.push_back(static_cast<uint8_t>(op)); }
  void emit(Op op, uint8_t arg) {
    proto_->code.push_back(static_cast<uint8_t>(op));
    proto_->code.push_back(arg);
  }

  // Emit a jump with a placeholder 16-bit offset. Returns the byte index of
  // the placeholder so we can patch it once we know where to jump to. This is
  // the classic "backpatching" trick — every compiler that emits forward
  // jumps for control flow does some version of this.
  std::size_t emitJump(Op op) {
    proto_->code.push_back(static_cast<uint8_t>(op));
    proto_->code.push_back(0xff);
    proto_->code.push_back(0xff);
    return proto_->code.size() - 2;
  }

  void patchJump(std::size_t at) {
    const std::ptrdiff_t target = static_cast<std::ptrdiff_t>(proto_->code.size());
    const std::ptrdiff_t fromAfterOperand = static_cast<std::ptrdiff_t>(at) + 2;
    const std::ptrdiff_t offset = target - fromAfterOperand;
    if (offset > 32767 || offset < -32768) {
      throw std::runtime_error("jump too large to encode in 16 bits");
    }
    const uint16_t u = static_cast<uint16_t>(static_cast<int16_t>(offset));
    proto_->code[at]     = static_cast<uint8_t>((u >> 8) & 0xff);
    proto_->code[at + 1] = static_cast<uint8_t>(u & 0xff);
  }

  uint8_t addConst(double v) {
    proto_->constants.push_back(v);
    if (proto_->constants.size() > 256) throw std::runtime_error("too many constants in one function");
    return static_cast<uint8_t>(proto_->constants.size() - 1);
  }

  uint8_t addName(const std::string& name) {
    for (std::size_t i = 0; i < proto_->names.size(); ++i) {
      if (proto_->names[i] == name) return static_cast<uint8_t>(i);
    }
    proto_->names.push_back(name);
    if (proto_->names.size() > 256) throw std::runtime_error("too many names in one function");
    return static_cast<uint8_t>(proto_->names.size() - 1);
  }

  uint8_t compileSubfunction(const std::vector<std::string>& params, const Expr& body,
                             const std::string& fname = "<anon>") {
    Compiler sub;
    sub.proto_->name = fname;
    sub.proto_->params = params;
    body.compile(sub);
    sub.emit(Op::Return);
    proto_->protos.push_back(sub.proto_);
    if (proto_->protos.size() > 256) throw std::runtime_error("too many sub-functions");
    return static_cast<uint8_t>(proto_->protos.size() - 1);
  }

private:
  std::shared_ptr<FunctionProto> proto_;
};

// AST::compile bodies. Read these like an assembly manual for the language —
// each construct turns into a deterministic sequence of opcodes.

void NumberExpr::compile(Compiler& c) const {
  c.emit(Op::Const, c.addConst(value));
}

void IdentExpr::compile(Compiler& c) const {
  c.emit(Op::GetVar, c.addName(name));
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
  // DefineVar peeks (doesn't pop), so `let` is an expression that returns its
  // own value. `let x = 5` leaves 5 on the stack.
  c.emit(Op::DefineVar, c.addName(name));
}

// if cond then a else b  →
//   <cond>
//   JUMP_IF_FALSE  ─── L_else
//   <a>
//   JUMP  ────────── L_end
// L_else:
//   <b>
// L_end:
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
  const uint8_t pi = c.compileSubfunction(params, *body);
  c.emit(Op::MakeFn, pi);
}

void CallExpr::compile(Compiler& c) const {
  callee->compile(c);
  for (const auto& a : args) a->compile(c);
  if (args.size() > 255) throw std::runtime_error("too many arguments");
  c.emit(Op::Call, static_cast<uint8_t>(args.size()));
}

void SequenceExpr::compile(Compiler& c) const {
  if (exprs.empty()) { c.emit(Op::Const, c.addConst(0.0)); return; }
  for (std::size_t i = 0; i < exprs.size(); ++i) {
    exprs[i]->compile(c);
    if (i + 1 < exprs.size()) c.emit(Op::Pop);
  }
}

// -----------------------------------------------------------------------------
// 6. Values, Environments, Closures (runtime side)
// -----------------------------------------------------------------------------

class Environment;
struct ClosureValue;
using EnvPtr = std::shared_ptr<Environment>;
using Value = std::variant<double, std::shared_ptr<ClosureValue>>;

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

struct ClosureValue {
  std::string name;
  std::shared_ptr<FunctionProto> proto;  // null for built-ins
  EnvPtr env;                            // captured-at-definition environment
  BuiltinFn builtin;                     // set only for built-ins
  bool isBuiltin() const { return proto == nullptr; }
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
  return "<fn " + std::get<std::shared_ptr<ClosureValue>>(v)->name + ">";
}

} // namespace

// -----------------------------------------------------------------------------
// 7. Disassembler — for the `:asm` REPL command
// -----------------------------------------------------------------------------

namespace {

void disassemble(const FunctionProto& proto, std::ostream& os) {
  os << "function " << proto.name << "(";
  for (std::size_t i = 0; i < proto.params.size(); ++i) {
    if (i) os << ", ";
    os << proto.params[i];
  }
  os << ")\n";
  if (!proto.constants.empty()) {
    os << "  constants:\n";
    for (std::size_t i = 0; i < proto.constants.size(); ++i) {
      os << "    [" << i << "] " << proto.constants[i] << "\n";
    }
  }
  if (!proto.names.empty()) {
    os << "  names:\n";
    for (std::size_t i = 0; i < proto.names.size(); ++i) {
      os << "    [" << i << "] " << proto.names[i] << "\n";
    }
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
      case Op::GetVar:
      case Op::DefineVar: {
        const uint8_t idx = proto.code[ip++];
        os << " " << static_cast<int>(idx) << "    ; " << proto.names[idx];
        break;
      }
      case Op::MakeFn: {
        const uint8_t idx = proto.code[ip++];
        os << " " << static_cast<int>(idx) << "    ; " << proto.protos[idx]->name;
        break;
      }
      case Op::Call: {
        const uint8_t argc = proto.code[ip++];
        os << " " << static_cast<int>(argc);
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
  for (const auto& sub : proto.protos) {
    os << "\n";
    disassemble(*sub, os);
  }
}

} // namespace

// -----------------------------------------------------------------------------
// 8. VM — the stack machine
//
// The whole VM is one while-loop with a switch. Each Frame holds a function
// proto, an instruction pointer, an environment, and a base index into the
// shared operand stack. CALL pushes a frame; RETURN pops one. The C++ stack
// is *not* used for language-level call depth, so unlike V1/V2 you can in
// principle make the stack arbitrarily deep — recursion is bounded by heap,
// not by C++ frame size. (We don't do tail-call optimisation here; that would
// reuse the current frame instead of pushing a new one.)
// -----------------------------------------------------------------------------

class VM {
public:
  VM() : globalEnv_(std::make_shared<Environment>()) {
    installBuiltins();
  }

  Value run(std::shared_ptr<FunctionProto> main) {
    auto mainClosure = std::make_shared<ClosureValue>();
    mainClosure->name = "<main>";
    mainClosure->proto = main;
    mainClosure->env = globalEnv_;

    frames_.clear();
    stack_.clear();
    pushFrame(mainClosure, globalEnv_);

    while (true) {
      Frame& f = frames_.back();
      const Op op = static_cast<Op>(readByte(f));
      switch (op) {
        case Op::Const: {
          const uint8_t idx = readByte(f);
          stack_.push_back(f.proto->constants[idx]);
          break;
        }
        case Op::Pop: {
          stack_.pop_back();
          break;
        }
        case Op::GetVar: {
          const uint8_t idx = readByte(f);
          stack_.push_back(f.env->lookup(f.proto->names[idx]));
          break;
        }
        case Op::DefineVar: {
          const uint8_t idx = readByte(f);
          f.env->define(f.proto->names[idx], stack_.back());
          break;
        }
        case Op::Neg: {
          stack_.back() = -asNumber(stack_.back(), "neg");
          break;
        }
        case Op::Add: binNum([](double a, double b){ return a + b; }); break;
        case Op::Sub: binNum([](double a, double b){ return a - b; }); break;
        case Op::Mul: binNum([](double a, double b){ return a * b; }); break;
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
          if (v == 0.0) {
            f.ip = static_cast<std::size_t>(static_cast<std::ptrdiff_t>(f.ip) + off);
          }
          break;
        }
        case Op::MakeFn: {
          const uint8_t pi = readByte(f);
          auto proto = f.proto->protos[pi];
          auto cl = std::make_shared<ClosureValue>();
          cl->name = proto->name;
          cl->proto = proto;
          cl->env = f.env; // snapshot current env -> this is the closure
          stack_.push_back(cl);
          break;
        }
        case Op::Call: {
          const uint8_t argc = readByte(f);
          callTop(argc);
          // f may now be invalidated (we pushed a new frame). Loop iterates
          // and re-grabs frames_.back() at the top.
          break;
        }
        case Op::Return: {
          Value result = std::move(stack_.back());
          stack_.pop_back();
          stack_.resize(frames_.back().base);
          frames_.pop_back();
          stack_.push_back(std::move(result));
          break;
        }
        case Op::Halt: {
          Value result = stack_.empty() ? Value(0.0) : stack_.back();
          stack_.clear();
          frames_.clear();
          return result;
        }
      }
    }
  }

private:
  struct Frame {
    std::shared_ptr<FunctionProto> proto;
    std::size_t ip = 0;
    EnvPtr env;
    std::size_t base = 0;
  };

  void pushFrame(std::shared_ptr<ClosureValue> cl, EnvPtr env) {
    Frame f;
    f.proto = cl->proto;
    f.env = std::move(env);
    f.base = stack_.size();
    frames_.push_back(std::move(f));
  }

  uint8_t readByte(Frame& f) { return f.proto->code[f.ip++]; }
  int16_t readShort(Frame& f) {
    const uint8_t hi = f.proto->code[f.ip++];
    const uint8_t lo = f.proto->code[f.ip++];
    return static_cast<int16_t>(static_cast<uint16_t>((hi << 8) | lo));
  }

  template <typename F>
  void binNum(F op) {
    const double b = asNumber(stack_.back(), "rhs"); stack_.pop_back();
    const double a = asNumber(stack_.back(), "lhs"); stack_.pop_back();
    stack_.push_back(op(a, b));
  }
  template <typename F>
  void binCmp(F op) {
    const double b = asNumber(stack_.back(), "rhs"); stack_.pop_back();
    const double a = asNumber(stack_.back(), "lhs"); stack_.pop_back();
    stack_.push_back(op(a, b) ? 1.0 : 0.0);
  }

  void callTop(uint8_t argc) {
    if (stack_.size() < static_cast<std::size_t>(argc) + 1) {
      throw std::runtime_error("internal: not enough operands for CALL");
    }
    std::vector<Value> args(stack_.end() - argc, stack_.end());
    stack_.erase(stack_.end() - argc, stack_.end());
    Value calleeVal = std::move(stack_.back());
    stack_.pop_back();

    if (!std::holds_alternative<std::shared_ptr<ClosureValue>>(calleeVal)) {
      throw std::runtime_error("attempt to call a non-function");
    }
    const auto callee = std::get<std::shared_ptr<ClosureValue>>(calleeVal);

    if (callee->isBuiltin()) {
      stack_.push_back(callee->builtin(args));
      return;
    }
    if (args.size() != callee->proto->params.size()) {
      throw std::runtime_error(
          "arity mismatch calling " + callee->name + ": expected "
          + std::to_string(callee->proto->params.size()) + ", got "
          + std::to_string(args.size()));
    }
    // New env's parent is the closure's captured env (lexical scope).
    auto callEnv = std::make_shared<Environment>(callee->env);
    for (std::size_t i = 0; i < args.size(); ++i) {
      callEnv->define(callee->proto->params[i], std::move(args[i]));
    }
    pushFrame(callee, callEnv);
  }

  void installBuiltins() {
    const auto reg = [&](const std::string& nm, int arity, BuiltinFn body) {
      auto cl = std::make_shared<ClosureValue>();
      cl->name = nm;
      cl->builtin = [nm, arity, body = std::move(body)](const std::vector<Value>& a) -> Value {
        if (arity >= 0 && static_cast<int>(a.size()) != arity) {
          throw std::runtime_error("arity mismatch calling " + nm);
        }
        return body(a);
      };
      globalEnv_->define(nm, cl);
    };
    reg("sqrt", 1, [](const std::vector<Value>& a){ return std::sqrt(asNumber(a[0], "sqrt")); });
    reg("pow",  2, [](const std::vector<Value>& a){ return std::pow(asNumber(a[0], "pow"), asNumber(a[1], "pow")); });
    reg("abs",  1, [](const std::vector<Value>& a){ return std::fabs(asNumber(a[0], "abs")); });
    reg("min",  2, [](const std::vector<Value>& a){ return std::fmin(asNumber(a[0], "min"), asNumber(a[1], "min")); });
    reg("max",  2, [](const std::vector<Value>& a){ return std::fmax(asNumber(a[0], "max"), asNumber(a[1], "max")); });
    reg("print",1, [](const std::vector<Value>& a){ std::cout << valueToString(a[0]) << "\n"; return a[0]; });
  }

  std::vector<Value> stack_;
  std::vector<Frame> frames_;
  EnvPtr globalEnv_;
};

// -----------------------------------------------------------------------------
// 9. Driver
// -----------------------------------------------------------------------------

namespace {

Value runSource(VM& vm, const std::string& source, std::string* asmOut = nullptr) {
  Lexer lexer(source);
  Parser parser(lexer.tokenize());
  std::vector<ExprPtr> program = parser.parseProgram();
  Compiler compiler;
  auto proto = compiler.compileProgram(program);
  if (asmOut) {
    std::ostringstream oss;
    disassemble(*proto, oss);
    *asmOut = oss.str();
  }
  return vm.run(proto);
}

[[maybe_unused]] void runRepl() {
  std::cout << "expr v3> bytecode VM. Prefix with ':asm ' to disassemble. Ctrl-D to exit.\n";
  VM vm;
  std::string line;
  while (std::cout << "expr v3> " && std::getline(std::cin, line)) {
    if (line.empty()) continue;
    bool showAsm = false;
    std::string source = line;
    if (source.rfind(":asm ", 0) == 0) {
      showAsm = true;
      source = source.substr(5);
    }
    try {
      std::string asmStr;
      const Value result = runSource(vm, source, showAsm ? &asmStr : nullptr);
      if (showAsm) std::cout << asmStr;
      std::cout << "= " << valueToString(result) << "\n";
    } catch (const std::exception& e) {
      std::cout << "error: " << e.what() << "\n";
    }
  }
  std::cout << "\n";
}

} // namespace

#ifndef EXPR_V3_TEST_BUILD
int main(int argc, char** argv) {
  if (argc > 1) {
    std::string source;
    for (int i = 1; i < argc; ++i) {
      if (i > 1) source += ' ';
      source += argv[i];
    }
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
#endif // EXPR_V3_TEST_BUILD
