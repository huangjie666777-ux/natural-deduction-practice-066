import { describe, expect, it } from "vitest";
import { formatFormula, formulaEquals, parseFormula, tryParseFormula } from "./formula";

describe("公式解析", () => {
  it("解析原子", () => {
    expect(parseFormula("P")).toEqual({ kind: "atom", name: "P" });
    expect(parseFormula("AB12")).toEqual({ kind: "atom", name: "AB12" });
  });

  it("优先级 ∧ > ∨ > →", () => {
    expect(formatFormula(parseFormula("A ∧ B ∨ C"))).toBe("A ∧ B ∨ C");
    const f = parseFormula("A ∨ B ∧ C");
    expect(f.kind).toBe("or");
    if (f.kind === "or") expect(f.right.kind).toBe("and");
    const g = parseFormula("A ∧ B → C ∨ D");
    expect(g.kind).toBe("imp");
  });

  it("→ 右结合，其余左结合", () => {
    const imp = parseFormula("A → B → C");
    expect(imp.kind).toBe("imp");
    if (imp.kind === "imp") expect(imp.right.kind).toBe("imp");
    const and = parseFormula("A ∧ B ∧ C");
    if (and.kind === "and") expect(and.left.kind).toBe("and");
    const or = parseFormula("A ∨ B ∨ C");
    if (or.kind === "or") expect(or.left.kind).toBe("or");
  });

  it("圆括号改变结构", () => {
    expect(formatFormula(parseFormula("(A ∨ B) ∧ C"))).toBe("(A ∨ B) ∧ C");
    const f = parseFormula("A → (B → C)");
    expect(formulaEquals(f, parseFormula("A → B → C"))).toBe(true);
    expect(formulaEquals(f, parseFormula("(A → B) → C"))).toBe(false);
  });

  it("按语法树比较，不把逻辑等价当作相同", () => {
    expect(formulaEquals(parseFormula("A ∧ B"), parseFormula("B ∧ A"))).toBe(false);
    expect(formulaEquals(parseFormula("A ∧ (B ∧ C)"), parseFormula("(A ∧ B) ∧ C"))).toBe(false);
    expect(formulaEquals(parseFormula("A → B"), parseFormula("A → B"))).toBe(true);
    expect(formulaEquals(parseFormula("((A))"), parseFormula("A"))).toBe(true);
  });

  it("语法错误定位字符", () => {
    const r = tryParseFormula("A ∧ ∧ B");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.pos).toBe(4);
    const r2 = tryParseFormula("a");
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.pos).toBe(0);
    const r3 = tryParseFormula("(A ∧ B");
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.pos).toBe(6);
    const r4 = tryParseFormula("");
    expect(r4.ok).toBe(false);
  });
});
