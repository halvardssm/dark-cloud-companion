// The walkthrough also carries its own weapon database (Game Data > Weapons). Extract the parts the weapon FAQ
// doesn't have (description text, how to obtain) and keep its stats for cross-checking against the FAQ data.
// Run: node scripts/extract/weapons-walkthrough.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const text = new TextDecoder("utf-16le")
  .decode(readFileSync(".local/guides/DC.txt"))
  .replace(/^﻿/, "");
const lines = text.replace(/\r/g, "").split("\n");

const start = lines.findIndex((l) => /^Wrenches\/Hammers\/Clubs\t+\[GDWRENCH\]/.test(l));
const end = lines.findIndex(
  (l, i) => i > start && /^Mini-Games|^Medal Collecting\t+\[GDMEDALS\]/.test(l),
);
if (start < 0 || end < 0) throw new Error("weapon region not found");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const nums = (s: string) => s.trim().split(/\s+/).map(Number);

const entry = z.object({
  id: z.string(),
  name: z.string(),
  combos: z.number().int().optional(),
  sp: z.number().int(),
  baseAbs: z.number(),
  abilities: z.array(z.string()),
  description: z.string(),
  buildsUpTo: z.array(z.string()),
  /** Minimum stats as printed: At, Du, Fl, Ch, Li, Cy, Sm, Ex, Be, Sc. */
  minStats: z.array(z.number()),
  maxStats: z.array(z.number()),
  enemies: z.array(z.string()),
  obtained: z.string(),
});

const out: z.infer<typeof entry>[] = [];
for (let i = start; i < end; i++) {
  const m = lines[i].match(
    /^Weapon:\s*(.+?)\s*\t+(?:\s*Combos:\s*(\d+)\s*\t+)?\s*SP:\s*(\d+)\s*\t+\s*Base ABS:\s*([\d.]+)/,
  );
  if (!m) continue;
  const rec: Record<string, unknown> = {
    id: slug(m[1]),
    name: m[1].trim(),
    ...(m[2] ? { combos: Number(m[2]) } : {}),
    sp: Number(m[3]),
    baseAbs: Number(m[4]),
    abilities: [],
    description: "",
    buildsUpTo: [],
    minStats: [],
    maxStats: [],
    enemies: [],
    obtained: "",
  };
  for (let j = i + 1; j < end && lines[j].trim() !== ""; j++) {
    let k: RegExpMatchArray | null;
    if ((k = lines[j].match(/^Abilities:\s*(.*)$/)))
      rec.abilities = /^none$/i.test(k[1].trim())
        ? []
        : k[1]
            .split(/,\s*/)
            .map((x) => x.trim())
            .filter(Boolean);
    else if ((k = lines[j].match(/^Description:\s*(.*)$/))) rec.description = k[1].trim();
    else if ((k = lines[j].match(/^Build Up:\s*(.*)$/)))
      rec.buildsUpTo = /^n\/a$/i.test(k[1].trim())
        ? []
        : k[1]
            .split(/,\s*/)
            .map((x) => x.trim())
            .filter(Boolean);
    else if ((k = lines[j].match(/^Min\. Stats:\s*(.*)$/))) rec.minStats = nums(k[1]);
    else if ((k = lines[j].match(/^Max\. Stats:\s*(.*)$/))) rec.maxStats = nums(k[1]);
    else if ((k = lines[j].match(/^Enemies:\s*(.*)$/)))
      rec.enemies = /^n\/a$/i.test(k[1].trim())
        ? []
        : k[1]
            .split(/,\s*/)
            .map((x) => x.trim())
            .filter(Boolean);
    else if ((k = lines[j].match(/^Obtained:\s*(.*)$/))) {
      let t = k[1];
      for (
        let n = j + 1;
        n < end && lines[n].trim() !== "" && !/^[A-Z][A-Za-z. ]*:/.test(lines[n]);
        n++
      )
        t += " " + lines[n].trim();
      rec.obtained = t.trim();
    }
  }
  out.push(entry.parse(rec));
}
writeFileSync("src/data/weapons-walkthrough.json", JSON.stringify(out, null, 2) + "\n");
console.log(`weapons in walkthrough: ${out.length}`);
