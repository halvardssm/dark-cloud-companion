import { weaponType } from "@/data/weapons-schema";
import { useTranslations } from "@/i18n";
import { weaponData } from "@/lib/planner/sources";

export const selectClass = "bg-background h-10 w-full rounded-md border px-3 text-sm";

/** Weapon dropdown grouped by type; `ids` limits the options. */
export function WeaponSelect({
  value,
  onChange,
  ids,
  className = selectClass,
}: {
  value: string;
  onChange: (id: string) => void;
  ids?: Set<string>;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {weaponType.options.map((type) => {
        const ws = weaponData.weapons.filter((w) => w.type === type && (!ids || ids.has(w.id)));
        if (!ws.length) return null;
        return (
          <optgroup key={type} label={t(`weapon.type.${type}` as const)}>
            {ws.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
