import {
  STAT_KEYS,
  abilityId,
  type AbilityId,
  type StatKey,
  type Stats,
} from "@/data/weapons-schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { getWeapon } from "@/lib/planner/sources";
import { OPPOSITES } from "@/lib/weapons/mechanics";

/** Required specs for a custom end weapon: minimum stats, level and abilities. */
export function TargetSpecs({
  weaponId,
  stats,
  level,
  abilities,
  onStats,
  onLevel,
  onAbilities,
}: {
  weaponId: string;
  stats: Stats;
  level: number;
  abilities: AbilityId[];
  onStats: (s: Stats) => void;
  onLevel: (n: number) => void;
  onAbilities: (a: AbilityId[]) => void;
}) {
  const t = useTranslations();
  const max = getWeapon(weaponId).maxStats;
  const set = (k: StatKey, n: number) =>
    onStats({ ...stats, [k]: Math.min(max[k], Math.max(0, n)) });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">{t("planner.targetSpecsHint")}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
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
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted-foreground mb-1 text-xs">{t("planner.wantAbilities")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {abilityId.options.map((a) => {
            const opposite = OPPOSITES[a];
            const blocked = !!opposite && abilities.includes(opposite);
            return (
              <Label
                key={a}
                className={`flex items-center gap-2 text-sm ${blocked ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={blocked}
                  checked={abilities.includes(a)}
                  onChange={(e) =>
                    onAbilities(
                      e.target.checked ? [...abilities, a] : abilities.filter((x) => x !== a),
                    )
                  }
                />
                {t(`ability.${a}` as const)}
              </Label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
