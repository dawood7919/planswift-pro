import React, { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, FileText, Layers3, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildProjectRollup, type RollupItem } from "@shared/takeoff-core/projectRollup";
import type { MeasurementGeometry, MeasurementKind } from "@shared/takeoff-core";
import SheetsTab from "./tabs/SheetsTab";
import TakeoffTab from "./tabs/TakeoffTab";
import EstimateTab from "./tabs/EstimateTab";

const tabs = [
  { id: "sheets", label: "الأوراق", icon: FileText },
  { id: "takeoff", label: "القياسات", icon: Layers3 },
  { id: "estimate", label: "التقدير", icon: Wallet },
] as const;

export type ProjectTab = (typeof tabs)[number]["id"];

function parseGeometry(geometryJson: string): MeasurementGeometry {
  try {
    return JSON.parse(geometryJson) as MeasurementGeometry;
  } catch {
    return {};
  }
}

/**
 * The project shell: three peer surfaces over one workspace query, with the plan viewer as a
 * focused child rather than a panel competing with everything else for the same column.
 */
export default function ProjectPage() {
  const [, params] = useRoute<{ projectId: string }>("/projects/:projectId");
  const [, setLocation] = useLocation();
  const projectId = params?.projectId;
  const [tab, setTab] = useState<ProjectTab>("sheets");

  const workspaceQuery = trpc.projects.get.useQuery(projectId ?? "", { enabled: Boolean(projectId) });
  const templatesQuery = trpc.templates.list.useQuery();

  const workspace = workspaceQuery.data;
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);

  const rollup = useMemo(() => {
    if (!workspace) return null;
    const items: RollupItem[] = workspace.items.map((item) => ({
      id: item.id,
      pageId: item.pageId,
      name: item.name,
      kind: item.kind as MeasurementKind,
      geometry: parseGeometry(item.geometryJson),
      rate: String(item.rate),
      multiplier: String(item.multiplier ?? 1),
      template: templates.find((candidate) => candidate.id === item.templateId) ?? null,
    }));
    return buildProjectRollup(workspace.pages, items, templates);
  }, [workspace, templates]);

  if (!projectId) return null;
  if (workspaceQuery.isLoading) return <div className="workspace-loading">جارٍ فتح المشروع…</div>;
  if (!workspace || !rollup) {
    return <div className="workspace-loading">تعذر فتح هذا المشروع. عد إلى قائمة المشاريع واختر مشروعاً صالحاً.</div>;
  }

  const openPlan = () => setLocation(`/workspace/${projectId}`);

  return (
    <div className="project-shell" dir="rtl">
      <header className="project-shell-header">
        <div className="project-heading">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} aria-label="العودة إلى المشاريع"><ArrowLeft size={19} /></Button>
          <div>
            <p className="workspace-eyebrow">{workspace.project.clientName || "مشروع"}{workspace.project.location ? ` · ${workspace.project.location}` : ""}</p>
            <h1>{workspace.project.name}</h1>
          </div>
        </div>
        <Button className="workspace-primary" size="sm" onClick={openPlan}>فتح المخطط</Button>
      </header>

      <nav className="project-tabs" role="tablist" aria-label="أقسام المشروع">
        {tabs.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={tab === entry.id}
              className={tab === entry.id ? "active" : ""}
              onClick={() => setTab(entry.id)}
            >
              <Icon size={15} />{entry.label}
            </button>
          );
        })}
      </nav>

      {rollup.untrustedPageCount > 0 && (
        <p className="project-notice" role="status">
          {rollup.untrustedPageCount} صفحة بإحداثيات قديمة مستبعدة من الإجماليات. افتح كل صفحة منها وحوّلها ثم أعد معايرتها.
        </p>
      )}

      <div className="project-tab-panel" role="tabpanel">
        {tab === "sheets" && <SheetsTab rollup={rollup} onOpenPlan={openPlan} />}
        {tab === "takeoff" && <TakeoffTab rollup={rollup} />}
        {tab === "estimate" && <EstimateTab rollup={rollup} currency={workspace.project.currency} />}
      </div>
    </div>
  );
}
