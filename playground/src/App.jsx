import React, { useMemo, useRef, useState } from "react";
import Editor from "./Editor.jsx";
import Terminal from "./Terminal.jsx";
import { Stepper } from "radiumscript";

const DEFAULT_CODE = `// RadiumScript Playground
import math;

def fib(n) {
    if (n < 2) { return n; }
    return fib(n - 1) + fib(n - 2);
}

def main() {
    print("=== RadiumScript ===");
    var i = 0;
    while (i < 10) {
        print("fib(" + i + ") = " + fib(i));
        i++;
    }
    print("sin(30) = " + math.sin(30));

    var p = { x: 10, y: 20 };
    print("point: " + p.x + "," + p.y);

    var xs = [1, 2, 3];
    xs.push(4);
    print("sum = " + xs.sum());
}

main();
`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [activeLine, setActiveLine] = useState(null);
  const [stepInfo, setStepInfo] = useState("");
  const [error, setError] = useState(null);
  const stepperRef = useRef(null);

  const inputLines = useMemo(() => stdin.split("\n"), [stdin]);
  const running = status === "stepping" || status === "running";

  function freshStepper() {
    const st = new Stepper(code, { inputLines });
    stepperRef.current = st;
    return st;
  }

  function doRun() {
    setError(null);
    setOutput("");
    setActiveLine(null);
    setStatus("running");
    setStepInfo("");
    const st = freshStepper();
    // drain synchronously (a bit at a time is fine; generator is sync)
    const res = st.runToEnd();
    setOutput(st.ctx.out);
    setActiveLine(null);
    if (res.error) {
      setError(res.error);
      setStatus("error");
    } else {
      setStatus("done");
    }
  }

  function doStep() {
    setError(null);
    let st = stepperRef.current;
    if (!st || st.done) {
      setOutput("");
      setActiveLine(null);
      setStepInfo("");
      st = freshStepper();
      setStatus("stepping");
    }
    const res = st.next();
    setOutput(st.ctx.out);
    if (res.done) {
      setActiveLine(null);
      if (res.error) {
        setError(res.error);
        setStatus("error");
      } else {
        setStatus("done");
        setStepInfo("");
      }
    } else {
      const line = res.step?.line ?? null;
      setActiveLine(line);
      setStepInfo(`▸ step ${st.steps} @ line ${line}`);
      setStatus("stepping");
    }
  }

  function doReset() {
    stepperRef.current = null;
    setOutput("");
    setActiveLine(null);
    setStepInfo("");
    setError(null);
    setStatus("idle");
  }

  const statusClass = status === "error" ? "err" : status === "done" ? "ok" : status === "idle" ? "warn" : "ok";

  return (
    <div className="app">
      <div className="toolbar">
        <span className="title">RadiumScript <small>Playground</small></span>
        <button className="btn primary" onClick={doRun} disabled={running}>▶ 运行</button>
        <button className="btn warn" onClick={doStep} disabled={status === "running"}>⇥ 步进</button>
        <button className="btn" onClick={doReset}>↺ 重置</button>
        <div className="spacer" />
        <span className={"status " + statusClass}>
          {status === "idle" ? "就绪" :
           status === "running" ? "运行中…" :
           status === "stepping" ? `步进中 (step ${stepperRef.current?.steps ?? 0})` :
           status === "done" ? "已结束" :
           status === "error" ? "出错" : ""}
        </span>
      </div>

      <div className="main">
        <div className="panel">
          <div className="panel-head">代码编辑器 (.rds)</div>
          <Editor value={code} onChange={setCode} activeLine={activeLine} />
        </div>
        <div className="panel">
          <div className="panel-head">输出终端</div>
          <Terminal output={output} status={status} stepInfo={stepInfo} error={error} />
          <div className="input-row">
            <input
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="stdin: 每行供一次 input() 读取"
            />
            <span className="hint">stdin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
