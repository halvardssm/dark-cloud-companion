// One-off extraction of the "Game Data" tables in DC.txt: inventions, Georama parts and requirements,
// full shop lists, item overview, fishing baits/lures and Donny's photo rewards.
// Run: node scripts/extract/gamedata.ts
import { readFileSync, writeFileSync } from "node:fs";
import { gamedata } from "../../src/data/gamedata-schema.ts";

const text = new TextDecoder("utf-16le")
  .decode(readFileSync(".local/guides/DC.txt"))
  .replace(/^﻿/, "");
const lines = text
  .replace(/\r/g, "")
  .replace(/Clawn/g, "Clown")
  .replace(/Spinning Ivanov\b/g, "Spinning Ivanoff")
  .split("\n");

const find = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));
/** Lines of a body section from its heading to the next heading at column 0 with [CODE]. */
function region(code: string): string[] {
  const start = find(new RegExp(`^[A-Z][^\\t]*\\t+\\[${code}\\]`));
  if (start < 0) throw new Error(`section ${code} not found`);
  const end = find(/^\S[^\t]*\t+\[[A-Z]+\]\s*$/, start + 1);
  return lines.slice(start + 2, end < 0 ? lines.length : end);
}

const parseIngredients = (s: string) =>
  s.split("&").map((p) => {
    const t = p.trim();
    return { scoop: t.startsWith("*"), name: t.replace(/^\*/, "").trim() };
  });
const parseQty = (s: string) =>
  s
    .split(",")
    .map((p) => p.trim().match(/^(\d+)\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ qty: Number(m[1]), name: m[2].trim() }));

// ---------------- inventions + photo rewards ----------------
const inv = region("GDINVENT");
const inventions: unknown[] = [];
let chapter = 0;
for (let i = 0; i < inv.length; i++) {
  const ch = inv[i].match(/^Chapter (\d) Inventions:/);
  if (ch) chapter = Number(ch[1]);
  const m = inv[i].match(/^Invention:\s*(.+?)\s*\t+\s*Recipe Found:\s*(.+?)\s*$/);
  if (!m) continue;
  const rec: Record<string, unknown> = {
    name: m[1],
    chapter,
    recipeFound: /^unknown$/i.test(m[2]) ? null : m[2],
    components: [],
  };
  for (let j = i + 1; j < inv.length && inv[j].trim() !== ""; j++) {
    let k: RegExpMatchArray | null;
    if ((k = inv[j].match(/^Ideas:\s*(.+)$/))) rec.ideas = parseIngredients(k[1]);
    else if ((k = inv[j].match(/^Alternate[:;]\s*(.+)$/))) rec.alternate = parseIngredients(k[1]);
    else if ((k = inv[j].match(/^Components Needed:\s*(.+)$/))) rec.components = parseQty(k[1]);
    else if ((k = inv[j].match(/^Overall Price:\s*([\d,]+) Gilda/)))
      rec.price = Number(k[1].replace(/,/g, ""));
  }
  inventions.push(rec);
}
const photoRewards = inv.flatMap((l) => {
  const m = l.match(/^(\d+)\/(\d+)\t+(.+?)\s*$/);
  return m ? [{ level: Number(m[1]), points: Number(m[2]), reward: m[3] }] : [];
});

// ---------------- Georama parts ----------------
const georamaParts: unknown[] = [];
{
  const g = region("GDGEORAMA");
  for (let i = 0; i < g.length; i++) {
    const m = g[i].match(/^Part:\s*(.+?)\s*(?:\t+\s*Polyn:\s*(\d+)\s*\t+\s*CP:\s*(\d+))?\s*$/);
    if (!m) continue;
    const part: Record<string, unknown> = {
      name: m[1],
      ...(m[2] ? { polyn: Number(m[2]), cp: Number(m[3]) } : {}),
      components: [],
      geostone: null,
    };
    for (let j = i + 1; j < g.length && g[j].trim() !== ""; j++) {
      let k: RegExpMatchArray | null;
      if ((k = g[j].match(/^Components:\s*(.+)$/)))
        part.components = /^N\/A$/i.test(k[1].trim()) ? [] : parseQty(k[1]);
      else if ((k = g[j].match(/^Cost to Build:\s*([\d,]+) Gilda/)))
        part.cost = Number(k[1].replace(/,/g, ""));
      else if ((k = g[j].match(/^Geostone:\s*(.+)$/)))
        part.geostone = /^none$/i.test(k[1].trim()) ? null : k[1].trim();
    }
    georamaParts.push(part);
  }
}

