import { useEffect, useState } from "react";
import {
  ProofBox,
  ProofIndex,
  ProofLine,
  RULE_NAMES,
  RuleKind,
  boxAssumption,
} from "../logic/proof";
import { Validation } from "../logic/validate";
import { Action } from "../state/useProof";

const RULES_NEEDING_LINE_REFS: RuleKind[] = ["reit", "andI", "andE", "orI", "orE", "impE"];
const RULES_NEEDING_BOX_REFS: RuleKind[] = ["impI", "orE"];

export interface ViewCtx {
  idx: ProofIndex;
  validation: Validation;
  dispatch: React.Dispatch<Action>;
  boxNumbers: Map<string, number>;
}

function scrollToItem(id: string) {
  const el = document.getElementById("item-" + id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1200);
}

function lineNumber(ctx: ViewCtx, id: string): string {
  const loc = ctx.idx.lines.get(id);
  return loc ? String(loc.number) : "✕";
}

function boxNumber(ctx: ViewCtx, id: string): string {
  const n = ctx.boxNumbers.get(id);
  return n ? String(n) : "✕";
}

// 以行号/分支号编辑引用，内部仍绑定稳定 id
function RefsEditor({
  label,
  ids,
  toText,
  parse,
  onCommit,
}: {
  label: string;
  ids: string[];
  toText: (id: string) => string;
  parse: (text: string) => string[] | null;
  onCommit: (ids: string[]) => void;
}) {
  const [text, setText] = useState(() => ids.map(toText).join(","));
  const [bad, setBad] = useState(false);
  const serialized = ids.map(toText).join(",");
  useEffect(() => {
    setText(serialized);
    setBad(false);
  }, [serialized]);

  return (
    <label className="refs-editor">
      <span>{label}</span>
      <input
        className={bad ? "bad" : ""}
        value={text}
        placeholder="无"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const parsed = parse(v);
          if (parsed) {
            setBad(false);
            onCommit(parsed);
          } else {
            setBad(true);
          }
        }}
      />
    </label>
  );
}

function RefChips({ ids, toText, prefix }: { ids: string[]; toText: (id: string) => string; prefix: string }) {
  if (ids.length === 0) return null;
  return (
    <span className="ref-chips">
      {ids.map((id) => (
        <button
          key={id}
          className={"chip" + (toText(id) === "✕" ? " dangling" : "")}
          title="点击定位到原行"
          onClick={() => scrollToItem(id)}
        >
          {prefix}
          {toText(id)}
        </button>
      ))}
    </span>
  );
}

