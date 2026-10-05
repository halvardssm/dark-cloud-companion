import { useStore } from "@nanostores/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { curatedGuideById } from "@/lib/guides/data";
import { chapterProgress, chapters } from "@/lib/data";
import { $checks, $profile } from "@/lib/store";

export function Dashboard() {
  const t = useTranslations();
  const checks = useStore($checks);
  const { activeGuides, customGuides } = useStore($profile);
  const main = chapters.filter((c) => c.phase === "main");
  const progress = main.map((c) => ({ c, p: chapterProgress(c.id, checks) }));
  const done = progress.reduce((n, x) => n + x.p.done, 0);
  const total = progress.reduce((n, x) => n + x.p.total, 0);
  // "Continue" = first chapter that isn't finished.
  const current = progress.find((x) => x.p.done < x.p.total)?.c ?? main[main.length - 1];
  const pct = total ? Math.round((done / total) * 100) : 0;
  const guides = activeGuides
    .map((id) => curatedGuideById.get(id) ?? customGuides.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("home.overall", { done, total })}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
          </div>
          <a className="underline" href={`/chapters/${current.id}`}>
            {t("home.continue")}: {current.number}. {current.title}
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("home.activeGuides")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {guides.length === 0 ? (
            <p className="text-muted-foreground">{t("home.noGuides")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {guides.map((g) => (
                <li key={g.id}>
                  <a
                    className="underline"
                    href={
                      g.kind === "curated"
                        ? `/guides/${g.id}`
                        : `/guides/custom?id=${encodeURIComponent(g.id)}`
                    }
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