// ---------------- Georama requirements ----------------
const georamaAreas: {
  name: string;
  tasks: { name: string; percent: number; conditions: string[] }[];
  reward?: string;
}[] = [];
{
  const g = region("GDREQUIRE");
  let area: (typeof georamaAreas)[number] | undefined;
  let task: (typeof georamaAreas)[number]["tasks"][number] | undefined;
  for (const l of g) {
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(.+?) Georama Requirements\s*$/))) {
      area = { name: m[1].trim(), tasks: [] };
      georamaAreas.push(area);
      task = undefined;
    } else if (area && (m = l.match(/^(\S.*?)\s*\t+\s*(\d+)%\s*$/))) {
      task = { name: m[1].trim(), percent: Number(m[2]), conditions: [] };
      area.tasks.push(task);
    } else if (task && (m = l.match(/^\* (.+)$/))) {
      task.conditions.push(m[1].trim());
    } else if (area && (m = l.match(/^Georama Completion Reward:\s*(.+)$/))) {
      area.reward = m[1].trim();
    } else if (task && l.startsWith("  ") && task.conditions.length) {
      // wrapped condition line
      task.conditions[task.conditions.length - 1] += " " + l.trim();
    }
  }
}

// ---------------- Shops (all, with currency) ----------------
const shops: unknown[] = [];
{
  const body = region("GDSHOPS");
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const l of body) {
    if (l.trim() === "") {
      if (cur.length) blocks.push(cur);
      cur = [];
    } else cur.push(l);
  }
  if (cur.length) blocks.push(cur);
  for (const b of blocks.slice(1)) {
    // blocks[0] is the intro paragraph; trailing footnotes ("NOTE: …", "* - …") are not shops.
    if (/^(NOTE|\*)/.test(b[0])) continue;
    const head = b.find((l) => /^Item\t+(Price|Medals|Exp)/.test(l));
    const currency =
      head && /Medals/.test(head) ? "medals" : head && /Exp/.test(head) ? "exp" : "gilda";
    const items = b
      .slice(1)
      .filter((l) => l !== head)
      .flatMap((l) => {
        const m = l.match(/^(.+?)\t+(\d+)(?:\t+(\d+))?\s*$/);
        if (m)
          return [
            {
              name: m[1].replace(/\*+$/, "").trim(),
              price: Number(m[2]),
              ...(m[3] ? { chapter: Number(m[3]) } : {}),
            },
          ];
        // rows without a price (repair powders) or with only a chapter
        const n = l.match(/^(.+?)(?:\t+(\d+))?\s*$/);
        return n && n[1].trim()
          ? [{ name: n[1].replace(/\*+$/, "").trim(), ...(n[2] ? { chapter: Number(n[2]) } : {}) }]
          : [];
      });
    if (items.length) shops.push({ name: b[0].trim(), currency, items });
  }
}

