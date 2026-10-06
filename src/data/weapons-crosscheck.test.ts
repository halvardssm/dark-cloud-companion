import { describe, expect, test } from "vitest";
import faqRaw from "./weapons.json";
import wtRaw from "./weapons-walkthrough.json";
import { weaponsData } from "./weapons-schema";

// The weapon FAQ (v3.1, 2016) and the walkthrough's own weapon list (2007) were extracted independently.
// They must agree on everything except the differences recorded here, where the FAQ is the newer source.
const faq = weaponsData.parse(faqRaw);
const wt = wtRaw as {
  id: string;
  name: string;
  combos?: number;
  sp: number;
  baseAbs: number;
  abilities: string[];
  buildsUpTo: string[];
  maxStats: number[];
  enemies: string[];
}[];
const byId = new Map(faq.weapons.map((w) => [w.id, w]));
const nameOf = (id: string) => byId.get(id)!.name;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Levenshtein distance, to forgive one-letter typos in the walkthrough's weapon names. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

describe("walkthrough vs weapon FAQ", () => {
  test("every FAQ weapon is in the walkthrough, plus the unobtainable intro wrench", () => {
    const wtIds = new Set(wt.map((w) => w.id));
    // The walkthrough spells it "Athena's Armet".
    expect(faq.weapons.filter((w) => !wtIds.has(w.id)).map((w) => w.id)).toEqual([
      "athenas-armlet",
    ]);
    expect(wt.filter((w) => !byId.has(w.id)).map((w) => w.name)).toEqual([
      "Wrench",
      "Athena's Armet",
    ]);
  });

  test("base ABS, SP per level and kill requirements agree exactly", () => {
    for (const w of wt) {
      const f = byId.get(w.id);
      if (!f) continue;
      expect(w.baseAbs, `${w.name} ABS`).toBe(f.baseAbs);
      expect(w.sp, `${w.name} SP`).toBe(f.spPerLevel);
      expect([...w.enemies].sort(), `${w.name} enemies`).toEqual([...f.requiresKills].sort());
    }
  });

  test("maximum stats agree except for two documented FAQ/walkthrough differences", () => {
    const order = ["at", "du", "fl", "ch", "li", "cy", "sm", "ex", "be", "sc"] as const;
    const diffs: string[] = [];
    for (const w of wt) {
      const f = byId.get(w.id);
      if (!f) continue;
      const mine = [
        f.maxStats.at,
        f.maxDu,
        ...(["fl", "ch", "li", "cy", "sm", "ex", "be", "sc"] as const).map((k) => f.maxStats[k]),
      ];
      order.forEach((k, i) => {
        if (w.maxStats[i] !== mine[i])
          diffs.push(`${w.id}:${k} walkthrough ${w.maxStats[i]} faq ${mine[i]}`);
      });
    }
    // Turtle Shell Hammer / Kubera's Hand: the (newer) FAQ was kept. Angel Shooter / Mobius Bangle rows were taken
    // from the walkthrough on purpose (see scripts/extract/weapons.ts), so they no longer differ.
    expect(diffs).toEqual(
      [
        "turtle-shell-hammer:sm walkthrough 34 faq 36",
        "kubera-s-hand:at walkthrough 35 faq 45",
      ].map((d) => d.replace("kubera-s-hand", "kuberas-hand")),
    );
  });

  test("the FAQ's abilities and build-up lists are supersets of the walkthrough's", () => {
    for (const w of wt) {
      const f = byId.get(w.id);
      if (!f) continue;
      const abil = new Set(f.abilities.map((a) => a.replace("-", " ")));
      for (const a of w.abilities)
        expect(abil.has(a.toLowerCase()), `${w.name} ability ${a}`).toBe(true);
      const targets = new Set(f.buildsUpTo.map((id) => norm(nameOf(id))));
      for (const t of w.buildsUpTo) {
        // Typos in the walkthrough ("Sargatana", "Tsikikage") are matched by prefix.
        const n = norm(t);
        expect(
          [...targets].some((x) => distance(x, n) <= 2),
          `${w.name} -> ${t}`,
        ).toBe(true);
      }
    }
  });
});
