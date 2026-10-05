import { useStore } from "@nanostores/react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ridepodRaw from "@/data/ridepod.json";
import { ridepodData, type RidepodPart } from "@/data/minigames-schema";
import { useTranslations } from "@/i18n";
import { ingredientIdByName } from "@/lib/data";
import { $checks, setChecked } from "@/lib/store";

const data = ridepodData.parse(ridepodRaw);
const categories = ["short", "long", "armor", "legs", "pack"] as const;

const partCheckId = (p: RidepodPart) => `ridepod:${p.id}`;
const coreCheckId = (name: string) => `ridepod-core:${name}`;

function ready(p: RidepodPart, checks: Record<string, true>) {
  const ok = (list: RidepodPart["invent"]) =>
    list.every((i) => checks[ingredientIdByName.get(i.name.toLowerCase()) ?? ""]);
  return ok(p.invent) || (!!p.alternate && ok(p.alternate));
}

const recipeText = (list: RidepodPart["invent"]) =>
  list.map((i) => (i.scoop ? `${i.name} (scoop)` : i.name)).join(" + ");

export function RidepodTracker() {
  const t = useTranslations();
  const checks = useStore($checks);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("ridepod.intro")}</p>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
          <span>{t("ridepod.cores")}</span>
          <span className="text-muted-foreground text-sm tabular-nums">
            {data.cores.filter((c) => checks[coreCheckId(c.name)]).length} / {data.cores.length}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          {data.cores.map((c) => (
            <CheckRow
              key={c.name}
              checked={!!checks[coreCheckId(c.name)]}
              onChange={(v) => setChecked(coreCheckId(c.name), v)}
              label={c.name}
              detail={[
                c.exp ? t("ridepod.coreExp", { exp: c.exp }) : undefined,
                t("ridepod.coreStats", { capacity: c.capacity, armor: c.armor }),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {categories.map((cat) => {
        const parts = data.parts.filter((p) => p.category === cat);
        const done = parts.filter((p) => checks[partCheckId(p)]).length;
        return (
          <Collapsible key={cat} defaultOpen={cat === "short"}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
              <span>{t(`ridepod.cat.${cat}` as const)}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {done} / {parts.length}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {parts.map((p) => {
                const built = !!checks[partCheckId(p)];
                const main = [
                  t("ridepod.capacity", { n: p.capacity }),
                  p.whp !== undefined ? t("ridepod.whp", { n: p.whp }) : undefined,
                  p.armor !== undefined ? t("ridepod.armorValue", { n: p.armor }) : undefined,
                  p.energy !== undefined ? t("ridepod.energyValue", { n: p.energy }) : undefined,
                  p.speed ? t("ridepod.speedValue", { n: p.speed }) : undefined,
                  ...Object.entries(p.stats ?? {}).map(([k, v]) => `${v} ${k}`),
                  p.buyExp ? t("ridepod.buy", { exp: p.buyExp }) : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <CheckRow
                    key={p.id}
                    checked={built}
                    onChange={(v) => setChecked(partCheckId(p), v)}
                    label={p.name}
                    badges={
                      !built && ready(p, checks) ? <Badge>{t("ready.badge")}</Badge> : undefined
                    }
                    detail={
                      <>
                        <span className="block">{main}</span>
                        <span className="block">
                          {t("ridepod.recipe")}: {recipeText(p.invent)}
                          {p.alternate
                            ? ` · ${t("ridepod.alternate")}: ${recipeText(p.alternate)}`
                            : ""}
                        </span>
                        <span className="block">
                          {t("ridepod.resources")}:{" "}
                          {p.resources.map((r) => `${r.qty}× ${r.name}`).join(", ")}
                        </span>
                      </>
                    }
                  />
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
