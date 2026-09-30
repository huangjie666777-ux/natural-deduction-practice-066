export type RuleKind =
  | "premise"
  | "assumption"
  | "reit"
  | "andI"
  | "andE"
  | "orI"
  | "orE"
  | "impI"
  | "impE";

export const RULE_NAMES: Record<RuleKind, string> = {
  premise: "前提",
  assumption: "假设",
  reit: "重申",
  andI: "合取引入 ∧I",
  andE: "合取消去 ∧E",
  orI: "析取引入 ∨I",
  orE: "析取消去 ∨E",
  impI: "蕴含引入 →I",
  impE: "蕴含消去 →E",
};

export interface ProofLine {
  kind: "line";
  id: string;
  formula: string; // 用户输入的原文，保留以便定位语法错误
  rule: RuleKind;
  lineRefs: string[]; // 稳定的行 id
  boxRefs: string[]; // 稳定的分支 id
}

export interface ProofBox {
  kind: "box";
  id: string;
  closed: boolean;
  items: ProofItem[]; // 第一项必为假设行
}

export type ProofItem = ProofLine | ProofBox;

export interface Proof {
  root: ProofBox; // 顶层框，无假设、不需要关闭
  goal: string;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return prefix + "-" + Date.now().toString(36) + "-" + counter.toString(36);
}

export function makeLine(partial?: Partial<Omit<ProofLine, "kind" | "id">>): ProofLine {
  return {
    kind: "line",
    id: newId("L"),
    formula: "",
    rule: "reit",
    lineRefs: [],
    boxRefs: [],
    ...partial,
  };
}

export function makeBox(): ProofBox {
  const assumption = makeLine({ rule: "assumption" });
  return { kind: "box", id: newId("B"), closed: false, items: [assumption] };
}

export function makeProof(premises: string[], goal: string): Proof {
  const items: ProofItem[] = premises.map((p) => makeLine({ formula: p, rule: "premise" }));
  return {
    root: { kind: "box", id: newId("B"), closed: false, items },
    goal,
  };
}

export interface LineLocation {
  line: ProofLine;
  box: ProofBox;
  index: number; // 在 box.items 中的下标
  number: number; // 全局行号（先序遍历，从 1 开始）
}

export interface BoxLocation {
  box: ProofBox;
  parent: ProofBox | null;
  index: number; // 在 parent.items 中的下标，顶层为 -1
  number: number; // 分支序号（先序遍历，从 1 开始）
}

export interface ProofIndex {
  lines: Map<string, LineLocation>;
  boxes: Map<string, BoxLocation>;
  lineOrder: ProofLine[];
  boxOrder: ProofBox[];
}

export function indexProof(proof: Proof): ProofIndex {
  const lines = new Map<string, LineLocation>();
  const boxes = new Map<string, BoxLocation>();
  const lineOrder: ProofLine[] = [];
  const boxOrder: ProofBox[] = [];
  const walk = (box: ProofBox, parent: ProofBox | null, index: number) => {
    boxes.set(box.id, { box, parent, index, number: boxOrder.length + 1 });
    boxOrder.push(box);
    box.items.forEach((item, i) => {
      if (item.kind === "line") {
        lines.set(item.id, { line: item, box, index: i, number: lineOrder.length + 1 });
        lineOrder.push(item);
      } else {
        walk(item, box, i);
      }
    });
  };
  walk(proof.root, null, -1);
  return { lines, boxes, lineOrder, boxOrder };
}

// 计算某行可见的行 id 与可引用的直接子分支 id。
// 可见行 = 本框内在前的行 + 各祖先框中位于本框之前的行（沿祖先链向上）。
// 可引用分支 = 本框内位于本行之前、且已关闭的直接子分支。
export function visibleFrom(idx: ProofIndex, lineId: string): {
  lineIds: Set<string>;
  boxIds: Set<string>;
} {
  const lineIds = new Set<string>();
  const boxIds = new Set<string>();
  const loc = idx.lines.get(lineId);
  if (!loc) return { lineIds, boxIds };
  let box: ProofBox | null = loc.box;
  let beforeIndex = loc.index;
  while (box) {
    for (let i = 0; i < beforeIndex; i++) {
      const item = box.items[i];
      if (item.kind === "line") {
        lineIds.add(item.id);
      } else if (item.closed) {
        boxIds.add(item.id);
      }
    }
    const parentLoc: ProofBox | null = idx.boxes.get(box.id)?.parent ?? null;
    if (!parentLoc) break;
    beforeIndex = idx.boxes.get(box.id)!.index;
    box = parentLoc;
  }
  return { lineIds, boxIds };
}

export function findBox(idx: ProofIndex, boxId: string): ProofBox | null {
  return idx.boxes.get(boxId)?.box ?? null;
}

export function boxAssumption(box: ProofBox): ProofLine | null {
  const first = box.items[0];
  return first && first.kind === "line" ? first : null;
}

export function boxLastLine(box: ProofBox): ProofLine | null {
  for (let i = box.items.length - 1; i >= 0; i--) {
    const item = box.items[i];
    if (item.kind === "line") return item;
  }
  return null;
}

export function topLevelLastLine(proof: Proof): ProofLine | null {
  return boxLastLine(proof.root);
}

export function allBoxesClosed(box: ProofBox, isRoot = true): boolean {
  if (!isRoot && !box.closed) return false;
  return box.items.every((it) => it.kind === "line" || allBoxesClosed(it, false));
}
