import { useMemo, useState } from "react";
import { STAT_KEYS } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { itemAvailability, synthSources } from "@/lib/planner/sources";

type Filter = "all" | "buyable" | "found";

/** All synth items with their gains and whether they can be bought or only found. */
export function ItemsList() {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const byCategory = new Map<string, typeof synthSources>();
    for (const s of synthSources) {
      const a = itemAvailability(s.name);
      if (filter === "buyable" && a.kind !== "buyable") continue;
      if (filter === "found" && a.kind !== "found") continue;
      if (needle && !s.name.toLowerCase().includes(needle)) continue;
      byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
    }
    return [...byCategory];
  }, [filter, needle]);

  const counts = useMemo(() => {
    const found = synthSources.filter((s) => itemAvailability(s.name).kind === "found").length;
    return { buyable: synthSources.length - found, found };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("items.intro")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          type="search"
          placeholder={t("items.search")}
          aria-label={t("items.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label={t("items.title")}
        >
          <option value="all">{t("items.filter.all")}</option>
          <option value="buyable">
            {t("items.filter.buyable")} ({counts.buyable})
          </option>
          <option value="found">
            {t("items.filter.found")} ({counts.found})
          </option>
        </select>
      </div>
      {groups.map(([category, items]) => (
        <section key={category} className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{category}</h2>
          <ul className="flex flex-col divide-y rounded-md border">
            {items.map((s) => {
              const a = itemAvailability(s.name);
              const gains = STAT_KEYS.filter((k) => s.gains[k]).map(
                (k) => `${t(`stat.${k}` as const)} +${s.gains[k]}`,
              );
              if (s.gains.du) gains.push(`${t("weapons.durability")} +${s.gains.du}`);
              if (s.ability) gains.push(t(`ability.${s.ability}` as const));
              return (
                <li key={s.name} className="flex flex-col gap-1 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {a.kind === "buyable" ? (
                      <Badge>{t("items.buyable")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("items.foundOnly")}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{gains.join(", ") || "—"}</p>
                  {a.kind === "buyable" && (
                    <p className="text-muted-foreground text-xs">
                      {t("items.price", { price: a.price, chapter: a.fromChapter })} ·{" "}
                      {t("items.shops", { shops: a.shops.join(", ") })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
