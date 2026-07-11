import React, { useEffect, useRef } from "react";

export default function Terminal({ output, status, stepInfo, error }) {
  const endRef = useRef(null);
  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ block: "end" });
  }, [output, status, error]);

  return (
    <div className="terminal">
      {output ? <span className="out">{output}</span> : <span className="muted">// 输出将显示在这里</span>}
      {stepInfo ? <><br /><span className="step-info">{stepInfo}</span></> : null}
      {error ? <><br /><span className="err">{"\u26a0 " + (error.message || String(error))}</span></> : null}
      {status === "done" && !error ? <><br /><span className="muted">[ 程序结束 ]</span></> : null}
      <div ref={endRef} />
    </div>
  );
}
