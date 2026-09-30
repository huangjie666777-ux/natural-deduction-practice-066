import { useEffect, useMemo, useReducer } from "react";
import {
  Proof,
  ProofBox,
  ProofItem,
  ProofLine,
  makeBox,
  makeLine,
  makeProof,
} from "../logic/proof";
import { validateProof } from "../logic/validate";
import { Exercise } from "../logic/exercises";

const STORAGE_KEY = "nd-proof-v1";

export interface ProofSession {
  proof: Proof;
  exerciseId: string | null; // null 表示自定义
  premises: string[];
}

export type Action =
  | { type: "load"; session: ProofSession }
  | { type: "reset" }
  | { type: "updateLine"; id: string; patch: Partial<Omit<ProofLine, "kind" | "id">> }
  | { type: "addLine"; boxId: string }
  | { type: "addBox"; boxId: string }
  | { type: "deleteLine"; id: string }
  | { type: "deleteBox"; id: string }
  | { type: "setClosed"; id: string; closed: boolean };

function mapItems(items: ProofItem[], fn: (item: ProofItem) => ProofItem | null): ProofItem[] {
  const out: ProofItem[] = [];
  for (const item of items) {
    if (item.kind === "box") {
      const mapped = fn(item);
      if (mapped) out.push(mapped);
    } else {
      const mapped = fn(item);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

function transformBox(box: ProofBox, fn: (item: ProofItem) => ProofItem | null): ProofBox {
  return { ...box, items: mapItems(box.items, (item) => {
    if (item.kind === "box") return fn(transformBox(item, fn));
    return fn(item);
  }) };
}

function updateProof(proof: Proof, fn: (item: ProofItem) => ProofItem | null): Proof {
  return { ...proof, root: transformBox(proof.root, fn) };
}

function appendToBox(proof: Proof, boxId: string, make: () => ProofItem): Proof {
  return updateProof(proof, (item) => {
    if (item.kind === "box" && item.id === boxId) {
      return { ...item, items: [...item.items, make()] };
    }
    return item;
  });
}

function reducer(session: ProofSession, action: Action): ProofSession {
  switch (action.type) {
    case "load":
      return action.session;
    case "reset": {
      return {
        ...session,
        proof: makeProof(session.premises, session.proof.goal),
      };
    }
    case "updateLine": {
      const proof = updateProof(session.proof, (item) => {
        if (item.kind === "line" && item.id === action.id) {
          return { ...item, ...action.patch };
        }
        return item;
      });
      return { ...session, proof };
    }
    case "addLine": {
      return { ...session, proof: appendToBox(session.proof, action.boxId, () => makeLine()) };
    }
    case "addBox": {
      return { ...session, proof: appendToBox(session.proof, action.boxId, () => makeBox()) };
    }
    case "deleteLine": {
      const proof = updateProof(session.proof, (item) => {
        if (item.kind === "line" && item.id === action.id && item.rule !== "premise") {
          return null;
        }
        return item;
      });
      return { ...session, proof };
    }
    case "deleteBox": {
      const proof = updateProof(session.proof, (item) => {
        if (item.kind === "box" && item.id === action.id) return null;
        return item;
      });
      return { ...session, proof };
    }
    case "setClosed": {
      const proof = updateProof(session.proof, (item) => {
        if (item.kind === "box" && item.id === action.id) {
          return { ...item, closed: action.closed };
        }
        return item;
      });
      return { ...session, proof };
    }
  }
}

export function sessionFromExercise(ex: Exercise): ProofSession {
  return {
    proof: makeProof(ex.premises, ex.goal),
    exerciseId: ex.id,
    premises: [...ex.premises],
  };
}

export function sessionFromCustom(premises: string[], goal: string): ProofSession {
  return {
    proof: makeProof(premises, goal),
    exerciseId: null,
    premises: [...premises],
  };
}

export function loadSession(fallback: ProofSession): ProofSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as ProofSession;
    if (!data || !data.proof || !data.proof.root) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export function useProofSession(initial: ProofSession) {
  const [session, dispatch] = useReducer(reducer, initial, loadSession);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // 存储不可用时忽略
    }
  }, [session]);

  const validation = useMemo(() => validateProof(session.proof), [session.proof]);

  return { session, dispatch, validation };
}

