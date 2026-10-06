import { Badge } from "@/components/ui/badge";
import { withBase } from "@/lib/base";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n";
import { chapters } from "@/lib/data";
import { chapterProgressOfGuides } from "@/lib/guide/dashboard";
import { guideProgress, isStepDone } from "@/lib/guide/progress";
import type { Guide } from "@/lib/guide/types";

/** Chapter progress grid plus, per switched-on guide, its next open steps. */
export function OverviewView({
  guides,
  checks,
  currentId,
  onChapter,
}: {
  guides: Guide[];
  checks: Record<string, true>;
  currentId: string;
  onChapter: (id: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      {guides.length === 0 && <p className="text-muted-foreground text-sm">{t("dash.noActive")}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {chapters.map((c) => {
          const p = chapterProgressOfGuides(guides, c.id, checks);
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChapter(c.id)}
                className="hover:bg-muted/50 flex w-full flex-col gap-2 rounded-lg border p-4 text-left"
              >
                <span className="flex items-center justify-between gap-2 font-medium">
                  <span>{c.phase === "main" ? `${c.number}. ${c.title}` : c.title}</span>
                  {c.id === currentId && <Badge>{t("dash.isCurrent")}</Badge>}
                  {c.phase === "postgame" && (
                    <Badge variant="secondary">{t("chapter.postgame")}</Badge>
                  )}
                </span>
                {p.total > 0 && (
                  <>
                    <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <span className="bg-primary block h-full" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {t("step.progress", { done: p.done, total: p.total })}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <section className="grid gap-4 lg:grid-cols-2">
        {guides.map((g) => {
          const p = guideProgress(g, checks);
          const open = g.steps.filter((s) => !isStepDone(g, s, checks)).slice(0, 3);
          return (
            <Card key={g.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <a
                    className="hover:underline"
                    href={withBase(`/guides/view?id=${encodeURIComponent(g.id)}`)}
                  >
                    {g.title}
                  </a>
                  <span className="text-muted-foreground text-xs font-normal tabular-nums">
                    {t("step.progress", { done: p.done, total: p.total })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {open.length === 0 ? (
                  <p className="text-muted-foreground">{t("dash.allDone")}</p>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-1 text-xs">{t("dash.nextSteps")}</p>
                    <ol className="list-decimal pl-5">
                      {open.map((s) => (
                        <li key={s.id}>{s.title}</li>
                      ))}
                    </ol>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
