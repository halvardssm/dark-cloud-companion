import { useEffect, useMemo, useState } from "react";
import { weaponType, type WeaponType } from "@/data/weapons-schema";
import { useTranslations } from "@/i18n";
import { weaponById, weaponData } from "@/lib/planner/sources";

/**
 * Weapon chooser with one tab per weapon type (wrenches & hammers, clubs, guns, swords, armbands) and the weapons of
 * the active type as buttons — easier to scan than one long dropdown. `ids` limits the choice.
 */
export function WeaponPicker({
  value,
  onChange,
  ids,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  ids?: Set<string>;
  label: string;
}) {
  const t = useTranslations();
  const byType = useMemo(
    () =>
      weaponType.options
        .map((type) => ({
          type,
          weapons: weaponData.weapons.filter((w) => w.type === type && (!ids || ids.has(w.id))),
        }))
        .filter((g) => g.weapons.length > 0),
    [ids],
  );
  const selectedType: WeaponType | undefined = weaponById.get(value)?.type;
  const [tab, setTab] = useState<WeaponType>(selectedType ?? byType[0]?.type ?? "wrench");
  // Follow the selection when it changes from outside (e.g. a deep link or a guide).
  useEffect(() => {
    if (selectedType) setTab(selectedType);
  }, [selectedType]);
  const active = byType.find((g) => g.type === tab) ?? byType[0];

  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b">
        {byType.map((g) => (
          <button
            key={g.type}
            type="button"
            role="tab"
            aria-selected={active?.type === g.type}
            onClick={() => setTab(g.type)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm whitespace-nowrap ${active?.type === g.type ? "border-primary font-medium" : "text-muted-foreground border-transparent"}`}
          >
            {t(`weapon.type.${g.type}` as const)}
            <span className="text-muted-foreground ml-1 text-xs">{g.weapons.length}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" className="flex flex-wrap gap-1.5">
        {active?.weapons.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={w.id === value}
            onClick={() => onChange(w.id)}
            className={`rounded-md border px-2.5 py-1 text-sm ${w.id === value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
          >
            {w.name}
          </button>
        ))}
      </div>
    </div>
  );
}
