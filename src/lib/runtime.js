// RadiumScript runtime: value model, helpers, builtins and standard libraries.

// ---- value classes ----
export class RSObject {
  constructor(pairs = []) { this.members = new Map(pairs); }
}
export class RSClass {
  constructor(name, priv, pub) {
    this.name = name;
    this.private = priv;
    this.public = pub;
    this.memberFlags = new Map(); // name -> { private:bool }
    for (const m of priv) if (m.name) this.memberFlags.set(m.name, { private: true });
    for (const m of pub) if (m.name) this.memberFlags.set(m.name, { private: false });
  }
}
export class RSInstance {
  constructor(klass) { this.klass = klass; this.members = new Map(); }
}
export class RSFunction {
  constructor(o) { Object.assign(this, o); } // name, params, body, closure, defClass
}
export class RSModule {
  constructor(name, exports) { this.name = name; this.exports = exports; } // exports: Map
}
export class RSNamespace {
  constructor(scope) { this.scope = scope; }
}
export class RSConstCell {
  constructor(value) { this.value = value; this.const = true; }
}

// ---- control-flow signals ----
export class ReturnSignal { constructor(value) { this.value = value; } }
export class BreakSignal { constructor(label = null) { this.label = label; } }
export class ContinueSignal { constructor(label = null) { this.label = label; } }
export class HaltSignal { constructor(code = 0) { this.code = code; } }
export class RSRuntimeError extends Error {}

// ---- type helpers ----
export const isNull = (v) => v === null;
export const isNumber = (v) => typeof v === "number";
export const isBool = (v) => typeof v === "boolean";
export const isString = (v) => typeof v === "string";
export const isList = (v) => Array.isArray(v);
export const isObject = (v) => v instanceof RSObject;
export const isInstance = (v) => v instanceof RSInstance;
export const isRSFunction = (v) => v instanceof RSFunction;
export const isCallable = (v) => v instanceof RSFunction || typeof v === "function";
export const isModule = (v) => v instanceof RSModule;
export const isNamespace = (v) => v instanceof RSNamespace;

export function typeOf(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return "list";
  if (v instanceof RSObject) return "object";
  if (v instanceof RSInstance) return v.klass ? v.klass.name : "instance";
  if (v instanceof RSFunction || typeof v === "function") return "function";
  return "null";
}

// convert any value to a number (NaN if impossible)
export function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return 0;
    const n = Number(s);
    return n;
  }
  return NaN;
}

export function isNumericConvertible(v) {
  if (typeof v === "number" || typeof v === "boolean" || v === null) return true;
  if (typeof v === "string") { const s = v.trim(); return s !== "" && !Number.isNaN(Number(s)); }
  return false;
}

export function truthy(v) {
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return !Number.isNaN(v) && v !== 0;
  if (typeof v === "string") return v !== "";
  if (Array.isArray(v)) return true;        // lists are always truthy
  if (v instanceof RSObject) return true;   // objects always truthy
  return true;
}

// string representation for printing / string conversion
export function toStr(v) {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "NaN";
    if (v === Infinity) return "INF";
    if (v === -Infinity) return "-INF";
    return String(v);
  }
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return "[" + v.map((x) => (typeof x === "string" ? '"' + x + '"' : toStr(x))).join(", ") + "]";
  if (v instanceof RSObject) {
    const entries = [...v.members.entries()];
    return "{" + entries.map(([k, x]) => k + ": " + (typeof x === "string" ? '"' + x + '"' : toStr(x))).join(", ") + "}";
  }
  if (v instanceof RSInstance) return `<instance of ${v.klass ? v.klass.name : "?"}>`;
  if (v instanceof RSFunction) return `<function ${v.name ?? ""}>`;
  if (typeof v === "function") return `<builtin>`;
  return String(v);
}

// display used by print (same as toStr for now)
export const display = toStr;

// conversions
export function toInt(v) {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  if (typeof v === "string") { const n = Number(v.trim()); return Number.isNaN(n) ? NaN : Math.trunc(n); }
  return NaN;
}
export function toFloat(v) { return toNumber(v); }
export function toBool(v) { return truthy(v); }

// strict equality
export function rsEqual(a, b) {
  // different runtime classes
  if (typeof a !== typeof b) {
    // both numbers/booleans handled by typeof, but boolean vs number differ
    return false;
  }
  if (typeof a === "number") {
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return a === b;
  }
  if (typeof a === "string" || typeof a === "boolean") return a === b;
  if (a === null && b === null) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a === b;     // reference
  if (a instanceof RSObject && b instanceof RSObject) return a === b;
  if (a instanceof RSInstance && b instanceof RSInstance) return a === b;
  return a === b;
}

