import { z } from "zod";
import { guide, type Guide } from "@/lib/guides/types";
import { walkthrough, type Walkthrough } from "@/lib/walkthroughs/types";

export const CONTENT_VERSION = 1;

/** Shareable content only (no progress). Distinct from a profile export, which also carries checks. */
export const contentFile = z.object({
  app: z.literal("dark-chronicles-companion"),
  kind: z.literal("content"),
  version: z.literal(CONTENT_VERSION),
  guides: z.array(guide.extend({ kind: z.literal("custom") })).default([]),
  walkthroughs: z.array(walkthrough).default([]),
});
export type ContentFile = z.infer<typeof contentFile>;

export function buildContentExport(guides: Guide[], walkthroughs: Walkthrough[]): ContentFile {
  return {
    app: "dark-chronicles-companion",
    kind: "content",
    version: CONTENT_VERSION,
    guides: guides.filter((g) => g.kind === "custom") as ContentFile["guides"],
    walkthroughs,
  };
}

export interface MergeSummary {
  added: number;
  copied: number;
  skipped: number;
}

const sameContent = (a: unknown, b: unknown, ignore: string[]) =>
  JSON.stringify(a, (k, v) => (ignore.includes(k) ? undefined : v)) ===
  JSON.stringify(b, (k, v) => (ignore.includes(k) ? undefined : v));

function mergeList<T extends { id: string; title: string }>(
  existing: T[],
  incoming: T[],
  ignore: string[],
  makeId: (old: string) => string,
): { list: T[]; summary: MergeSummary } {
  const list = [...existing];
  const summary: MergeSummary = { added: 0, copied: 0, skipped: 0 };
  for (const item of incoming) {
    const clash = list.find((x) => x.id === item.id);
    if (!clash) {
      list.push(item);
      summary.added++;
    } else if (sameContent(clash, item, ignore)) {
      summary.skipped++;
    } else {
      list.push({ ...item, id: makeId(item.id), title: `${item.title} (imported)` });
      summary.copied++;
    }
  }
  return { list, summary };
}

/** Merges imported content into existing content. Same id + same content is skipped; same id + different content is kept as a copy. */
export function mergeContent(
  existing: { guides: Guide[]; walkthroughs: Walkthrough[] },
  file: ContentFile,
  makeId: (old: string) => string,
) {
  const g = mergeList(existing.guides, file.guides as Guide[], ["createdAt"], makeId);
  const w = mergeList(existing.walkthroughs, file.walkthroughs, ["createdAt", "updatedAt"], makeId);
  return {
    guides: g.list,
    walkthroughs: w.list,
    summary: {
      added: g.summary.added + w.summary.added,
      copied: g.summary.copied + w.summary.copied,
      skipped: g.summary.skipped + w.summary.skipped,
    },
  };
}
