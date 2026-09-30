import { Formula, formulaEquals, tryParseFormula } from "./formula";
import {
  Proof,
  ProofBox,
  ProofLine,
  ProofIndex,
  indexProof,
  visibleFrom,
  boxAssumption,
  boxLastLine,
  topLevelLastLine,
  allBoxesClosed,
} from "./proof";

export type LineStatus = "ok" | "error" | "dep";

export interface LineVerdict {
  status: LineStatus;
  message: string;
}

export interface Validation {
  verdicts: Map<string, LineVerdict>;
  boxValid: Map<string, boolean>;
  complete: boolean;
  completeMessage: string;
}

const OK: LineVerdict = { status: "ok", message: "有效" };

function err(message: string): LineVerdict {
  return { status: "error", message };
}

function dep(message: string): LineVerdict {
  return { status: "dep", message };
}

interface Ctx {
  idx: ProofIndex;
  verdicts: Map<string, LineVerdict>;
  boxValid: Map<string, boolean>;
  parsed: Map<string, Formula>;
}

// 被引用分支内的行在先序中一定早于当前行，可按需递归判定
function boxIsValid(ctx: Ctx, box: ProofBox): boolean {
  const cached = ctx.boxValid.get(box.id);
  if (cached !== undefined) return cached;
  let ok = true;
  for (const item of box.items) {
    if (item.kind === "line") {
      const v = ctx.verdicts.get(item.id);
      if (!v || v.status !== "ok") ok = false;
    } else if (!boxIsValid(ctx, item)) {
      ok = false;
    }
  }
  ctx.boxValid.set(box.id, ok);
  return ok;
}

function parseLineFormula(ctx: Ctx, line: ProofLine): Formula | LineVerdict {
  const cached = ctx.parsed.get(line.id);
  if (cached) return cached;
  const r = tryParseFormula(line.formula);
  if (!r.ok) return err("语法错误（第 " + (r.pos + 1) + " 个字符）：" + r.message);
  ctx.parsed.set(line.id, r.formula);
  return r.formula;
}

function isVerdict(x: unknown): x is LineVerdict {
  return typeof x === "object" && x !== null && "status" in x;
}

// 解析被引用行的公式；若引用行本身无效则返回 null（由 dep 逻辑处理）
function refFormula(ctx: Ctx, id: string): Formula | null {
  const loc = ctx.idx.lines.get(id);
  if (!loc) return null;
  const f = parseLineFormula(ctx, loc.line);
  return isVerdict(f) ? null : f;
}

function checkRefs(
  ctx: Ctx,
  line: ProofLine,
  needLines: number,
  needBoxes: number
): LineVerdict | null {
  if (line.lineRefs.length !== needLines || line.boxRefs.length !== needBoxes) {
    const parts: string[] = [];
    if (needLines > 0) parts.push(needLines + " 个行引用");
    if (needBoxes > 0) parts.push(needBoxes + " 个分支引用");
    if (parts.length === 0) parts.push("不需要引用");
    return err("该规则需要 " + parts.join("和"));
  }
  const vis = visibleFrom(ctx.idx, line.id);
  for (const ref of line.lineRefs) {
    if (!ctx.idx.lines.has(ref)) {
      return err("引用的行已删除，引用失效");
    }
    if (!vis.lineIds.has(ref)) {
      return err("引用的行在此不可见（位于已关闭分支内、其他分支或尚未出现）");
    }
    const v = ctx.verdicts.get(ref);
    if (v && v.status !== "ok") {
      return dep("依赖的第 " + ctx.idx.lines.get(ref)!.number + " 行无效");
    }
  }
  for (const ref of line.boxRefs) {
    const bloc = ctx.idx.boxes.get(ref);
    if (!bloc) {
      return err("引用的分支已删除，引用失效");
    }
    if (!bloc.box.closed) {
      return err("引用的分支尚未关闭");
    }
    if (!vis.boxIds.has(ref)) {
      return err("引用的分支不是本层之前已关闭的直接子分支");
    }
    if (!boxIsValid(ctx, bloc.box)) {
      return dep("引用的分支内部存在无效步骤");
    }
  }
  return null;
}

