import { useMemo } from "react";
import { EXERCISES } from "./logic/exercises";
import { indexProof } from "./logic/proof";
import { sessionFromExercise, useProofSession } from "./state/useProof";
import { ProofView, ViewCtx } from "./components/ProofView";
import { SetupBar } from "./components/SetupBar";
import { CheatSheet } from "./components/CheatSheet";

export default function App() {
  const { session, dispatch, validation } = useProofSession(sessionFromExercise(EXERCISES[0]));
  const idx = useMemo(() => indexProof(session.proof), [session.proof]);
  const boxNumbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const b of idx.boxOrder) {
      if (b.id === session.proof.root.id) continue;
      n += 1;
      m.set(b.id, n);
    }
    return m;
  }, [idx, session.proof.root.id]);

  const ctx: ViewCtx = { idx, validation, dispatch, boxNumbers };
  const ex = EXERCISES.find((e) => e.id === session.exerciseId);

  return (
    <main>
      <h1>自然演绎证明练习</h1>
      <SetupBar session={session} onLoad={(s) => dispatch({ type: "load", session: s })} />
      {ex && <p className="ex-desc">{ex.description}</p>}
      <div className="goal-bar">
        <span>
          前提：{session.premises.length > 0 ? session.premises.join("；") : "（无）"}
        </span>
        <span className="goal">目标：{session.proof.goal}</span>
      </div>
      <div className={"completion " + (validation.complete ? "done" : "")}>
        {validation.complete ? "🎉 " : ""}
        {validation.completeMessage}
      </div>
      <ProofView ctx={ctx} />
      <CheatSheet />
    </main>
  );
}

