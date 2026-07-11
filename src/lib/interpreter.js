// RadiumScript interpreter: generator-based evaluator.
// Each statement yields a {kind:"step", node, line, col} event before executing,
// enabling single-stepping for the playground. Control flow uses signals.

import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import {
  RSObject, RSClass, RSInstance, RSFunction, RSModule, RSNamespace,
  ReturnSignal, BreakSignal, ContinueSignal, HaltSignal, RSRuntimeError,
  Scope, createBuiltins,
  isNull, isNumber, isBool, isString, isList, isObject, isInstance, isRSFunction, isCallable, isModule, isNamespace,
  typeOf, toNumber, toInt, toFloat, toBool, truthy, toStr, display, rsEqual, isNumericConvertible,
} from "./runtime.js";

const NULL = null;
const INF = Infinity;

// ---------- context ----------
export function makeContext(opts = {}) {
  return {
    out: "",
    inputLines: Array.isArray(opts.inputLines) ? [...opts.inputLines] : [],
    inputIdx: 0,
    callDepth: 0,
    maxDepth: opts.maxDepth ?? 1024,
    maxSteps: opts.maxSteps ?? 1000000,
    steps: 0,
    thisStack: [],
    exports: new Map(),
    onOutput: opts.onOutput ?? null,
    emit(s) { this.out += s; if (this.onOutput) this.onOutput(s); },
    readInput() {
      if (this.inputIdx < this.inputLines.length) return this.inputLines[this.inputIdx++];
      return "";
    },
  };
}

export function createGlobalScope(ctx) {
  const { globals, modules } = createBuiltins(ctx);
  const scope = new Scope(null);
  for (const [name, val] of Object.entries(globals)) scope.declare(name, val);
  // stash modules for import resolution
  scope.__modules = modules;
  return scope;
}

function moduleMap(modObj) {
  const m = new Map();
  for (const [k, v] of Object.entries(modObj)) m.set(k, v);
  return m;
}

// ---------- value operations (pure, no stepping) ----------
function applyBinary(op, l, r) {
  switch (op) {
    case "+":
      if (isList(l) && isList(r)) return l.concat(r);
      if (isString(l) || isString(r)) return toStr(l) + toStr(r);
      return toNumber(l) + toNumber(r);
    case "-": return toNumber(l) - toNumber(r);
    case "*": return toNumber(l) * toNumber(r);
    case "/": {
      const a = toNumber(l), b = toNumber(r);
      if (b === 0) {
        if (Number.isNaN(a) || a === 0) return NaN;
        return a > 0 ? Infinity : -Infinity;
      }
      return a / b;
    }
    case "%": {
      const a = toNumber(l), b = toNumber(r);
      if (b === 0) return NaN;
      return a % b;
    }
    case "**": return Math.pow(toNumber(l), toNumber(r));
    case "==": return rsEqual(l, r);
    case "!=": return !rsEqual(l, r);
    case ">": case "<": case ">=": case "<=": return compare(op, l, r);
    default: throw new RSRuntimeError(`Unknown operator '${op}'`);
  }
}

function compare(op, l, r) {
  let a, b, numeric;
  if (isNumericConvertible(l) && isNumericConvertible(r)) {
    a = toNumber(l); b = toNumber(r);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    numeric = true;
  } else {
    a = toStr(l); b = toStr(r); numeric = false;
  }
  switch (op) {
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
  }
}

function getMember(obj, prop, ctx) {
  if (isInstance(obj)) {
    const klass = obj.klass;
    const cell = obj.members.get(prop);
    if (cell === undefined) return NULL;
    const flag = klass && klass.memberFlags ? klass.memberFlags.get(prop) : null;
    const top = ctx.thisStack[ctx.thisStack.length - 1];
    const curKlass = top ? top.klass : null;
    if (flag && flag.private && curKlass !== klass) {
      throw new RSRuntimeError(`Cannot access private member '${prop}'`);
    }
    return cell.value !== undefined ? cell.value : cell;
  }
  if (isObject(obj)) return obj.members.has(prop) ? obj.members.get(prop) : NULL;
  if (isModule(obj)) {
    if (obj.exports.has(prop)) return obj.exports.get(prop);
    throw new RSRuntimeError(`Module '${obj.name}' has no member '${prop}'`);
  }
  if (isNamespace(obj)) {
    if (!obj.scope.has(prop)) throw new RSRuntimeError(`Namespace has no member '${prop}'`);
    return obj.scope.get(prop);
  }
  // numbers/strings/bool/null: no bare member access
  return NULL;
}

