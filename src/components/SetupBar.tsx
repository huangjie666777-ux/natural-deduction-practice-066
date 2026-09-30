import { useState } from "react";
import { EXERCISES } from "../logic/exercises";
import { tryParseFormula } from "../logic/formula";
import { makeProof } from "../logic/proof";
import { ProofSession, sessionFromCustom, sessionFromExercise } from "../state/useProof";

export function SetupBar({
  session,
  onLoad,
}: {
  session: ProofSession;
  onLoad: (s: ProofSession) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [premisesText, setPremisesText] = useState("P → Q\nQ → R");
  const [goalText, setGoalText] = useState("P → R");
  const [error, setError] = useState("");

  const startCustom = () => {
    const premises = premisesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    for (const p of premises) {
      const r = tryParseFormula(p);
      if (!r.ok) {
        setError("前提 “" + p + "” 第 " + (r.pos + 1) + " 个字符：" + r.message);
        return;
      }
    }
    const g = tryParseFormula(goalText);
    if (!g.ok) {
      setError("目标第 " + (g.pos + 1) + " 个字符：" + g.message);
      return;
    }
    setError("");
    setShowCustom(false);
    onLoad(sessionFromCustom(premises, goalText.trim()));
  };

  return (
    <div className="setup-bar">
      <label>
        练习：
        <select
          value={session.exerciseId ?? "custom"}
          onChange={(e) => {
            const id = e.target.value;
            if (id === "custom") {
              setShowCustom(true);
              return;
            }
            const ex = EXERCISES.find((x) => x.id === id);
            if (ex) onLoad(sessionFromExercise(ex));
          }}
        >
          {EXERCISES.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
          <option value="custom">自定义…</option>
        </select>
      </label>
      <button
        onClick={() => {
          if (confirm("重置当前练习？所有证明步骤将被清空。")) {
            onLoad({ ...session, proof: resetProof(session) });
          }
        }}
      >
        重置本题
      </button>
      <button onClick={() => setShowCustom((v) => !v)}>自定义题目</button>
      {showCustom && (
        <div className="custom-panel">
          <p>每行一个前提（大写原子，支持 ∧ ∨ → 与圆括号）：</p>
          <textarea
            rows={4}
            value={premisesText}
            onChange={(e) => setPremisesText(e.target.value)}
          />
          <p>目标公式：</p>
          <input value={goalText} onChange={(e) => setGoalText(e.target.value)} />
          {error && <p className="error-text">{error}</p>}
          <button onClick={startCustom}>开始自定义练习</button>
        </div>
      )}
    </div>
  );
}

function resetProof(session: ProofSession) {
  return makeProof(session.premises, session.proof.goal);
}
