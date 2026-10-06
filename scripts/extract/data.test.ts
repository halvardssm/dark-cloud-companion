// Cross-checks the committed extracted data (src/data/*.json) against the zod schemas, across
// the two source guides and against the game's own printed totals. Kept next to the extractors
// (scripts/extract/*.ts) that produce the data.
import { describe, expect, test } from "vitest";
import chaptersRaw from "../../src/data/chapters.json";
import checklistRaw from "../../src/data/checklist.json";
import fishingRaw from "../../src/data/fishing.json";
import georamaRaw from "../../src/data/georama.json";
import inventionsRaw from "../../src/data/inventions.json";
import itemsOverviewRaw from "../../src/data/items-overview.json";
import monstersRaw from "../../src/data/monsters.json";
import ridepodRaw from "../../src/data/ridepod.json";
import sectionsRaw from "../../src/data/sections.json";
import shopsRaw from "../../src/data/shops.json";
import weaponsRaw from "../../src/data/weapons.json";
import weaponsWalkthroughRaw from "../../src/data/weapons-walkthrough.json";
import { ingredientIdByName } from "../../src/lib/data.ts";
import {
  STAT_KEYS,
  chaptersFile,
  checklistFile,
  gamedata,
  monstersData,
  ridepodData,
  sectionsFile,
  weaponsData,
} from "../../src/lib/schemas.ts";

const chapters = chaptersFile.parse(chaptersRaw);
const sections = sectionsFile.parse(sectionsRaw);
const checklist = checklistFile.parse(checklistRaw);
const weapons = weaponsData.parse(weaponsRaw);
const byId = new Map(weapons.weapons.map((w) => [w.id, w]));
const inventions = gamedata.inventions.parse(inventionsRaw);
const georama = {
  parts: gamedata.georamaParts.parse(georamaRaw.parts),
  areas: gamedata.georamaAreas.parse(georamaRaw.areas),
};
const shops = gamedata.shops.parse(shopsRaw);
const itemsOverview = gamedata.items.parse(itemsOverviewRaw);
const fishing = gamedata.fishing.parse(fishingRaw);
const ridepod = ridepodData.parse(ridepodRaw);
const monsters = monstersData.parse(monstersRaw);