function setMember(obj, prop, value, ctx) {
  if (isObject(obj)) { obj.members.set(prop, value); return; }
  if (isInstance(obj)) {
    const klass = obj.klass;
    const flag = klass && klass.memberFlags ? klass.memberFlags.get(prop) : null;
    const top = ctx.thisStack[ctx.thisStack.length - 1];
    const curKlass = top ? top.klass : null;
    if (flag && flag.private && curKlass !== klass) {
      throw new RSRuntimeError(`Cannot assign private member '${prop}'`);
    }
    if (!obj.members.has(prop)) throw new RSRuntimeError(`Instance has no member '${prop}'`);
    obj.members.set(prop, value);
    return;
  }
  throw new RSRuntimeError(`Cannot set member '${prop}' on this value`);
}

function getIndex(obj, idx) {
  if (isList(obj)) {
    let i = toInt(idx);
    const len = obj.length;
    if (i < 0) i = len + i;
    if (i < 0 || i >= len) return NULL;
    return obj[i];
  }
  if (isString(obj)) {
    let i = toInt(idx);
    const len = obj.length;
    if (i < 0) i = len + i;
    if (i < 0 || i >= len) return NULL;
    return obj[i];
  }
  if (isObject(obj)) return obj.members.has(toStr(idx)) ? obj.members.get(toStr(idx)) : NULL;
  if (isInstance(obj)) return obj.members.has(toStr(idx)) ? obj.members.get(toStr(idx)) : NULL;
  // numbers/bool/null treated as string for indexing
  const s = toStr(obj);
  let i = toInt(idx);
  if (i < 0) i = s.length + i;
  if (i < 0 || i >= s.length) return NULL;
  return s[i];
}

function setIndex(obj, idx, value) {
  if (isList(obj)) {
    let i = toInt(idx);
    const len = obj.length;
    if (i < 0) i = len + i;
    if (i === len) { obj.push(value); return; }
    if (i < 0 || i > len) throw new RSRuntimeError(`List index ${i} out of range`);
    obj[i] = value;
    return;
  }
  if (isObject(obj)) { obj.members.set(toStr(idx), value); return; }
  throw new RSRuntimeError(`Cannot index-assign this value`);
}

function listMethod(list, name, args, ctx) {
  switch (name) {
    case "len": return list.length;
    case "sum": return list.reduce((a, x) => a + toNumber(x), 0);
    case "in": return list.some((x) => rsEqual(x, args[0]));
    case "lin": return list.map(toStr).join(args[0] !== undefined ? toStr(args[0]) : "");
    case "push": list.push(args[0]); return NULL;
    case "remove": list.splice(toInt(args[0]), 1); return NULL;
    case "insert": list.splice(toInt(args[0]), 0, args[1]); return NULL;
    case "clear": list.length = 0; return NULL;
    default: throw new RSRuntimeError(`List has no method '${name}'`);
  }
}

function stringMethod(str, name, args) {
  switch (name) {
    case "len": return str.length;
    case "fill": {
      const list = args[0];
      const sep = args[1] !== undefined ? toStr(args[1]) : " ";
      if (!isList(list)) throw new RSRuntimeError("fill expects a list");
      list.length = 0;
      for (const part of str.split(sep)) list.push(autoTypeStr(part));
      return NULL;
    }
    case "sfill": {
      const list = args[0];
      if (!isList(list)) throw new RSRuntimeError("sfill expects a list");
      list.length = 0;
      for (const ch of str) list.push(ch);
      return NULL;
    }
    default: throw new RSRuntimeError(`String has no method '${name}'`);
  }
}