// ---------------- Item overview ----------------
const items: unknown[] = [];
{
  const body = region("GDITEMS");
  const synthOf = (s: string) => {
    const out: Record<string, number> = {};
    for (const m of s.matchAll(/(\d+) (At|Du|Fl|Ch|Li|Cy|Sm|Ex|Be|Sc)\b/g))
      out[m[2]] = Number(m[1]);
    return out;
  };
  let mode: "functional" | "clothing" | "ridepod" | "material" | undefined;
  for (const l of body) {
    if (l.startsWith(" Functional items")) mode = "functional";
    else if (l.startsWith(" Clothing")) mode = "clothing";
    else if (l.startsWith(" Ridepod Parts")) mode = "ridepod";
    else if (l.startsWith(" Constructive Items")) mode = "material";
    if (!mode || !l.includes("\t") || l.startsWith("Item\t")) continue;
    const cols = l
      .split(/\t+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (mode === "functional" && cols.length >= 3) {
      items.push({
        name: cols[0],
        category: "functional",
        effect: cols[1],
        synth: synthOf(cols[2]),
      });
    } else if (mode === "clothing" && cols.length >= 4) {
      items.push({
        name: cols[0],
        category: "clothing",
        who: cols[1],
        slot: cols[2],
        synth: synthOf(cols[3]),
      });
    } else if (mode === "ridepod" && cols.length >= 5) {
      items.push({
        name: cols[0],
        category: "ridepod",
        part: cols[1],
        capacity: Number(cols[2]),
        value: cols[3],
        synth: synthOf(cols[4]),
      });
    } else if (mode === "material" && cols.length >= 2) {
      const rest = cols.slice(1).join(" ");
      const synth = synthOf(rest);
      const coin = cols[0].endsWith("Coin") && !Object.keys(synth).length && rest !== "N/A";
      items.push({
        name: cols[0].replace(/\s+Lure$/, " Lure"),
        category: coin ? "coin" : "material",
        synth,
        ...(coin ? { ability: rest } : {}),
      });
    }
  }
}

// ---------------- Fishing ----------------
const fishing = { baits: [] as unknown[], lures: [] as unknown[], photoRewards };
{
  const f = region("GDFISHING");
  let mode: "bait" | "lure" | undefined;
  for (const l of f) {
    if (/^Bait\t+Type\t+Fish/.test(l)) mode = "bait";
    else if (/^Lure\t+Fish/.test(l)) mode = "lure";
    else if (l.trim() === "")
      mode = mode && (mode === "bait" || mode === "lure") ? mode : undefined;
    else if (mode && l.includes("\t")) {
      const cols = l.split(/\t+/).map((c) => c.trim());
      if (mode === "bait" && cols.length >= 3) {
        fishing.baits.push({
          name: cols[0],
          type: cols[1],
          fish: cols[2]
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x && x !== "None?"),
        });
      } else if (mode === "lure" && cols.length >= 2) {
        fishing.lures.push({
          name: cols[0],
          fish: cols[1]
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x && x !== "?"),
        });
      }
    } else if (mode && !l.includes("\t")) mode = undefined;
  }
}

const out = {
  inventions: gamedata.inventions.parse(inventions),
  georamaParts: gamedata.georamaParts.parse(georamaParts),
  georamaAreas: gamedata.georamaAreas.parse(georamaAreas),
  shops: gamedata.shops.parse(shops),
  items: gamedata.items.parse(items),
  fishing: gamedata.fishing.parse(fishing),
};
writeFileSync("src/data/inventions.json", JSON.stringify(out.inventions, null, 2) + "\n");
writeFileSync(
  "src/data/georama.json",
  JSON.stringify({ parts: out.georamaParts, areas: out.georamaAreas }, null, 2) + "\n",
);
writeFileSync("src/data/shops.json", JSON.stringify(out.shops, null, 2) + "\n");
writeFileSync("src/data/items-overview.json", JSON.stringify(out.items, null, 2) + "\n");
writeFileSync("src/data/fishing.json", JSON.stringify(out.fishing, null, 2) + "\n");
console.log(
  `inventions ${out.inventions.length}, georama parts ${out.georamaParts.length}, areas ${out.georamaAreas.length} (tasks ${out.georamaAreas.reduce((n, a) => n + a.tasks.length, 0)}), shops ${out.shops.length}, items ${out.items.length}, baits ${out.fishing.baits.length}, lures ${out.fishing.lures.length}, rewards ${out.fishing.photoRewards.length}`,
);
