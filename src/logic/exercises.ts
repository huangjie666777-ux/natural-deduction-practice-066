export interface Exercise {
  id: string;
  title: string;
  description: string;
  premises: string[];
  goal: string;
}

export const EXERCISES: Exercise[] = [
  {
    id: "conj-comm",
    title: "合取交换",
    description: "从 P ∧ Q 推出 Q ∧ P（练习 ∧E 与 ∧I）",
    premises: ["P ∧ Q"],
    goal: "Q ∧ P",
  },
  {
    id: "imp-trans",
    title: "蕴含传递（嵌套假设）",
    description: "从 P → Q 与 Q → R 推出 P → R（需要开启假设分支）",
    premises: ["P → Q", "Q → R"],
    goal: "P → R",
  },
  {
    id: "or-elim",
    title: "分情况证明",
    description: "从 P ∨ Q、P → R、Q → R 推出 R（练习 ∨E）",
    premises: ["P ∨ Q", "P → R", "Q → R"],
    goal: "R",
  },
  {
    id: "nested-imp",
    title: "嵌套蕴含",
    description: "从 P 推出 Q → (P ∧ Q)（分支内再套分支）",
    premises: ["P"],
    goal: "Q → (P ∧ Q)",
  },
  {
    id: "dist",
    title: "合取对析取的分配",
    description: "从 P ∧ (Q ∨ R) 推出 (P ∧ Q) ∨ (P ∧ R)（嵌套 + 分情况综合）",
    premises: ["P ∧ (Q ∨ R)"],
    goal: "(P ∧ Q) ∨ (P ∧ R)",
  },
];