function autoTypeStr(s) {
  const t = String(s).trim();
  if (t === "NULL") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "INF") return Infinity;
  if (t === "NaN") return NaN;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d*\.\d+$/.test(t) || /^-?\d+\.\d*$/.test(t)) return parseFloat(t);
  return s;
}

// ---------- evaluator (generators) ----------
function* evalBlockItem(node, scope, ctx) {
  switch (node.type) {
    case "FunctionDecl": return yield* evalFunctionDecl(node, scope, ctx);
    case "ClassDecl": return yield* evalClassDecl(node, scope, ctx);
    case "NamespaceDecl": return yield* evalNamespaceDecl(node, scope, ctx);
    case "Import": return evalImport(node, scope, ctx);
    case "Export": evalExport(node, scope, ctx); return null;
    default: return yield* evalStatement(node, scope, ctx);
  }
}

function* evalFunctionDecl(node, scope, ctx) {
  const fn = new RSFunction({
    name: node.name,
    params: node.params,
    body: node.body,
    closure: scope,
    defClass: null,
  });
  scope.declareLocal(node.name, fn);
  return null;
}

function* evalClassDecl(node, scope, ctx) {
  const klass = new RSClass(node.name, node.private, node.public);
  klass.closure = scope;
  scope.declareLocal(node.name, klass);
  return null;
}

function* evalNamespaceDecl(node, scope, ctx) {
  const nsScope = scope.child();
  yield* evalBlockBody(node.body.body, nsScope, ctx);
  scope.declareLocal(node.name, new RSNamespace(nsScope));
  return null;
}

function evalImport(node, scope, ctx) {
  const modules = scope.__modules || {};
  let modObj = null;
  if (!node.isFile && modules[node.source]) modObj = modules[node.source];
  if (!modObj && node.isFile) throw new RSRuntimeError(`File imports are not supported in the sandbox ('${node.source}')`);
  if (!modObj) throw new RSRuntimeError(`Unknown library '${node.source}'`);
  const name = node.alias || node.source;
  const mod = new RSModule(node.source, moduleMap(modObj));
  scope.declareLocal(name, mod);
  return null;
}

function evalExport(node, scope, ctx) {
  if (scope.has(node.name)) ctx.exports.set(node.name, scope.get(node.name));
  return null;
}

function* evalStatement(node, scope, ctx) {
  yield { kind: "step", node, line: node.line, col: node.col };
  switch (node.type) {
    case "Block": return yield* evalBlock(node, scope, ctx);
    case "VarDecl": return yield* evalVarDecl(node, scope, ctx);
    case "ExprStmt": { yield* evalExpr(node.expr, scope, ctx); return null; }
    case "If": return yield* evalIf(node, scope, ctx);
    case "Switch": return yield* evalSwitch(node, scope, ctx);
    case "While": return yield* evalWhile(node, scope, ctx);
    case "DoWhile": return yield* evalDoWhile(node, scope, ctx);
    case "Return": return yield* evalReturn(node, scope, ctx);
    case "Break": return yield* evalBreak(node, scope, ctx);
    case "Continue": return yield* evalContinue(node, scope, ctx);
    case "Labeled": return yield* evalLabeled(node, scope, ctx);
    default: throw new RSRuntimeError(`Unknown statement type '${node.type}'`);
  }
}

function* evalBlock(node, scope, ctx) {
  // OPAQUE block: catches unlabeled break; child scope.
  const blkScope = scope.child();
  try {
    yield* evalBlockBody(node.body, blkScope, ctx);
  } catch (e) {
    if (e instanceof BreakSignal && e.label === null) return null;
    throw e;
  }
  return null;
}

function* evalBlockBody(items, scope, ctx) {
  // TRANSPARENT runner: no catching. Used by loop/case/function bodies.
  for (const it of items) yield* evalBlockItem(it, scope, ctx);
  return null;
}

