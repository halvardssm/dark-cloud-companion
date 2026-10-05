import { atom, computed } from "nanostores";
import { mergeContent, type ContentFile, type MergeSummary } from "./content-file";
import type { Guide } from "./guides/types";
import type { Walkthrough } from "./walkthroughs/types";
import {
  STATE_VERSION,
  STORAGE_KEY,
  createProfile,
  exportFile,
  importProfiles,
  initialState,
  parseState,
  type AppState,
  type ExportFile,
  type Profile,
  type ViewSettings,
} from "./profiles";

export const $state = atom<AppState>(initialState());
/** False until localStorage has been read on the client (avoid hydration flashes). */
export const $ready = atom(false);

export const $profile = computed($state, (s) => s.profiles[s.activeProfile]);
export const $checks = computed($profile, (p) => p.checks);

function persist(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

if (typeof window !== "undefined") {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {}
  $state.set(parseState(raw));
  $ready.set(true);
  $state.listen(persist);
  // Keep tabs in sync.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) $state.set(parseState(e.newValue));
  });
}

function updateProfile(fn: (p: Profile) => Profile) {
  const s = $state.get();
  const p = s.profiles[s.activeProfile];
  $state.set({ ...s, profiles: { ...s.profiles, [p.id]: fn(p) } });
}

export function setChecked(id: string, checked: boolean) {
  updateProfile((p) => {
    const checks = { ...p.checks };
    if (checked) checks[id] = true;
    else delete checks[id];
    return { ...p, checks };
  });
}

export function setView(
  patch: Partial<Omit<ViewSettings, "layers">> & { layers?: Partial<ViewSettings["layers"]> },
) {
  updateProfile((p) => ({
    ...p,
    view: { ...p.view, ...patch, layers: { ...p.view.layers, ...patch.layers } },
  }));
}

export function toggleGuide(id: string, on: boolean) {
  updateProfile((p) => ({
    ...p,
    // Switching a walkthrough on also turns the walkthrough layer on, otherwise nothing would appear.
    view:
      on && id.startsWith("wt-")
        ? { ...p.view, layers: { ...p.view.layers, walkthrough: true } }
        : p.view,
    activeGuides: on
      ? [...new Set([...p.activeGuides, id])]
      : p.activeGuides.filter((g) => g !== id),
  }));
}

export function addCustomGuide(g: Guide) {
  updateProfile((p) => ({
    ...p,
    customGuides: [...p.customGuides.filter((x) => x.id !== g.id), g],
    activeGuides: [...new Set([...p.activeGuides, g.id])],
  }));
}

export function removeCustomGuide(id: string) {
  updateProfile((p) => ({
    ...p,
    customGuides: p.customGuides.filter((g) => g.id !== id),
    activeGuides: p.activeGuides.filter((g) => g !== id),
  }));
}

/** Creates or replaces a walkthrough in the active profile. */
export function saveWalkthrough(w: Walkthrough) {
  updateProfile((p) => {
    const next = { ...w, updatedAt: Date.now() };
    const exists = p.walkthroughs.some((x) => x.id === w.id);
    return {
      ...p,
      walkthroughs: exists
        ? p.walkthroughs.map((x) => (x.id === w.id ? next : x))
        : [...p.walkthroughs, next],
    };
  });
}

export function deleteWalkthrough(id: string) {
  updateProfile((p) => ({
    ...p,
    walkthroughs: p.walkthroughs.filter((w) => w.id !== id),
    activeGuides: p.activeGuides.filter((g) => g !== id),
    // Drop this walkthrough's ticks so stale progress doesn't linger.
    checks: Object.fromEntries(
      Object.entries(p.checks).filter(([k]) => !k.startsWith(`wt:${id}:`)),
    ) as typeof p.checks,
  }));
}

/** Merges validated imported guides/walkthroughs into the active profile; returns what happened. */
export function applyContent(file: ContentFile): MergeSummary {
  let summary: MergeSummary = { added: 0, copied: 0, skipped: 0 };
  updateProfile((p) => {
    const merged = mergeContent(
      { guides: p.customGuides, walkthroughs: p.walkthroughs },
      file,
      (old) => `${old}-i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    );
    summary = merged.summary;
    return { ...p, customGuides: merged.guides, walkthroughs: merged.walkthroughs };
  });
  return summary;
}

export function addProfile(name: string) {
  const p = createProfile(name);
  const s = $state.get();
  $state.set({ ...s, activeProfile: p.id, profiles: { ...s.profiles, [p.id]: p } });
}

export function switchProfile(id: string) {
  const s = $state.get();
  if (s.profiles[id]) $state.set({ ...s, activeProfile: id });
}

export function renameProfile(id: string, name: string) {
  const s = $state.get();
  if (!s.profiles[id] || !name.trim()) return;
  $state.set({ ...s, profiles: { ...s.profiles, [id]: { ...s.profiles[id], name: name.trim() } } });
}

export function deleteProfile(id: string) {
  const s = $state.get();
  const ids = Object.keys(s.profiles);
  if (ids.length <= 1 || !s.profiles[id]) return;
  const { [id]: _removed, ...rest } = s.profiles;
  $state.set({
    ...s,
    profiles: rest,
    activeProfile: s.activeProfile === id ? Object.keys(rest)[0] : s.activeProfile,
  });
}

export function buildExport(ids?: string[]): ExportFile {
  const s = $state.get();
  const profiles = (ids ?? Object.keys(s.profiles)).map((id) => s.profiles[id]).filter(Boolean);
  return { app: "dark-chronicles-companion", version: STATE_VERSION, profiles };
}

/** Returns an error message, or null on success. */
export async function importFromJson(json: string): Promise<string | null> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "Not valid JSON";
  }
  const parsed = exportFile.safeParse(data);
  if (!parsed.success) return "Not a Dark Chronicles Companion export";
  // Guides and walkthroughs reference weapons, items and chapters: make sure they all exist before accepting.
  const { validateGuide, validateWalkthrough } = await import("./content-validate");
  const errors = parsed.data.profiles.flatMap((p) => [
    ...p.customGuides.flatMap((g) => validateGuide(g).map((e) => `${p.name} / ${g.title}: ${e}`)),
    ...p.walkthroughs.flatMap((w) =>
      validateWalkthrough(w).map((e) => `${p.name} / ${w.title}: ${e}`),
    ),
  ]);
  if (errors.length) return errors.slice(0, 5).join("\n");
  $state.set(importProfiles($state.get(), parsed.data));
  return null;
}
