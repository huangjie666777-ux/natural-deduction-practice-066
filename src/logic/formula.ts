export type Formula =
  | { kind: "atom"; name: string }
  | { kind: "and" | "or" | "imp"; left: Formula; right: Formula };

export class ParseError extends Error {
  pos: number;
  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

export function formulaEquals(a: Formula, b: Formula): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "atom" && b.kind === "atom") return a.name === b.name;
  if (a.kind !== "atom" && b.kind !== "atom") {
    return formulaEquals(a.left, b.left) && formulaEquals(a.right, b.right);
  }
  return false;
}

export function formatFormula(f: Formula): string {
  switch (f.kind) {
    case "atom":
      return f.name;
    case "and":
      return fmtSide(f.left, "and") + " ∧ " + fmtSide(f.right, "and");
    case "or":
      return fmtSide(f.left, "or") + " ∨ " + fmtSide(f.right, "or");
    case "imp":
      return fmtImpLeft(f.left) + " → " + formatFormula(f.right);
  }
}

const prec: Record<Formula["kind"], number> = { atom: 3, and: 2, or: 1, imp: 0 };

function fmtSide(f: Formula, parent: "and" | "or"): string {
  const s = formatFormula(f);
  return prec[f.kind] < prec[parent] ? "(" + s + ")" : s;
}

function fmtImpLeft(f: Formula): string {
  const s = formatFormula(f);
  return f.kind === "imp" ? "(" + s + ")" : s;
}

class Parser {
  private i = 0;
  constructor(private src: string) {}

  parse(): Formula {
    this.skipWs();
    const f = this.parseImp();
    this.skipWs();
    if (this.i < this.src.length) {
      throw new ParseError("意外的字符 “" + this.src[this.i] + "”", this.i);
    }
    return f;
  }

  private skipWs() {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }

  private peek(): string | undefined {
    return this.src[this.i];
  }

  private parseImp(): Formula {
    const left = this.parseOr();
    this.skipWs();
    if (this.peek() === "→") {
      this.i++;
      const right = this.parseImp(); // 右结合
      return { kind: "imp", left, right };
    }
    return left;
  }

  private parseOr(): Formula {
    let left = this.parseAnd();
    for (;;) {
      this.skipWs();
      if (this.peek() !== "∨") return left;
      this.i++;
      const right = this.parseAnd(); // 左结合
      left = { kind: "or", left, right };
    }
  }

  private parseAnd(): Formula {
    let left = this.parseAtom();
    for (;;) {
      this.skipWs();
      if (this.peek() !== "∧") return left;
      this.i++;
      const right = this.parseAtom(); // 左结合
      left = { kind: "and", left, right };
    }
  }

  private parseAtom(): Formula {
    this.skipWs();
    const ch = this.peek();
    if (ch === undefined) {
      throw new ParseError("公式在此处意外结束", this.i);
    }
    if (ch === "(") {
      this.i++;
      const f = this.parseImp();
      this.skipWs();
      if (this.peek() !== ")") {
        throw new ParseError("此处应为 “)”", this.i);
      }
      this.i++;
      return f;
    }
    if (/[A-Z]/.test(ch)) {
      const start = this.i;
      while (this.i < this.src.length && /[A-Z0-9]/.test(this.src[this.i])) this.i++;
      return { kind: "atom", name: this.src.slice(start, this.i) };
    }
    throw new ParseError("意外的字符 “" + ch + "”，应为大写原子或 “(”", this.i);
  }
}

export function parseFormula(src: string): Formula {
  return new Parser(src).parse();
}

export type ParseResult =
  | { ok: true; formula: Formula }
  | { ok: false; message: string; pos: number };

export function tryParseFormula(src: string): ParseResult {
  if (src.trim() === "") {
    return { ok: false, message: "公式不能为空", pos: 0 };
  }
  try {
    return { ok: true, formula: parseFormula(src) };
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, message: e.message, pos: e.pos };
    throw e;
  }
}

