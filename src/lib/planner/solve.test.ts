import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { getWeapon, synthSources } from "./sources";
import { simulatePlan } from "./simulate";
import { solveChain } from "./solve";

const items = synthSources.filter((s) => Object.keys(s.gains).some((k) => k !== "du"));

describe("solveChain (items only)", () => {
  test("Battle Wrench -> Drill Wrench is solved and the plan simulates cleanly", async () => {
    const start = freshState(getWeapon("battle-wrench"));
    const r = await solveChain({
      start,
      chain: ["battle-wrench", "drill-wrench"],
      objective: "abs",
      spBonus: 1,
      items,
      templates: [],
    });
    expect(r.status).toBe("optimal");
    const sim = simulatePlan(start, r.plan!, { spBonus: 1 });
    expect(sim.errors).toEqual([]);
    expect(sim.state.weaponId).toBe("drill-wrench");
    // Levelling to +2 and synthing is far cheaper than levelling all the way to +4 (176 ABS).
    expect(sim.cost.abs).toBeLessThan(176);
  });
});
