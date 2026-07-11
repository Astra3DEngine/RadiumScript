// RadiumScript parser: recursive descent producing an AST.
// Each node carries { type, ... , line, col } for stepping/UI highlighting.

import { tokenize } from "./lexer.js";

export class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.p = 0;
  }
  get cur() { return this.toks[this.p]; }
  peek(o = 0) { return this.toks[this.p + o]; }

  is(type, value) {
    const t = this.cur;
    return t.type === type && (value === undefined || t.value === value);
  }
  isKw(v) { return this.cur.type === "keyword" && this.cur.value === v; }
  isOp(v) { return this.cur.type === "op" && this.cur.value === v; }

  advance() { const t = this.toks[this.p++]; return t; }
  expectOp(v) {
    if (!this.isOp(v)) this.err(`Expected '${v}' but got '${this.cur.value ?? this.cur.type}'`);
    return this.advance();
  }
  expectKw(v) {
    if (!this.isKw(v)) this.err(`Expected '${v}'`);
    return this.advance();
  }
  err(msg) {
    const t = this.cur;
    throw new SyntaxError(`Parse error at line ${t.line}:${t.col} - ${msg}`);
  }

  node(type, t, extra = {}) {
    return { type, line: t.line, col: t.col, ...extra };
  }

  // ---- program ----
  parseProgram() {
    const body = [];
    while (!this.is("eof")) body.push(this.parseTopLevel());
    return { type: "Program", body, line: 1, col: 1 };
  }

  parseTopLevel() {
    if (this.isKw("import")) return this.parseImport();
    if (this.isKw("export")) return this.parseExport();
    return this.parseBlockItem();
  }

  parseImport() {
    const t = this.advance(); // import
    let source, isFile;
    if (this.cur.type === "string") { source = this.advance().value; isFile = true; }
    else if (this.cur.type === "identifier") { source = this.advance().value; isFile = false; }
    else this.err("Expected library name or filename after import");
    let alias = null;
    if (this.isKw("as")) { this.advance(); alias = this.expectIdent().value; }
    this.expectOp(";");
    return this.node("Import", t, { source, isFile, alias });
  }

  parseExport() {
    const t = this.advance(); // export
    const name = this.expectIdent().value;
    this.expectOp(";");
    return this.node("Export", t, { name });
  }

  expectIdent() {
    if (this.cur.type !== "identifier") this.err(`Expected identifier but got '${this.cur.value ?? this.cur.type}'`);
    return this.advance();
  }

  // ---- block item (statements + decls allowed in a block) ----
  parseBlockItem() {
    if (this.isKw("def")) return this.parseFunctionDecl();
    if (this.isKw("class")) return this.parseClassDecl();
    if (this.isKw("namespace")) return this.parseNamespaceDecl();
    return this.parseStatement();
  }

  parseBlock() {
    const t = this.expectOp("{");
    const body = [];
    while (!this.isOp("}") && !this.is("eof")) body.push(this.parseBlockItem());
    this.expectOp("}");
    return this.node("Block", t, { body });
  }

  // ---- statements ----
  parseStatement() {
    if (this.isOp("{")) return this.parseBlock();
    if (this.isKw("var")) return this.parseVarDecl(false);
    if (this.isKw("const")) return this.parseVarDecl(true);
    if (this.isKw("if")) return this.parseIf();
    if (this.isKw("switch")) return this.parseSwitch();
    if (this.isKw("while")) return this.parseWhile();
    if (this.isKw("do")) return this.parseDoWhile();
    if (this.isKw("return")) return this.parseReturn();
    if (this.isKw("break")) return this.parseBreak();
    if (this.isKw("continue")) return this.parseContinue();

    // labeled statement: identifier ":" ( while | do-while | switch | block )
    if (this.cur.type === "identifier" && this.peek(1).type === "op" && this.peek(1).value === ":") {
      const t = this.advance();
      const label = t.value;
      this.advance(); // ':'
      let body;
      if (this.isKw("while")) body = this.parseWhile(label);
      else if (this.isKw("do")) body = this.parseDoWhile(label);
      else if (this.isKw("switch")) body = this.parseSwitch(label);
      else if (this.isOp("{")) body = this.parseBlock();
      else this.err("Expected while/do/switch/block after label");
      return this.node("Labeled", t, { label, body });
    }

    // expression statement (covers assignments too)
    const t = this.cur;
    const expr = this.parseExpression();
    this.expectOp(";");
    return this.node("ExprStmt", t, { expr });
  }

  parseVarDecl(isConst) {
    const kw = this.advance(); // var | const
    const name = this.expectIdent().value;
    let value = null;
    if (this.isOp("=")) { this.advance(); value = this.parseExpression(); }
    this.expectOp(";");
    return this.node("VarDecl", kw, { name, value, const: isConst });
  }

  parseIf() {
    const t = this.advance(); // if
    this.expectOp("(");
    const test = this.parseExpression();
    this.expectOp(")");
    const then = this.parseBlock();
    let alt = null;
    if (this.isKw("else")) {
      this.advance();
      if (this.isKw("if")) alt = this.parseIf();
      else alt = this.parseBlock();
    }
    return this.node("If", t, { test, then, alt });
  }

  parseSwitch(label) {
    const t = this.advance(); // switch
    this.expectOp("(");
    const disc = this.parseExpression();
    this.expectOp(")");
    this.expectOp("{");
    const clauses = [];
    while (!this.isOp("}") && !this.is("eof")) {
      let isDefault = false, test = null;
      if (this.isKw("case")) {
        this.advance();
        test = this.parseExpression();
      } else if (this.isKw("default")) {
        this.advance();
        isDefault = true;
      } else this.err("Expected case or default");
      this.expectOp(":");
      const body = this.parseBlock();
      clauses.push({ test, body, isDefault });
    }
    this.expectOp("}");
    return this.node("Switch", t, { discriminant: disc, clauses, label: label ?? null });
  }

  parseWhile(label) {
    const t = this.advance(); // while
    this.expectOp("(");
    const test = this.parseExpression();
    this.expectOp(")");
    const body = this.parseBlock();
    return this.node("While", t, { test, body, label: label ?? null });
  }

  parseDoWhile(label) {
    const t = this.advance(); // do
    const body = this.parseBlock();
    this.expectKw("while");
    this.expectOp("(");
    const test = this.parseExpression();
    this.expectOp(")");
    this.expectOp(";");
    return this.node("DoWhile", t, { body, test, label: label ?? null });
  }

  parseReturn() {
    const t = this.advance(); // return
    let value = null;
    if (!this.isOp(";")) value = this.parseExpression();
    this.expectOp(";");
    return this.node("Return", t, { value });
  }

  parseBreak() {
    const t = this.advance(); // break
    let label = null, cond = null;
    if (this.cur.type === "identifier") { label = this.advance().value; }
    if (this.isKw("if")) { this.advance(); this.expectOp("("); cond = this.parseExpression(); this.expectOp(")"); }
    this.expectOp(";");
    return this.node("Break", t, { label, cond });
  }

  parseContinue() {
    const t = this.advance(); // continue
    let label = null, cond = null;
    if (this.cur.type === "identifier") { label = this.advance().value; }
    if (this.isKw("if")) { this.advance(); this.expectOp("("); cond = this.parseExpression(); this.expectOp(")"); }
    this.expectOp(";");
    return this.node("Continue", t, { label, cond });
  }

  parseFunctionDecl() {
    const t = this.advance(); // def
    const name = this.expectIdent().value;
    this.expectOp("(");
    const params = this.parseParams();
    this.expectOp(")");
    let body = null;
    if (this.isOp(";")) { this.advance(); }        // forward declaration
    else if (this.isOp("{")) body = this.parseBlock();
    else this.err("Expected '{' or ';' in function declaration");
    return this.node("FunctionDecl", t, { name, params, body });
  }

  parseParams() {
    const params = [];
    if (this.isOp(")")) return params;
    do {
      const name = this.expectIdent().value;
      let def = null;
      if (this.isOp("=")) { this.advance(); def = this.parseExpression(); }
      params.push({ name, default: def });
      if (this.isOp(",")) this.advance(); else break;
    } while (true);
    return params;
  }

  parseClassDecl() {
    const t = this.advance(); // class
    const name = this.expectIdent().value;
    this.expectOp("{");
    const priv = [], pub = [];
    let section = null;
    while (!this.isOp("}") && !this.is("eof")) {
      if (this.isKw("private")) { this.advance(); this.expectOp(":"); section = priv; continue; }
      if (this.isKw("public")) { this.advance(); this.expectOp(":"); section = pub; continue; }
      if (section === null) section = pub; // lenient: default to public
      const m = this.parseClassMember();
      section.push(m);
    }
    this.expectOp("}");
    return this.node("ClassDecl", t, { name, private: priv, public: pub });
  }

  parseClassMember() {
    if (this.isKw("var")) return this.parseVarDecl(false);
    if (this.isKw("const")) return this.parseVarDecl(true);
    if (this.isKw("def")) return this.parseFunctionDecl();
    this.err("Expected class member (var/const/def)");
  }

  parseNamespaceDecl() {
    const t = this.advance(); // namespace
    const name = this.expectIdent().value;
    const body = this.parseBlock();
    return this.node("NamespaceDecl", t, { name, body });
  }

  // ---- expressions ----
  parseExpression() { return this.parseAssignment(); }

  parseAssignment() {
    const left = this.parseTernary();
    if (this.isOp("=")) {
      if (!isLValue(left)) this.err("Invalid assignment target");
      const eq = this.advance();
      const value = this.parseAssignment(); // right-assoc
      return this.node("AssignExpr", eq, { target: left, value });
    }
    return left;
  }

  parseTernary() {
    const cond = this.parseLogicalOr();
    if (this.isOp("?")) {
      const t = this.advance();
      const cons = this.parseExpression();
      this.expectOp(":");
      const alt = this.parseExpression();
      return this.node("Ternary", t, { test: cond, cons, alt });
    }
    return cond;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.isOp("||")) {
      const t = this.advance();
      const right = this.parseLogicalAnd();
      left = this.node("Logical", t, { op: "||", left, right });
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseEquality();
    while (this.isOp("&&")) {
      const t = this.advance();
      const right = this.parseEquality();
      left = this.node("Logical", t, { op: "&&", left, right });
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.isOp("==") || this.isOp("!=")) {
      const t = this.advance();
      const op = t.value;
      const right = this.parseComparison();
      left = this.node("Binary", t, { op, left, right });
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (this.isOp(">") || this.isOp("<") || this.isOp(">=") || this.isOp("<=")) {
      const t = this.advance();
      const op = t.value;
      const right = this.parseAdditive();
      left = this.node("Binary", t, { op, left, right });
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const t = this.advance();
      const op = t.value;
      const right = this.parseMultiplicative();
      left = this.node("Binary", t, { op, left, right });
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const t = this.advance();
      const op = t.value;
      const right = this.parseUnary();
      left = this.node("Binary", t, { op, left, right });
    }
    return left;
  }

  parseUnary() {
    if (this.isOp("!") || this.isOp("-")) {
      const t = this.advance();
      const operand = this.parseUnary();
      return this.node("Unary", t, { op: t.value, operand });
    }
    return this.parsePower();
  }

  parsePower() {
    const base = this.parsePostfix();
    if (this.isOp("**")) {
      const t = this.advance();
      const exp = this.parseUnary(); // right-assoc, unary on the outside
      return this.node("Binary", t, { op: "**", left: base, right: exp });
    }
    return base;
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    while (true) {
      if (this.isOp(".")) {
        const t = this.advance();
        const prop = this.expectIdent().value;
        expr = this.node("Member", t, { object: expr, property: prop });
      } else if (this.isOp("::")) {
        const t = this.advance();
        const prop = this.expectIdent().value;
        expr = this.node("Namespace", t, { object: expr, property: prop });
      } else if (this.isOp("[")) {
        const t = this.advance();
        const index = this.parseExpression();
        this.expectOp("]");
        expr = this.node("Index", t, { object: expr, index });
      } else if (this.isOp("(")) {
        const t = this.advance();
        const args = [];
        if (!this.isOp(")")) {
          do {
            args.push(this.parseExpression());
            if (this.isOp(",")) this.advance(); else break;
          } while (true);
        }
        this.expectOp(")");
        expr = this.node("Call", t, { callee: expr, args });
      } else if (this.isOp("++") || this.isOp("--")) {
        const t = this.advance();
        expr = this.node("Postfix", t, { op: t.value, operand: expr });
      } else break;
    }
    return expr;
  }

  parsePrimary() {
    // literals & keywords-as-values
    if (this.cur.type === "number") {
      const t = this.advance();
      return this.node("Literal", t, { kind: "number", value: t.value });
    }
    if (this.cur.type === "string") {
      const t = this.advance();
      return this.node("Literal", t, { kind: "string", value: t.value });
    }
    if (this.isKw("true") || this.isKw("false")) {
      const t = this.advance();
      return this.node("Literal", t, { kind: "bool", value: t.value === "true" });
    }
    if (this.isKw("NULL")) { const t = this.advance(); return this.node("Literal", t, { kind: "null", value: null }); }
    if (this.isKw("INF")) { const t = this.advance(); return this.node("Literal", t, { kind: "inf", value: Infinity }); }
    if (this.isKw("NaN")) { const t = this.advance(); return this.node("Literal", t, { kind: "nan", value: NaN }); }
    if (this.isKw("this")) { const t = this.advance(); return this.node("This", t, {}); }

    if (this.cur.type === "identifier") {
      const t = this.advance();
      return this.node("Identifier", t, { name: t.value });
    }

    // parenthesised
    if (this.isOp("(")) {
      const t = this.advance();
      const expr = this.parseExpression();
      this.expectOp(")");
      return expr;
    }

    // list literal
    if (this.isOp("[")) {
      const t = this.advance();
      const elements = [];
      if (!this.isOp("]")) {
        do {
          elements.push(this.parseExpression());
          if (this.isOp(",")) this.advance(); else break;
        } while (true);
      }
      this.expectOp("]");
      return this.node("List", t, { elements });
    }

    // braced: object literal or block expression (in expression context)
    if (this.isOp("{")) {
      // decide: empty -> object; "identifier :" -> try object; else block expr
      if (this.peek(1).type === "op" && this.peek(1).value === "}") {
        const t = this.advance(); this.advance();
        return this.node("Object", t, { pairs: [] });
      }
      if (this.peek(1).type === "identifier" && this.peek(2).type === "op" && this.peek(2).value === ":") {
        // try object literal with backtracking
        const save = this.p;
        try {
          return this.parseObjectLiteral();
        } catch (e) {
          this.p = save;
          return this.parseBlockExpression();
        }
      }
      return this.parseBlockExpression();
    }

    this.err(`Unexpected token '${this.cur.value ?? this.cur.type}'`);
  }

  parseObjectLiteral() {
    const t = this.expectOp("{");
    const pairs = [];
    if (!this.isOp("}")) {
      do {
        const key = this.expectIdent().value;
        this.expectOp(":");
        const value = this.parseExpression();
        pairs.push({ key, value });
        if (this.isOp(",")) this.advance(); else break;
      } while (true);
    }
    this.expectOp("}");
    return this.node("Object", t, { pairs });
  }

  parseBlockExpression() {
    const t = this.expectOp("{");
    const body = [];
    while (!this.isOp("}") && !this.is("eof")) body.push(this.parseBlockItem());
    this.expectOp("}");
    return this.node("BlockExpr", t, { body });
  }
}

function isLValue(node) {
  return node.type === "Identifier" || node.type === "Member" ||
    node.type === "Index" || node.type === "Namespace";
}

export function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens).parseProgram();
}
