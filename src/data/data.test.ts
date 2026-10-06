import { describe, expect, test } from "vitest";
import chapters from "./chapters.json";
import sections from "./sections.json";
import checklist from "./checklist.json";
import { chaptersFile, checklistFile, sectionsFile } from "./schema";

const ch = chaptersFile.parse(chapters);
const sec = sectionsFile.parse(sections);
const items = checklistFile.parse(checklist);

describe("extracted data", () => {
  test("ids are unique", () => {
    for (const list of [ch, sec, items]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("references resolve", () => {
    const secIds = new Set(sec.map((s) => s.id));
    const chIds = new Set(ch.map((c) => c.id));
    for (const c of ch) for (const id of c.sectionIds) expect(secIds.has(id)).toBe(true);
    for (const s of sec) expect(chIds.has(s.chapterId)).toBe(true);
    for (const i of items) {
      expect(chIds.has(i.chapterId)).toBe(true);
      if (i.sectionId) expect(secIds.has(i.sectionId)).toBe(true);
    }
  });

  test("chapter 1 matches the source's end-of-chapter stats (85 ideas, 4 scoops, 10 inventions)", () => {
    const n = (cat: string) =>
      items.filter((i) => i.chapterId === "c1" && i.category === cat).length;
    expect(n("idea")).toBe(85);
    expect(n("scoop")).toBe(4);
    expect(n("invention")).toBe(10);
  });

  test("every invention ingredient is a known idea or scoop", () => {
    const known = new Set(
      items
        .filter((i) => i.category === "idea" || i.category === "scoop")
        .map((i) => i.name.toLowerCase()),
    );
    const missing = items
      .filter((i) => i.category === "invention")
      .flatMap((i) => (i.recipe ?? []).map((r) => ({ inv: i.name, r: r.name })))
      .filter(({ r }) => !known.has(r.toLowerCase()));
    // Known gaps in source naming are listed here explicitly so new ones fail the test.
    expect(missing.map((m) => `${m.inv}: ${m.r}`)).toEqual([]);
  });

  test("dungeons have enemies and totals", () => {
    for (const s of sec.filter((s) => s.medals)) {
      expect(s.enemies.length, s.id).toBeGreaterThan(0);
      expect(s.totals, s.id).toBeDefined();
    }
  });

  test("post-game items are flagged", () => {
    expect(items.filter((i) => i.postgame).length).toBeGreaterThanOrEqual(6);
  });
});
