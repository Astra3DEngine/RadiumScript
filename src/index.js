// RadiumScript interpreter - public entry point.
// Importable as a Node.js / ESM package: `import { run, Stepper } from 'radiumscript'`.

import { tokenize } from "./lib/lexer.js";
import { parse } from "./lib/parser.js";
import { run, Stepper, makeContext, createGlobalScope, version } from "./lib/interpreter.js";

export { tokenize, parse, run, Stepper, makeContext, createGlobalScope, version };
export { RSObject, RSClass, RSInstance, RSFunction, RSModule, RSNamespace } from "./lib/runtime.js";