function* evalVarDecl(node, scope, ctx) {
  let val = NULL;
  if (node.value !== null) val = yield* evalExpr(node.value, scope, ctx);
  scope.declareLocal(node.name, val, node.const);
  return null;
}

function* evalIf(node, scope, ctx) {
  if (truthy(yield* evalExpr(node.test, scope, ctx))) {
    yield* evalBlock(node.then, scope, ctx);
  } else if (node.alt) {
    if (node.alt.type === "If") yield* evalStatement(node.alt, scope, ctx);
    else yield* evalBlock(node.alt, scope, ctx);
  }
  return null;
}

function* evalSwitch(node, scope, ctx) {
  const disc = yield* evalExpr(node.discriminant, scope, ctx);
  let start = -1;
  for (let i = 0; i < node.clauses.length; i++) {
    const c = node.clauses[i];
    if (c.isDefault) continue;
    const cv = yield* evalExpr(c.test, scope, ctx);
    if (rsEqual(disc, cv)) { start = i; break; }
  }
  if (start === -1) {
    for (let i = 0; i < node.clauses.length; i++) if (node.clauses[i].isDefault) { start = i; break; }
  }
  if (start === -1) return null;
  try {
    for (let i = start; i < node.clauses.length; i++) {
      yield* evalBlockBody(node.clauses[i].body.body, scope.child(), ctx);
    }
  } catch (e) {
    if (e instanceof BreakSignal && (e.label === null || e.label === node.label)) return null;
    throw e;
  }
  return null;
}

function* evalWhile(node, scope, ctx) {
  while (truthy(yield* evalExpr(node.test, scope, ctx))) {
    const iterScope = scope.child();
    try {
      yield* evalBlockBody(node.body.body, iterScope, ctx);
    } catch (e) {
      if (e instanceof BreakSignal) {
        if (e.label === null || e.label === node.label) break;
        throw e;
      }
      if (e instanceof ContinueSignal) {
        if (e.label === null || e.label === node.label) continue;
        throw e;
      }
      throw e;
    }
  }
  return null;
}

function* evalDoWhile(node, scope, ctx) {
  while (true) {
    const iterScope = scope.child();
    try {
      yield* evalBlockBody(node.body.body, iterScope, ctx);
    } catch (e) {
      if (e instanceof BreakSignal) {
        if (e.label === null || e.label === node.label) break;
        throw e;
      }
      if (e instanceof ContinueSignal) {
        if (e.label === null || e.label === node.label) { /* fall to test */ }
        else throw e;
      } else throw e;
    }
    if (!truthy(yield* evalExpr(node.test, scope, ctx))) break;
  }
  return null;
}

function* evalReturn(node, scope, ctx) {
  const v = node.value ? yield* evalExpr(node.value, scope, ctx) : NULL;
  throw new ReturnSignal(v);
}

function* evalBreak(node, scope, ctx) {
  let doit = true;
  if (node.cond) doit = truthy(yield* evalExpr(node.cond, scope, ctx));
  if (doit) throw new BreakSignal(node.label);
  return null;
}

function* evalContinue(node, scope, ctx) {
  let doit = true;
  if (node.cond) doit = truthy(yield* evalExpr(node.cond, scope, ctx));
  if (doit) throw new ContinueSignal(node.label);
  return null;
}

function* evalLabeled(node, scope, ctx) {
  try {
    yield* evalStatement(node.body, scope, ctx);
  } catch (e) {
    if (e instanceof BreakSignal && e.label === node.label) return null;
    throw e;
  }
  return null;
}

