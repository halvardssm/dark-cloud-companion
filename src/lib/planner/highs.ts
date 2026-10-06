import loadHighs from "highs";

type Highs = Awaited<ReturnType<typeof loadHighs>>;
let instance: Promise<Highs> | undefined;

/** Lazily loads the HiGHS WebAssembly solver (once). In the browser the wasm file is fetched from the app bundle. */
export function getHighs(): Promise<Highs> {
  instance ??= (async () => {
    const isNode = typeof process !== "undefined" && !!process.versions?.node;
    if (isNode) return loadHighs();
    const wasm = (await import("highs/runtime?url")).default;
    return loadHighs({ locateFile: () => wasm });
  })();
  return instance;
}

export interface LpRow {
  name: string;
  coeffs: Map<string, number>;
  min?: number;
  max?: number;
}

export interface LpModel {
  /** Variable name -> objective coefficient. */
  objective: Map<string, number>;
  rows: LpRow[];
  integers: string[];
  /** Upper bounds for variables (lower bound is always 0). */
  upper?: Map<string, number>;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(6));
const term = (c: number, v: string) => `${c < 0 ? "-" : "+"} ${num(Math.abs(c))} ${v}`;

/** Serialises to CPLEX LP format (variable/row names must start with a letter other than e/E followed by digits). */
export function toLp(m: LpModel): string {
  const out: string[] = ["Minimize"];
  const obj = [...m.objective].filter(([, c]) => c !== 0);
  out.push(` obj: ${obj.length ? obj.map(([v, c]) => term(c, v)).join(" ") : "0 vz"}`);
  out.push("Subject To");
  for (const r of m.rows) {
    const expr = [...r.coeffs]
      .filter(([, c]) => c !== 0)
      .map(([v, c]) => term(c, v))
      .join(" ");
    if (!expr) continue;
    if (r.min !== undefined) out.push(` ${r.name}_lo: ${expr} >= ${num(r.min)}`);
    if (r.max !== undefined) out.push(` ${r.name}_hi: ${expr} <= ${num(r.max)}`);
  }
  if (m.upper?.size) {
    out.push("Bounds");
    for (const [v, u] of m.upper) out.push(` 0 <= ${v} <= ${num(u)}`);
  }
  if (m.integers.length) {
    out.push("Generals");
    out.push(` ${m.integers.join(" ")}`);
  }
  out.push("End");
  return out.join("\n");
}

export interface LpSolution {
  status: "optimal" | "infeasible" | "timedout" | "error";
  value?: number;
  values: Map<string, number>;
}

export async function solveLp(
  m: LpModel,
  opts: { timeLimitSec?: number; mipGap?: number; objectiveBound?: number } = {},
): Promise<LpSolution> {
  const highs = await getHighs();
  const res = highs.solve(toLp(m), {
    output_flag: false,
    time_limit: opts.timeLimitSec ?? 10,
    mip_rel_gap: opts.mipGap ?? 0.001,
    // Primal bound: solutions no better than this are cut off (solver reports "infeasible").
    ...(opts.objectiveBound !== undefined ? { objective_bound: opts.objectiveBound } : {}),
  });
  const values = new Map<string, number>();
  for (const [name, col] of Object.entries(res.Columns ?? {}))
    values.set(name, (col as { Primal: number }).Primal);
  if (res.Status === "Optimal") return { status: "optimal", value: res.ObjectiveValue, values };
  if (res.Status === "Infeasible" || res.Status === "Primal infeasible or unbounded")
    return { status: "infeasible", values };
  if (res.Status === "Time limit reached")
    return values.size
      ? { status: "timedout", value: res.ObjectiveValue, values }
      : { status: "timedout", values };
  return { status: "error", values };
}
