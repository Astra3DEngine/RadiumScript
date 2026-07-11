// RadiumScript lexer / tokenizer.
// Produces a flat list of tokens with { type, value, line, col }.

export const KEYWORDS = new Set([
  "var", "const", "def", "return", "if", "else", "switch", "case", "default",
  "while", "do", "break", "continue", "class", "private", "public", "this",
  "namespace", "import", "as", "export", "true", "false", "NULL", "INF", "NaN",
]);

// Multi-character operators, longest first so greedy matching wins.
const OPERATORS = [
  "**", "++", "--", "==", "!=", ">=", "<=", "&&", "||", "::",
  "+", "-", "*", "/", "%", ">", "<", "=", "!", ".", ",", ";",
  "(", ")", "[", "]", "{", "}", ":",
];

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  const isDigit = (c) => c >= "0" && c <= "9";
  const isIdentStart = (c) => /[A-Za-z_]/.test(c);
  const isIdentPart = (c) => /[A-Za-z0-9_]/.test(c);

  function push(type, value, sLine, sCol) {
    tokens.push({ type, value, line: sLine, col: sCol });
  }

  function readEscape() {
    // assumes src[i] === '\\' and i+1 is the escape char
    const c = src[i + 1];
    if (c === undefined) return "\\";
    let out;
    switch (c) {
      case "n": out = "\n"; break;
      case "r": out = "\r"; break;
      case "t": out = "\t"; break;
      case "b": out = "\b"; break;
      case "f": out = "\f"; break;
      case "v": out = "\v"; break;
      case "0": out = "\0"; break;
      case "\\": out = "\\"; break;
      case '"': out = '"'; break;
      case "'": out = "'"; break;
      case "`": out = "`"; break;
      case "d": out = "$"; break; // \d -> $ (per docs: "special" escape)
      default: out = c; break;
    }
    i += 2;
    col += 2;
    return out;
  }

  while (i < n) {
    const c = src[i];

    // newline
    if (c === "\n") { i++; line++; col = 1; continue; }
    if (c === "\r") { i++; if (src[i] === "\n") i++; line++; col = 1; continue; }

    // whitespace
    if (c === " " || c === "\t" || c === "\f" || c === "\v") { i++; col++; continue; }

    // line comment
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") { i++; col++; }
      continue;
    }

    // string
    if (c === '"') {
      const sLine = line, sCol = col;
      i++; col++;
      let str = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\") {
          str += readEscape();
          continue;
        }
        if (src[i] === "\n") { str += "\n"; i++; line++; col = 1; continue; }
        str += src[i]; i++; col++;
      }
      if (i >= n) throw new SyntaxError(`Unterminated string at line ${sLine}:${sCol}`);
      i++; col++; // closing quote
      push("string", str, sLine, sCol);
      continue;
    }

    // number
    if (isDigit(c)) {
      const sLine = line, sCol = col;
      let num = "";
      while (i < n && isDigit(src[i])) { num += src[i]; i++; col++; }
      let isFloat = false;
      if (src[i] === "." && isDigit(src[i + 1])) {
        isFloat = true;
        num += "."; i++; col++;
        while (i < n && isDigit(src[i])) { num += src[i]; i++; col++; }
      }
      push("number", isFloat ? parseFloat(num) : parseInt(num, 10), sLine, sCol);
      continue;
    }

    // identifier / keyword
    if (isIdentStart(c)) {
      const sLine = line, sCol = col;
      let id = "";
      while (i < n && isIdentPart(src[i])) { id += src[i]; i++; col++; }
      if (KEYWORDS.has(id)) {
        push("keyword", id, sLine, sCol);
      } else {
        push("identifier", id, sLine, sCol);
      }
      continue;
    }

    // operators / punctuation
    let matched = false;
    for (const op of OPERATORS) {
      if (src.startsWith(op, i)) {
        const sLine = line, sCol = col;
        push("op", op, sLine, sCol);
        i += op.length;
        col += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    throw new SyntaxError(`Unexpected character '${c}' at line ${line}:${col}`);
  }

  push("eof", null, line, col);
  return tokens;
}
