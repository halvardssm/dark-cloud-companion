import { CheckRow } from "@/components/chapter/CheckRow";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n";
import type { medalItems } from "@/lib/data";
import type { Section } from "@/data/schema";
import { setChecked } from "@/lib/store";

/** A section's facts (enemies, totals, boss, …) with its medal and prize checkboxes. */
export function SectionFacts({
  section,
  medals,
  checks,
  showFacts,
}: {
  section: Section;
  medals: ReturnType<typeof medalItems>;
  checks: Record<string, true>;
  showFacts: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-1 rounded-md border px-2 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline">{t(`section.kind.${section.kind}` as const)}</Badge>
        {section.seal && (
          <Badge variant="secondary">{t("section.seal", { seal: section.seal })}</Badge>
        )}
        {section.special && (
          <Badge variant="outline">{t("section.special", { text: section.special })}</Badge>
        )}
      </div>
      {medals.map((m) => (
        <CheckRow
          key={m.id}
          checked={!!checks[m.id]}
          onChange={(v) => setChecked(m.id, v)}
          label={
            <>
              <span className="text-muted-foreground">
                {m.kind === "prize" && m.prizeType === "spheda"
                  ? t("medal.spheda")
                  : t(`medal.${m.kind}` as const)}
              </span>
              <span>{m.value}</span>
            </>
          }
        />
      ))}
      {showFacts && (
        <div className="text-muted-foreground flex flex-col gap-0.5 px-2 text-xs">
          {section.boss && (
            <p>
              {t("section.boss", { name: section.boss.name })}
              {section.boss.scoop ? ` (${t("section.bossScoop")})` : ""}
            </p>
          )}
          {section.totals && (
            <p>
              {t("section.totals", { abs: section.totals.abs, gilda: section.totals.gilda })}
              {section.geostone ? ` · ${t("section.geostone")}: ${section.geostone}` : ""}
            </p>
          )}
          {section.enemies.length > 0 && (
            <p>
              {t("section.enemies")}:{" "}
              {section.enemies
                .map((e) => `${e.name}${e.carriesKey ? "*" : ""} ×${e.count}`)
                .join(", ")}
            </p>
          )}
          {section.georamaBuild.length > 0 && (
            <p>
              {t("section.georama", {
                parts: section.georamaBuild.map((g) => `${g.qty}× ${g.name}`).join(", "),
              })}
            </p>
          )}
          {section.recruits.map((r) => (
            <p key={r.name}>{t("section.recruits", { name: r.name, where: r.location })}</p>
          ))}
        </div>
      )}
    </div>
  );
}
