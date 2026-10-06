import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/i18n";
import { $draft } from "@/lib/guide/draft";
import { EditorSection } from "./EditorSection";
import { GeneratorSection } from "./GeneratorSection";

type Tab = "generate" | "create";

/** Planner tab: one section generates a weapon build, the other hand-crafts guides (generated builds prefill it). */
export function PlannerPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("generate");
  const draft = useStore($draft);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.has("edit") || p.has("new")) setTab("create");
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: t("planner.tab.generate") },
    { id: "create", label: `${t("planner.tab.create")}${draft ? " •" : ""}` },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex flex-wrap gap-1 border-b">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x.id ? "border-primary font-medium" : "text-muted-foreground border-transparent"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {/* Both sections stay mounted so a generated result and an open draft survive switching tabs. */}
      <div hidden={tab !== "generate"}>
        <GeneratorSection onOpenEditor={() => setTab("create")} />
      </div>
      <div hidden={tab !== "create"}>
        <EditorSection />
      </div>
    </div>
  );
}
