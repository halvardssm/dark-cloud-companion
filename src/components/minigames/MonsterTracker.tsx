import { useStore } from "@nanostores/react";
import { CheckRow } from "@/components/chapter/CheckRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import monstersRaw from "@/data/monsters.json";
import { monstersData } from "@/lib/schemas";
import { useTranslations } from "@/i18n";
import { $checks, setChecked } from "@/lib/store";

const classes = monstersData.parse(monstersRaw);

export function MonsterTracker() {
  const t = useTranslations();
  const checks = useStore($checks);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t("monsters.intro")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((c) => (
          <Card key={c.id} size="sm">
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
              <p className="text-muted-foreground text-xs">
                {t("monsters.badgeHow", { how: c.badge })}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-x-4">
                <CheckRow
                  checked={!!checks[`monster:${c.id}:badge`]}
                  onChange={(v) => setChecked(`monster:${c.id}:badge`, v)}
                  label={t("monsters.badge")}
                />
                <CheckRow
                  checked={!!checks[`monster:${c.id}:mastered`]}
                  onChange={(v) => setChecked(`monster:${c.id}:mastered`, v)}
                  label={t("monsters.mastered")}
                />
              </div>
              <ul className="text-sm">
                {c.forms.map((f) => (
                  <li key={f.name} style={{ paddingLeft: `${f.depth * 12}px` }} className="py-0.5">
                    {f.name}{" "}
                    <span className="text-muted-foreground text-xs">
                      {t("monsters.stats", { atk: f.atk, def: f.def })}
                      {f.note ? ` · ${f.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