// ---------- expressions ----------
function* evalExpr(node, scope, ctx) {
  switch (node.type) {
    case "Literal": return node.value;
    case "Identifier": return evalIdentifier(node, scope, ctx);
    case "This": return evalThis(node, ctx);
    case "List": return yield* evalList(node, scope, ctx);
    case "Object": return yield* evalObject(node, scope, ctx);
    case "BlockExpr": return yield* evalBlockExpr(node, scope, ctx);
    case "Unary": return yield* evalUnary(node, scope, ctx);
    case "Binary": return yield* evalBinary(node, scope, ctx);
    case "Logical": return yield* evalLogical(node, scope, ctx);
    case "Ternary": return yield* evalTernary(node, scope, ctx);
    case "AssignExpr": return yield* evalAssign(node, scope, ctx);
    case "Call": return yield* evalCall(node, scope, ctx);
    case "Member": {
      const obj = yield* evalExpr(node.object, scope, ctx);
      return getMember(obj, node.property, ctx);
    }
    case "Namespace": return yield* evalNamespace(node, scope, ctx);
    case "Index": {
      const obj = yield* evalExpr(node.object, scope, ctx);
      const idx = yield* evalExpr(node.index, scope, ctx);
      return getIndex(obj, idx);
    }
    case "Postfix": return yield* evalPostfix(node, scope, ctx);
    default: throw new RSRuntimeError(`Unknown expression type '${node.type}'`);
  }
}

function evalIdentifier(node, scope, ctx) {
  if (!scope.has(node.name)) throw new RSRuntimeError(`Undefined variable '${node.name}'`);
  return scope.get(node.name);
}

function evalThis(node, ctx) {
  const top = ctx.thisStack[ctx.thisStack.length - 1];
  if (!top) throw new RSRuntimeError("'this' used outside a method");
  return top.instance;
}

function* evalList(node, scope, ctx) {
  const arr = [];
  for (const e of node.elements) arr.push(yield* evalExpr(e, scope, ctx));
  return arr;
}

function* evalObject(node, scope, ctx) {
  const obj = new RSObject();
  for (const p of node.pairs) obj.members.set(p.key, yield* evalExpr(p.value, scope, ctx));
  return obj;
}

function* evalBlockExpr(node, scope, ctx) {
  const blkScope = scope.child();
  let result = NULL;
  try {
    yield* evalBlockBody(node.body, blkScope, ctx);
  } catch (e) {
    if (e instanceof ReturnSignal) return e.value;
    if (e instanceof BreakSignal && e.label === null) return NULL;
    throw e;
  }
  return result;
}

function* evalUnary(node, scope, ctx) {
  const v = yield* evalExpr(node.operand, scope, ctx);
  if (node.op === "!") return !truthy(v);
  if (node.op === "-") return -toNumber(v);
  throw new RSRuntimeError(`Unknown unary '${node.op}'`);
}

function* evalBinary(node, scope, ctx) {
  const l = yield* evalExpr(node.left, scope, ctx);
  const r = yield* evalExpr(node.right, scope, ctx);
  return applyBinary(node.op, l, r);
}

function* evalLogical(node, scope, ctx) {
  const l = yield* evalExpr(node.left, scope, ctx);
  if (node.op === "&&") { if (!truthy(l)) return l; return yield* evalExpr(node.right, scope, ctx); }
  if (node.op === "||") { if (truthy(l)) return l; return yield* evalExpr(node.right, scope, ctx); }
  throw new RSRuntimeError(`Unknown logical '${node.op}'`);
}

function* evalTernary(node, scope, ctx) {
  const c = yield* evalExpr(node.test, scope, ctx);
  if (truthy(c)) return yield* evalExpr(node.cons, scope, ctx);
  return yield* evalExpr(node.alt, scope, ctx);
}

function* evalAssign(node, scope, ctx) {
  const v = yield* evalExpr(node.value, scope, ctx);
  yield* assignLValue(node.target, v, scope, ctx);
  return v;
}

