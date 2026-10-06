import { CircleDashedIcon, CrosshairIcon, GemIcon, SwordIcon, WrenchIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WeaponType } from "@/lib/schemas";
import { useTranslations } from "@/i18n";

/** One tab per weapon type, in the order the planner shows them. */
const TYPE_TABS: { type: WeaponType; Icon: LucideIcon }[] = [
  { type: "wrench", Icon: WrenchIcon },
  { type: "sword", Icon: SwordIcon },
  { type: "gun", Icon: CrosshairIcon },
  { type: "armband", Icon: GemIcon },
  { type: "club", Icon: CircleDashedIcon },
];

/**
 * Weapon-type chooser for the generator: a vertical strip of icon-only tabs (a horizontal row on small
 * screens). The type name appears on hover and for keyboard users; it is always in the accessible name.
 */
export function WeaponTypeTabs({
  value,
  onChange,
}: {
  value: WeaponType;
  onChange: (type: WeaponType) => void;
}) {
  const t = useTranslations();
  return (
    <div
      role="tablist"
      aria-label={t("planner.weaponType")}
      className="flex flex-row gap-1 sm:w-11 sm:shrink-0 sm:flex-col"
    >
      {TYPE_TABS.map(({ type, Icon }) => {
        const active = type === value;
        const label = t(`weapon.type.${type}` as const);
        return (
          <div key={type} className="group relative">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={label}
              onClick={() => onChange(type)}
              className={`flex size-9 items-center justify-center rounded-md border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{label}</span>
            </button>
            <span
              role="tooltip"
              className="bg-primary text-primary-foreground pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:left-full sm:top-1/2 sm:mt-0 sm:ml-2 sm:-translate-x-0 sm:-translate-y-1/2"
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
