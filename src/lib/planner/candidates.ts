import { STAT_KEYS } from "@/lib/schemas";
import { synthSources, type SynthSource } from "./sources";

export interface ItemFilter {
  /** Only items sold by this chapter (shop-sold items only unless `allowFound`). */
  maxChapter: number;
  /** Also allow items that are never sold (dungeon drops etc.). Treated as free. */
  allowFound?: boolean;
}

const statGains = (s: SynthSource) => STAT_KEYS.map((k) => s.gains[k] ?? 0);
const hasStatGain = (s: SynthSource) => statGains(s).some((g) => g > 0);

/** Items that can be synthed at this point, with dominated ones removed (never worse in any stat, never cheaper). */
export function itemCandidates(filter: ItemFilter): SynthSource[] {
  const pool = synthSources.filter((s) => {
    if (!hasStatGain(s)) return false;
    if (s.price !== undefined) return (s.fromChapter ?? 1) <= filter.maxChapter;
    return !!filter.allowFound && !/^(Moon|Sun) Stone$/.test(s.name);
  });
  const price = (s: SynthSource) => s.price ?? 0;
  return pool.filter((a, i) => {
    const ga = statGains(a);
    return !pool.some((b, j) => {
      if (i === j) return false;
      const gb = statGains(b);
      const geq = gb.every((g, n) => g >= ga[n]);
      const strictlyBetter = gb.some((g, n) => g > ga[n]) || price(b) < price(a);
      return geq && price(b) <= price(a) && (strictlyBetter || j < i);
    });
  });
}
