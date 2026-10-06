import { useStore } from "@nanostores/react";
import { withBase } from "@/lib/base";
import { CheckRow } from "@/components/chapter/CheckRow";
import { weaponData } from "@/lib/planner/sources";
import { useTranslations } from "@/i18n";
import { chapters, medalItems, sectionsOf } from "@/lib/data";
import { $checks, setChecked } from "@/lib/store";

export function SphedaTracker() {
  const t = useTranslations();
  const checks = useStore($checks);
  const clubs = weaponData.weapons.filter((w) => w.type === "club");
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">{t("spheda.intro")}</p>
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("spheda.clubs")}</h2>
        <p className="text-sm">
          {clubs.map((c, i) => (
            <span key={c.id}>
              <a className="underline" href={withBase(`/weapons/${c.id}`)}>
                {c.name}
              </a>
              {i < clubs.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      </section>
      {chapters
        .filter((c) => c.phase === "main")
        .map((c) => {
          const rows = sectionsOf(c.id).flatMap((s) =>
            medalItems(s)
              .filter((m) => m.kind === "prize" && m.prizeType === "spheda")
              .map((m) => ({ s, m })),
          );
          if (!rows.length) return null;
          const done = rows.filter((r) => checks[r.m.id]).length;
          return (
            <section key={c.id} className="flex flex-col">
              <h2 className="mb-1 flex items-baseline justify-between text-lg font-semibold">
                <a className="hover:underline" href={withBase(`/?chapter=${c.id}`)}>
                  {c.number}. {c.title}
                </a>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {done} / {rows.length}
                </span>
              </h2>
              {rows.map(({ s, m }) => (
                <CheckRow
                  key={m.id}
                  checked={!!checks[m.id]}
                  onChange={(v) => setChecked(m.id, v)}
                  label={m.value}
                  detail={s.title}
                />
              ))}
            </section>
          );
        })}
    </div>
  );
}
