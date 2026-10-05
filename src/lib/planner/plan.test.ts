import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { findChains, planPath } from "./plan";
import { getWeapon } from "./sources";

const start = (id: string) => freshState(getWeapon(id));

describe("findChains", () => {
  test("Battle Wrench reaches Drill Wrench directly and via True Battle Wrench", () => {
    const chains = findChains("battle-wrench", "drill-wrench", 8).map((c) => c.join(">"));
    expect(chains).toContain("battle-wrench>drill-wrench");
    expect(chains).toContain("battle-wrench>true-battle-wrench>drill-wrench");
  });

  test("kill requirements from late chapters block early plans", () => {
    expect(findChains("battle-wrench", "grade-zero", 5)).toEqual([]);
    expect(findChains("battle-wrench", "grade-zero", 7).length).toBeGreaterThan(0);
  });
});

describe("planPath", () => {
  test("reaches Smash Wrench cheaply and the result is simulator-valid", async () => {
    const r = await planPath({
      start: start("battle-wrench"),
      targetId: "smash-wrench",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 3,
      spBonus: 1,
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.errors).toEqual([]);
    expect(r.simulation!.state.weaponId).toBe("smash-wrench");
    expect(r.simulation!.cost.abs).toBeLessThan(2000);
  });

  test("Grade Zero by chapter 7 with least ABS beats the FAQ's full recipe (24160 ABS, which also maxes stats and abilities)", async () => {
    const r = await planPath({
      start: start("battle-wrench"),
      targetId: "grade-zero",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 7,
      spBonus: 1,
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.errors).toEqual([]);
    expect(r.simulation!.cost.abs).toBeLessThan(24160);
  }, 60000);

  test("no plan when a required enemy cannot be reached yet", async () => {
    const r = await planPath({
      start: start("battle-wrench"),
      targetId: "legend",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 4,
      spBonus: 1,
    });
    expect(r.status).toBe("no-path");
  });
});

describe("gilda budget and chapters", () => {
  test("a gilda budget changes the plan away from expensive gems", async () => {
    const common = {
      start: start("battle-wrench"),
      targetId: "stinger-wrench",
      objective: "abs" as const,
      goal: { kind: "reach" as const },
      maxChapter: 8,
      spBonus: 1,
    };
    const free = await planPath(common);
    const capped = await planPath({ ...common, maxGilda: 3000 });
    expect(free.status).toBe("ok");
    expect(capped.status).toBe("ok");
    expect(capped.simulation!.cost.gilda).toBeLessThanOrEqual(3000);
    expect(capped.simulation!.cost.abs).toBeGreaterThanOrEqual(free.simulation!.cost.abs);
  }, 60000);
});

test("earliestChapter follows enemy kill requirements", async () => {
  const { earliestChapter } = await import("./plan");
  expect(earliestChapter("battle-wrench", "drill-wrench")).toBe(1);
  expect(earliestChapter("battle-wrench", "grade-zero")).toBe(7);
});
