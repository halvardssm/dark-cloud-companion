import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { getWeapon } from "./sources";
import { simulatePlan, simulateRecipe } from "./simulate";
import type { Recipe } from "./types";

// FAQ 7.1: buy Battle Wrench, level to +3, upgrade to True Battle Wrench, level to +5.
const tbw: Recipe = {
  acquire: { kind: "shop", shop: "Milane's Weapon Shop", price: 200, chapter: 1 },
  stages: [
    { weaponId: "battle-wrench", levelTo: 3, synths: [] },
    { weaponId: "true-battle-wrench", levelTo: 5, synths: [] },
  ],
};

describe("simulator", () => {
  test("FAQ 7.1 True Battle Wrench +5: 368 ABS, 33 SP with a support character", () => {
    const r = simulateRecipe(tbw, { spBonus: 1 });
    expect(r.errors).toEqual([]);
    expect(r.cost.abs).toBe(368);
    expect(r.state.weaponId).toBe("true-battle-wrench");
    expect(r.state.level).toBe(5);
    expect(r.state.sp).toBe(33);
  });

  test("without the support bonus SP is 25", () => {
    expect(simulateRecipe(tbw, { spBonus: 0 }).state.sp).toBe(25);
  });

  test("reports unmet build-up requirements", () => {
    const start = freshState(getWeapon("battle-wrench"));
    const r = simulatePlan(start, {
      stages: [
        { weaponId: "battle-wrench", levelTo: 0, synths: [] },
        { weaponId: "drill-wrench", levelTo: 0, synths: [] },
      ],
    });
    expect(r.errors.join()).toMatch(/stats too low/);
  });

  test("reports synths without enough SP", () => {
    const start = freshState(getWeapon("battle-wrench")); // 1 SP
    const r = simulatePlan(start, {
      stages: [
        {
          weaponId: "battle-wrench",
          levelTo: 0,
          synths: [{ kind: "item", name: "Gunpowder", count: 5 }],
        },
      ],
    });
    expect(r.errors.join()).toMatch(/SP/);
  });

  test("a TBW +5 sphere filled with items synths onto a main weapon", () => {
    const sphere: Recipe = {
      ...tbw,
      stages: [
        tbw.stages[0],
        {
          weaponId: "true-battle-wrench",
          levelTo: 5,
          synths: [{ kind: "item", name: "Gunpowder", count: 8 }],
        },
      ],
    };
    const start = freshState(getWeapon("battle-wrench"));
    const r = simulatePlan(start, {
      stages: [
        { weaponId: "battle-wrench", levelTo: 7, synths: [{ kind: "sphere", recipe: sphere }] },
      ],
    });
    expect(r.errors).toEqual([]);
    // 8 Gunpowder = +16 Fl on the TBW (capped at 19), then 60% of it moves to the main weapon.
    expect(r.state.stats.fl).toBeGreaterThan(start.stats.fl + 5);
    expect(r.cost.abs).toBe(368 + 32 + 32 + 48 + 64 + 80 + 96 + 112);
  });
});