function checkLine(ctx: Ctx, line: ProofLine): LineVerdict {
  const loc = ctx.idx.lines.get(line.id)!;
  const inRoot = ctx.idx.boxes.get(loc.box.id)!.parent === null;
  const isFirstOfBox = loc.index === 0 && !inRoot;

  if (line.rule === "assumption") {
    if (!isFirstOfBox) return err("假设行只能作为分支的第一行");
    const f = parseLineFormula(ctx, line);
    return isVerdict(f) ? f : OK;
  }
  if (isFirstOfBox) return err("分支的第一行必须使用“假设”规则");

  if (line.rule === "premise") {
    if (!inRoot) return err("前提只能出现在顶层");
    const f = parseLineFormula(ctx, line);
    return isVerdict(f) ? f : OK;
  }

  const f = parseLineFormula(ctx, line);
  if (isVerdict(f)) return f;

  switch (line.rule) {
    case "reit": {
      const bad = checkRefs(ctx, line, 1, 0);
      if (bad) return bad;
      const g = refFormula(ctx, line.lineRefs[0]);
      if (!g) return dep("依赖的行无效");
      if (!formulaEquals(f, g)) return err("重申的公式必须与引用行完全相同（按语法树比较）");
      return OK;
    }
    case "andI": {
      const bad = checkRefs(ctx, line, 2, 0);
      if (bad) return bad;
      const a = refFormula(ctx, line.lineRefs[0]);
      const b = refFormula(ctx, line.lineRefs[1]);
      if (!a || !b) return dep("依赖的行无效");
      if (f.kind !== "and") return err("结论必须是合取式 A ∧ B");
      const direct = formulaEquals(f.left, a) && formulaEquals(f.right, b);
      const swapped = formulaEquals(f.left, b) && formulaEquals(f.right, a);
      if (!direct && !swapped) return err("合取引入要求结论为两个引用行的合取");
      return OK;
    }
    case "andE": {
      const bad = checkRefs(ctx, line, 1, 0);
      if (bad) return bad;
      const g = refFormula(ctx, line.lineRefs[0]);
      if (!g) return dep("依赖的行无效");
      if (g.kind !== "and") return err("引用行必须是合取式");
      if (!formulaEquals(f, g.left) && !formulaEquals(f, g.right)) {
        return err("结论必须是该合取式的某一合取支");
      }
      return OK;
    }
    case "orI": {
      const bad = checkRefs(ctx, line, 1, 0);
      if (bad) return bad;
      const g = refFormula(ctx, line.lineRefs[0]);
      if (!g) return dep("依赖的行无效");
      if (f.kind !== "or") return err("结论必须是析取式 A ∨ B");
      if (!formulaEquals(f.left, g) && !formulaEquals(f.right, g)) {
        return err("析取引入要求某一析取支与引用行相同");
      }
      return OK;
    }
    case "impE": {
      const bad = checkRefs(ctx, line, 2, 0);
      if (bad) return bad;
      const imp = refFormula(ctx, line.lineRefs[0]);
      const ant = refFormula(ctx, line.lineRefs[1]);
      if (!imp || !ant) return dep("依赖的行无效");
      if (imp.kind !== "imp") return err("第一个引用行必须是蕴含式 A → B");
      if (!formulaEquals(imp.left, ant)) return err("第二个引用行必须等于蕴含式的前件");
      if (!formulaEquals(imp.right, f)) return err("结论必须等于蕴含式的后件");
      return OK;
    }
    case "impI": {
      const bad = checkRefs(ctx, line, 0, 1);
      if (bad) return bad;
      if (f.kind !== "imp") return err("结论必须是蕴含式 A → B");
      const box = ctx.idx.boxes.get(line.boxRefs[0])!.box;
      const asm = boxAssumption(box);
      const last = boxLastLine(box);
      if (!asm || !last) return err("引用的分支为空");
      const asmF = refFormula(ctx, asm.id);
      const lastF = refFormula(ctx, last.id);
      if (!asmF || !lastF) return dep("引用的分支内部存在无效步骤");
      if (!formulaEquals(asmF, f.left)) return err("分支首行假设必须等于蕴含式前件");
      if (!formulaEquals(lastF, f.right)) return err("分支末行结论必须等于蕴含式后件");
      return OK;
    }
    case "orE": {
      const bad = checkRefs(ctx, line, 1, 2);
      if (bad) return bad;
      const disj = refFormula(ctx, line.lineRefs[0]);
      if (!disj) return dep("依赖的行无效");
      if (disj.kind !== "or") return err("引用行必须是析取式 A ∨ B");
      const box1 = ctx.idx.boxes.get(line.boxRefs[0])!.box;
      const box2 = ctx.idx.boxes.get(line.boxRefs[1])!.box;
      const a1 = boxAssumption(box1);
      const a2 = boxAssumption(box2);
      const l1 = boxLastLine(box1);
      const l2 = boxLastLine(box2);
      if (!a1 || !a2 || !l1 || !l2) return err("引用的分支为空");
      const a1F = refFormula(ctx, a1.id);
      const a2F = refFormula(ctx, a2.id);
      const l1F = refFormula(ctx, l1.id);
      const l2F = refFormula(ctx, l2.id);
      if (!a1F || !a2F || !l1F || !l2F) return dep("引用的分支内部存在无效步骤");
      if (!formulaEquals(a1F, disj.left)) return err("第一个分支的假设必须等于析取式左支");
      if (!formulaEquals(a2F, disj.right)) return err("第二个分支的假设必须等于析取式右支");
      if (!formulaEquals(l1F, f) || !formulaEquals(l2F, f)) {
        return err("两个分支的末行必须都与本行结论相同");
      }
      return OK;
    }
    default:
      return err("未知规则");
  }
}

