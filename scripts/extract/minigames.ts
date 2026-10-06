// One-off extraction: Ridepod parts and monster classes from DC.txt (Game Data) -> src/data/{ridepod,monsters}.json
// Run: node scripts/extract/minigames.ts
import { readFileSync, writeFileSync } from "node:fs";
import { monstersData, ridepodData, type RidepodPart } from "../../src/lib/schemas.ts";

const text = new TextDecoder("utf-16le")
  .decode(readFileSync(".local/guides/DC.txt"))
  .replace(/^﻿/, "");
const lines = text.replace(/\r/g, "").split("\n");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const find = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));

// ---------------- Ridepod ----------------
const rStart = find(/^The Ridepod ~ Steve\t+\[GDRIDEPOD\]/);
const rEnd = find(/^Monster Transformation\t+\[GDTRANSFO\]/, rStart);
if (rStart < 0 || rEnd < 0) throw new Error("ridepod region not found");
const region = lines.slice(rStart, rEnd);

const parseIngredients = (s: string) =>
  s.split("&").map((p) => {
    const t = p.trim();
    return { scoop: t.startsWith("*"), name: t.replace(/^\*/, "").trim() };
  });

const parseResources = (s: string) =>
  s.split(",").flatMap((p) => {
    const m = p.trim().match(/^(\d+)\s+(.+)$/);
    return m ? [{ qty: Number(m[1]), name: m[2].trim() }] : [];
  });

const sectionOf: Record<string, RidepodPart["category"]> = {
  "Short-Range Weapons:": "short",
  "Long-Range Weapons:": "long",
  "Armor:": "armor",
  "Legs:": "legs",
  "Energy Packs:": "pack",
};

const parts: RidepodPart[] = [];
let category: RidepodPart["category"] | undefined;
for (let i = 0; i < region.length; i++) {
  const l = region[i];
  if (sectionOf[l.trim()]) {
    category = sectionOf[l.trim()];
    continue;
  }
  if (l.startsWith("Upgrades:")) category = undefined;
  if (!category) continue;
  const m = l.match(
    /^(\S.*?)\s*\t+\s*Buy\?\s*(No|(\d+) exp)\s*\t+\s*Capacity:\s*(\d+)\s*\t+\s*(WHP|Armor|Speed|Energy):\s*(.+?)\s*$/,
  );
  if (!m) continue;
  const part: RidepodPart = {
    id: slug(m[1]),
    name: m[1].trim(),
    category,
    ...(m[3] ? { buyExp: Number(m[3]) } : {}),
    capacity: Number(m[4]),
    invent: [],
    resources: [],
  };
  const val = m[6];
  if (m[5] === "WHP") part.whp = Number(val);
  else if (m[5] === "Armor") part.armor = Number(val);
  else if (m[5] === "Energy") part.energy = Number(val);
  else part.speed = val;
  for (let j = i + 1; j < region.length && region[j].trim() !== ""; j++) {
    const x = region[j].trim();
    let k: RegExpMatchArray | null;
    if ((k = x.match(/^Invent:\s*(.+)$/))) part.invent = parseIngredients(k[1]);
    else if ((k = x.match(/^Alternate:\s*(.+)$/))) part.alternate = parseIngredients(k[1]);
    else if ((k = x.match(/^Resources:\s*(.+)$/))) part.resources = parseResources(k[1]);
    else if ((k = x.match(/^Stats:\s*(.+)$/))) {
      part.stats = Object.fromEntries(
        k[1].split(",").flatMap((p) => {
          const n = p.trim().match(/^(\d+)\s+(.+)$/);
          return n ? [[n[2], Number(n[1])]] : [];
        }),
      );
    }
  }
  parts.push(part);
}

const cores = region.flatMap((l) => {
  const m = l.match(
    /^(.+?)(?: \(you start with it\)| \((\d+) exp\)) - (\d+) capacity, (\d+) extra armor capacity/,
  );
  return m
    ? [{ name: m[1].trim(), exp: Number(m[2] ?? 0), capacity: Number(m[3]), armor: Number(m[4]) }]
    : [];
});

const shieldIdx = region.findIndex((l) => l.startsWith(" Shield Kits"));
const shieldText = region
  .slice(shieldIdx, shieldIdx + 8)
  .join(" ")
  .replace(/\s+/g, " ");
const costsPart = shieldText.match(/cost ([\d, and]+) exp/)?.[1] ?? "";
const shieldKitCosts = [...costsPart.matchAll(/\d+/g)].map((m) => Number(m[0]));

const ridepod = ridepodData.parse({ parts, cores, shieldKitCosts });
writeFileSync("src/data/ridepod.json", JSON.stringify(ridepod, null, 2) + "\n");

// ---------------- Monster classes ----------------
const mStart = find(/^Monster Transformation\t+\[GDTRANSFO\]/);
const mEnd = find(/^IV\. Secrets and Misc\./, mStart);
const mRegion = lines.slice(mStart, mEnd);
const classes: unknown[] = [];
let cur: { id: string; name: string; badge: string; forms: unknown[] } | undefined;
for (const l of mRegion) {
  const c = l.match(/^Class:\s*(.+?)\s*\t+\s*Badge:\s*(.+?)\s*$/);
  if (c) {
    cur = { id: slug(c[1]), name: c[1].trim(), badge: c[2], forms: [] };
    classes.push(cur);
    continue;
  }
  if (!cur || l.startsWith("Transformations:") || !l.trim()) continue;
  const f = l.match(/^(\s*)(\S.*?) \((?:Atk (\d+), Def (\d+)|(\d+) Atk, (\d+) Def)\)(.*)$/);
  if (!f) continue;
  const rest = f[7];
  const evo = rest.match(/\(evol\w+ (?:into|to) ([^)]+)\)/)?.[1];
  const note = rest.replace(/\(evol\w+ (?:into|to) [^)]+\)/, "").match(/\(([^)]+)\)/)?.[1];
  const evolvesTo = evo ? evo.split(/ or /).map((s) => s.trim()) : [];
  cur.forms.push({
    name: f[2].trim(),
    atk: Number(f[3] ?? f[5]),
    def: Number(f[4] ?? f[6]),
    evolvesTo,
    ...(note ? { note } : {}),
    depth: f[1].length,
  });
}
// "Fire or Holy Gemron" shares its last word between both options: expand when that names a real form.
for (const c of classes as { forms: { name: string; evolvesTo: string[] }[] }[]) {
  const names = new Set(c.forms.map((f) => f.name));
  for (const f of c.forms) {
    const suffix = f.evolvesTo.at(-1)?.split(" ").slice(1).join(" ");
    f.evolvesTo = f.evolvesTo.map((n) =>
      !names.has(n) && suffix && names.has(`${n} ${suffix}`) ? `${n} ${suffix}` : n,
    );
  }
}
const monsters = monstersData.parse(classes);
writeFileSync("src/data/monsters.json", JSON.stringify(monsters, null, 2) + "\n");
console.log(
  `ridepod parts ${parts.length}, cores ${cores.length}, shield kits ${shieldKitCosts.length}; monster classes ${monsters.length}, forms ${monsters.reduce((n, c) => n + c.forms.length, 0)}`,
);
