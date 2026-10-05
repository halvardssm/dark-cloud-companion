// One-off extraction: shop item prices from DC.txt (Game Data > Shop Lists) -> src/data/items.json
// Run: node scripts/extract/shops.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const text = new TextDecoder("utf-16le")
  .decode(readFileSync(".local/guides/DC.txt"))
  .replace(/^﻿/, "");
const lines = text.replace(/\r/g, "").split("\n");

// Body headings start at column 0 (the table of contents entries are indented).
const start = lines.findIndex((l) => /^Shop Lists\t+\[GDSHOPS\]/.test(l));
const end = lines.findIndex((l, i) => i > start && /^Items Overview\t+\[GDITEMS\]/.test(l));
if (start < 0 || end < 0) throw new Error("shop list region not found");

interface Offer {
  item: string;
  shop: string;
  price: number;
  chapter: number;
}
const offers: Offer[] = [];

// Shop blocks are separated by blank lines; the first line of a block is the shop name.
const body = lines.slice(start + 3, end);
const blocks: string[][] = [];
let cur: string[] = [];
for (const l of body) {
  if (l.trim() === "") {
    if (cur.length) blocks.push(cur);
    cur = [];
  } else cur.push(l);
}
if (cur.length) blocks.push(cur);

for (const b of blocks) {
  const shop = b[0].trim();
  if (b.some((l) => /^Item\t+(Medals|Exp)/.test(l))) continue; // medal / exp exchanges, not gilda
  for (const l of b.slice(1)) {
    const m = l.match(/^(.+?)\t+(\d+)(?:\t+(\d+))?\s*$/);
    if (!m) continue;
    const item = m[1].replace(/[*]+$/, "").trim();
    if (item.endsWith("Repair Powder")) continue; // price changes every chapter
    offers.push({ item, shop, price: Number(m[2]), chapter: m[3] ? Number(m[3]) : 1 });
  }
}

const items = new Map<
  string,
  { name: string; price: number; fromChapter: number; shops: string[] }
>();
for (const o of offers) {
  const cur = items.get(o.item);
  if (!cur)
    items.set(o.item, { name: o.item, price: o.price, fromChapter: o.chapter, shops: [o.shop] });
  else {
    if (!cur.shops.includes(o.shop)) cur.shops.push(o.shop);
    // Cheapest price wins; if equal, the earliest chapter wins.
    if (o.price < cur.price || (o.price === cur.price && o.chapter < cur.fromChapter)) {
      cur.price = o.price;
      cur.fromChapter = o.chapter;
    }
  }
}

const schema = z.array(
  z.object({
    name: z.string(),
    price: z.number().int(),
    fromChapter: z.number().int(),
    shops: z.array(z.string()),
  }),
);
const out = schema.parse([...items.values()].sort((a, b) => a.name.localeCompare(b.name)));
writeFileSync("src/data/items.json", JSON.stringify(out, null, 2) + "\n");
console.log(`items ${out.length} from ${blocks.length} shop blocks`);
