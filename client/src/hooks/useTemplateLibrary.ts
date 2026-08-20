import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { inspectFormula } from "@shared/takeoff-core/formula";
import { inspectTemplateDependencies } from "@shared/takeoff-core/templateDeps";

export type TemplateKind = "PART" | "ASSEMBLY";
export type CostItemKind = "MATERIAL" | "LABOR" | "EQUIPMENT";

/**
 * The estimating library — Parts, Assemblies, folders and cost items.
 *
 * This owned sixteen pieces of state and seven mutations inside the plan viewer, which had
 * nothing to do with drawing. Keeping it together here lets the viewer treat the library as
 * one value, and lets the library be reasoned about (and tested) on its own.
 */
export function useTemplateLibrary() {
  const utils = trpc.useUtils();

  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [kind, setKind] = useState<TemplateKind>("PART");
  const [name, setName] = useState("");
  const [formula, setFormula] = useState("quantity * rate");
  const [unit, setUnit] = useState("وحدة");
  const [rate, setRate] = useState("0");
  const [folderId, setFolderId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);

  const [costItemKind, setCostItemKind] = useState<CostItemKind>("MATERIAL");
  const [costItemName, setCostItemName] = useState("");
  const [costItemQuantityFormula, setCostItemQuantityFormula] = useState("quantity");
  const [costItemUnit, setCostItemUnit] = useState("وحدة");
  const [costItemRate, setCostItemRate] = useState("0");
  const [costItemWastePercent, setCostItemWastePercent] = useState("0");

  const templatesQuery = trpc.templates.list.useQuery();
  const foldersQuery = trpc.templates.folders.list.useQuery();
  const templates = templatesQuery.data ?? [];
  const folders = foldersQuery.data ?? [];

  function resetCostItemForm() {
    setCostItemName("");
    setCostItemQuantityFormula("quantity");
    setCostItemRate("0");
    setCostItemWastePercent("0");
  }

  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); setName(""); setDependencyIds([]); toast.success("تم حفظ القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ القالب."),
  });
  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); setEditingTemplateId(null); setName(""); setDependencyIds([]); toast.success("تم تحديث القالب ومراجعه."); },
    onError: (error) => toast.error(error.message === "TEMPLATE_DEPENDENCY_IN_USE" ? "لا يمكن إزالة هذا القالب لأنه مرجع لقالب آخر." : error.message || "تعذر تحديث القالب."),
  });
  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast.success("حُذف القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حذف القالب."),
  });
  const createFolder = trpc.templates.folders.create.useMutation({
    onSuccess: () => { utils.templates.folders.list.invalidate(); setFolderName(""); toast.success("حُفظ مجلد المكتبة."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ المجلد."),
  });
  const deleteFolder = trpc.templates.folders.delete.useMutation({
    onSuccess: () => { utils.templates.folders.list.invalidate(); setFolderId(""); toast.success("حُذف مجلد المكتبة."); },
    onError: (error) => toast.error(error.message === "TEMPLATE_FOLDER_IN_USE" ? "انقل القوالب من المجلد قبل حذفه." : error.message || "تعذر حذف المجلد."),
  });
  const createCostItem = trpc.templates.costItems.create.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); resetCostItemForm(); toast.success("أُضيف بند التكلفة إلى القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ بند التكلفة."),
  });
  const deleteCostItem = trpc.templates.costItems.delete.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast.success("حُذف بند التكلفة."); },
    onError: (error) => toast.error(error.message || "تعذر حذف بند التكلفة."),
  });

  const formulaDiagnostic = useMemo(() => inspectFormula(formula), [formula]);

  const dependencyDiagnostic = useMemo(() => {
    const draftId = editingTemplateId ?? "template-draft";
    const graph = [
      ...templates.filter((template) => template.id !== draftId).map((template) => ({ id: template.id, formula: template.formula, rate: template.rate, dependencyIds: template.dependencyIds })),
      { id: draftId, formula: formula || "0", rate: rate || "0", dependencyIds },
    ];
    return inspectTemplateDependencies(graph, draftId);
  }, [editingTemplateId, dependencyIds, formula, rate, templates]);

  function edit(template: (typeof templates)[number]) {
    setEditingTemplateId(template.id);
    setKind(template.kind);
    setName(template.name);
    setFormula(template.formula);
    setUnit(template.unit);
    setRate(String(template.rate));
    setFolderId(template.folderId ?? "");
    setDependencyIds(template.dependencyIds);
  }

  function resetForm() {
    setEditingTemplateId(null);
    setKind("PART");
    setName("");
    setFormula("quantity * rate");
    setUnit("وحدة");
    setRate("0");
    setFolderId("");
    setDependencyIds([]);
  }

  function submit() {
    if (!name.trim() || !formula.trim()) { toast.error("أدخل اسم القالب وصيغته."); return; }
    if (!formulaDiagnostic.valid) { toast.error(formulaDiagnostic.message); return; }
    if (!dependencyDiagnostic.valid) { toast.error(dependencyDiagnostic.message); return; }
    const payload = { name: name.trim(), formula: formula.trim(), unit: unit.trim() || "وحدة", rate: rate || "0", folderId: folderId || null, dependencyIds };
    if (editingTemplateId) updateTemplate.mutate({ templateId: editingTemplateId, ...payload });
    else createTemplate.mutate({ kind, ...payload });
  }

  function submitCostItem() {
    if (!editingTemplateId) { toast.error("احفظ القالب أولاً ثم أضف مواده أو عمالته."); return; }
    if (!costItemName.trim() || !costItemQuantityFormula.trim()) { toast.error("أدخل اسم البند وصيغة كميته."); return; }
    const diagnostic = inspectFormula(costItemQuantityFormula);
    if (!diagnostic.valid) { toast.error(diagnostic.message); return; }
    createCostItem.mutate({
      templateId: editingTemplateId,
      kind: costItemKind,
      name: costItemName.trim(),
      quantityFormula: costItemQuantityFormula.trim(),
      unit: costItemUnit.trim() || "وحدة",
      rate: costItemRate || "0",
      wastePercent: costItemWastePercent || "0",
    });
  }

  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;

  return {
    isOpen, setIsOpen,
    templates, folders, editingTemplateId, editingTemplate,
    kind, setKind, name, setName, formula, setFormula, unit, setUnit, rate, setRate,
    folderId, setFolderId, folderName, setFolderName, dependencyIds, setDependencyIds,
    costItemKind, setCostItemKind, costItemName, setCostItemName,
    costItemQuantityFormula, setCostItemQuantityFormula, costItemUnit, setCostItemUnit,
    costItemRate, setCostItemRate, costItemWastePercent, setCostItemWastePercent,
    formulaDiagnostic, dependencyDiagnostic,
    createTemplate, updateTemplate, deleteTemplate, createFolder, deleteFolder, createCostItem, deleteCostItem,
    edit, resetForm, submit, submitCostItem,
  };
}

export type TemplateLibrary = ReturnType<typeof useTemplateLibrary>;