function* assignLValue(target, value, scope, ctx) {
  switch (target.type) {
    case "Identifier":
      if (!scope.has(target.name)) throw new RSRuntimeError(`Assignment to undefined variable '${target.name}'`);
      scope.set(target.name, value);
      return null;
    case "Member": {
      const obj = yield* evalExpr(target.object, scope, ctx);
      setMember(obj, target.property, value, ctx);
      return null;
    }
    case "Index": {
      const obj = yield* evalExpr(target.object, scope, ctx);
      const idx = yield* evalExpr(target.index, scope, ctx);
      setIndex(obj, idx, value);
      return null;
    }
    case "Namespace": {
      const ns = yield* evalExpr(target.object, scope, ctx);
      if (!isNamespace(ns)) throw new RSRuntimeError("Namespace access target is not a namespace");
      if (!ns.scope.has(target.property)) ns.scope.declare(target.property, value);
      else ns.scope.set(target.property, value);
      return null;
    }
    default: throw new RSRuntimeError("Invalid assignment target");
  }
}

function* evalPostfix(node, scope, ctx) {
  const target = node.operand;
  let old;
  if (target.type === "Identifier") {
    if (!scope.has(target.name)) throw new RSRuntimeError(`Undefined variable '${target.name}'`);
    old = scope.get(target.name);
    scope.set(target.name, toNumber(old) + (node.op === "++" ? 1 : -1));
  } else if (target.type === "Member" || target.type === "Index" || target.type === "Namespace") {
    const obj = yield* evalExpr(target.object, scope, ctx);
    let cur;
    if (target.type === "Member") cur = getMember(obj, target.property, ctx);
    else if (target.type === "Index") cur = getIndex(obj, yield* evalExpr(target.index, scope, ctx));
    else { const ns = obj; cur = ns.scope.get(target.property); }
    old = cur;
    const nv = toNumber(cur) + (node.op === "++" ? 1 : -1);
    if (target.type === "Member") setMember(obj, target.property, nv, ctx);
    else if (target.type === "Index") setIndex(obj, yield* evalExpr(target.index, scope, ctx), nv);
    else { const ns = obj; if (!ns.scope.has(target.property)) ns.scope.declare(target.property, nv); else ns.scope.set(target.property, nv); }
  } else {
    throw new RSRuntimeError("Invalid postfix target");
  }
  return old;
}

function* evalNamespace(node, scope, ctx) {
  const ns = yield* evalExpr(node.object, scope, ctx);
  if (!isNamespace(ns)) throw new RSRuntimeError(" '::' target is not a namespace");
  if (!ns.scope.has(node.property)) throw new RSRuntimeError(`Namespace has no member '${node.property}'`);
  return ns.scope.get(node.property);
}

function* evalCall(node, scope, ctx) {
  const callee = node.callee;
  if (callee.type === "Member") {
    const obj = yield* evalExpr(callee.object, scope, ctx);
    const args = [];
    for (const a of node.args) args.push(yield* evalExpr(a, scope, ctx));
    return yield* callMethod(obj, callee.property, args, scope, ctx);
  }
  if (callee.type === "Namespace") {
    const ns = yield* evalExpr(callee.object, scope, ctx);
    if (!isNamespace(ns)) throw new RSRuntimeError(" '::' target is not a namespace");
    if (!ns.scope.has(callee.property)) throw new RSRuntimeError(`Namespace has no member '${callee.property}'`);
    const fn = ns.scope.get(callee.property);
    const args = [];
    for (const a of node.args) args.push(yield* evalExpr(a, scope, ctx));
    return yield* callValue(fn, args, ctx);
  }
  const fn = yield* evalExpr(callee, scope, ctx);
  const args = [];
  for (const a of node.args) args.push(yield* evalExpr(a, scope, ctx));
  return yield* callValue(fn, args, ctx);
}

function* callValue(fn, args, ctx) {
  if (fn instanceof RSClass) return yield* instantiate(fn, args, ctx);
  if (fn instanceof RSFunction) return yield* callFunction(fn, args, null, null, ctx);
  if (typeof fn === "function") return fn(...args);
  throw new RSRuntimeError(`Value of type '${typeOf(fn)}' is not callable`);
}

