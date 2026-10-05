import { weaponData } from "./sources";

/** Weapons that can be built up (directly or through a chain) into `targetId`, including the target itself. */
export function ancestorsOf(targetId: string): Set<string> {
  const parents = new Map<string, string[]>();
  for (const w of weaponData.weapons)
    for (const t of w.buildsUpTo) parents.set(t, [...(parents.get(t) ?? []), w.id]);
  const seen = new Set<string>([targetId]);
  const queue = [targetId];
  while (queue.length) {
    for (const p of parents.get(queue.pop()!) ?? []) {
      if (!seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    }
  }
  return seen;
}

/** Weapons nothing builds up into: the natural starting points of a line. */
export const rootWeaponIds = new Set(
  weaponData.weapons
    .filter((w) => !weaponData.weapons.some((o) => o.buildsUpTo.includes(w.id)))
    .map((w) => w.id),
);
