// One-off extraction: ".local/guides/DC weapon guide.txt" -> src/data/weapons.json
// Only structured facts (stats, costs, recipes, build-up edges) are carried over, never prose.
// Run: node scripts/extract/weapons.ts
import { readFileSync, writeFileSync } from "node:fs";
import {
  STAT_KEYS,
  weaponsData,
  type AbilityId,
  type StatKey,
  type SynthItem,
  type Weapon,
  type WeaponsData,
} from "../../src/lib/schemas.ts";

// The walkthrough's own weapon list (scripts/extract/weapons-walkthrough.ts) supplies descriptions and a second opinion on stats.
const walkthrough: { id: string; description: string; maxStats: number[] }[] = JSON.parse(
  readFileSync("src/data/weapons-walkthrough.json", "utf8"),
);

/**
 * Cross-source corrections. The FAQ's maximum-stat rows for Angel Shooter and Mobius Bangle have their elemental
 * columns swapped relative to the walkthrough; only the walkthrough's version is consistent with Angel Shooter's
 * base Cyclone (170), so those two rows are taken from the walkthrough.
 */
const MAX_STATS_FROM_WALKTHROUGH = new Set(["angel-shooter", "mobius-bangle"]);

const lines = readFileSync(".local/guides/DC weapon guide.txt", "utf8")
  .replace(/\r/g, "")
  .split("\n");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Index of the body heading (skips the table of contents, which is in the first ~100 lines). */
function heading(re: RegExp, from = 100): number {
  const i = lines.findIndex((l, n) => n >= from && re.test(l.trim()));
  if (i < 0) throw new Error(`heading not found: ${re}`);
  return i;
}

const isBanner = (l: string) => l.startsWith("=-=-=");
const isHeading = (l: string) =>
  /^\d+\.\d+(\.\d+)? - /.test(l.trim()) || /^\d+\.0 - /.test(l.trim());

/** Lines of a "=-=-=\n Title\n=-=-=" subsection inside [start, end). */
function subsection(start: number, end: number, title: string): string[] {
  for (let i = start; i < end - 2; i++) {
    if (isBanner(lines[i]) && lines[i + 1].trim() === title && isBanner(lines[i + 2])) {
      const out: string[] = [];
      for (let j = i + 3; j < end && !isBanner(lines[j]) && !isHeading(lines[j]); j++)
        out.push(lines[j]);
      return out;
    }
  }
  return [];
}

const abilityMap: Record<string, AbilityId> = {
  wealth: "wealth",
  poverty: "poverty",
  poison: "poison",
  stop: "stop",
  steal: "steal",
  critical: "critical",
  durable: "durable",
  fragile: "fragile",
  absorb: "absorb",
  heal: "heal",
  dark: "dark",
  "abs up": "abs-up",
};

// ---------------- weapons ----------------
const typeSections = [
  {
    start: /^5\.1 - Wrenches\/Hammers$/,
    end: /^5\.2 - Spheda Clubs$/,
    type: "wrench",
    character: "max",
  },
  { start: /^5\.2 - Spheda Clubs$/, end: /^5\.3 - Guns$/, type: "club", character: "max" },
  { start: /^5\.3 - Guns$/, end: /^5\.4 - Swords$/, type: "gun", character: "max" },
  { start: /^5\.4 - Swords$/, end: /^5\.5 - Armbands$/, type: "sword", character: "monica" },
  {
    start: /^5\.5 - Armbands$/,
    end: /^5\.6 - Ultimate Weapons$/,
    type: "armband",
    character: "monica",
  },
] as const;

type Row = Pick<Weapon, "name" | "baseAbs" | "spPerLevel" | "abilities"> & {
  combo?: string;
  gunType?: Weapon["gunType"];
  /** Footnoted in the source: attack depends on time of day (Lamb's Sword). */
  attackVaries?: boolean;
  builds: string[];
};