function computeBoxValid(ctx: Ctx, box: ProofBox): boolean {
  let ok = true;
  for (const item of box.items) {
    if (item.kind === "line") {
      const v = ctx.verdicts.get(item.id);
      if (!v || v.status !== "ok") ok = false;
    } else {
      if (!computeBoxValid(ctx, item)) ok = false;
    }
  }
  ctx.boxValid.set(box.id, ok);
  return ok;
}

export function validateProof(proof: Proof): Validation {
  const idx = indexProof(proof);
  const verdicts = new Map<string, LineVerdict>();
  const boxValid = new Map<string, boolean>();
  const ctx: Ctx = { idx, verdicts, boxValid, parsed: new Map() };

  // 行号按先序排列，被引用行一定排在引用者之前，顺序校验即可
  for (const line of idx.lineOrder) {
    verdicts.set(line.id, checkLine(ctx, line));
  }
  computeBoxValid(ctx, proof.root);

  let complete = false;
  let completeMessage = "";
  const goalParsed = tryParseFormula(proof.goal);
  if (!goalParsed.ok) {
    completeMessage = "目标公式存在语法错误";
  } else if (!allBoxesClosed(proof.root)) {
    completeMessage = "尚有未关闭的假设分支";
  } else if (!boxValid.get(proof.root.id)) {
    completeMessage = "尚有无效步骤";
  } else {
    const last = topLevelLastLine(proof);
    if (!last) {
      completeMessage = "顶层还没有任何结论行";
    } else {
      const lastF = tryParseFormula(last.formula);
      if (lastF.ok && formulaEquals(lastF.formula, goalParsed.formula)) {
        complete = true;
        completeMessage = "证明完成！";
      } else {
        completeMessage = "顶层最后一行必须等于目标公式";
      }
    }
  }

  return { verdicts, boxValid, complete, completeMessage };
}