function* callMethod(obj, name, args, scope, ctx) {
  if (isInstance(obj)) {
    if (!obj.members.has(name)) throw new RSRuntimeError(`Instance has no method '${name}'`);
    const fn = obj.members.get(name);
    const klass = obj.klass;
    const flag = klass && klass.memberFlags ? klass.memberFlags.get(name) : null;
    const top = ctx.thisStack[ctx.thisStack.length - 1];
    const curKlass = top ? top.klass : null;
    if (flag && flag.private && curKlass !== klass) throw new RSRuntimeError(`Cannot call private method '${name}'`);
    if (fn instanceof RSFunction) return yield* callFunction(fn, args, obj, klass, ctx);
    if (typeof fn === "function") return fn(...args);
    throw new RSRuntimeError(`Member '${name}' is not callable`);
  }
  if (isList(obj)) return listMethod(obj, name, args, ctx);
  if (isString(obj)) return stringMethod(obj, name, args);
  if (isNumber(obj) || isBool(obj) || isNull(obj)) {
    if (name === "len") return toStr(obj).length;
    throw new RSRuntimeError(`Value has no method '${name}'`);
  }
  if (isObject(obj)) {
    if (name === "len") return obj.members.size;
    if (obj.members.has(name)) {
      const fn = obj.members.get(name);
      if (typeof fn === "function") return fn(...args);
      throw new RSRuntimeError(`Member '${name}' is not callable`);
    }
    throw new RSRuntimeError(`Object has no method '${name}'`);
  }
  if (isModule(obj)) {
    if (!obj.exports.has(name)) throw new RSRuntimeError(`Module '${obj.name}' has no member '${name}'`);
    const fn = obj.exports.get(name);
    if (fn instanceof RSFunction) return yield* callFunction(fn, args, null, null, ctx);
    if (typeof fn === "function") return fn(...args);
    return fn; // plain value accessed as call? -> error
  }
  if (isNamespace(obj)) {
    if (!obj.scope.has(name)) throw new RSRuntimeError(`Namespace has no member '${name}'`);
    const fn = obj.scope.get(name);
    return yield* callValue(fn, args, ctx);
  }
  throw new RSRuntimeError(`Value of type '${typeOf(obj)}' has no method '${name}'`);
}

function* callFunction(fn, args, thisVal, classCtx, ctx) {
  if (fn.body === null) throw new RSRuntimeError(`Function '${fn.name}' is declared but not defined`);
  ctx.callDepth++;
  if (ctx.callDepth > ctx.maxDepth) {
    ctx.callDepth--;
    throw new RSRuntimeError("Maximum recursion depth exceeded (1024)");
  }
  const fnScope = fn.closure.child();
  for (let i = 0; i < fn.params.length; i++) {
    const p = fn.params[i];
    let val;
    if (i < args.length && args[i] !== undefined) val = args[i];
    else if (p.default !== null) val = yield* evalExpr(p.default, fn.closure, ctx);
    else val = NULL;
    fnScope.declare(p.name, val);
  }
  ctx.thisStack.push(thisVal ? { instance: thisVal, klass: classCtx } : null);
  let result = NULL;
  try {
    try {
      yield* evalBlockBody(fn.body.body, fnScope, ctx);
    } catch (e) {
      if (e instanceof ReturnSignal) { result = e.value; }
      else if (e instanceof BreakSignal && e.label === null) { result = NULL; }
      else throw e;
    }
  } finally {
    ctx.thisStack.pop();
    ctx.callDepth--;
  }
  return result;
}

function* instantiate(klass, args, ctx) {
  const inst = new RSInstance(klass);
  ctx.thisStack.push({ instance: inst, klass });
  try {
    for (const m of klass.private) yield* initMember(m, inst, klass, ctx);
    for (const m of klass.public) yield* initMember(m, inst, klass, ctx);
    if (inst.members.has("init")) {
      const initFn = inst.members.get("init");
      if (initFn instanceof RSFunction) {
        // call init as a method, but without increasing recursion guard issues
        ctx.callDepth++;
        try {
          const fnScope = initFn.closure.child();
          for (let i = 0; i < initFn.params.length; i++) {
            const p = initFn.params[i];
            let val = i < args.length ? args[i] : (p.default !== null ? (yield* evalExpr(p.default, initFn.closure, ctx)) : NULL);
            fnScope.declare(p.name, val);
          }
          try { yield* evalBlockBody(initFn.body.body, fnScope, ctx); }
          catch (e) { if (e instanceof ReturnSignal) { /* ignore */ } else if (e instanceof BreakSignal && e.label === null) { /* ignore */ } else throw e; }
        } finally { ctx.callDepth--; }
      }
    }
  } finally {
    ctx.thisStack.pop();
  }
  return inst;
}

