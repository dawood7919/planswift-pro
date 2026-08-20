import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ClipboardList, FileStack, Ruler, WalletCards } from "lucide-react";
import { useState } from "react";
import { useLocation, useRoute } from "wouter";

type ProjectTab = "sheets" | "takeoff" | "estimate";

export default function ProjectPage() {
  const { direction, t } = useTranslation();
  const [, params] = useRoute<{ projectId: string }>("/projects/:projectId");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<ProjectTab>("sheets");
  const projectId = params?.projectId ?? "";
  const projectQuery = trpc.projects.get.useQuery(projectId, { enabled: Boolean(projectId) });

  if (projectQuery.isLoading) return <div className="workspace-loading" dir={direction}>{t("project.loading")}</div>;
  if (projectQuery.isError || !projectQuery.data) return <section className="workspace-empty large-empty" dir={direction}><h1>{t("project.errorTitle")}</h1><p>{t("project.errorDescription")}</p><Button className="workspace-primary" onClick={() => setLocation("/projects")}>{t("project.backToProjects")}</Button></section>;

  const { project, pages, items } = projectQuery.data;
  const pageNames = new Map(pages.map((page) => [page.id, page.name]));
  const tabs: Array<{ id: ProjectTab; label: string; icon: typeof FileStack }> = [
    { id: "sheets", label: t("project.sheets"), icon: FileStack },
    { id: "takeoff", label: t("project.takeoff"), icon: Ruler },
    { id: "estimate", label: t("project.estimate"), icon: WalletCards },
  ];

  return <main className="project-shell" dir={direction}>
    <header className="workspace-topbar project-shell-header">
      <div className="project-heading"><Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} aria-label={t("project.backToProjects")}><ArrowLeft size={19} /></Button><div><p className="workspace-eyebrow">PROJECT / OVERVIEW</p><h1>{project.name}</h1></div></div>
      <Button className="workspace-primary" onClick={() => setLocation(`/workspace/${project.id}`)}><Ruler size={16} />{t("project.openPlan")}</Button>
    </header>
    <nav className="project-tabs" aria-label={t("project.tabsLabel")}>
      {tabs.map(({ id, label, icon: Icon }) => <Button key={id} variant={activeTab === id ? "default" : "ghost"} className="project-tab" data-state={activeTab === id ? "active" : "inactive"} onClick={() => setActiveTab(id)}><Icon size={15} />{label}</Button>)}
    </nav>
    <section className="project-tab-surface" aria-live="polite">
      {activeTab === "sheets" && <div className="project-tab-grid sheets-tab">
        {pages.length === 0 ? <div className="workspace-empty"><FileStack size={24} /><p>{t("project.sheetsEmpty")}</p></div> : pages.map((page) => <article className="project-page-card" key={page.id}><div className="project-page-preview"><FileStack size={28} /><span>{page.pdfPageNumber ? t("project.pdfSheet") : t("project.blankSheet")}</span></div><div><p className="panel-kicker">{t("project.sheet")}</p><h2 title={page.name}>{page.name}</h2><p>{t("project.measurementsCount", { count: items.filter((item) => item.pageId === page.id).length })}</p></div><Button className="project-page-action" variant="outline" onClick={() => setLocation(`/workspace/${project.id}`)}>{t("project.openPlan")}</Button></article>)}
      </div>}
      {activeTab === "takeoff" && <div className="project-tab-grid takeoff-tab">
        {items.length === 0 ? <div className="workspace-empty"><Ruler size={24} /><p>{t("project.takeoffEmpty")}</p></div> : items.map((item) => <article className="project-takeoff-row" key={item.id}><i className={`takeoff-kind-dot takeoff-kind-${item.kind.toLowerCase()}`} /><div><b>{item.name}</b><small>{pageNames.get(item.pageId) ?? t("project.unknownSheet")}</small></div><span>{item.kind}</span></article>)}
      </div>}
      {activeTab === "estimate" && <div className="estimate-tab"><ClipboardList size={30} /><h2>{t("project.estimateTitle")}</h2><p>{t("project.estimateDescription")}</p><dl><div><dt>{t("project.sheets")}</dt><dd>{pages.length}</dd></div><div><dt>{t("project.takeoff")}</dt><dd>{items.length}</dd></div></dl><Button className="workspace-primary" onClick={() => setLocation(`/workspace/${project.id}`)}>{t("project.openReport")}</Button></div>}
    </section>
  </main>;
}