function parseGeneral(region: string[]): Row[] {
  const header = region.find((l) => /ABS/.test(l) && /Build Up/.test(l))!;
  const iAbs = header.indexOf("ABS");
  const iSp = header.indexOf("SP");
  const iAbil = header.indexOf("Abilities");
  const iBuild = header.indexOf("Build Up");
  const rows: Row[] = [];
  let block: string[] = [];
  const flush = () => {
    if (!block.length) return;
    const first = block[0];
    const abilities = block
      .map((l) => l.slice(iAbil, iBuild).trim())
      .filter((a) => a && a !== "-")
      .map((a) => {
        const id = abilityMap[a.toLowerCase()];
        if (!id) throw new Error(`unknown ability: ${a}`);
        return id;
      });
    const builds = block.map((l) => l.slice(iBuild).trim()).filter((b) => b && b !== "-");
    const mid = first.slice(iSp + 2, iAbil).trim();
    const rawName = first.slice(0, iAbs).trim();
    const row: Row = {
      name: rawName.replace(/\*$/, ""),
      ...(rawName.endsWith("*") ? { attackVaries: true } : {}),
      baseAbs: Number(first.slice(iAbs - 1, iSp - 1).trim()),
      spPerLevel: Number(first.slice(iSp - 1, iSp + 2).trim()),
      abilities,
      builds,
    };
    if (mid) {
      if (/^[NMGB]$/.test(mid)) row.gunType = mid as Weapon["gunType"];
      else row.combo = mid;
    }
    rows.push(row);
    block = [];
  };
  // The table has no blank lines; the first blank line after the header ends it.
  for (const l of region.slice(region.indexOf(header) + 1)) {
    if (!l.trim()) break;
    if (/^-{20,}$/.test(l.trim())) flush();
    else block.push(l);
  }
  flush();
  return rows;
}

function parseEnemyReqs(region: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of region) {
    if (!l.trim()) continue;
    const [name, rest] = l.trim().split(/\s{2,}/);
    if (rest) out[name] = rest.split(",").map((s) => s.trim());
  }
  return out;
}

function parseNumbers(region: string[], count: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const re = new RegExp(`^(.+?)\\s+((?:\\d+\\s+){${count - 1}}\\d+)\\s*$`);
  for (const l of region) {
    const m = l.match(re);
    if (m) out[m[1].trim()] = m[2].trim().split(/\s+/).map(Number);
  }
  return out;
}

const weapons: Weapon[] = [];
const nameToId = new Map<string, string>();
const rawBuilds = new Map<string, string[]>();

for (const sec of typeSections) {
  const s = heading(sec.start);
  const e = heading(sec.end, s + 1);
  const general = parseGeneral(subsection(s, e, "General"));
  const reqs = parseEnemyReqs(subsection(s, e, "Enemy Requirements"));
  const base = parseNumbers(subsection(s, e, "Base Stats"), 10);
  const max = parseNumbers(subsection(s, e, "Maximum Stats"), 10);
  for (const g of general) {
    const b = base[g.name];
    const m = max[g.name];
    if (!b || !m) throw new Error(`missing stats for ${g.name}`);
    const id = slug(g.name);
    const wt = walkthrough.find((x) => x.id === id);
    if (wt && MAX_STATS_FROM_WALKTHROUGH.has(id)) {
      // Walkthrough order: At, Du, Fl, Ch, Li, Cy, Sm, Ex, Be, Sc.
      m.splice(0, m.length, wt.maxStats[0], wt.maxStats[1], ...wt.maxStats.slice(2));
    }
    nameToId.set(g.name, id);
    rawBuilds.set(id, g.builds);
    weapons.push({
      id,
      name: g.name,
      character: sec.character,
      type: sec.type,
      ...(g.gunType ? { gunType: g.gunType } : {}),
      ...(g.combo ? { combo: g.combo } : {}),
      ...(g.attackVaries ? { attackVariesByTime: true } : {}),
      baseAbs: g.baseAbs,
      spPerLevel: g.spPerLevel,
      abilities: g.abilities,
      buildsUpTo: [],
      ...(wt?.description ? { description: wt.description } : {}),
      requiresKills: reqs[g.name] ?? [],
      baseStats: Object.fromEntries(STAT_KEYS.map((k, i) => [k, b[i]])) as Weapon["baseStats"],
      baseSp: b[9],
      maxStats: Object.fromEntries(
        STAT_KEYS.map((k, i) => [k, i === 0 ? m[0] : m[i + 1]]),
      ) as Weapon["maxStats"],
      maxDu: m[1],
    });
  }
}
for (const w of weapons) {
  w.buildsUpTo = (rawBuilds.get(w.id) ?? []).map((n) => {
    const id = nameToId.get(n);
    if (!id) throw new Error(`build-up target not found: ${n} (from ${w.name})`);
    return id;
  });
}

