import { useStore } from "@nanostores/react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n";
import { chapterProgress, chapters } from "@/lib/data";
import { $checks } from "@/lib/store";

export function ChaptersOverview() {
  const t = useTranslations();
  const checks = useStore($checks);
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {chapters.map((c) => {
        const p = chapterProgress(c.id, checks);
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return (
          <li key={c.id}>
            <a
              href={`/chapters/${c.id}`}
              className="hover:bg-muted/50 flex flex-col gap-2 rounded-lg border p-4"
            >
              <span className="flex items-center justify-between gap-2 font-medium">
                <span>{c.phase === "main" ? `${c.number}. ${c.title}` : c.title}</span>
                {c.phase === "postgame" && (
                  <Badge variant="secondary">{t("chapter.postgame")}</Badge>
                )}
              </span>
              <span className="bg-muted h-1.5 overflow-hidden rounded-full">
                <span className="bg-primary block h-full" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {t("chapter.progress", { done: p.done, total: p.total })}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
