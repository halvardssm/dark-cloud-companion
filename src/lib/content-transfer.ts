import { fromLegacyGuide, fromLegacyWalkthrough } from "@/lib/guide/legacy";
import { guide as legacyGuide } from "@/lib/guides/types";
import { walkthrough as legacyWalkthrough } from "@/lib/walkthroughs/types";
import { z } from "zod";
import { contentFile, type ContentFile } from "./content-file";
import { validateGuide } from "./content-validate";

export type ParseResult = { ok: true; file: ContentFile } | { ok: false; error: string };

/** Version 1 content files (separate build guides and walkthroughs) are converted to unified guides. */
const legacyContent = z.object({
  app: z.literal("dark-chronicles-companion"),
  kind: z.literal("content"),
  version: z.literal(1),
  guides: z.array(legacyGuide).default([]),
  walkthroughs: z.array(legacyWalkthrough).default([]),
});

/** Parses and deeply validates an imported file. Nothing is returned unless every guide is valid. */
export function parseContentImport(json: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: "Not valid JSON" };
  }
  if (typeof data === "object" && data !== null && "profiles" in data) {
    return { ok: false, error: "This is a profile export. Import it under Settings → Profiles." };
  }
  let file: ContentFile | undefined;
  const v2 = contentFile.safeParse(data);
  if (v2.success) file = v2.data;
  else {
    const v1 = legacyContent.safeParse(data);
    if (v1.success) {
      file = {
        app: "dark-chronicles-companion",
        kind: "content",
        version: 2,
        guides: [
          ...v1.data.guides
            .filter((g) => g.kind === "custom")
            .map((g) => ({ ...fromLegacyGuide(g), kind: "custom" as const })),
          ...v1.data.walkthroughs.map((w) => ({
            ...fromLegacyWalkthrough(w),
            kind: "custom" as const,
          })),
        ],
      };
    }
  }
  if (!file) return { ok: false, error: "Not a Dark Chronicles Companion guides export" };
  const errors = file.guides.flatMap((g) =>
    validateGuide(g).map((e) => `Guide "${g.title}": ${e}`),
  );
  if (errors.length) return { ok: false, error: errors.slice(0, 5).join("\n") };
  return { ok: true, file };
}
