import { atom, computed } from "nanostores";
import { mergeGuides, type ContentFile, type MergeSummary } from "./content-file";
import type { Guide } from "./guide/types";
import {
  STATE_VERSION,
  STORAGE_KEY,
  createProfile,
  importProfiles,
  initialState,
  parseProfileExport,
  parseState,
  type AppState,
  type DashboardView,
  type ExportFile,
  type PlannerInputs,
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

/** Sets several ticks at once (e.g. "complete this step"). */
export function setManyChecked(ids: string[], checked: boolean) {
  updateProfile((p) => {
    const checks = { ...p.checks };
    for (const id of ids) {
      if (checked) checks[id] = true;
      else delete checks[id];
    }
    return { ...p, checks };
  });
}

export function setView(patch: Partial<ViewSettings>) {
  updateProfile((p) => ({ ...p, view: { ...p.view, ...patch } }));
}

export function setDashboardView(view: DashboardView) {
  updateProfile((p) => ({ ...p, dashboard: { ...p.dashboard, view } }));
}

/** `null` follows progress automatically. */
export function setCurrentChapter(chapterId: string | null) {
  updateProfile((p) => ({ ...p, dashboard: { ...p.dashboard, currentChapter: chapterId } }));
}

/** Remembers the planner's inputs in the active profile. */
export function setPlannerInputs(inputs: PlannerInputs) {
  updateProfile((p) => ({ ...p, planner: inputs }));
}

export function toggleGuide(id: string, on: boolean) {
  updateProfile((p) => ({
    ...p,
    activeGuides: on
      ? [...new Set([...p.activeGuides, id])]
      : p.activeGuides.filter((g) => g !== id),
  }));
}

/** Creates or replaces one of the user's own guides. */
export function saveGuide(g: Guide, opts: { activate?: boolean } = {}) {
  updateProfile((p) => {
    const next: Guide = {
      ...g,
      kind: "custom",
      updatedAt: Date.now(),
      createdAt: g.createdAt ?? Date.now(),
    };
    const exists = p.guides.some((x) => x.id === g.id);
    return {
      ...p,
      guides: exists ? p.guides.map((x) => (x.id === g.id ? next : x)) : [...p.guides, next],
      activeGuides: opts.activate ? [...new Set([...p.activeGuides, g.id])] : p.activeGuides,
    };
  });
}

export function deleteGuide(id: string) {
  updateProfile((p) => ({
    ...p,
    guides: p.guides.filter((g) => g.id !== id),
    activeGuides: p.activeGuides.filter((g) => g !== id),
    // Drop this guide's own ticks so stale progress doesn't linger (shared data-item ticks stay).
    checks: Object.fromEntries(
      Object.entries(p.checks).filter(([k]) => !k.startsWith(`g:${id}:`)),
    ) as typeof p.checks,
  }));
}

/** Merges validated imported guides into the active profile; returns what happened. */
export function applyContent(file: ContentFile): MergeSummary {
  let summary: MergeSummary = { added: 0, copied: 0, skipped: 0 };
  updateProfile((p) => {
    const merged = mergeGuides(
      p.guides,
      file.guides as Guide[],
      (old) => `${old}-i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    );
    summary = merged.summary;
    return { ...p, guides: merged.guides };
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

/** Returns an error message, or null on success. Accepts exports of the current and the previous format. */
export async function importFromJson(json: string): Promise<string | null> {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return "Not valid JSON";
  }
  const parsed = parseProfileExport(data);
  if (!parsed) return "Not a Dark Chronicles Companion export";
  // Guides reference weapons, items and chapters: make sure they all exist before accepting.
  const { validateGuide } = await import("./content-validate");
  const errors = parsed.profiles.flatMap((p) =>
    p.guides.flatMap((g) => validateGuide(g).map((e) => `${p.name} / ${g.title}: ${e}`)),
  );
  if (errors.length) return errors.slice(0, 5).join("\n");
  $state.set(importProfiles($state.get(), parsed));
  return null;
}
