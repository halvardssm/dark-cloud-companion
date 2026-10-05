import { STAT_KEYS, abilityId, type AbilityId, type StatKey } from "@/data/weapons-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/i18n";
import { getWeapon } from "@/lib/planner/sources";
import { freshState, type WeaponState } from "@/lib/weapons/mechanics";

interface Props {
  state: WeaponState;
  onChange: (s: WeaponState) => void;
}

function NumberField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <Label className="flex flex-col items-start gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full"
      />
    </Label>
  );
}

/** Editable current specs of the start weapon (level, ABS, SP, stats, abilities). */
export function StartSpecs({ state, onChange }: Props) {
  const t = useTranslations();
  const weapon = getWeapon(state.weaponId);
  const setStat = (k: StatKey, n: number) =>
    onChange({ ...state, stats: { ...state.stats, [k]: Math.min(n, weapon.maxStats[k]) } });
  const toggleAbility = (a: AbilityId) =>
    onChange({
      ...state,
      abilities: state.abilities.includes(a)
        ? state.abilities.filter((x) => x !== a)
        : [...state.abilities, a],
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label={t("planner.level")}
          value={state.level}
          max={99}
          onChange={(n) => onChange({ ...state, level: Math.min(n, 99) })}
        />
        <NumberField
          label={t("planner.absStored")}
          value={state.abs}
          onChange={(n) => onChange({ ...state, abs: n })}
        />
        <NumberField
          label={t("planner.sp")}
          value={state.sp}
          max={999}
          onChange={(n) => onChange({ ...state, sp: Math.min(n, 999) })}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {STAT_KEYS.map((k) => (
          <NumberField
            key={k}
            label={t(`stat.${k}` as const)}
            value={state.stats[k]}
            max={weapon.maxStats[k]}
            onChange={(n) => setStat(k, n)}
          />
        ))}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-muted-foreground mb-1 text-xs">{t("planner.abilities")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {abilityId.options.map((a) => (
            <Label key={a} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.abilities.includes(a)}
                onChange={() => toggleAbility(a)}
              />
              {t(`ability.${a}` as const)}
            </Label>
          ))}
        </div>
      </fieldset>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(freshState(weapon))}
        >
          {t("planner.specs.reset")}
        </Button>
      </div>
    </div>
  );
}
