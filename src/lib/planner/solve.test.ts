import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { getWeapon, synthSources } from "./sources";
import { simulatePlan } from "./simulate";
import { solveChain } from "./solve";

const items = synthSources.filter((s) => Object.keys(s.gains).some((k) => k !== "du"));
const start = freshState(getWeapon("battle-wrench"));

describe("solveChain (items only)", () => {
  const base = (extra: Record<string, unknown> = {}) => ({
    start,
    chain: ["battle-wrench", "drill-wrench"],
    objective: "abs" as const,
    spBonus: 1,
    items,
    templates: [],
    ...extra,
  });

  test("Battle Wrench -> Drill Wrench is solved and the plan simulates cleanly", async () => {
    const r = await solveChain(base());
    expect(r.status).toBe("optimal");
    const sim = simulatePlan(start, r.plan!, { spBonus: 1 });
    expect(sim.errors).toEqual([]);
    expect(sim.state.weaponId).toBe("drill-wrench");
    // Levelling to +2 and synthing is far cheaper than levelling all the way to +4 (176 ABS).
    expect(sim.cost.abs).toBeLessThan(176);
  });

  test("the objective value is the simulated cost plus a small secondary weight", async () => {
    const r = await solveChain(base());
    expect(r.status).toBe("optimal");
    const sim = simulatePlan(start, r.plan!, { spBonus: 1 });
    const key = sim.cost.abs + 1e-3 * sim.cost.gilda;
    expect(Math.abs(r.value! - key)).toBeLessThan(1e-6);
  });

  test("objectiveBound prunes chains that cannot beat it", async () => {
    const best = await solveChain(base());
    expect(best.status).toBe("optimal");
    const pruned = await solveChain(base({ objectiveBound: best.value! - 100 }));
    expect(pruned.plan).toBeUndefined();
    const kept = await solveChain(base({ objectiveBound: best.value! + 100 }));
    expect(kept.status).toBe("optimal");
    expect(kept.plan).toBeDefined();
  });
});
