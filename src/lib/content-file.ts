import { z } from "zod";
import { guide, type Guide } from "@/lib/guide/types";

export const CONTENT_VERSION = 2;

/** Shareable guides only (no progress). Distinct from a profile export, which also carries ticks. */
export const contentFile = z.object({
  app: z.literal("dark-chronicles-companion"),
  kind: z.literal("content"),
  version: z.literal(CONTENT_VERSION),
  guides: z.array(guide.extend({ kind: z.literal("custom") })).max(200),
});
export type ContentFile = z.infer<typeof contentFile>;

export function buildContentExport(guides: Guide[]): ContentFile {
  return {
    app: "dark-chronicles-companion",
    kind: "content",
    version: CONTENT_VERSION,
    guides: guides.filter((g) => g.kind === "custom") as ContentFile["guides"],
  };
}

export interface MergeSummary {
  added: number;
  copied: number;
  skipped: number;
}

const sameContent = (a: Guide, b: Guide) => {
  const strip = (g: Guide) =>
    JSON.stringify(g, (k, v) => (k === "createdAt" || k === "updatedAt" ? undefined : v));
  return strip(a) === strip(b);
};

/** Same id + same content is skipped; same id + different content is kept as a copy with a fresh id. */
export function mergeGuides(existing: Guide[], incoming: Guide[], makeId: (old: string) => string) {
  const list = [...existing];
  const summary: MergeSummary = { added: 0, copied: 0, skipped: 0 };
  for (const g of incoming) {
    const clash = list.find((x) => x.id === g.id);
    if (!clash) {
      list.push(g);
      summary.added++;
    } else if (sameContent(clash, g)) {
      summary.skipped++;
    } else {
      list.push({ ...g, id: makeId(g.id), title: `${g.title} (imported)` });
      summary.copied++;
    }
  }
  return { guides: list, summary };
}