// ---------------- synth items (4.4) ----------------
const synthItems: SynthItem[] = [];
{
  const s = heading(/^4\.4 - Spectrumize Tables$/);
  const e = heading(/^4\.5 - Building Up$/, s + 1);
  let category = "";
  let cols: { key: StatKey | "du"; end: number }[] = [];
  for (let i = s; i < e; i++) {
    const l = lines[i];
    if (
      isBanner(l) &&
      lines[i + 1]?.trim() &&
      !isBanner(lines[i + 1]) &&
      isBanner(lines[i + 2] ?? "")
    ) {
      category = lines[i + 1].trim();
      cols = [];
      continue;
    }
    if (!category || category === "Nothing") continue;
    if (!cols.length && /^\s+(At|Du|Fl|Ch|Li|Cy|Sm|Ex|Be|Sc)\b/.test(l)) {
      cols = [...l.matchAll(/(At|Du|Fl|Ch|Li|Cy|Sm|Ex|Be|Sc)/g)].map((m) => ({
        key: m[1].toLowerCase() as StatKey | "du",
        end: m.index! + m[1].length,
      }));
      continue;
    }
    if (!cols.length || !l.trim() || isBanner(l)) continue;
    const name = l.match(/^(\S.*?)\s{2,}\d/)?.[1];
    if (!name) continue;
    const gains: SynthItem["gains"] = {};
    for (const m of l.matchAll(/\d+/g)) {
      if (m.index! < name.length) continue;
      const end = m.index! + m[0].length;
      const col = cols.reduce((a, c) => (Math.abs(c.end - end) < Math.abs(a.end - end) ? c : a));
      gains[col.key] = Number(m[0]);
    }
    synthItems.push({ name, category, gains });
  }
}

// ---------------- shops (6.1) ----------------
const shops: WeaponsData["shops"] = [];
{
  const s = heading(/^6\.1 - Shop Weapons$/);
  const e = heading(/^6\.2 - Dungeon Weapons$/, s + 1);
  let chapter = 0;
  let shop = "";
  for (let i = s; i < e; i++) {
    const l = lines[i];
    const ch = l.match(/^ Chapter (\d+)$/);
    if (ch) {
      chapter = Number(ch[1]);
      continue;
    }
    if (/^-{10,}$/.test(l.trim()) && i > s + 1 && lines[i - 1].trim() && !isBanner(lines[i - 1])) {
      shop = lines[i - 1].trim();
      continue;
    }
    const m = l.match(/^(\S.*?)\s{2,}([\d,]+)\s*$/);
    if (m && chapter && shop) {
      const id = nameToId.get(m[1].trim());
      if (!id) throw new Error(`shop weapon not found: ${m[1]} (ch ${chapter}, ${shop})`);
      shops.push({ chapter, shop, weaponId: id, price: Number(m[2].replace(/,/g, "")) });
    }
  }
}

// ---------------- dungeon weapons (6.2) ----------------
const dungeonWeapons: WeaponsData["dungeonWeapons"] = [];
{
  const s = heading(/^6\.2 - Dungeon Weapons$/);
  const e = heading(/^6\.3 - Invented Weapons$/, s + 1);
  for (let i = s; i < e - 2; i++) {
    if (isBanner(lines[i]) && isBanner(lines[i + 2]) && lines[i + 1].trim()) {
      const names: string[] = [];
      for (let j = i + 3; j < e && lines[j].trim() && !isBanner(lines[j]); j++)
        names.push(lines[j].trim());
      dungeonWeapons.push({
        dungeon: lines[i + 1].trim(),
        weaponIds: names.map((n) => {
          const id = nameToId.get(n);
          if (!id) throw new Error(`dungeon weapon not found: ${n}`);
          return id;
        }),
      });
    }
  }
}

