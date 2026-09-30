import { describe, expect, it } from "vitest";
import { makeBox, makeLine, makeProof, Proof, ProofLine } from "./proof";
import { validateProof } from "./validate";

function verdictOf(proof: Proof, line: ProofLine) {
  return validateProof(proof).verdicts.get(line.id)!;
}

describe("证明校验", () => {
  it("完整证明 P ∧ Q ⊢ Q ∧ P 可通过并完成", () => {
    const proof = makeProof(["P ∧ Q"], "Q ∧ P");
    const [premise] = proof.root.items as ProofLine[];
    const l1 = makeLine({ formula: "Q", rule: "andE", lineRefs: [premise.id] });
    const l2 = makeLine({ formula: "P", rule: "andE", lineRefs: [premise.id] });
    const l3 = makeLine({ formula: "Q ∧ P", rule: "andI", lineRefs: [l1.id, l2.id] });
    proof.root.items.push(l1, l2, l3);
    const v = validateProof(proof);
    expect(v.verdicts.get(l1.id)!.status).toBe("ok");
    expect(v.verdicts.get(l2.id)!.status).toBe("ok");
    expect(v.verdicts.get(l3.id)!.status).toBe("ok");
    expect(v.complete).toBe(true);
  });

  it("结构不同（即使逻辑等价）不算相同", () => {
    const proof = makeProof(["P ∧ Q"], "P ∧ Q");
    const [premise] = proof.root.items as ProofLine[];
    const l1 = makeLine({ formula: "Q ∧ P", rule: "reit", lineRefs: [premise.id] });
    proof.root.items.push(l1);
    expect(verdictOf(proof, l1).status).toBe("error");
  });

  it("删除被引用行后引用失效", () => {
    const proof = makeProof(["P"], "P");
    const l1 = makeLine({ formula: "P", rule: "reit", lineRefs: ["ghost-id"] });
    proof.root.items.push(l1);
    const v = verdictOf(proof, l1);
    expect(v.status).toBe("error");
    expect(v.message).toContain("失效");
  });

  it("已关闭分支内部的行不能被外部引用", () => {
    const proof = makeProof(["P"], "P");
    const box = makeBox();
    const asm = box.items[0] as ProofLine;
    asm.formula = "Q";
    const inner = makeLine({ formula: "Q", rule: "reit", lineRefs: [asm.id] });
    box.items.push(inner);
    box.closed = true;
    const outside = makeLine({ formula: "Q", rule: "reit", lineRefs: [inner.id] });
    proof.root.items.push(box, outside);
    const v = verdictOf(proof, outside);
    expect(v.status).toBe("error");
    expect(v.message).toContain("不可见");
  });

  it("分支内部可以重申外层可见行", () => {
    const proof = makeProof(["P"], "Q → P");
    const box = makeBox();
    const asm = box.items[0] as ProofLine;
    asm.formula = "Q";
    const [premise] = proof.root.items as ProofLine[];
    const inner = makeLine({ formula: "P", rule: "reit", lineRefs: [premise.id] });
    box.items.push(inner);
    box.closed = true;
    const concl = makeLine({ formula: "Q → P", rule: "impI", boxRefs: [box.id] });
    proof.root.items.push(box, concl);
    const v = validateProof(proof);
    expect(v.verdicts.get(inner.id)!.status).toBe("ok");
    expect(v.verdicts.get(concl.id)!.status).toBe("ok");
    expect(v.complete).toBe(true);
  });

  it("蕴含引入要求分支已关闭且为本层直接子分支", () => {
    const proof = makeProof([], "P → P");
    const box = makeBox();
    const asm = box.items[0] as ProofLine;
    asm.formula = "P";
    const inner = makeLine({ formula: "P", rule: "reit", lineRefs: [asm.id] });
    box.items.push(inner);
    const concl = makeLine({ formula: "P → P", rule: "impI", boxRefs: [box.id] });
    proof.root.items.push(box, concl);
    // 未关闭
    expect(verdictOf(proof, concl).status).toBe("error");
    box.closed = true;
    expect(verdictOf(proof, concl).status).toBe("ok");
  });

  it("蕴含引入检查假设与结论", () => {
    const proof = makeProof([], "P → Q");
    const box = makeBox();
    (box.items[0] as ProofLine).formula = "P";
    const inner = makeLine({ formula: "P", rule: "reit", lineRefs: [(box.items[0] as ProofLine).id] });
    box.items.push(inner);
    box.closed = true;
    const concl = makeLine({ formula: "P → Q", rule: "impI", boxRefs: [box.id] });
    proof.root.items.push(box, concl);
    expect(verdictOf(proof, concl).status).toBe("error");
  });

  it("析取消去：两个分支末行须为同一结论", () => {
    const proof = makeProof(["P ∨ Q", "P → R", "Q → R"], "R");
    const [disj, pr, qr] = proof.root.items as ProofLine[];
    const b1 = makeBox();
    (b1.items[0] as ProofLine).formula = "P";
    b1.items.push(
      makeLine({ formula: "R", rule: "impE", lineRefs: [pr.id, (b1.items[0] as ProofLine).id] })
    );
    b1.closed = true;
    const b2 = makeBox();
    (b2.items[0] as ProofLine).formula = "Q";
    b2.items.push(
      makeLine({ formula: "R", rule: "impE", lineRefs: [qr.id, (b2.items[0] as ProofLine).id] })
    );
    b2.closed = true;
    const concl = makeLine({ formula: "R", rule: "orE", lineRefs: [disj.id], boxRefs: [b1.id, b2.id] });
    proof.root.items.push(b1, b2, concl);
    const v = validateProof(proof);
    expect(v.verdicts.get(concl.id)!.status).toBe("ok");
    expect(v.complete).toBe(true);

    // 破坏第二个分支的结论
    (b2.items[1] as ProofLine).formula = "P";
    const v2 = validateProof(proof);
    expect(v2.verdicts.get((b2.items[1] as ProofLine).id)!.status).toBe("error");
    expect(v2.verdicts.get(concl.id)!.status).not.toBe("ok");
    expect(v2.complete).toBe(false);
  });

  it("依赖无效会传播", () => {
    const proof = makeProof(["P"], "P");
    const bad = makeLine({ formula: "P", rule: "andE", lineRefs: [] });
    const dep1 = makeLine({ formula: "P", rule: "reit", lineRefs: [bad.id] });
    proof.root.items.push(bad, dep1);
    const v = validateProof(proof);
    expect(v.verdicts.get(bad.id)!.status).toBe("error");
    expect(v.verdicts.get(dep1.id)!.status).toBe("dep");
  });

  it("引用后面的行不可见", () => {
    const proof = makeProof(["P"], "P");
    const later = makeLine({ formula: "P", rule: "reit", lineRefs: [] });
    const early = makeLine({ formula: "P", rule: "reit", lineRefs: [later.id] });
    later.lineRefs = [early.id];
    proof.root.items.push(early, later);
    const v = validateProof(proof);
    expect(v.verdicts.get(early.id)!.status).toBe("error");
  });

  it("未关闭分支或末行不等于目标时不算完成", () => {
    const proof = makeProof(["P"], "P");
    const [premise] = proof.root.items as ProofLine[];
    const box = makeBox();
    (box.items[0] as ProofLine).formula = "Q";
    proof.root.items.push(box);
    expect(validateProof(proof).complete).toBe(false);
    box.closed = true;
    const done = makeLine({ formula: "P", rule: "reit", lineRefs: [premise.id] });
    proof.root.items.push(done);
    expect(validateProof(proof).complete).toBe(true);
  });

  it("跨层借用其他分支的行不合法", () => {
    const proof = makeProof(["P"], "P");
    const b1 = makeBox();
    (b1.items[0] as ProofLine).formula = "Q";
    const inner = makeLine({ formula: "Q", rule: "reit", lineRefs: [(b1.items[0] as ProofLine).id] });
    b1.items.push(inner);
    const b2 = makeBox();
    (b2.items[0] as ProofLine).formula = "R";
    const thief = makeLine({ formula: "Q", rule: "reit", lineRefs: [inner.id] });
    b2.items.push(thief);
    proof.root.items.push(b1, b2);
    expect(verdictOf(proof, thief).status).toBe("error");
  });
});

