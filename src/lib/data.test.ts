import { expect, test } from "vitest";
import {
  allMedals,
  chapterProgress,
  checklist,
  inventionReady,
  medalItems,
  sections,
} from "./data";

test("medal ids are unique", () => {
  expect(new Set(allMedals.map((m) => m.id)).size).toBe(allMedals.length);
});

test("medal items come from section data", () => {
  const s = sections.find((x) => x.medals?.prize)!;
  const kinds = medalItems(s).map((m) => m.kind);
  expect(kinds).toContain("timeAttack");
  expect(kinds).toContain("prize");
});

test("invention readiness follows ingredient checks", () => {
  const inv = checklist.find((i) => i.category === "invention" && i.chapterId === "c1")!;
  expect(inventionReady(inv, {})).toBe(false);
  const all: Record<string, true> = Object.fromEntries(checklist.map((i) => [i.id, true as const]));
  expect(inventionReady(inv, all)).toBe(true);
});

test("chapter progress counts checked ids", () => {
  const first = checklist.find((i) => i.chapterId === "c1")!;
  expect(chapterProgress("c1", { [first.id]: true }).done).toBe(1);
  expect(chapterProgress("c1", {}).total).toBeGreaterThan(80);
});