// ---------------- invented weapons (6.3) ----------------
const invented: WeaponsData["invented"] = [];
{
  const s = heading(/^6\.3 - Invented Weapons$/);
  const e = heading(/^6\.4 - Event Weapons$/, s + 1);
  for (let i = s; i < e - 2; i++) {
    if (isBanner(lines[i]) && isBanner(lines[i + 2]) && lines[i + 1].trim()) {
      const name = lines[i + 1].trim();
      const ideas: string[][] = [];
      const materials: { name: string; qty: number }[] = [];
      for (
        let j = i + 3;
        j < e && !isBanner(lines[j]) && !isHeading(lines[j]) && !/^-{5,}$/.test(lines[j].trim());
        j++
      ) {
        const t = lines[j].trim();
        if (!t) continue;
        const mat = t.match(/^(.+?)\s+x\s*(\d+)$/);
        if (mat) materials.push({ name: mat[1].trim(), qty: Number(mat[2]) });
        else ideas.push(t.split(/\s+OR\s+/).map((x) => x.trim()));
      }
      const id = nameToId.get(name);
      if (!id) throw new Error(`invented weapon not found: ${name}`);
      invented.push({ weaponId: id, ideas, materials });
    }
  }
}

// ---------------- event weapons (6.4), facts re-stated in our own words ----------------
const eventHow: [string, string][] = [
  ["Jurak Gun", "Complete 100% of the Sindain Georama (one-of-a-kind)."],
  ["Serpent Slicer", "Complete 100% of the Balance Valley Georama."],
  ["Holy Daedalus Blade", "Complete 100% of the Heim Rada Georama (one-of-a-kind)."],
  [
    "Ama no Murakumo",
    "Spheda prize in 'Something Rare Here!' (Rainbow Butterfly Wood star path, Chapter 6+).",
  ],
  ["Mardan Sword", "First place, Beginner class, Finny Frenzy (one-of-a-kind)."],
  [
    "Garayan Sword",
    "First place, Junior class, Finny Frenzy; also reachable by building up the Mardan Sword.",
  ],
];
const events: WeaponsData["events"] = eventHow.map(([name, how]) => {
  const id = nameToId.get(name);
  if (!id) throw new Error(`event weapon not found: ${name}`);
  return { weaponId: id, how };
});

// ---------------- kill-requirement enemies ----------------
const killChapter = new Map<string, number>();
{
  const grab = (re: RegExp, chapter: number) => {
    const i = lines.findIndex((l, n) => n > 100 && re.test(l));
    if (i < 0) throw new Error(`enemy list not found: ${re}`);
    let j = i;
    while (lines[j].trim() !== "") j++; // end of the intro sentence
    for (j++; j < lines.length && lines[j].trim() !== ""; j++)
      killChapter.set(lines[j].trim(), chapter);
  };
  grab(/^The following enemies unlock Tier 7 weapons/, 6);
  grab(/^The following enemies unlock Tier 8 and 9 weapons/, 7);
  killChapter.set("Rifle Wolf", 5);
}
const enemyNames = [...new Set(weapons.flatMap((w) => w.requiresKills))].sort();
const killEnemies = enemyNames.map((name) => ({
  name,
  ...(killChapter.has(name) ? { chapter: killChapter.get(name) } : {}),
}));

const out = weaponsData.parse({
  weapons,
  synthItems,
  shops,
  invented,
  events,
  dungeonWeapons,
  killEnemies,
});
writeFileSync("src/data/weapons.json", JSON.stringify(out, null, 2) + "\n");
console.log(
  `weapons ${weapons.length}, synthItems ${synthItems.length}, shops ${shops.length}, invented ${invented.length}, dungeons ${dungeonWeapons.length}, killEnemies ${killEnemies.length}`,
);
