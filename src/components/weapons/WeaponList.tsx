import { useMemo, useState } from "react";
import { weaponType } from "@/data/weapons-schema";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { weaponData } from "@/lib/planner/sources";

export function WeaponList() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return weaponType.options
      .filter((ty) => type === "all" || type === ty)
      .map((ty) => ({
        type: ty,
        weapons: weaponData.weapons.filter(
          (w) => w.type === ty && (!needle || w.name.toLowerCase().includes(needle)),
        ),
      }))
      .filter((g) => g.weapons.length);
  }, [q, type]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("weapons.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("weapons.search")}
        />
        <div role="tablist" aria-label={t("weapons.title")} className="flex flex-wrap gap-1">
          {(["all", ...weaponType.options] as const).map((ty) => (
            <button
              key={ty}
              type="button"
              role="tab"
              aria-selected={type === ty}
              onClick={() => setType(ty)}
              className={`rounded-md border px-3 py-1.5 text-sm ${type === ty ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
            >
              {ty === "all" ? t("weapons.all") : t(`weapon.type.${ty}` as const)}
            </button>
          ))}
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.type} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t(`weapon.type.${g.type}` as const)}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.weapons.map((w) => (
              <li key={w.id}>
                <a
                  href={`/weapons/${w.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{w.name}</span>
                  <span className="flex gap-1">
                    {w.requiresKills.length > 0 && <Badge variant="outline">★</Badge>}
                    {w.abilities.slice(0, 2).map((a) => (
                      <Badge key={a} variant="secondary">
                        {t(`ability.${a}` as const)}
                      </Badge>
                    ))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
