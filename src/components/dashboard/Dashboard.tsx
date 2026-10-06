import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StepFilters } from "@/components/guide/StepCard";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { firstIncompleteChapter } from "@/lib/guide/dashboard";
import { guideProgress } from "@/lib/guide/progress";
import type { DashboardView } from "@/lib/profiles";
import { setDashboardView, setView } from "@/lib/store";
import { ByGuideView } from "./ByGuideView";
import { ChapterView, FilterBar } from "./ChapterView";
import { OverviewView } from "./OverviewView";
import { useActiveGuides } from "./useActiveGuides";

const views: DashboardView[] = ["chapter", "overview", "byGuide"];

export function Dashboard() {
  const t = useTranslations();
  const { profile, checks, guides } = useActiveGuides();
  const [needle, setNeedle] = useState("");
  const [viewChapter, setViewChapter] = useState<string | null>(null);

  // A chapter can be requested with ?chapter=c3 (e.g. from redirected old links).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("chapter");
    if (id && chapterById.has(id)) setViewChapter(id);
  }, []);

  const currentId = profile.dashboard.currentChapter ?? firstIncompleteChapter(guides, checks);
  const chapterId = viewChapter ?? currentId;
  // Each switched-on guide tracks its own progress; nothing is shown for guides that are off.
  const perGuide = useMemo(
    () => guides.map((g) => ({ guide: g, progress: guideProgress(g, checks) })),
    [guides, checks],
  );

  const filters: StepFilters = {
    hideDone: profile.view.hideDone,
    hidePostgame: profile.view.hidePostgame,
    showFacts: profile.view.showFacts,
    needle: needle.trim().toLowerCase(),
  };

  const openChapter = (id: string) => {
    setViewChapter(id);
    setDashboardView("chapter");
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
        {perGuide.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("dash.noActive")}{" "}
            <a className="underline" href="/guides">
              {t("nav.guides")}
            </a>
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {perGuide.map(({ guide, progress }) => {
              const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
              return (
                <li key={guide.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <a
                      className="truncate hover:underline"
                      href={`/guides/view?id=${encodeURIComponent(guide.id)}`}
                    >
                      {guide.title}
                    </a>
                    <span className="text-muted-foreground tabular-nums">
                      {t("step.progress", { done: progress.done, total: progress.total })}
                    </span>
                  </div>
                  <div
                    className="bg-muted h-2 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={guide.title}
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div role="tablist" className="flex flex-wrap gap-1 border-b">
        {views.map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={profile.dashboard.view === v}
            onClick={() => setDashboardView(v)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${profile.dashboard.view === v ? "border-primary font-medium" : "text-muted-foreground border-transparent"}`}
          >
            {t(`dash.views.${v}` as const)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Toggle
          label={t("view.facts")}
          checked={profile.view.showFacts}
          onChange={(v) => setView({ showFacts: v })}
        />
        <Toggle
          label={t("view.hideDone")}
          checked={profile.view.hideDone}
          onChange={(v) => setView({ hideDone: v })}
        />
        <Toggle
          label={t("view.hidePostgame")}
          checked={profile.view.hidePostgame}
          onChange={(v) => setView({ hidePostgame: v })}
        />
      </div>
      {profile.dashboard.view !== "overview" && (
        <FilterBar filters={filters} needle={needle} onNeedle={setNeedle} />
      )}

      {profile.dashboard.view === "chapter" && (
        <ChapterView
          guides={guides}
          profile={profile}
          checks={checks}
          chapterId={chapterId}
          currentId={currentId}
          onChapter={setViewChapter}
          filters={filters}
        />
      )}
      {profile.dashboard.view === "overview" && (
        <OverviewView
          guides={guides}
          checks={checks}
          currentId={currentId}
          onChapter={openChapter}
        />
      )}
      {profile.dashboard.view === "byGuide" && (
        <ByGuideView guides={guides} checks={checks} filters={filters} />
      )}
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
