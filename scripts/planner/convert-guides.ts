// One-off: convert the previous curated-guide JSON (build-guide format) to unified guides.
// Run: pnpm exec vite-node --config vitest.config.ts scripts/planner/convert-guides.ts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { fromLegacyGuide } from "../../src/lib/guide/legacy.ts";
import { guide } from "../../src/lib/guide/types.ts";
import { guide as legacyGuide } from "../../src/lib/guides/types.ts";

const legacy = z
  .array(legacyGuide)
  .parse(JSON.parse(readFileSync("src/lib/guide/fixtures/legacy-curated.json", "utf8")));
const out = legacy.map((g) => guide.parse(fromLegacyGuide(g)));
writeFileSync("src/data/guides.json", JSON.stringify(out, null, 2) + "\n");
console.log(`converted ${out.length} guides`);
