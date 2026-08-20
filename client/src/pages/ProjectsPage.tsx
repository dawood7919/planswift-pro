import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { canLoadProjects, getProjectsAccessState } from "@/lib/projectsAccess";
import { readProjectImportFile, triggerProjectFileDownload } from "@/lib/projectFileBrowser";
import { useTranslation } from "@/i18n";
import { ArrowLeft, Download, FileUp, FolderPlus, MapPin, Plus, Ruler } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ProjectsPage() {
  const { t, direction } = useTranslation();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user, loading: isAuthLoading, error: authError, refresh: refreshAuth } = useAuth();
  const accessState = getProjectsAccessState({ isAuthLoading, userId: user?.id });
  const projectsQuery = trpc.projects.list.useQuery(undefined, {
    enabled: canLoadProjects(accessState),
  });
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setProjectLocation] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const createProject = trpc.projects.create.useMutation({
    onSuccess: async (result) => {
      await utils.projects.list.invalidate();
      toast.success(t("projects.created"));
      setLocation(`/projects/${result.id}`);
    },
    onError: (error) => toast.error(error.message || t("projects.createError")),
  });
  const importProject = trpc.projects.importProjectFile.useMutation({
    onSuccess: async (result) => {
      await utils.projects.list.invalidate();
      toast.success(t("projects.imported"));
      setLocation(`/projects/${result.id}`);
    },
    onError: (error) => toast.error(error.message || t("projects.importError")),
  });
  const exportProject = trpc.projects.exportProjectFile.useMutation({
    onError: (error) => toast.error(error.message || t("projects.exportError")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createProject.mutate({ name, clientName: clientName || undefined, location: location || undefined, currency: "USD", lengthUnit: "m" });
  }

  async function importProjectFile(file: File) {
    try { importProject.mutate(await readProjectImportFile(file)); } catch (error) { toast.error(error instanceof Error && error.message === "PROJECT_FILE_TOO_LARGE" ? t("projects.fileTooLarge") : t("projects.readError")); }
  }

  function downloadProjectFile(projectId: string, projectName: string) {
    exportProject.mutate(projectId, { onSuccess: (content) => {
      triggerProjectFileDownload(content);
      toast.success(t("projects.downloaded", { projectName }));
    } });
  }

  if (accessState === "auth-loading") {
    return <div className="workspace-loading" dir={direction}>{t("projects.authLoading")}</div>;
  }

  if (accessState === "guest") {
    return (
      <section className="workspace-empty large-empty" dir={direction} aria-live="polite">
        <span className="empty-symbol"><FolderPlus size={28} /></span>
        <h1>{t("projects.guestTitle")}</h1>
        <p>{authError ? t("projects.guestError") : t("projects.guestDescription")}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          {authError ? <Button variant="outline" onClick={() => void refreshAuth()}>{t("projects.retryAuth")}</Button> : null}
          <Button className="workspace-primary" onClick={() => startLogin()}>{t("projects.signIn")}</Button>
        </div>
      </section>
    );
  }

  return (
    <div className="projects-screen" dir={direction}>
      <header className="workspace-topbar">
        <div><p className="workspace-eyebrow">TAKEOFF / PROJECTS</p><h1>{t("projects.heading")}</h1></div>
        <div className="topbar-actions"><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProjectFile(file); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importProject.isPending}><FileUp size={16} />{importProject.isPending ? t("projects.importing") : t("projects.import")}</Button><Button className="workspace-primary" onClick={() => setIsCreating((value) => !value)}><Plus size={17} />{t("projects.new")}</Button></div>
      </header>

      {isCreating && (
        <form className="new-project-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>{t("projects.name")}</span><Input autoFocus required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("projects.namePlaceholder")} /></label>
            <label><span>{t("projects.client")}</span><Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder={t("projects.clientPlaceholder")} /></label>
            <label><span>{t("projects.location")}</span><Input value={location} onChange={(event) => setProjectLocation(event.target.value)} placeholder={t("projects.locationPlaceholder")} /></label>
          </div>
          <div className="form-actions"><Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>{t("projects.cancel")}</Button><Button className="workspace-primary" type="submit" disabled={createProject.isPending}>{createProject.isPending ? t("projects.creating") : t("projects.createAndOpen")}<ArrowLeft size={16} /></Button></div>
        </form>
      )}

      <section className="projects-list" aria-label={t("projects.listLabel")}>
        {projectsQuery.isLoading && <p className="workspace-empty">{t("projects.loading")}</p>}
        {projectsQuery.isError && <p className="workspace-empty">{t("projects.loadError")}</p>}
        {!projectsQuery.isLoading && !projectsQuery.isError && projectsQuery.data?.length === 0 && (
          <div className="workspace-empty large-empty"><span className="empty-symbol"><FolderPlus size={28} /></span><h2>{t("projects.emptyTitle")}</h2><p>{t("projects.emptyDescription")}</p><Button className="workspace-primary" onClick={() => setIsCreating(true)}><Plus size={16} />{t("projects.create")}</Button></div>
        )}
        {projectsQuery.data?.map((project) => (
          <article className="project-card" key={project.id}>
            <button className="project-card-open" onClick={() => setLocation(`/projects/${project.id}`)} aria-label={t("projects.open", { projectName: project.name })}><span className="project-mark"><Ruler size={21} /></span><span className="project-card-copy"><b>{project.name}</b><small>{project.clientName || t("projects.unclassified")}</small><small className="project-location"><MapPin size={12} />{project.location || t("projects.locationUnknown")}</small></span><span className="project-card-meta"><span>{project.lengthUnit}</span><ArrowLeft size={18} /></span></button>
            <button className="project-export" onClick={() => downloadProjectFile(project.id, project.name)} disabled={exportProject.isPending} aria-label={t("projects.download", { projectName: project.name })}><Download size={14} />{t("projects.copy")}</button>
          </article>
        ))}
      </section>
    </div>
  );
}
