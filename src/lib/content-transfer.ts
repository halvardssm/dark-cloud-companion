import { contentFile, type ContentFile } from "./content-file";
import { validateGuide, validateWalkthrough } from "./content-validate";

export type ParseResult = { ok: true; file: ContentFile } | { ok: false; error: string };

/** Parses and deeply validates an imported file. Nothing is returned unless every item is valid. */
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
  const parsed = contentFile.safeParse(data);
  if (!parsed.success)
    return { ok: false, error: "Not a Dark Chronicles Companion guides/walkthroughs export" };
  const errors = [
    ...parsed.data.guides.flatMap((g) => validateGuide(g).map((e) => `Guide "${g.title}": ${e}`)),
    ...parsed.data.walkthroughs.flatMap((w) =>
      validateWalkthrough(w).map((e) => `Walkthrough "${w.title}": ${e}`),
    ),
  ];
  if (errors.length) return { ok: false, error: errors.slice(0, 5).join("\n") };
  return { ok: true, file: parsed.data };
}
