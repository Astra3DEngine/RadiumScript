import { useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { rsExtensions, setStepLine } from "./cm-rs.js";

// CodeMirror 6 based editor with RS syntax highlighting, autocompletion
// and active-step-line highlight driven by the `activeLine` prop.
export default function Editor({ value, onChange, activeLine }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // mount once
  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions: rsExtensions((s) => onChangeRef.current?.(s)) }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync external value changes into the editor (avoid clobbering user input)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  // drive step-line highlight + scroll into view
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const ln = activeLine ?? -1;
    const effects = [setStepLine.of(ln)];
    if (ln >= 1 && ln <= view.state.doc.lines) {
      const line = view.state.doc.line(ln);
      effects.push(EditorView.scrollIntoView(line.from, { y: "nearest" }));
    }
    view.dispatch({ effects });
  }, [activeLine]);

  return <div className="cm-host" ref={hostRef} />;
}
