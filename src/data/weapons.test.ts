import { describe, expect, test } from "vitest";
import raw from "./weapons.json";
import { STAT_KEYS, weaponsData } from "./weapons-schema";

const data = weaponsData.parse(raw);
const byId = new Map(data.weapons.map((w) => [w.id, w]));

describe("weapons data", () => {
  test("has the expected weapon counts per type", () => {
    const count = (t: string) => data.weapons.filter((w) => w.type === t).length;
    expect(data.weapons).toHaveLength(109);
    expect(count("wrench")).toBe(16);
    expect(count("club")).toBe(6);
    expect(count("gun")).toBe(19);
    expect(count("armband")).toBe(19);
    expect(count("sword")).toBe(49);
  });

  test("ids are unique", () => {
    expect(byId.size).toBe(data.weapons.length);
  });

  test("all references resolve", () => {
    for (const w of data.weapons)
      for (const t of w.buildsUpTo) expect(byId.has(t), `${w.id} -> ${t}`).toBe(true);
    for (const s of data.shops) expect(byId.has(s.weaponId)).toBe(true);
    for (const i of data.invented) expect(byId.has(i.weaponId)).toBe(true);
    for (const e of data.events) expect(byId.has(e.weaponId)).toBe(true);
    for (const d of data.dungeonWeapons)
      for (const id of d.weaponIds) expect(byId.has(id)).toBe(true);
  });

  test("build-up never crosses characters or weapon types", () => {
    for (const w of data.weapons)
      for (const t of w.buildsUpTo) expect(byId.get(t)!.type, `${w.id} -> ${t}`).toBe(w.type);
  });

  test("max stats are never below base stats", () => {
    for (const w of data.weapons)
      for (const k of STAT_KEYS)
        expect(w.maxStats[k], `${w.id} ${k}`).toBeGreaterThanOrEqual(w.baseStats[k]);
  });

  test("kill requirements all have a defined enemy entry", () => {
    const known = new Set(data.killEnemies.map((e) => e.name));
    for (const w of data.weapons) for (const e of w.requiresKills) expect(known.has(e)).toBe(true);
  });

  test("matches worked examples from the weapon FAQ", () => {
    const drill = byId.get("drill-wrench")!;
    expect(drill.baseStats).toMatchObject({ at: 16, fl: 2, sm: 10, be: 5, ch: 0 });
    expect(byId.get("battle-wrench")!.baseAbs).toBe(32);
    expect(byId.get("battle-wrench")!.buildsUpTo.sort()).toEqual([
      "drill-wrench",
      "true-battle-wrench",
    ]);
    expect(byId.get("thorn-armlet")!.abilities.sort()).toEqual(["abs-up", "poverty"]);
    expect(byId.get("legend")!.requiresKills).toEqual(["Evil Nail", "Guardia", "Lancer"]);
  });

  test("synth items: spot checks", () => {
    const item = (n: string) => data.synthItems.find((i) => i.name === n)!.gains;
    expect(item("Knight Boots")).toEqual({ at: 2 });
    expect(item("Flame Crystal")).toEqual({ fl: 3 });
    expect(item("Moon Stone")).toMatchObject({ at: 8, ch: 15, du: 8 });
  });
});
