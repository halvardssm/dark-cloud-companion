import { useMemo } from "react";
import { deriveBuild, type DerivedBuild } from "./derive";
import type { Guide } from "./types";

const cache = new WeakMap<Guide, DerivedBuild>();

/** Derived build data for a guide, memoised per guide object (built-in guides are stable objects). */
export function derivedFor(guide: Guide): DerivedBuild {
  let d = cache.get(guide);
  if (!d) {
    d = deriveBuild(guide);
    cache.set(guide, d);
  }
  return d;
}

export const useDerived = (guide: Guide) => useMemo(() => derivedFor(guide), [guide]);
