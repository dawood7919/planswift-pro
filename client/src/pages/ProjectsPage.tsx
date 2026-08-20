import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { canLoadProjects, getProjectsAccessState } from "@/lib/projectsAccess";
import { readProjectImportFile, triggerProjectFileDownload } from "@/lib/projectFileBrowser";
import { ArrowLeft, Download, FileUp, FolderPlus, MapPin, Plus, Ruler } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ProjectsPage() {
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
      toast.success("تم إنشاء المشروع ومساحة العمل الأولى.");
      setLocation(`/workspace/${result.id}`);
    },
    onError: (error) => toast.error(error.message || "تعذر إنشاء المشروع."),
  });
  const importProject = trpc.projects.importProjectFile.useMutation({
    onSuccess: async (result) => {
      await utils.projects.list.invalidate();
      toast.success("تم استيراد نسخة المشروع كنسخة جديدة. ملفات PDF الأصلية غير مشمولة.");
      setLocation(`/workspace/${result.id}`);
    },
    onError: (error) => toast.error(error.message || "تعذر استيراد ملف المشروع."),
  });
  const exportProject = trpc.projects.exportProjectFile.useMutation({
    onError: (error) => toast.error(error.message || "تعذر تنزيل نسخة المشروع."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createProject.mutate({ name, clientName: clientName || undefined, location: location || undefined, currency: "USD", lengthUnit: "m" });
  }

  async function importProjectFile(file: File) {
    try { importProject.mutate(await readProjectImportFile(file)); } catch (error) { toast.error(error instanceof Error && error.message === "PROJECT_FILE_TOO_LARGE" ? "يجب ألا يتجاوز ملف المشروع 5 ميغابايت." : "تعذر قراءة ملف المشروع."); }
  }

  function downloadProjectFile(projectId: string, projectName: string) {
    exportProject.mutate(projectId, { onSuccess: (content) => {
      triggerProjectFileDownload(content);
      toast.success(`تم تنزيل نسخة ${projectName}.`);
    } });
  }

  if (accessState === "auth-loading") {
    return <div className="workspace-loading" dir="rtl">جارٍ التحقق من جلسة الدخول…</div>;
  }

  if (accessState === "guest") {
    return (
      <section className="workspace-empty large-empty" dir="rtl" aria-live="polite">
        <span className="empty-symbol"><FolderPlus size={28} /></span>
        <h1>سجّل الدخول لعرض مشاريعك</h1>
        <p>{authError ? "تعذر التحقق من جلسة الدخول. أعد المحاولة أو سجّل الدخول من جديد." : "تحتاج إلى جلسة دخول لحماية المخططات والكميات والتقديرات الخاصة بك."}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          {authError ? <Button variant="outline" onClick={() => void refreshAuth()}>إعادة محاولة التحقق</Button> : null}
          <Button className="workspace-primary" onClick={() => startLogin()}>تسجيل الدخول</Button>
        </div>
      </section>
    );
  }

  return (
    <div className="projects-screen" dir="rtl">
      <header className="workspace-topbar">
        <div><p className="workspace-eyebrow">TAKEOFF / PROJECTS</p><h1>مشاريع القياس</h1></div>
        <div className="topbar-actions"><input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProjectFile(file); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importProject.isPending}><FileUp size={16} />{importProject.isPending ? "جارٍ الاستيراد" : "استيراد نسخة"}</Button><Button className="workspace-primary" onClick={() => setIsCreating((value) => !value)}><Plus size={17} />مشروع جديد</Button></div>
      </header>

      {isCreating && (
        <form className="new-project-form" onSubmit={submit}>
          <div className="form-grid">
            <label><span>اسم المشروع</span><Input autoFocus required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: مجمع الأعمال – الحزمة A" /></label>
            <label><span>العميل (اختياري)</span><Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="اسم العميل أو المقاول" /></label>
            <label><span>الموقع (اختياري)</span><Input value={location} onChange={(event) => setProjectLocation(event.target.value)} placeholder="المدينة أو موقع المشروع" /></label>
          </div>
          <div className="form-actions"><Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>إلغاء</Button><Button className="workspace-primary" type="submit" disabled={createProject.isPending}>{createProject.isPending ? "جارٍ الإنشاء…" : "إنشاء وفتح مساحة العمل"}<ArrowLeft size={16} /></Button></div>
        </form>
      )}

      <section className="projects-list" aria-label="قائمة المشاريع">
        {projectsQuery.isLoading && <p className="workspace-empty">جارٍ تحميل المشاريع…</p>}
        {projectsQuery.isError && <p className="workspace-empty">تعذر الوصول إلى المشاريع. أعد المحاولة بعد التحقق من الاتصال.</p>}
        {!projectsQuery.isLoading && !projectsQuery.isError && projectsQuery.data?.length === 0 && (
          <div className="workspace-empty large-empty"><span className="empty-symbol"><FolderPlus size={28} /></span><h2>ابدأ مشروع القياس الأول</h2><p>أنشئ مشروعاً لتفتح صفحة رسم ومعايرة وأدوات Area وLinear وSegment وCount، مع حفظ الكميات والتقدير.</p><Button className="workspace-primary" onClick={() => setIsCreating(true)}><Plus size={16} />إنشاء مشروع</Button></div>
        )}
        {projectsQuery.data?.map((project) => (
          <article className="project-card" key={project.id}>
            <button className="project-card-open" onClick={() => setLocation(`/projects/${project.id}`)} aria-label={`فتح ${project.name}`}><span className="project-mark"><Ruler size={21} /></span><span className="project-card-copy"><b>{project.name}</b><small>{project.clientName || "مشروع غير مصنف"}</small><small className="project-location"><MapPin size={12} />{project.location || "الموقع غير محدد"}</small></span><span className="project-card-meta"><span>{project.lengthUnit}</span><ArrowLeft size={18} /></span></button>
            <button className="project-export" onClick={() => downloadProjectFile(project.id, project.name)} disabled={exportProject.isPending} aria-label={`تنزيل نسخة ${project.name}`}><Download size={14} />نسخة</button>
          </article>
        ))}
      </section>
    </div>
  );
}
