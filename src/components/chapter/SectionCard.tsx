import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Section } from "@/data/schema";
import { useTranslations } from "@/i18n";
import type { MedalItem } from "@/lib/data";
import { $checks, setChecked } from "@/lib/store";
import { useStore } from "@nanostores/react";
import { CheckRow } from "./CheckRow";

export function SectionCard({ section, medals }: { section: Section; medals: MedalItem[] }) {
  const t = useTranslations();
  const checks = useStore($checks);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {section.title}
          <Badge variant="outline">{t(`section.kind.${section.kind}` as const)}</Badge>
          {section.seal && (
            <Badge variant="secondary">{t("section.seal", { seal: section.seal })}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
        {section.totals && (
          <p className="text-muted-foreground px-2 text-xs">
            {t("section.totals", { abs: section.totals.abs, gilda: section.totals.gilda })}
            {section.geostone ? ` · ${t("section.geostone")}: ${section.geostone}` : ""}
          </p>
        )}
        {section.enemies.length > 0 && (
          <p className="text-muted-foreground px-2 text-xs">
            {t("section.enemies")}:{" "}
            {section.enemies
              .map((e) => `${e.name}${e.carriesKey ? "*" : ""} ×${e.count}`)
              .join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
