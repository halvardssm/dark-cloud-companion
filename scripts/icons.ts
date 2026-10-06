// Renders public/favicon.svg to the PNG icons referenced by the web manifest.
// Run: node scripts/icons.ts
import { readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("public/favicon.svg");
for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/icon-${size}.png`);
}
// A maskable icon needs a safe zone: render the artwork at 80% on the background colour.
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#171717" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icon-maskable-512.png");
console.log("icons written");
