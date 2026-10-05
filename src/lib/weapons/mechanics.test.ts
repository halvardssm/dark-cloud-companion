import { describe, expect, test } from "vitest";
import raw from "@/data/weapons.json";
import { weaponsData } from "@/data/weapons-schema";
import {
  absBetween,
  absForNextLevel,
  absToReach,
  addAbilities,
  attackTransfer,
  buildUp,
  buildUpRequirements,
  canBuildUp,
  freshState,
  levelUp,
  levelUpTo,
  sphereFromWeapon,
  synth,
} from "./mechanics";

const data = weaponsData.parse(raw);
const w = (id: string) => data.weapons.find((x) => x.id === id)!;

describe("ABS formulas (FAQ 4.1)", () => {
  test("Battle Wrench requirement sequence is 32, 32, 48, 64, 80", () => {
    const seq = [0, 1, 2, 3, 4].map((n) => absForNextLevel(32, n));
    expect(seq).toEqual([32, 32, 48, 64, 80]);
  });

  test("total ABS to +N is the sum of the per-level requirements", () => {
    let total = 0;
    for (let n = 0; n < 12; n++) {
      total += absForNextLevel(32, n);
      expect(absToReach(32, n + 1)).toBe(total);
    }
    expect(absBetween(32, 3, 5)).toBe(absForNextLevel(32, 3) + absForNextLevel(32, 4));
  });
});

describe("abilities (FAQ 4.2)", () => {
  test("opposites cancel; abilities without opposites don't stack", () => {
    expect(addAbilities(["abs-up", "poverty"], ["wealth"])).toEqual(["abs-up"]);
    expect(addAbilities(["poison"], ["poison"])).toEqual(["poison"]);
  });

  test("Thorn Armlet -> Pocklekul keeps ABS Up and drops Poverty/Wealth (FAQ example)", () => {
    const thorn = freshState(w("thorn-armlet"));
    const next = buildUp(thorn, w("pocklekul"));
    expect(next.abilities).toEqual(["abs-up"]);
  });
});

describe("leveling", () => {
  test("At +2 per level for five levels, then +1; SP by weapon tier", () => {
    const bw = w("battle-wrench");
    const s5 = levelUpTo(freshState(bw), bw, 5);
    expect(s5.stats.at).toBe(8 + 5 * 2);
    expect(s5.sp).toBe(1 + 5 * 3);
    expect(levelUpTo(freshState(bw), bw, 7).stats.at).toBe(8 + 10 + 2);
    expect(levelUpTo(freshState(bw), bw, 5).du).toBe(5);
  });

  test("weapons with kill requirements gain +3 At for the first five levels", () => {
    const legend = w("legend");
    expect(levelUp(freshState(legend), legend).stats.at).toBe(150 + 3);
  });

  test("support-character SP bonus", () => {
    const bw = w("battle-wrench");
    expect(levelUp(freshState(bw), bw, 1).sp).toBe(1 + 3 + 1);
  });
});

describe("spectrumize (FAQ 4.3)", () => {
  test("non-At stats keep 60%, floored: 18 Fl -> 10", () => {
    const aux = {
      ...freshState(w("battle-wrench")),
      stats: { ...freshState(w("battle-wrench")).stats, fl: 18 },
    };
    expect(sphereFromWeapon(aux, 100).gains.fl).toBe(10);
  });

  test("At transfer: 25% when main At >= aux At", () => {
    expect(attackTransfer(50, 40)).toBe(10);
  });

  test("At transfer: main At 2/3 of aux gives 50%, 1/3 gives 75% (FAQ)", () => {
    expect(attackTransfer(40, 60)).toBe(30);
    expect(attackTransfer(20, 60)).toBe(45);
  });

  test("synth spends SP and refuses without enough", () => {
    const bw = w("battle-wrench");
    const s = freshState(bw); // 1 SP
    const after = synth(s, bw, { fl: 2 }, 1);
    expect(after.stats.fl).toBe(s.stats.fl + 2);
    expect(after.sp).toBe(0);
    expect(synth(after, bw, { fl: 2 }, 1)).toBe(after);
  });
});

describe("build-up (FAQ 4.5)", () => {
  test("requirements for Drill Wrench match the FAQ: 15 At, 2 Fl, 9 Sm, 5 Be", () => {
    const req = buildUpRequirements(w("drill-wrench"));
    expect(req).toMatchObject({ at: 15, fl: 2, sm: 9, be: 5, ch: 0 });
  });

  test("worked example: Battle Wrench 20/19/19/19 -> Drill Wrench 21/19/20/19", () => {
    const bw = w("battle-wrench");
    const state = {
      ...freshState(bw),
      stats: { ...freshState(bw).stats, at: 20, fl: 19, sm: 19, be: 19 },
    };
    expect(canBuildUp(state, bw, w("drill-wrench"), new Set())).toBe(true);
    const next = buildUp(state, w("drill-wrench"));
    expect(next).toMatchObject({ weaponId: "drill-wrench", level: 0 });
    expect(next.stats).toMatchObject({ at: 21, fl: 19, sm: 20, be: 19 });
  });

  test("a fresh Battle Wrench cannot yet build up to Drill Wrench", () => {
    const bw = w("battle-wrench");
    expect(canBuildUp(freshState(bw), bw, w("drill-wrench"), new Set())).toBe(false);
  });

  test("kill requirements gate build-up", () => {
    const hh = w("heavy-hammer");
    const digi = w("digi-hammer");
    const state = { ...freshState(digi), stats: { ...hh.baseStats } };
    expect(canBuildUp(state, digi, hh, new Set())).toBe(false);
    expect(canBuildUp(state, digi, hh, new Set(["Iron Mask", "Pirate Eye"]))).toBe(true);
  });

  test("cannot build up along a non-existent edge", () => {
    const bw = w("battle-wrench");
    const legend = w("legend");
    const state = { ...freshState(bw), stats: { ...legend.baseStats } };
    expect(canBuildUp(state, bw, legend, new Set(legend.requiresKills))).toBe(false);
  });
});
