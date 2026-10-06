import { describe, expect, test } from "vitest";
import inventionsRaw from "./inventions.json";
import georamaRaw from "./georama.json";
import shopsRaw from "./shops.json";
import itemsRaw from "./items-overview.json";
import fishingRaw from "./fishing.json";
import weaponsRaw from "./weapons.json";
import sectionsRaw from "./sections.json";
import checklistRaw from "./checklist.json";
import { gamedata } from "./gamedata-schema";
import { sectionsFile, checklistFile } from "./schema";
import { weaponsData } from "./weapons-schema";

const inventions = gamedata.inventions.parse(inventionsRaw);
const georama = {
  parts: gamedata.georamaParts.parse(georamaRaw.parts),
  areas: gamedata.georamaAreas.parse(georamaRaw.areas),
};
const shops = gamedata.shops.parse(shopsRaw);
const items = gamedata.items.parse(itemsRaw);
const fishing = gamedata.fishing.parse(fishingRaw);
const sections = sectionsFile.parse(sectionsRaw);
const checklist = checklistFile.parse(checklistRaw);
const weapons = weaponsData.parse(weaponsRaw);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

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
    const byName = new Map(items.map((i) => [norm(i.name), i]));
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
