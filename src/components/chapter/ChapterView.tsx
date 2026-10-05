import { useStore } from "@nanostores/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ChecklistCategory, ChecklistItem } from "@/data/schema";
import { useTranslations } from "@/i18n";
import {
  chapters,
  chapterById,
  chapterProgress,
  inventionReady,
  itemsOf,
  medalItems,
  sectionById,
  sectionsOf,
} from "@/lib/data";
import { $checks, $profile, setChecked, setView } from "@/lib/store";
import { ChapterGuides } from "@/components/guides/ChapterGuides";
import { ChapterWalkthroughs } from "@/components/walkthroughs/ChapterWalkthroughs";
import { CheckRow } from "./CheckRow";
import { SectionCard } from "./SectionCard";

const categoryOrder: ChecklistCategory[] = [
  "scoop",
  "idea",
  "invention",
  "powerup",
  "recruit",
  "georama",
  "badge",
];

export function ChapterView({ chapterId }: { chapterId: string }) {
  const t = useTranslations();
  const checks = useStore($checks);
  const { view } = useStore($profile);
  const chapter = chapterById.get(chapterId)!;
  const items = itemsOf(chapterId);
  const sections = sectionsOf(chapterId);
  const progress = chapterProgress(chapterId, checks);
  const index = chapters.findIndex((c) => c.id === chapterId);
  const prev = chapters[index - 1];
  const next = chapters[index + 1];

  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = (i: ChecklistItem) =>
    !(view.hidePostgame && i.postgame) &&
    !(view.hideDone && checks[i.id]) &&
    (!needle || i.name.toLowerCase().includes(needle));

  const missable = items.filter((i) => i.missable && !checks[i.id]);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {chapter.phase === "main" ? `${chapter.number}. ` : ""}
            {chapter.title}
          </h1>
          <span className="text-muted-foreground text-sm tabular-nums">
            {t("chapter.progress", { done: progress.done, total: progress.total })}
          </span>
        </div>
        <div
          className="bg-muted h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Toggle
            label={t("view.walkthrough")}
            checked={view.layers.walkthrough}
            onChange={(v) => setView({ layers: { walkthrough: v } })}
          />
          <Toggle
            label={t("view.facts")}
            checked={view.layers.facts}
            onChange={(v) => setView({ layers: { facts: v } })}
          />
          <Toggle
            label={t("view.hideDone")}
            checked={view.hideDone}
            onChange={(v) => setView({ hideDone: v })}
          />
          <Toggle
            label={t("view.hidePostgame")}
            checked={view.hidePostgame}
            onChange={(v) => setView({ hidePostgame: v })}
          />
        </div>
        <Input
          type="search"
          placeholder={t("chapter.search")}
          aria-label={t("chapter.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      {missable.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">{t("missable.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {missable.map((i) => (
              <CheckRow
                key={i.id}
                checked={false}
                onChange={(v) => setChecked(i.id, v)}
                label={i.name}
                detail={i.sectionId ? sectionById.get(i.sectionId)?.title : undefined}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {chapter.phase === "main" && <ChapterGuides chapterNumber={chapter.number} />}
      <ChapterWalkthroughs chapterId={chapter.id} />

      {view.layers.checklists &&
        categoryOrder.map((cat) => {
          const all = items.filter((i) => i.category === cat);
          if (!all.length) return null;
          const shown = all.filter(visible);
          if (needle && !shown.length) return null;
          const done = all.filter((i) => checks[i.id]).length;
          return (
            <Collapsible
              key={`${cat}-${needle ? "q" : ""}`}
              defaultOpen={!!needle || cat === "scoop" || cat === "powerup"}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-3 text-left font-medium">
                <span>{t(`cat.${cat}` as const)}</span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {done} / {all.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div
                  className={
                    cat === "idea" ? "grid gap-x-4 pt-2 sm:grid-cols-2 lg:grid-cols-3" : "pt-2"
                  }
                >
                  {shown.map((i) => (
                    <ItemRow key={i.id} item={i} checks={checks} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

      {view.layers.facts && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("cat.medal")}</h2>
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} medals={medalItems(s)} />
          ))}
        </section>
      )}
      <nav className="flex justify-between gap-3 border-t pt-4 text-sm">
        {prev ? (
          <a className="underline" href={`/chapters/${prev.id}`}>
            ← {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="underline" href={`/chapters/${next.id}`}>
            {next.title} →
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </Label>
  );
}

function ItemRow({ item, checks }: { item: ChecklistItem; checks: Record<string, true> }) {
  const t = useTranslations();
  const section = item.sectionId ? sectionById.get(item.sectionId) : undefined;
  const ready = item.category === "invention" && !checks[item.id] && inventionReady(item, checks);
  const detail = [
    item.recipe?.map((r) => (r.scoop ? `${r.name} (scoop)` : r.name)).join(" + "),
    ...(item.notes ?? []),
    section && !item.notes?.includes(section.title) ? section.title : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <CheckRow
      checked={!!checks[item.id]}
      onChange={(v) => setChecked(item.id, v)}
      label={item.name}
      detail={detail || undefined}
      badges={
        <>
          {item.missable && <Badge variant="destructive">{t("missable.badge")}</Badge>}
          {item.ghost && <Badge variant="outline">{t("ghost.badge")}</Badge>}
          {item.albumOnly && <Badge variant="outline">{t("album.badge")}</Badge>}
          {item.postgame && <Badge variant="secondary">{t("postgame.badge")}</Badge>}
          {ready && <Badge>{t("ready.badge")}</Badge>}
        </>
      }
    />
  );
}