function LineRow({ line, ctx }: { line: ProofLine; ctx: ViewCtx }) {
  const loc = ctx.idx.lines.get(line.id);
  const verdict = ctx.validation.verdicts.get(line.id);
  const needsLineRefs = RULES_NEEDING_LINE_REFS.includes(line.rule);
  const needsBoxRefs = RULES_NEEDING_BOX_REFS.includes(line.rule);
  const locked = line.rule === "premise";

  const parseLineNums = (text: string): string[] | null => {
    const t = text.trim();
    if (t === "") return [];
    const parts = t.split(/[,,\s]+/);
    const ids: string[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isInteger(n) || n < 1 || n > ctx.idx.lineOrder.length) return null;
      ids.push(ctx.idx.lineOrder[n - 1].id);
    }
    return ids;
  };
  const parseBoxNums = (text: string): string[] | null => {
    const t = text.trim();
    if (t === "") return [];
    const parts = t.split(/[,,\s]+/);
    const ids: string[] = [];
    for (const p of parts) {
      const n = Number(p);
      const entry = [...ctx.boxNumbers.entries()].find(([, num]) => num === n);
      if (!entry) return null;
      ids.push(entry[0]);
    }
    return ids;
  };

  return (
    <div id={"item-" + line.id} className={"line-row status-" + (verdict?.status ?? "error")}>
      <span className="line-no">{loc?.number ?? "?"}</span>
      <input
        className="formula-input"
        value={line.formula}
        disabled={locked}
        placeholder="输入公式，如 P ∧ (Q → R)"
        onChange={(e) => ctx.dispatch({ type: "updateLine", id: line.id, patch: { formula: e.target.value } })}
      />
      <select
        value={line.rule}
        disabled={locked}
        onChange={(e) =>
          ctx.dispatch({ type: "updateLine", id: line.id, patch: { rule: e.target.value as RuleKind } })
        }
      >
        {(Object.keys(RULE_NAMES) as RuleKind[])
          .filter((r) => r !== "premise" && r !== "assumption" || r === line.rule)
          .map((r) => (
            <option key={r} value={r}>
              {RULE_NAMES[r]}
            </option>
          ))}
      </select>
      {needsLineRefs && (
        <RefsEditor
          label="行引用"
          ids={line.lineRefs}
          toText={(id) => lineNumber(ctx, id)}
          parse={parseLineNums}
          onCommit={(ids) => ctx.dispatch({ type: "updateLine", id: line.id, patch: { lineRefs: ids } })}
        />
      )}
      {needsBoxRefs && (
        <RefsEditor
          label="分支引用"
          ids={line.boxRefs}
          toText={(id) => boxNumber(ctx, id)}
          parse={parseBoxNums}
          onCommit={(ids) => ctx.dispatch({ type: "updateLine", id: line.id, patch: { boxRefs: ids } })}
        />
      )}
      <RefChips ids={line.lineRefs} toText={(id) => lineNumber(ctx, id)} prefix="行" />
      <RefChips ids={line.boxRefs} toText={(id) => boxNumber(ctx, id)} prefix="分支" />
      <span className={"verdict " + (verdict?.status ?? "error")} title={verdict?.message}>
        {verdict?.status === "ok" ? "✓ 有效" : verdict?.status === "dep" ? "⚠ 依赖无效" : "✗ 错误"}
      </span>
      {verdict && verdict.status !== "ok" && <span className="verdict-msg">{verdict.message}</span>}
      {!locked && (
        <button
          className="danger"
          title="删除该行（引用它的步骤将报失效）"
          onClick={() => ctx.dispatch({ type: "deleteLine", id: line.id })}
        >
          删除
        </button>
      )}
    </div>
  );
}

function BoxView({ box, ctx }: { box: ProofBox; ctx: ViewCtx }) {
  const num = ctx.boxNumbers.get(box.id);
  const valid = ctx.validation.boxValid.get(box.id);
  const asm = boxAssumption(box);
  return (
    <div id={"item-" + box.id} className={"proof-box" + (box.closed ? " closed" : "")}>
      <div className="box-header">
        <span className="box-tag">分支 {num}{box.closed ? "（已关闭）" : "（未关闭）"}</span>
        <span className={"verdict " + (valid ? "ok" : "error")}>{valid ? "✓" : "✗"}</span>
        {asm && <span className="box-asm">假设：{asm.formula || "（空）"}</span>}
        <button onClick={() => ctx.dispatch({ type: "setClosed", id: box.id, closed: !box.closed })}>
          {box.closed ? "重新打开" : "关闭分支"}
        </button>
        <button className="danger" onClick={() => ctx.dispatch({ type: "deleteBox", id: box.id })}>
          删除分支
        </button>
      </div>
      {box.items.map((item) =>
        item.kind === "line" ? (
          <LineRow key={item.id} line={item} ctx={ctx} />
        ) : (
          <BoxView key={item.id} box={item} ctx={ctx} />
        )
      )}
      {!box.closed && (
        <div className="box-actions">
          <button onClick={() => ctx.dispatch({ type: "addLine", boxId: box.id })}>+ 添加一行</button>
          <button onClick={() => ctx.dispatch({ type: "addBox", boxId: box.id })}>+ 开启子分支</button>
        </div>
      )}
    </div>
  );
}

export function ProofView({ ctx }: { ctx: ViewCtx }) {
  const root = ctx.idx.boxes.get(ctx.idx.boxOrder[0].id)!.box;
  return (
    <div className="proof-root">
      {root.items.map((item) =>
        item.kind === "line" ? (
          <LineRow key={item.id} line={item} ctx={ctx} />
        ) : (
          <BoxView key={item.id} box={item} ctx={ctx} />
        )
      )}
      <div className="box-actions">
        <button onClick={() => ctx.dispatch({ type: "addLine", boxId: root.id })}>+ 添加一行</button>
        <button onClick={() => ctx.dispatch({ type: "addBox", boxId: root.id })}>+ 开启假设分支</button>
      </div>
    </div>
  );
}

