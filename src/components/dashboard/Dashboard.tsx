import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { StepFilters } from "@/components/guide/StepCard";
import { useTranslations } from "@/i18n";
import { chapterById } from "@/lib/data";
import { builtinGuideById } from "@/lib/guide/builtin";
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
  const main = builtinGuideById.get("main")!;
  const [needle, setNeedle] = useState("");
  const [viewChapter, setViewChapter] = useState<string | null>(null);

  // A chapter can be requested with ?chapter=c3 (e.g. from redirected old links).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("chapter");
    if (id && chapterById.has(id)) setViewChapter(id);
  }, []);

  const currentId = profile.dashboard.currentChapter ?? firstIncompleteChapter(main, checks);
  const chapterId = viewChapter ?? currentId;
  const overall = useMemo(() => guideProgress(main, checks), [checks]);
  const pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;

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
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t("nav.dashboard")}</h1>
          <span className="text-muted-foreground text-sm tabular-nums">
            {t("home.overall", { done: overall.done, total: overall.total })}
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
        </div>
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
