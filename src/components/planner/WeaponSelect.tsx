import { weaponType } from "@/data/weapons-schema";
import { useTranslations } from "@/i18n";
import { weaponData } from "@/lib/planner/sources";

export const selectClass = "bg-background h-10 w-full rounded-md border px-3 text-sm";

/**
 * Weapon dropdown grouped by type; `ids` limits the options. With `tierOrder`, the weapons of each type
 * are ordered by SP tier (the game's low/mid/high weapon tiers), highest first, instead of data order.
 */
export function WeaponSelect({
  value,
  onChange,
  ids,
  className = selectClass,
  tierOrder = false,
}: {
  value: string;
  onChange: (id: string) => void;
  ids?: Set<string>;
  className?: string;
  tierOrder?: boolean;
}) {
  const t = useTranslations();
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {weaponType.options.map((type) => {
        let ws = weaponData.weapons.filter((w) => w.type === type && (!ids || ids.has(w.id)));
        if (!ws.length) return null;
        if (tierOrder)
          ws = [...ws].sort((a, b) => b.spPerLevel - a.spPerLevel || a.name.localeCompare(b.name));
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
