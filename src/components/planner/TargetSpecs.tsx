import { STAT_KEYS, type StatKey, type Stats } from "@/data/weapons-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { getWeapon } from "@/lib/planner/sources";

/**
 * Required specs for the finished weapon: minimum stats and level. The Min and Max buttons on the left
 * prefill the target's base and maximum stats.
 */
export function TargetSpecs({
  weaponId,
  stats,
  level,
  onStats,
  onLevel,
}: {
  weaponId: string;
  stats: Stats;
  level: number;
  onStats: (s: Stats) => void;
  onLevel: (n: number) => void;
}) {
  const t = useTranslations();
  const weapon = getWeapon(weaponId);
  const max = weapon.maxStats;
  const set = (k: StatKey, n: number) =>
    onStats({ ...stats, [k]: Math.min(max[k], Math.max(0, n)) });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">{t("planner.targetSpecsHint")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex gap-2 sm:w-20 sm:flex-col" role="group" aria-label={weapon.name}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t("planner.specs.minHint")}
            onClick={() => onStats({ ...weapon.baseStats })}
          >
            {t("planner.specs.min")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t("planner.specs.maxHint")}
            onClick={() => onStats({ ...weapon.maxStats })}
          >
            {t("planner.specs.max")}
          </Button>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-3 sm:grid-cols-5">
          {STAT_KEYS.map((k) => (
            <Label key={k} className="flex flex-col items-start gap-1 text-xs">
              <span className="text-muted-foreground">
                {t(`stat.${k}` as const)} ≤ {max[k]}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={max[k]}
                value={stats[k]}
                onChange={(e) => set(k, Math.floor(Number(e.target.value) || 0))}
              />
            </Label>
          ))}
          <Label className="flex flex-col items-start gap-1 text-xs">
            <span className="text-muted-foreground">{t("planner.targetLevel")}</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={level}
              onChange={(e) =>
                onLevel(Math.min(99, Math.max(0, Math.floor(Number(e.target.value) || 0))))
              }
            />
          </Label>
        </div>
      </div>
    </div>
  );
}