// ---- printf rule engine ----
function applyPrintfRule(content, rule) {
  const s = toStr(content);
  if (typeof rule !== "string") return s;
  const m = rule.match(/^%([bf])(\d+)$/) || rule.match(/^%(n)(h)?$/);
  if (!m) return s;
  const [, kind, n] = m;
  if (kind === "b") {
    const digits = parseInt(n, 10);
    const num = toNumber(content);
    if (Number.isNaN(num)) return "NaN";
    return num.toPrecision(digits);
  }
  if (kind === "f") {
    const digits = parseInt(n, 10);
    const num = toNumber(content);
    if (Number.isNaN(num)) return "NaN";
    return num.toFixed(digits);
  }
  if (kind === "n") {
    const hex = m[2] === "h";
    let out = "";
    for (const ch of s) {
      const code = ch.codePointAt(0);
      out += hex ? code.toString(16) : String(code);
    }
    return out;
  }
  return s;
}

// ---- scope ----
export class Scope {
  constructor(parent = null) { this.vars = new Map(); this.parent = parent; }
  declare(name, value, isConst = false) {
    this.vars.set(name, { value, const: isConst });
  }
  // declare/overwrite strictly in THIS scope (var shadows parent scope)
  declareLocal(name, value, isConst = false) {
    if (this.vars.has(name)) { this.vars.get(name).value = value; return; }
    this.vars.set(name, { value, const: isConst });
  }
  localCell(name) { return this.vars.has(name) ? this.vars.get(name) : null; }
  has(name) {
    let s = this;
    while (s) { if (s.vars.has(name)) return true; s = s.parent; }
    return false;
  }
  get(name) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) return s.vars.get(name).value;
      s = s.parent;
    }
    return undefined;
  }
  getCell(name) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) return s.vars.get(name);
      s = s.parent;
    }
    return null;
  }
  set(name, value) {
    let s = this;
    while (s) {
      if (s.vars.has(name)) {
        const cell = s.vars.get(name);
        if (cell.const) throw new RSRuntimeError(`Cannot reassign constant '${name}'`);
        cell.value = value;
        return true;
      }
      s = s.parent;
    }
    return false;
  }
  child() { return new Scope(this); }
}

// ---- builtins & libraries factory ----
export function createBuiltins(ctx) {
  const print = (...args) => {
    if (args.length === 0) { ctx.emit("\n"); return null; }
    if (args.length === 1) { ctx.emit(toStr(args[0]) + "\n"); return null; }
    // >=2: all but last are contents joined by "", last is the end char
    const end = args[args.length - 1];
    const body = args.slice(0, -1).map(toStr).join("");
    ctx.emit(body + toStr(end));
    return null;
  };

  const printf = (content, rule) => { ctx.emit(applyPrintfRule(content, rule)); return null; };

  const input = (prompt) => {
    if (prompt !== undefined && prompt !== null) ctx.emit(toStr(prompt));
    const line = ctx.readInput();
    return autoType(line);
  };
  input.fill = null; // handled as method

  const type = (v) => typeOf(v);

  const intF = (v) => toInt(v);
  const floatF = (v) => toFloat(v);
  const boolF = (v) => toBool(v);
  const stringF = (v) => toStr(v);

  const globals = {
    print, printf, input, type,
    int: intF, float: floatF, bool: boolF, string: stringF,
  };

  // math library (trig in degrees, per docs example; results rounded to kill FP noise)
  const trig = (f, x) => {
    const v = f(toNumber(x) * Math.PI / 180);
    return Math.round(v * 1e12) / 1e12;
  };
  const math = {
    pi: Math.PI,
    sin: (x) => trig(Math.sin, x),
    cos: (x) => trig(Math.cos, x),
    tan: (x) => trig(Math.tan, x),
    sqrt: (x) => Math.sqrt(toNumber(x)),
    abs: (x) => Math.abs(toNumber(x)),
    floor: (x) => Math.floor(toNumber(x)),
    ceil: (x) => Math.ceil(toNumber(x)),
    round: (x) => Math.round(toNumber(x)),
  };

  const sys = {
    time: () => Date.now(),
    exit: (code = 0) => { throw new HaltSignal(code); },
    argv: [],
  };

  const fs = {
    readText: () => { throw new RSRuntimeError("fs is not available in the sandbox"); },
    writeText: () => { throw new RSRuntimeError("fs is not available in the sandbox"); },
    exists: () => false,
  };

  const stringLib = {
    split: (s, sep) => toStr(s).split(toStr(sep)),
    join: (list, sep) => (Array.isArray(list) ? list.map(toStr).join(toStr(sep)) : toStr(list)),
    contains: (s, sub) => toStr(s).includes(toStr(sub)),
    replace: (s, a, b) => toStr(s).split(toStr(a)).join(toStr(b)),
  };

  const modules = { math, sys, fs, string: stringLib };
  return { globals, modules };
}

function autoType(line) {
  if (line === null || line === undefined) return null;
  const s = String(line);
  const trimmed = s.trim();
  if (trimmed === "NULL") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "INF") return Infinity;
  if (trimmed === "NaN") return NaN;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d*\.\d+$/.test(trimmed) || /^-?\d+\.\d*$/.test(trimmed)) return parseFloat(trimmed);
  return s;
}