function* initMember(m, inst, klass, ctx) {
  if (m.type === "VarDecl" || m.type === "ConstDecl") {
    let val = NULL;
    if (m.value !== null) val = yield* evalExpr(m.value, klass.closure, ctx);
    inst.members.set(m.name, val);
  } else if (m.type === "FunctionDecl") {
    const fn = new RSFunction({
      name: m.name,
      params: m.params,
      body: m.body,
      closure: klass.closure,
      defClass: klass,
    });
    inst.members.set(m.name, fn);
  }
}

// ---------- program entry ----------
function* runProgram(ast, ctx, globalScope) {
  try {
    yield* evalBlockBody(ast.body, globalScope, ctx);
  } catch (e) {
    if (e instanceof HaltSignal) return e.code;
    if (e instanceof ReturnSignal) return e.value;
    if (e instanceof BreakSignal || e instanceof ContinueSignal) {
      throw new RSRuntimeError(`${e.constructor.name.replace("Signal", "")} used outside a valid context`);
    }
    throw e;
  }
  return null;
}

// ---------- public runner (run to completion) ----------
export function run(source, opts = {}) {
  const ctx = makeContext(opts);
  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    return { output: "", error: e, result: null };
  }
  const globalScope = createGlobalScope(ctx);
  const gen = runProgram(ast, ctx, globalScope);
  let result = null;
  try {
    while (true) {
      const r = gen.next();
      if (r.done) { result = r.value; break; }
      ctx.steps++;
      if (ctx.steps > ctx.maxSteps) throw new RSRuntimeError("Step limit exceeded (possible infinite loop)");
    }
  } catch (e) {
    return { output: ctx.out, error: e, result: null };
  }
  return { output: ctx.out, error: null, result };
}

// ---------- public stepper ----------
export class Stepper {
  constructor(source, opts = {}) {
    this.source = source;
    this.opts = opts;
    this.reset();
  }
  reset() {
    this.ctx = makeContext(this.opts);
    try {
      this.ast = parse(this.source);
      this.parseError = null;
    } catch (e) {
      this.ast = null;
      this.parseError = e;
    }
    this.globalScope = this.ast ? createGlobalScope(this.ctx) : null;
    this.gen = this.ast ? runProgram(this.ast, this.ctx, this.globalScope) : null;
    this.done = !this.gen;
    this.current = null;
    this.error = this.parseError;
    this.steps = 0;
  }
  next() {
    if (this.parseError) return { done: true, error: this.parseError, output: this.ctx.out };
    if (this.done) return { done: true, output: this.ctx.out, error: this.error };
    let r;
    try {
      r = this.gen.next();
    } catch (e) {
      this.done = true;
      this.error = e;
      return { done: true, output: this.ctx.out, error: e };
    }
    if (r.done) {
      this.done = true;
      this.current = null;
      return { done: true, output: this.ctx.out, error: null, result: r.value };
    }
    this.current = r.value;
    this.steps++;
    this.ctx.steps++;
    if (this.ctx.steps > this.ctx.maxSteps) {
      this.done = true;
      this.error = new RSRuntimeError("Step limit exceeded (possible infinite loop)");
      return { done: true, output: this.ctx.out, error: this.error };
    }
    return { done: false, step: r.value, output: this.ctx.out, error: null };
  }
  runToEnd() {
    while (!this.done) {
      const r = this.next();
      if (r.done) return r;
    }
    return { done: true, output: this.ctx.out, error: this.error };
  }
}

export { tokenize, parse };
export const version = "0.1.0";
