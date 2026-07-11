// CodeMirror 6 setup for RadiumScript: language tokens, completion, step-line highlight.
import { StreamLanguage, LanguageSupport, bracketMatching } from "@codemirror/language";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { EditorView, Decoration, lineNumbers, highlightActiveLineGutter, highlightActiveLine,
  highlightSpecialChars, drawSelection, rectangularSelection, crosshairCursor, keymap } from "@codemirror/view";
import { EditorState, StateEffect, StateField, Compartment } from "@codemirror/state";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

// ---- token tables ----
const KEYWORDS = [
  "var", "const", "def", "return", "if", "else", "switch", "case", "default",
  "while", "do", "break", "continue", "class", "private", "public", "this",
  "namespace", "import", "as", "export",
];
const CONSTANTS = ["true", "false", "NULL", "INF", "NaN"];
const BUILTINS = ["print", "printf", "input", "type", "int", "float", "bool", "string"];
const LIBS = ["math", "sys", "fs", "string"];
const LIB_MEMBERS = {
  math: ["pi", "sin", "cos", "tan", "sqrt", "abs", "floor", "ceil", "round"],
  sys: ["time", "exit", "argv"],
  fs: ["readText", "writeText", "exists"],
  string: ["split", "join", "contains", "replace"],
};
const LIST_METHODS = ["len", "sum", "in", "lin", "push", "remove", "insert", "clear"];
const STRING_METHODS = ["len", "fill", "sfill"];

const KEYWORD_RE = KEYWORDS.join("|");
const CONST_RE = CONSTANTS.join("|");

// ---- RS stream language ----
const rsStream = {
  name: "radiumscript",
  startState() { return {}; },
  copyState(s) { return s; },
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match("//")) { stream.skipToEnd(); return "comment"; }
    if (stream.match('"')) {
      while (!stream.eol()) {
        const c = stream.next();
        if (c === '"') break;
        if (c === "\\" && !stream.eol()) stream.next();
      }
      return "string";
    }
    if (stream.match(/\d/)) {
      stream.eatWhile(/\d/);
      if (stream.peek() === ".") { stream.next(); stream.eatWhile(/\d/); }
      return "number";
    }
    if (stream.match(new RegExp("^(" + CONST_RE + ")\\b"))) return "atom";
    if (stream.match(new RegExp("^(" + KEYWORD_RE + ")\\b"))) return "keyword";
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) return "variable";
    if (stream.match(/^(\*\*|\+\+|--|==|!=|>=|<=|&&|\|\||::)/)) return "operator";
    if (stream.match(/^[+\-*/%<>!=.,;(){}\[\]:]/)) return "operator";
    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: "//" },
    closeBrackets: { brackets: ["(", "[", "{", '"'] },
  },
};

export const rsLanguage = new LanguageSupport(StreamLanguage.define(rsStream));

// ---- completion ----
// user-defined names scanned from the buffer (updated by Editor on change)
let userNames = [];
const NAME_PATTERNS = [
  [/^\s*def\s+(\w+)\s*\(/gm, "function"],
  [/^\s*var\s+(\w+)/gm, "variable"],
  [/^\s*const\s+(\w+)/gm, "constant"],
  [/^\s*class\s+(\w+)/gm, "class"],
  [/^\s*namespace\s+(\w+)/gm, "namespace"],
];
export function refreshUserNames(code) {
  const set = new Map();
  for (const [re, type] of NAME_PATTERNS) {
    for (const m of code.matchAll(re)) {
      if (!KEYWORDS.includes(m[1]) && !CONSTANTS.includes(m[1])) set.set(m[1], type);
    }
  }
  userNames = [...set.entries()].map(([label, type]) => ({ label, type }));
}

function rsCompletion(context) {
  // module / method member completion: WORD.<partial>
  const dotted = context.matchBefore(/(\w+)\.(\w*)/);
  if (dotted) {
    const m = dotted.text.match(/(\w+)\.(\w*)$/);
    if (m) {
      const mod = m[1];
      const members = LIB_MEMBERS[mod] || LIST_METHODS;
      const from = dotted.from + m.index + m[1].length + 1;
      return {
        from,
        validFor: /^\w*$/,
        options: members.map((label) => ({ label, type: LIB_MEMBERS[mod] ? "function" : "method" })),
      };
    }
  }

  const word = context.matchBefore(/\w*/);
  if (!word) return null;
  if (word.text === "" && !context.explicit) return null;

  const options = [
    ...KEYWORDS.map((l) => ({ label: l, type: "keyword" })),
    ...CONSTANTS.map((l) => ({ label: l, type: "constant" })),
    ...BUILTINS.map((l) => ({ label: l, type: "function" })),
    ...LIBS.map((l) => ({ label: l, type: "namespace" })),
    ...LIST_METHODS.map((l) => ({ label: l + " ()", type: "method", apply: l })),
    ...userNames,
  ];
  return { from: word.from, validFor: /^\w*$/, options };
}

export const rsAutocomplete = autocompletion({ override: [rsCompletion], activateOnTyping: true });

// ---- step-line highlight ----
export const setStepLine = StateEffect.define();
export const stepLineField = StateField.define({
  create: () => -1,
  update: (val, tr) => {
    for (const e of tr.effects) if (e.is(setStepLine)) val = e.value;
    return val;
  },
});

export const stepLineDecorations = EditorView.decorations.of((view) => {
  const ln = view.state.field(stepLineField);
  if (ln < 1) return Decoration.none;
  const n = view.state.doc.lines;
  const line = view.state.doc.line(Math.min(Math.max(1, ln), n));
  return Decoration.set([Decoration.line({ class: "cm-step-line" }).range(line.from)]);
});

// ---- theme tweaks (blend with app palette) ----
export const rsTheme = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-scroller": { overflow: "auto", fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace', fontSize: "13.5px" },
  ".cm-gutters": { backgroundColor: "rgba(0,0,0,0.20)", borderRight: "1px solid #2a3050", color: "#555c80" },
  ".cm-content": { fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace', fontSize: "13.5px", caretColor: "#66ccff" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.045)" },
  ".cm-step-line": { backgroundColor: "rgba(102,204,255,0.16)", boxShadow: "inset 3px 0 0 #66ccff" },
  ".cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { background: "rgba(102,204,255,0.25)" },
  ".cm-tooltip": { background: "#1d2238", border: "1px solid #2a3050" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "#2a3360", color: "#66ccff" },
});

// ---- bundle of all extensions for the editor ----
export function rsExtensions(onChange) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    bracketMatching(),
    closeBrackets(),
    rsAutocomplete,
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    rsLanguage,
    oneDark,
    rsTheme,
    stepLineField,
    stepLineDecorations,
    EditorView.updateListener.of((v) => {
      if (v.docChanged && onChange) onChange(v.state.doc.toString());
      if (v.docChanged) refreshUserNames(v.state.doc.toString());
    }),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap]),
  ];
}

export { EditorState, EditorView };
