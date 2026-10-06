import { describe, expect, test } from "vitest";
import { freshState } from "@/lib/weapons/mechanics";
import { findChains, planPath, startOptions } from "./plan";
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
  }, 60000);

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

describe("optimal start search", () => {
  test("startOptions lists roots as free and ancestors by their cheapest acquisition", () => {
    const opts = startOptions("smash-wrench", 4);
    expect(opts).toContainEqual({ weaponId: "battle-wrench", acquire: { kind: "have" } });
    expect(opts).toContainEqual({
      weaponId: "drill-wrench",
      acquire: { kind: "shop", shop: "Milane's Weapon Shop", price: 350, chapter: 2 },
    });
    // The target itself can be bought; the cheapest option (invention) wins over the shop price.
    expect(opts).toContainEqual({
      weaponId: "smash-wrench",
      acquire: { kind: "invent", chapter: 3, gilda: 400 },
    });
    // Inventions from a later chapter are out of reach.
    expect(opts.map((o) => o.weaponId)).not.toContain("stinger-wrench");
    expect(opts.map((o) => o.weaponId)).not.toContain("true-battle-wrench");
  });

  test("buys the target outright when that is cheaper than building it", async () => {
    // Reaching the Smash Wrench costs ~700 ABS from the root, but the weapon itself can be
    // invented for 400 gilda — with least ABS the planner should buy it instead.
    const r = await planPath({
      start: start("battle-wrench"),
      optimalStart: true,
      targetId: "smash-wrench",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 8,
      spBonus: 1,
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.errors).toEqual([]);
    expect(r.plan!.stages).toEqual([{ weaponId: "smash-wrench", levelTo: 0, synths: [] }]);
    expect(r.acquire).toEqual({ kind: "invent", chapter: 3, gilda: 400 });
    expect(r.simulation!.cost.abs).toBe(0);
    expect(r.simulation!.cost.gilda).toBe(400);
  }, 240000);

  test("keeps the root start when building up the whole line is cheapest (Grade Zero)", async () => {
    const root = await planPath({
      start: start("battle-wrench"),
      targetId: "grade-zero",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 7,
      spBonus: 1,
    });
    const opt = await planPath({
      start: start("battle-wrench"),
      optimalStart: true,
      targetId: "grade-zero",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 7,
      spBonus: 1,
    });
    expect(root.status).toBe("ok");
    expect(opt.status).toBe("ok");
    expect(opt.simulation!.errors).toEqual([]);
    // Early weapons level up for far less ABS than late ones and every build-up carries the
    // stats forward, so the whole line from the Battle Wrench is genuinely the cheapest start.
    expect(opt.acquire).toEqual({ kind: "have" });
    expect(opt.plan!.stages[0].weaponId).toBe("battle-wrench");
    expect(opt.simulation!.cost.abs).toBeLessThanOrEqual(root.simulation!.cost.abs);
  }, 240000);

  test("the acquisition price counts toward the gilda budget and the plan cost", async () => {
    // Building the Smash Wrench from the root needs at least 510 gilda of synth items, so a
    // 500-gilda budget rules the root build out; buying the weapon (invention, 400) still fits.
    const r = await planPath({
      start: start("battle-wrench"),
      optimalStart: true,
      targetId: "smash-wrench",
      objective: "gilda",
      goal: { kind: "reach" },
      maxChapter: 8,
      spBonus: 1,
      maxGilda: 500,
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.errors).toEqual([]);
    expect(r.acquire).toEqual({ kind: "invent", chapter: 3, gilda: 400 });
    expect(r.simulation!.cost.gilda).toBe(400);
    // Without a budget the same search picks the cheapest overall, but the purchase price is
    // always part of the reported cost.
    const free = await planPath({
      start: start("battle-wrench"),
      optimalStart: true,
      targetId: "smash-wrench",
      objective: "gilda",
      goal: { kind: "reach" },
      maxChapter: 8,
      spBonus: 1,
    });
    expect(free.status).toBe("ok");
    expect(free.simulation!.errors).toEqual([]);
    const price =
      free.acquire?.kind === "shop"
        ? free.acquire.price
        : free.acquire?.kind === "invent"
          ? free.acquire.gilda
          : 0;
    expect(free.simulation!.cost.gilda).toBeGreaterThanOrEqual(price);
  }, 240000);
});

describe("ability goals", () => {
  test("coins are added so the finished weapon carries the wanted abilities", async () => {
    const r = await planPath({
      start: start("battle-wrench"),
      targetId: "smash-wrench",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 8,
      spBonus: 1,
      abilities: ["poison", "dark"],
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.errors).toEqual([]);
    expect(r.simulation!.state.abilities).toEqual(expect.arrayContaining(["poison", "dark"]));
    expect(r.abilitiesMissing).toBeUndefined();
    const last = r.plan!.stages.at(-1)!;
    expect(last.synths.some((s) => s.kind === "item" && s.name === "Poison Coin")).toBe(true);
    expect(last.synths.some((s) => s.kind === "item" && s.name === "Dark Coin")).toBe(true);
  }, 60000);

  test("abilities whose coin isn't sold yet are reported as missing, the rest are still added", async () => {
    const r = await planPath({
      start: start("battle-wrench"),
      targetId: "smash-wrench",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 3,
      spBonus: 1,
      abilities: ["poison", "dark"],
    });
    expect(r.status).toBe("ok");
    expect(r.abilitiesMissing).toEqual(["poison"]);
    expect(r.simulation!.state.abilities).toContain("dark");
  }, 60000);

  test("an opposite ability on the weapon takes a second coin", async () => {
    // Thorn Armlet is born with Poverty; Wealth needs two coins (cancel, then add).
    const r = await planPath({
      start: start("magic-brassard"),
      targetId: "pocklekul",
      objective: "abs",
      goal: { kind: "reach" },
      maxChapter: 8,
      spBonus: 1,
      abilities: ["wealth"],
    });
    expect(r.status).toBe("ok");
    expect(r.simulation!.state.abilities).toContain("wealth");
  }, 90000);
});