// The weapon FAQ (v3.1, 2016) and the walkthrough's own weapon list (2007) were extracted
// independently; they must agree on everything except the differences recorded in the tests below.
const wt = weaponsWalkthroughRaw as {
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const nameOf = (id: string) => byId.get(id)!.name;

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

describe("extracted chapters, sections and checklist", () => {
  test("ids are unique", () => {
    for (const list of [chapters, sections, checklist]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("references resolve", () => {
    const secIds = new Set(sections.map((s) => s.id));
    const chIds = new Set(chapters.map((c) => c.id));
    for (const c of chapters) for (const id of c.sectionIds) expect(secIds.has(id)).toBe(true);
    for (const s of sections) expect(chIds.has(s.chapterId)).toBe(true);
    for (const i of checklist) {
      expect(chIds.has(i.chapterId)).toBe(true);
      if (i.sectionId) expect(secIds.has(i.sectionId)).toBe(true);
    }
  });

  test("chapter 1 matches the source's end-of-chapter stats (85 ideas, 4 scoops, 10 inventions)", () => {
    const n = (cat: string) =>
      checklist.filter((i) => i.chapterId === "c1" && i.category === cat).length;
    expect(n("idea")).toBe(85);
    expect(n("scoop")).toBe(4);
    expect(n("invention")).toBe(10);
  });

  test("every invention ingredient is a known idea or scoop", () => {
    const known = new Set(
      checklist
        .filter((i) => i.category === "idea" || i.category === "scoop")
        .map((i) => i.name.toLowerCase()),
    );
    const missing = checklist
      .filter((i) => i.category === "invention")
      .flatMap((i) => (i.recipe ?? []).map((r) => ({ inv: i.name, r: r.name })))
      .filter(({ r }) => !known.has(r.toLowerCase()));
    // Known gaps in source naming are listed here explicitly so new ones fail the test.
    expect(missing.map((m) => `${m.inv}: ${m.r}`)).toEqual([]);
  });

  test("dungeons have enemies and totals", () => {
    for (const s of sections.filter((s) => s.medals)) {
      expect(s.enemies.length, s.id).toBeGreaterThan(0);
      expect(s.totals, s.id).toBeDefined();
    }
  });

  test("post-game items are flagged", () => {
    expect(checklist.filter((i) => i.postgame).length).toBeGreaterThanOrEqual(6);
  });
});

describe("weapons data", () => {
  test("has the expected weapon counts per type", () => {
    const count = (t: string) => weapons.weapons.filter((w) => w.type === t).length;
    expect(weapons.weapons).toHaveLength(109);
    expect(count("wrench")).toBe(16);
    expect(count("club")).toBe(6);
    expect(count("gun")).toBe(19);
    expect(count("armband")).toBe(19);
    expect(count("sword")).toBe(49);
  });

  test("ids are unique", () => {
    expect(byId.size).toBe(weapons.weapons.length);
  });

  test("SP tiers are only 3 (low), 4 (mid) or 6 (high) — the planner groups weapons by them", () => {
    for (const w of weapons.weapons) expect(w.spPerLevel, w.name).toBeLessThanOrEqual(6);
    expect(new Set(weapons.weapons.map((w) => w.spPerLevel))).toEqual(new Set([3, 4, 6]));
  });

  test("all references resolve", () => {
    for (const w of weapons.weapons)
      for (const t of w.buildsUpTo) expect(byId.has(t), `${w.id} -> ${t}`).toBe(true);
    for (const s of weapons.shops) expect(byId.has(s.weaponId)).toBe(true);
    for (const i of weapons.invented) expect(byId.has(i.weaponId)).toBe(true);
    for (const e of weapons.events) expect(byId.has(e.weaponId)).toBe(true);
    for (const d of weapons.dungeonWeapons)
      for (const id of d.weaponIds) expect(byId.has(id)).toBe(true);
  });

  test("build-up never crosses characters or weapon types", () => {
    for (const w of weapons.weapons)
      for (const t of w.buildsUpTo) expect(byId.get(t)!.type, `${w.id} -> ${t}`).toBe(w.type);
  });

  test("max stats are never below base stats", () => {
    for (const w of weapons.weapons)
      for (const k of STAT_KEYS)
        expect(w.maxStats[k], `${w.id} ${k}`).toBeGreaterThanOrEqual(w.baseStats[k]);
  });

  test("kill requirements all have a defined enemy entry", () => {
    const known = new Set(weapons.killEnemies.map((e) => e.name));
    for (const w of weapons.weapons)
      for (const e of w.requiresKills) expect(known.has(e)).toBe(true);
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
    const item = (n: string) => weapons.synthItems.find((i) => i.name === n)!.gains;
    expect(item("Knight Boots")).toEqual({ at: 2 });
    expect(item("Flame Crystal")).toEqual({ fl: 3 });
    expect(item("Moon Stone")).toMatchObject({ at: 8, ch: 15, du: 8 });
  });
});

describe("walkthrough vs weapon FAQ", () => {
  test("every FAQ weapon is in the walkthrough, plus the unobtainable intro wrench", () => {
    const wtIds = new Set(wt.map((w) => w.id));
    // The walkthrough spells it "Athena's Armet".
    expect(weapons.weapons.filter((w) => !wtIds.has(w.id)).map((w) => w.id)).toEqual([
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
    // Turtle Shell Hammer / Kubera's Hand: the (newer) FAQ was kept. Angel Shooter / Mobius Bangle rows
    // were taken from the walkthrough on purpose (see scripts/extract/weapons.ts), so they no longer differ.
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

describe("game data extraction", () => {
  test("inventions: 128 entries that line up with the chapter checklists", () => {
    expect(inventions).toHaveLength(128);
    const byName = new Map(
      checklist.filter((i) => i.category === "invention").map((i) => [norm(i.name), i]),
    );
    const missing = inventions.filter((i) => !byName.has(norm(i.name))).map((i) => i.name);
    expect(missing).toEqual([]);
    for (const inv of inventions) {
      const c = byName.get(norm(inv.name));
      if (!c) continue;
      const a = inv.ideas.map((i) => norm(i.name)).sort();
      const b = (c.recipe ?? []).map((i) => norm(i.name)).sort();
      expect(a, inv.name).toEqual(b);
    }
  });

  test("Georama: 76 parts, 5 areas each with a completion reward", () => {
    expect(georama.parts).toHaveLength(76);
    expect(georama.areas.map((a) => a.name)).toEqual([
      "Sindain",
      "Balance Valley",
      "Veniccio",
      "Heim Rada",
      "Moon Flower Palace",
    ]);
    for (const a of georama.areas) {
      expect(a.reward, a.name).toBeTruthy();
      expect(a.tasks.length).toBeGreaterThan(5);
      // Tasks are worth 100% in total.
      expect(
        a.tasks.reduce((n, t) => n + t.percent, 0),
        a.name,
      ).toBe(100);
    }
  });

  test("Georama completion rewards agree with the weapon FAQ's event weapons", () => {
    const events = new Set(
      weapons.events.map((e) => weapons.weapons.find((w) => w.id === e.weaponId)!.name),
    );
    for (const name of ["Jurak Gun", "Serpent Slicer", "Holy Daedalus Blade"]) {
      expect(events.has(name)).toBe(true);
      expect(georama.areas.some((a) => a.reward === name)).toBe(true);
    }
  });

  test("shops: only real shops, with currencies", () => {
    expect(shops.map((s) => s.name)).not.toContain(expect.stringMatching(/^NOTE|^\*/));
    expect(shops.find((s) => s.name === "Need's Medal Exchange")?.currency).toBe("medals");
    expect(shops.find((s) => s.name === "G-Parts")?.currency).toBe("exp");
    expect(
      shops
        .find((s) => s.name === "Conda's Goods")
        ?.items.some((i) => i.name === "Gunpowder" && i.price === 20),
    ).toBe(true);
  });

  test("item overview synth values agree with the weapon FAQ's spectrumize tables", () => {
    const short: Record<string, string> = {
      at: "At",
      du: "Du",
      fl: "Fl",
      ch: "Ch",
      li: "Li",
      cy: "Cy",
      sm: "Sm",
      ex: "Ex",
      be: "Be",
      sc: "Sc",
    };
    const byName = new Map(itemsOverview.map((i) => [norm(i.name), i]));
    const diffs: string[] = [];
    for (const s of weapons.synthItems) {
      const o = byName.get(norm(s.name));
      if (!o) continue;
      const mine = Object.fromEntries(Object.entries(s.gains).map(([k, v]) => [short[k], v]));
      if (
        JSON.stringify(Object.entries(mine).sort()) !==
        JSON.stringify(Object.entries(o.synth).sort())
      )
        diffs.push(`${s.name}: faq ${JSON.stringify(mine)} vs guide ${JSON.stringify(o.synth)}`);
    }
    // Every difference between the two guides is listed here so a new one fails loudly.
    expect(diffs).toEqual([]);
  });

  test("every section's medal count matches the guide's medal breakdown (127 levels)", () => {
    const perChapter: Record<string, number> = {
      c1: 5,
      c2: 9,
      c3: 16,
      c4: 14,
      c5: 16,
      c6: 12,
      c7: 24,
      c8: 31,
    };
    for (const [ch, n] of Object.entries(perChapter)) {
      expect(sections.filter((s) => s.chapterId === ch && s.medals).length, ch).toBe(n);
    }
  });

  test("fishing tables and Donny's rewards", () => {
    expect(fishing.baits.length).toBeGreaterThanOrEqual(12);
    expect(fishing.lures.map((l) => l.name)).toEqual(["Frog", "Minnow", "Spinner", "Fork"]);
    expect(fishing.photoRewards[0]).toEqual({ level: 2, points: 100, reward: "Diamond" });
    expect(fishing.photoRewards).toHaveLength(7);
  });
});

describe("ridepod data", () => {
  test("part counts per category match the source (5 families × 4 weapons, 8 armors, 9 legs, 6 packs)", () => {
    const n = (c: string) => ridepod.parts.filter((p) => p.category === c).length;
    expect([n("short"), n("long"), n("armor"), n("legs"), n("pack")]).toEqual([20, 20, 8, 9, 6]);
  });

  test("every part has a 3-ingredient recipe and resources", () => {
    for (const p of ridepod.parts) {
      expect(p.invent, p.name).toHaveLength(3);
      expect(p.resources.length, p.name).toBeGreaterThan(0);
    }
  });

  test("ids are unique; 7 cores and 21 shield kits", () => {
    expect(new Set(ridepod.parts.map((p) => p.id)).size).toBe(ridepod.parts.length);
    expect(ridepod.cores).toHaveLength(7);
    expect(ridepod.shieldKitCosts).toHaveLength(21);
  });

  test("recipe ingredients are known ideas or scoops", () => {
    const missing = ridepod.parts.flatMap((p) =>
      [...p.invent, ...(p.alternate ?? [])]
        .filter((i) => !ingredientIdByName.has(i.name.toLowerCase()))
        .map((i) => `${p.name}: ${i.name}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("monster data", () => {
  test("10 classes, every evolution target exists in its class", () => {
    expect(monsters).toHaveLength(10);
    for (const c of monsters) {
      const names = new Set(c.forms.map((f) => f.name));
      for (const f of c.forms)
        for (const t of f.evolvesTo) expect(names.has(t), `${c.name}: ${t}`).toBe(true);
    }
  });
});
