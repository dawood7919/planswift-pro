import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { triggerProjectFileDownload } from "@/lib/projectFileBrowser";
import { createQuantityReportXlsx } from "@/lib/reportExcel";
import { nextCopyName } from "@/lib/measurementNames";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/ar";
import { formatArea, formatCount, formatCurrency, formatLength, formatQuantity, formatVolume } from "@/i18n/format";
import PdfPlanLayer from "@/components/PdfPlanLayer";
import PdfThumbnail from "@/components/PdfThumbnail";
import PdfReviewOverlay from "@/components/PdfReviewOverlay";
import { ItemSearchPanel } from "@/components/ItemSearchPanel";
import { COOKIE_NAME } from "@shared/const";
import {
  calculateMeasurement,
  createCalibration,
  validatePolygonRings,
  type CalibrationScale,
  type MeasurementGeometry,
  type MeasurementKind,
  type Point2D,
} from "@shared/takeoff-core";
import { findComparablePdfPage } from "@shared/takeoff-core/documentReview";
import { evaluateFormula, inspectFormula } from "@shared/takeoff-core/formula";
import { evaluateTemplateWithDependencies, inspectTemplateDependencies } from "@shared/takeoff-core/templateDeps";
import { buildQuantityReport, reportToCsv, reportTotal } from "@shared/takeoff-core/report";
import { buildPrintableReportHtml, sendToPrintWindow } from "@shared/takeoff-core/printReport";
import { snapPoint, type SnapResult } from "@shared/takeoff-core/snapping";
import { searchTakeoffItems } from "@shared/takeoff-core/itemSearch";
import { translateMeasurementGeometry } from "@shared/takeoff-core/translate";
import { normalizePointerInput, pointerInputLabelKey, type PointerInputKind } from "@shared/takeoff-core/pointerInput";
import { createPageViewport, DEFAULT_BLANK_PAGE_SIZE, toPagePoint, type PageSize } from "@shared/takeoff-core/viewport";
import { legacyGeometryToPagePoints, legacyPointToPagePoint } from "@shared/takeoff-core/legacyGeometry";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  Crosshair,
  Download,
  FileUp,
  Expand,
  Hand,
  Hash,
  Layers3,
  LineChart,
  Minus,
  MousePointer2,
  Move,
  Pencil,
  PenLine,
  Plus,
  Printer,
  Redo2,
  Ruler,
  Save,
  Smartphone,
  SquareDashed,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { PointerEvent, WheelEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type Tool = "SELECT" | "PAN" | "CALIBRATE" | "ANNOTATE" | "ADD_HOLE" | MeasurementKind;
type Item = { id: string; pageId: string; kind: MeasurementKind; name: string; color: string; geometry: MeasurementGeometry; rate: string; multiplier: string; templateId: string | null };
type CanvasSnapshot = { items: Item[]; calibration: CalibrationScale | null };
type VertexTarget = { itemId: string; ringIndex: number | null; pointIndex: number };
type PendingCommand = { type: string; payloadJson: string };

const toolOptions: Array<{ tool: Tool; labelKey: TranslationKey; icon: typeof Ruler; hintKey: TranslationKey }> = [
  { tool: "SELECT", labelKey: "workspace.tool.select", icon: MousePointer2, hintKey: "workspace.toolHint.select" },
  { tool: "PAN", labelKey: "workspace.tool.pan", icon: Hand, hintKey: "workspace.toolHint.pan" },
  { tool: "CALIBRATE", labelKey: "workspace.tool.calibrate", icon: Ruler, hintKey: "workspace.toolHint.calibrate" },
  { tool: "ANNOTATE", labelKey: "workspace.tool.annotate", icon: Pencil, hintKey: "workspace.toolHint.annotate" },
  { tool: "AREA", labelKey: "workspace.tool.area", icon: SquareDashed, hintKey: "workspace.toolHint.area" },
  { tool: "ROOF_AREA", labelKey: "workspace.tool.roofArea", icon: SquareDashed, hintKey: "workspace.toolHint.roofArea" },
  { tool: "VOLUME", labelKey: "workspace.tool.volume", icon: SquareDashed, hintKey: "workspace.toolHint.volume" },
  { tool: "ADD_HOLE", labelKey: "workspace.tool.cutout", icon: Minus, hintKey: "workspace.toolHint.cutout" },
  { tool: "LINEAR", labelKey: "workspace.tool.linear", icon: LineChart, hintKey: "workspace.toolHint.linear" },
  { tool: "SEGMENT", labelKey: "workspace.tool.segment", icon: Move, hintKey: "workspace.toolHint.segment" },
  { tool: "COUNT", labelKey: "workspace.tool.count", icon: Hash, hintKey: "workspace.toolHint.count" },
];

const colors: Record<MeasurementKind, string> = { AREA: "var(--area)", ROOF_AREA: "var(--roof-area)", VOLUME: "var(--volume)", LINEAR: "var(--linear)", SEGMENT: "var(--segment)", COUNT: "var(--count)" };
const measurementNameKeys: Record<MeasurementKind, TranslationKey> = { AREA: "workspace.measurementName.area", ROOF_AREA: "workspace.measurementName.roofArea", VOLUME: "workspace.measurementName.volume", LINEAR: "workspace.measurementName.linear", SEGMENT: "workspace.measurementName.segment", COUNT: "workspace.measurementName.count" };
const isAreaKind = (kind: MeasurementKind): kind is "AREA" | "ROOF_AREA" | "VOLUME" => ["AREA", "ROOF_AREA", "VOLUME"].includes(kind);

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseStoredItem(item: { id: string; pageId: string; kind: MeasurementKind; name: string; color: string; geometryJson: string; rate: string | number; multiplier?: string | number; templateId: string | null }) : Item {
  try {
    return { id: item.id, pageId: item.pageId, kind: item.kind, name: item.name, color: item.color, geometry: JSON.parse(item.geometryJson) as MeasurementGeometry, rate: String(item.rate), multiplier: String(item.multiplier ?? 1), templateId: item.templateId };
  } catch {
    return { id: item.id, pageId: item.pageId, kind: item.kind, name: item.name, color: item.color, geometry: {}, rate: String(item.rate), multiplier: String(item.multiplier ?? 1), templateId: item.templateId };
  }
}

export default function WorkspacePage() {
  const { t, locale, direction, unitSystem, setLocale, setUnitSystem } = useTranslation();
  const localizedToolOptions = toolOptions.map((option) => ({ ...option, label: t(option.labelKey), hint: t(option.hintKey) }));
  const [, params] = useRoute<{ projectId: string }>("/workspace/:projectId");
  const [, setLocation] = useLocation();
  const projectId = params?.projectId;
  const workspaceQuery = trpc.projects.get.useQuery(projectId ?? "", { enabled: Boolean(projectId) });
  const utils = trpc.useUtils();
  const createNativeSession = trpc.auth.createNativeSession.useMutation({
    onSuccess: ({ token, expiresInSeconds }) => {
      window.prompt(`انسخ رمز ربط Android والصقه في التطبيق. الصلاحية ${Math.floor(expiresInSeconds / 86_400)} أيام. لا تشاركه مع أي شخص.`, token);
      toast.success("تم إنشاء رمز Android مؤقت. انسخه إلى التطبيق الأصلي.");
    },
    onError: (error) => toast.error(error.message || "تعذر إنشاء رمز Android."),
  });
  const saveWorkspace = trpc.projects.saveWorkspace.useMutation({
    onSuccess: () => { setPendingCommands([]); toast.success("حُفظ المشروع مع صفحة القياس وعناصره."); utils.projects.get.invalidate(projectId); },
    onError: (error) => toast.error(error.message || "تعذر حفظ المشروع."),
  });
  const addBlankPage = trpc.projects.addBlankPage.useMutation({
    onSuccess: (createdPage) => { setActivePageId(createdPage.id); utils.projects.get.invalidate(projectId); toast.success("أُضيفت صفحة رسم فارغة."); },
    onError: (error) => toast.error(error.message || "تعذرت إضافة الصفحة."),
  });
  const renamePage = trpc.projects.renamePage.useMutation({
    onSuccess: () => { setIsRenamingPage(false); utils.projects.get.invalidate(projectId); toast.success("تمت إعادة تسمية الصفحة."); },
    onError: (error) => toast.error(error.message || "تعذرت إعادة تسمية الصفحة."),
  });
  const deletePage = trpc.projects.deletePage.useMutation({
    onSuccess: (result) => { setActivePageId(result.nextPageId); utils.projects.get.invalidate(projectId); toast.success("حُذفت الصفحة وعناصر قياسها."); },
    onError: (error) => toast.error(error.message === "LAST_PAGE_REQUIRED" ? "يجب أن يبقى في المشروع صفحة واحدة على الأقل." : error.message || "تعذر حذف الصفحة."),
  });
  const convertLegacyPageGeometry = trpc.projects.convertLegacyPageGeometry.useMutation({
    onSuccess: () => { setCalibration(null); setSelectedId(null); setSelectedIds(new Set()); utils.projects.get.invalidate(projectId); toast.success("حُولت الصفحة إلى إحداثيات PDF. أعد المعايرة قبل اعتماد أي كمية."); },
    onError: (error) => toast.error(error.message || "تعذر تحويل الصفحة القديمة."),
  });
  const createScaleContext = trpc.projects.createScaleContext.useMutation({
    onSuccess: (context) => { setCalibration({ drawingDistance: Number(context.drawingDistance), worldDistance: Number(context.worldDistance), unit: context.unit as CalibrationScale["unit"], factor: Number(context.worldDistance) / Number(context.drawingDistance) }); setScaleContextName(""); utils.projects.get.invalidate(projectId); toast.success("حُفظ سياق المقياس وجرى تفعيله."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ سياق المقياس."),
  });
  const activateScaleContext = trpc.projects.activateScaleContext.useMutation({
    onSuccess: (context) => { setCalibration({ drawingDistance: Number(context.drawingDistance), worldDistance: Number(context.worldDistance), unit: context.unit as CalibrationScale["unit"], factor: Number(context.worldDistance) / Number(context.drawingDistance) }); utils.projects.get.invalidate(projectId); toast.success("تم تفعيل سياق المقياس."); },
    onError: (error) => toast.error(error.message || "تعذر تفعيل سياق المقياس."),
  });
  const deleteScaleContext = trpc.projects.deleteScaleContext.useMutation({
    onSuccess: () => { utils.projects.get.invalidate(projectId); toast.success("حُذف سياق المقياس."); },
    onError: (error) => toast.error(error.message || "تعذر حذف سياق المقياس."),
  });
  const createReview = trpc.projects.createReview.useMutation({
    onSuccess: (review) => { setReviewDocumentId(review.referenceDocumentId); utils.projects.get.invalidate(projectId); toast.success("حُفظت المراجعة المرجعية في سجل المشروع."); },
    onError: (error) => toast.error(error.message === "REVIEW_ALREADY_EXISTS" ? "هذه المراجعة محفوظة بالفعل لهذه الصفحة." : error.message || "تعذر حفظ المراجعة."),
  });
  const deleteReview = trpc.projects.deleteReview.useMutation({
    onSuccess: () => { utils.projects.get.invalidate(projectId); toast.success("حُذفت المراجعة المحفوظة."); },
    onError: (error) => toast.error(error.message || "تعذر حذف المراجعة."),
  });
  const createAnnotation = trpc.projects.createAnnotation.useMutation({
    onSuccess: () => { setAnnotationText(""); utils.projects.get.invalidate(projectId); toast.success("حُفظت الملاحظة على المخطط."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ الملاحظة."),
  });
  const deleteAnnotation = trpc.projects.deleteAnnotation.useMutation({
    onSuccess: () => { utils.projects.get.invalidate(projectId); toast.success("حُذفت الملاحظة."); },
    onError: (error) => toast.error(error.message || "تعذر حذف الملاحظة."),
  });
  const reorderPages = trpc.projects.reorderPages.useMutation({
    onSuccess: () => { utils.projects.get.invalidate(projectId); },
    onError: (error) => toast.error(error.message || "تعذر إعادة ترتيب الصفحات."),
  });
  const exportProject = trpc.projects.exportProjectFile.useMutation({
    onError: (error) => toast.error(error.message || "تعذر تصدير نسخة المشروع."),
  });
  const createVersion = trpc.projects.createVersion.useMutation({
    onSuccess: () => { setVersionLabel(""); utils.projects.get.invalidate(projectId); toast.success("حُفظت لقطة الإصدار للمشروع."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ لقطة الإصدار."),
  });
  const restoreVersion = trpc.projects.restoreVersion.useMutation({
    onSuccess: (restored) => { toast.success("أُنشئ مشروع جديد من لقطة الإصدار؛ لم يُستبدل المشروع المصدر."); setLocation(`/workspace/${restored.id}`); },
    onError: (error) => toast.error(error.message || "تعذرت استعادة لقطة الإصدار."),
  });
  const templatesQuery = trpc.templates.list.useQuery();
  const templateFoldersQuery = trpc.templates.folders.list.useQuery();
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); setTemplateName(""); setTemplateDependencyIds([]); toast.success("تم حفظ القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ القالب."),
  });
  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); setEditingTemplateId(null); setTemplateName(""); setTemplateDependencyIds([]); toast.success("تم تحديث القالب ومراجعه."); },
    onError: (error) => toast.error(error.message === "TEMPLATE_DEPENDENCY_IN_USE" ? "لا يمكن إزالة هذا القالب لأنه مرجع لقالب آخر." : error.message || "تعذر تحديث القالب."),
  });
  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast.success("حُذف القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حذف القالب."),
  });
  const createTemplateFolder = trpc.templates.folders.create.useMutation({
    onSuccess: () => { utils.templates.folders.list.invalidate(); setTemplateFolderName(""); toast.success("حُفظ مجلد المكتبة."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ المجلد."),
  });
  const deleteTemplateFolder = trpc.templates.folders.delete.useMutation({
    onSuccess: () => { utils.templates.folders.list.invalidate(); setTemplateFolderId(""); toast.success("حُذف مجلد المكتبة."); },
    onError: (error) => toast.error(error.message === "TEMPLATE_FOLDER_IN_USE" ? "انقل القوالب من المجلد قبل حذفه." : error.message || "تعذر حذف المجلد."),
  });
  const createTemplateCostItem = trpc.templates.costItems.create.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); setCostItemName(""); setCostItemQuantityFormula("quantity"); setCostItemRate("0"); setCostItemWastePercent("0"); toast.success("أُضيف بند التكلفة إلى القالب."); },
    onError: (error) => toast.error(error.message || "تعذر حفظ بند التكلفة."),
  });
  const deleteTemplateCostItem = trpc.templates.costItems.delete.useMutation({
    onSuccess: () => { utils.templates.list.invalidate(); toast.success("حُذف بند التكلفة."); },
    onError: (error) => toast.error(error.message || "تعذر حذف بند التكلفة."),
  });

  const [tool, setTool] = useState<Tool>("SELECT");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [groupOffset, setGroupOffset] = useState({ x: "10", y: "0" });
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null);
  const [calibration, setCalibration] = useState<CalibrationScale | null>(null);
  const [calibrationPoints, setCalibrationPoints] = useState<Point2D[]>([]);
  const [knownDistance, setKnownDistance] = useState("10");
  const [unit, setUnit] = useState<CalibrationScale["unit"]>("m");
  const [scaleContextName, setScaleContextName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [pointerInput, setPointerInput] = useState<PointerInputKind>("mouse");
  const [history, setHistory] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);
  const [draggedVertex, setDraggedVertex] = useState<VertexTarget | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isRenamingPage, setIsRenamingPage] = useState(false);
  const [pageNameDraft, setPageNameDraft] = useState("");
  const [reviewDocumentId, setReviewDocumentId] = useState<string | null>(null);
  const [reviewLabel, setReviewLabel] = useState("");
  const [annotationText, setAnnotationText] = useState("");
  const [annotationColor, setAnnotationColor] = useState("var(--text)");
  const [objectSnapEnabled, setObjectSnapEnabled] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<SnapResult | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [templateKind, setTemplateKind] = useState<"PART" | "ASSEMBLY">("PART");
  const [templateName, setTemplateName] = useState("");
  const [templateFormula, setTemplateFormula] = useState("quantity * rate");
  const [templateUnit, setTemplateUnit] = useState("وحدة");
  const [templateRate, setTemplateRate] = useState("0");
  const [templateFolderId, setTemplateFolderId] = useState("");
  const [templateFolderName, setTemplateFolderName] = useState("");
  const [templateDependencyIds, setTemplateDependencyIds] = useState<string[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [costItemKind, setCostItemKind] = useState<"MATERIAL" | "LABOR" | "EQUIPMENT">("MATERIAL");
  const [costItemName, setCostItemName] = useState("");
  const [costItemQuantityFormula, setCostItemQuantityFormula] = useState("quantity");
  const [costItemUnit, setCostItemUnit] = useState("وحدة");
  const [costItemRate, setCostItemRate] = useState("0");
  const [costItemWastePercent, setCostItemWastePercent] = useState("0");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const hydratedProject = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasShellRef = useRef<HTMLElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pointerAnchor = useRef<{ clientX: number; clientY: number; pan: { x: number; y: number } } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const pages = workspaceQuery.data?.pages ?? [];
  const defaultPage = pages.find((candidate) => candidate.pdfPageNumber) ?? pages[0];
  const page = pages.find((candidate) => candidate.id === activePageId) ?? defaultPage;
  const reviewDocuments = (workspaceQuery.data?.documents ?? []).filter((document) => document.id !== page?.documentId);
  const comparisonPage = findComparablePdfPage(page, pages, reviewDocumentId);
  const pageReviews = (workspaceQuery.data?.reviews ?? []).filter((review) => review.sourcePageId === page?.id);
  const pageAnnotations = (workspaceQuery.data?.annotations ?? []).filter((annotation) => annotation.pageId === page?.id);
  const pageScaleContexts = (workspaceQuery.data?.scaleContexts ?? []).filter((context) => context.pageId === page?.id);
  const projectVersions = workspaceQuery.data?.versions ?? [];
  const isLegacyPage = page?.geometrySpace === "LEGACY_VIEWBOX";
  const pageSize = useMemo<PageSize>(() => {
    const width = Number(page?.pageWidth);
    const height = Number(page?.pageHeight);
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : DEFAULT_BLANK_PAGE_SIZE;
  }, [page?.pageHeight, page?.pageWidth]);
  const viewport = useMemo(() => createPageViewport(pageSize, canvasSize, zoom, pan), [pageSize, canvasSize, zoom, pan]);

  useLayoutEffect(() => {
    const canvasShell = canvasShellRef.current;
    if (!canvasShell) return;
    const update = () => setCanvasSize({ width: canvasShell.clientWidth || DEFAULT_BLANK_PAGE_SIZE.width, height: canvasShell.clientHeight || DEFAULT_BLANK_PAGE_SIZE.height });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(canvasShell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!workspaceQuery.data || workspaceQuery.data.project.id === hydratedProject.current) return;
    hydratedProject.current = workspaceQuery.data.project.id;
    setItems(workspaceQuery.data.items.map((item) => parseStoredItem(item)));
    const persistedPage = workspaceQuery.data.pages.find((candidate) => candidate.id === activePageId) ?? workspaceQuery.data.pages.find((candidate) => candidate.pdfPageNumber) ?? workspaceQuery.data.pages[0];
    setActivePageId((current) => current && workspaceQuery.data?.pages.some((candidate) => candidate.id === current) ? current : persistedPage?.id ?? null);
    if (persistedPage?.scaleDrawingDistance && persistedPage.scaleWorldDistance && persistedPage.scaleUnit) {
      setCalibration({
        drawingDistance: Number(persistedPage.scaleDrawingDistance),
        worldDistance: Number(persistedPage.scaleWorldDistance),
        unit: persistedPage.scaleUnit as CalibrationScale["unit"],
        factor: Number(persistedPage.scaleWorldDistance) / Number(persistedPage.scaleDrawingDistance),
      });
    }
  }, [workspaceQuery.data, activePageId]);

  const pageItems = useMemo(() => items.filter((item) => item.pageId === page?.id), [items, page?.id]);
  const renderedPageItems = useMemo(() => isLegacyPage ? pageItems.map((item) => ({ ...item, geometry: legacyGeometryToPagePoints(item.geometry, pageSize) })) : pageItems, [isLegacyPage, pageItems, pageSize]);
  const renderedAnnotations = useMemo(() => isLegacyPage ? pageAnnotations.map((annotation) => ({ ...annotation, ...legacyPointToPagePoint({ x: Number(annotation.x), y: Number(annotation.y) }, pageSize) })) : pageAnnotations, [isLegacyPage, pageAnnotations, pageSize]);
  const snapCandidates = useMemo(() => pageItems.flatMap((item) => isAreaKind(item.kind) ? item.geometry.rings?.flat() ?? [] : item.kind === "COUNT" ? item.geometry.marks ?? [] : item.geometry.points ?? []), [pageItems]);
  const selected = pageItems.find((item) => item.id === selectedId) ?? null;
  const selectedItems = pageItems.filter((item) => selectedIds.has(item.id));
  const selectedMeasurement = useMemo(() => selected ? calculateMeasurement(selected.kind, selected.geometry, calibration) : null, [selected, calibration]);
  const templates = templatesQuery.data ?? [];
  const templateFolders = templateFoldersQuery.data ?? [];
  const calculateItemCost = (item: Item) => {
    const measurement = calculateMeasurement(item.kind, item.geometry, calibration);
    if (measurement.status !== "VALID") return null;
    const template = templates.find((candidate) => candidate.id === item.templateId);
    try {
      return template ? evaluateTemplateWithDependencies(template.id, templates, { quantity: measurement.value, rate: Number(template.rate), waste: 0 }).value : measurement.value * Number(item.rate || 0);
    } catch { return null; }
  };
  const reportRows = useMemo(() => buildQuantityReport(pageItems.map((item) => ({ ...item, template: templates.find((template) => template.id === item.templateId) ?? null })), calibration, templates), [pageItems, calibration, templates]);
  const projectTotal = useMemo(() => reportTotal(reportRows), [reportRows]);
  const searchResults = useMemo(() => searchTakeoffItems(pageItems.map((item) => ({ ...item, templateName: templates.find((template) => template.id === item.templateId)?.name ?? null })), itemSearchQuery), [pageItems, templates, itemSearchQuery]);
  const templateFormulaDiagnostic = useMemo(() => inspectFormula(templateFormula), [templateFormula]);
  const templateDependencyDiagnostic = useMemo(() => {
    const draftId = editingTemplateId ?? "template-draft";
    const graph = [
      ...templates.filter((template) => template.id !== draftId).map((template) => ({ id: template.id, formula: template.formula, rate: template.rate, dependencyIds: template.dependencyIds })),
      { id: draftId, formula: templateFormula || "0", rate: templateRate || "0", dependencyIds: templateDependencyIds },
    ];
    return inspectTemplateDependencies(graph, draftId);
  }, [editingTemplateId, templateDependencyIds, templateFormula, templateRate, templates]);

  useEffect(() => {
    if (!page) return;
    setSelectedId(null);
    setSelectedIds(new Set());
    setDraftPoints([]);
    setCalibration(page.scaleDrawingDistance && page.scaleWorldDistance && page.scaleUnit ? {
      drawingDistance: Number(page.scaleDrawingDistance),
      worldDistance: Number(page.scaleWorldDistance),
      unit: page.scaleUnit as CalibrationScale["unit"],
      factor: Number(page.scaleWorldDistance) / Number(page.scaleDrawingDistance),
    } : null);
  }, [page?.id]);

  function captureSnapshot() { return { items: structuredClone(items), calibration: calibration ? { ...calibration } : null }; }
  function recordCommand(type: string, payload: Record<string, unknown>) { setPendingCommands((current) => [...current.slice(-99), { type, payloadJson: JSON.stringify(payload) }]); }
  function pushHistory() { setHistory((stack) => [...stack.slice(-49), captureSnapshot()]); setFuture([]); }
  function undo() { const prior = history.at(-1); if (!prior) return; setFuture((stack) => [...stack, captureSnapshot()]); setItems(prior.items); setCalibration(prior.calibration); setHistory((stack) => stack.slice(0, -1)); setSelectedId(null); setSelectedIds(new Set()); }
  function redo() { const next = future.at(-1); if (!next) return; setHistory((stack) => [...stack, captureSnapshot()]); setItems(next.items); setCalibration(next.calibration); setFuture((stack) => stack.slice(0, -1)); setSelectedId(null); setSelectedIds(new Set()); }

  function eventPoint(event: PointerEvent<SVGSVGElement>): Point2D {
    const rect = event.currentTarget.getBoundingClientRect();
    const drawingPoint = toPagePoint({ x: event.clientX, y: event.clientY }, rect, viewport);
    if ((!objectSnapEnabled && !gridSnapEnabled) || tool === "PAN") { setSnapIndicator(null); return drawingPoint; }
    const snapped = snapPoint(drawingPoint, { endpointCandidates: snapCandidates, radius: 12 / Math.max(viewport.scale, 0.0001), gridSize: calibration ? 0.5 / calibration.factor : 0, objectSnapEnabled, gridSnapEnabled: gridSnapEnabled && Boolean(calibration) && !isLegacyPage });
    setSnapIndicator(snapped.kind === "NONE" ? null : snapped);
    return snapped.point;
  }

  function addItem(kind: MeasurementKind, geometry: MeasurementGeometry) {
    pushHistory();
    const item: Item = {
      id: createId(),
      pageId: page?.id ?? "",
      kind,
      name: `${t(measurementNameKeys[kind])} ${pageItems.filter((existing) => existing.kind === kind).length + 1}`,
      color: colors[kind],
      geometry,
      rate: "0",
      multiplier: "1",
      templateId: null,
    };
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
    setSelectedIds(new Set([item.id]));
    setDraftPoints([]);
    setTool("SELECT");
    recordCommand("CREATE_TAKEOFF", { itemId: item.id, kind, pointCount: geometry.points?.length ?? geometry.rings?.[0]?.length ?? geometry.marks?.length ?? 0 });
  }

  function handleCanvasPointerDown(event: PointerEvent<SVGSVGElement>) {
    setPointerInput(normalizePointerInput(event.pointerType));
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "PAN" || event.button === 1) { pointerAnchor.current = { clientX: event.clientX, clientY: event.clientY, pan }; setIsPanning(true); return; }
    if (isLegacyPage) { toast.error("هذه الصفحة تستخدم إحداثيات قديمة. حوّلها وأعد معايرتها قبل التعديل."); return; }
    const point = eventPoint(event);
    if (tool === "SELECT") {
      const vertex = hitVertex(point);
      if (vertex && !event.shiftKey) { pushHistory(); setSelectedId(vertex.itemId); setSelectedIds(new Set([vertex.itemId])); setDraggedVertex(vertex); return; }
      const hitId = hitItem(point);
      if (event.shiftKey && hitId) {
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(hitId)) next.delete(hitId); else next.add(hitId);
          setSelectedId(next.has(hitId) ? hitId : (next.values().next().value ?? null));
          return next;
        });
        return;
      }
      setSelectedId(hitId);
      setSelectedIds(hitId ? new Set([hitId]) : new Set());
      return;
    }
    if (tool === "CALIBRATE") { setCalibrationPoints((current) => current.length === 2 ? [point] : [...current, point]); return; }
    if (tool === "ANNOTATE") {
      if (!projectId || !page || !annotationText.trim()) { toast.error("اكتب نص الملاحظة أولاً ثم ضعها على المخطط."); return; }
      createAnnotation.mutate({ projectId, pageId: page.id, text: annotationText.trim(), x: point.x.toFixed(4), y: point.y.toFixed(4), color: annotationColor });
      return;
    }
    if (tool === "SEGMENT") {
      if (draftPoints.length === 0) setDraftPoints([point]); else addItem("SEGMENT", { points: [draftPoints[0]!, point] });
      return;
    }
    if (tool === "COUNT") { setDraftPoints((current) => [...current, point]); return; }
    setDraftPoints((current) => [...current, point]);
  }

  function handleCanvasPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (isPanning && pointerAnchor.current) {
      setPan({ x: pointerAnchor.current.pan.x + event.clientX - pointerAnchor.current.clientX, y: pointerAnchor.current.pan.y + event.clientY - pointerAnchor.current.clientY });
      return;
    }
    if (isLegacyPage) return;
    if (draggedVertex) {
      const point = eventPoint(event);
      setItems((current) => current.map((item) => {
        if (item.id !== draggedVertex.itemId) return item;
        if (isAreaKind(item.kind)) {
          const rings = structuredClone(item.geometry.rings ?? []);
          if (draggedVertex.ringIndex !== null && rings[draggedVertex.ringIndex]?.[draggedVertex.pointIndex]) {
            rings[draggedVertex.ringIndex]![draggedVertex.pointIndex] = point;
          }
          return { ...item, geometry: { ...item.geometry, rings } };
        }
        const key = item.kind === "COUNT" ? "marks" : "points";
        const points = structuredClone(item.geometry[key] ?? []);
        if (points[draggedVertex.pointIndex]) points[draggedVertex.pointIndex] = point;
        return { ...item, geometry: { ...item.geometry, [key]: points } };
      }));
      return;
    }
    setHoverPoint(eventPoint(event));
  }

  function handlePointerUp() {
    if (draggedVertex) recordCommand("MOVE_VERTEX", draggedVertex);
    setIsPanning(false); setDraggedVertex(null); pointerAnchor.current = null;
  }
  function handleWheel(event: WheelEvent<SVGSVGElement>) { event.preventDefault(); setZoom((value) => Math.max(.55, Math.min(3.2, value + (event.deltaY > 0 ? -.12 : .12)))); }

  function hitItem(point: Point2D): string | null {
    const tolerance = 13 / Math.max(viewport.scale, 0.0001);
    for (const item of [...pageItems].reverse()) {
      const points = isAreaKind(item.kind) ? item.geometry.rings?.flat() ?? [] : item.kind === "COUNT" ? item.geometry.marks ?? [] : item.geometry.points ?? [];
      if (points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < tolerance)) return item.id;
    }
    return null;
  }

  function hitVertex(point: Point2D): VertexTarget | null {
    const tolerance = 11 / Math.max(viewport.scale, 0.0001);
    for (const item of [...pageItems].reverse()) {
      if (isAreaKind(item.kind)) {
        const rings = item.geometry.rings ?? [];
        for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
          const ring = rings[ringIndex]!;
          const pointIndex = ring.findIndex((candidate: Point2D) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < tolerance);
          if (pointIndex >= 0) return { itemId: item.id, ringIndex, pointIndex };
        }
      } else {
        const key = item.kind === "COUNT" ? "marks" : "points";
        const pointIndex = (item.geometry[key] ?? []).findIndex((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < tolerance);
        if (pointIndex >= 0) return { itemId: item.id, ringIndex: null, pointIndex };
      }
    }
    return null;
  }

  function finishTool() {
    if (tool === "ADD_HOLE") {
      if (!selected || !isAreaKind(selected.kind)) { toast.message("اختر شكلاً مساحياً أولاً ثم ارسم القطع الداخلي."); return; }
      if (draftPoints.length < 3) { toast.message("يحتاج القطع الداخلي إلى ثلاثة رؤوس على الأقل."); return; }
      try {
        validatePolygonRings([...(selected.geometry.rings ?? []), draftPoints]);
      } catch (error) {
        const diagnostic = error instanceof Error ? error.message : "CUTOUT_INVALID";
        const messages: Record<string, string> = {
          CUTOUT_OUTSIDE_OUTER_RING: "يجب أن يبقى القطع الداخلي داخل حدود المساحة، من دون ملامسة الحواف.",
          CUTOUTS_OVERLAP: "لا يمكن أن تتداخل القطوع الداخلية معاً.",
          CUTOUT_SELF_INTERSECTION: "القطع الداخلي متقاطع ذاتياً؛ عدّل الرؤوس قبل الاعتماد.",
        };
        toast.error(messages[diagnostic] ?? "القطع الداخلي غير صالح هندسياً.");
        return;
      }
      pushHistory();
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, geometry: { ...item.geometry, rings: [...(item.geometry.rings ?? []), draftPoints] } } : item));
      recordCommand("ADD_CUTOUT", { itemId: selected.id, vertexCount: draftPoints.length });
      setDraftPoints([]); setTool("SELECT");
      return;
    }
    if (tool === "AREA" && draftPoints.length >= 3) return addItem("AREA", { rings: [draftPoints] });
    if (tool === "ROOF_AREA" && draftPoints.length >= 3) return addItem("ROOF_AREA", { rings: [draftPoints], slopeRise: 0, slopeRun: 12 });
    if (tool === "VOLUME" && draftPoints.length >= 3) return addItem("VOLUME", { rings: [draftPoints], depth: 1 });
    if (tool === "LINEAR" && draftPoints.length >= 2) return addItem("LINEAR", { points: draftPoints });
    if (tool === "COUNT" && draftPoints.length >= 1) return addItem("COUNT", { marks: draftPoints });
    toast.message("أضف نقاطاً كافية لإتمام الأداة الحالية.");
  }

  function applyCalibration() {
    if (calibrationPoints.length !== 2) return;
    try {
      const next = createCalibration(calibrationPoints[0]!, calibrationPoints[1]!, Number(knownDistance), unit);
      pushHistory(); setCalibration(next); recordCommand("CALIBRATE_SCALE", { drawingDistance: next.drawingDistance, worldDistance: next.worldDistance, unit: next.unit }); setCalibrationPoints([]); setTool("SELECT"); toast.success("تم اعتماد المقياس. ستُعاد حساب الكميات فوراً.");
    } catch { toast.error("أدخل بعداً موجباً وحدد نقطتين مختلفتين للمعايرة."); }
  }

  function saveScaleContext() {
    if (!projectId || !page || !calibration) { toast.message("اعتمد معايرة صالحة أولاً قبل حفظ سياق المقياس."); return; }
    createScaleContext.mutate({ projectId, pageId: page.id, name: scaleContextName.trim() || `مقياس ${pageScaleContexts.length + 1}`, drawingDistance: calibration.drawingDistance, worldDistance: calibration.worldDistance, unit: calibration.unit });
  }

  function updateSelectedRate(rate: string) {
    if (!selected || !/^\d*(\.\d{0,4})?$/.test(rate)) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, rate } : item));
  }

  function updateSelectedMultiplier(multiplier: string) {
    if (!selected || !/^\d*(\.\d{0,4})?$/.test(multiplier)) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, multiplier } : item));
  }

  function commitSelectedMultiplier() {
    if (!selected) return;
    const multiplier = Number(selected.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) { toast.error("عامل التكرار يجب أن يكون أكبر من صفر."); return; }
    recordCommand("SET_TAKEOFF_MULTIPLIER", { itemId: selected.id, multiplier });
  }

  function updateSelectedGeometryNumber(key: "slopeRise" | "slopeRun" | "depth", value: string) {
    if (!selected) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return;
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, geometry: { ...item.geometry, [key]: numeric } } : item));
  }

  function updateSelectedTemplate(templateId: string) {
    if (!selected) return;
    pushHistory();
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, templateId: templateId || null } : item));
    recordCommand("ASSIGN_TEMPLATE", { itemId: selected.id, templateId: templateId || null });
  }

  function submitTemplate() {
    if (!templateName.trim() || !templateFormula.trim()) { toast.error("أدخل اسم القالب وصيغته."); return; }
    if (!templateFormulaDiagnostic.valid) { toast.error(t(`formula.${templateFormulaDiagnostic.code}` as TranslationKey)); return; }
    if (!templateDependencyDiagnostic.valid) { toast.error(t(`template.${templateDependencyDiagnostic.code}` as TranslationKey)); return; }
    const payload = { name: templateName.trim(), formula: templateFormula.trim(), unit: templateUnit.trim() || "وحدة", rate: templateRate || "0", folderId: templateFolderId || null, dependencyIds: templateDependencyIds };
    if (editingTemplateId) updateTemplate.mutate({ templateId: editingTemplateId, ...payload });
    else createTemplate.mutate({ kind: templateKind, ...payload });
  }

  function editTemplate(template: typeof templates[number]) {
    setEditingTemplateId(template.id);
    setTemplateKind(template.kind);
    setTemplateName(template.name);
    setTemplateFormula(template.formula);
    setTemplateUnit(template.unit);
    setTemplateRate(String(template.rate));
    setTemplateFolderId(template.folderId ?? "");
    setTemplateDependencyIds(template.dependencyIds);
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateKind("PART");
    setTemplateName("");
    setTemplateFormula("quantity * rate");
    setTemplateUnit("وحدة");
    setTemplateRate("0");
    setTemplateFolderId("");
    setTemplateDependencyIds([]);
  }

  function submitTemplateCostItem() {
    if (!editingTemplateId) { toast.error("احفظ القالب أولاً ثم أضف مواده أو عمالته."); return; }
    if (!costItemName.trim() || !costItemQuantityFormula.trim()) { toast.error("أدخل اسم البند وصيغة كميته."); return; }
    const diagnostic = inspectFormula(costItemQuantityFormula);
    if (!diagnostic.valid) { toast.error(t(`formula.${diagnostic.code}` as TranslationKey)); return; }
    createTemplateCostItem.mutate({ templateId: editingTemplateId, kind: costItemKind, name: costItemName.trim(), quantityFormula: costItemQuantityFormula.trim(), unit: costItemUnit.trim() || "وحدة", rate: costItemRate || "0", wastePercent: costItemWastePercent || "0" });
  }

  function downloadReportCsv() {
    const csv = reportToCsv(reportRows, projectTotal, workspaceQuery.data?.project.currency ?? "", { headers: [t("report.item"), t("report.kind"), t("report.quantity"), t("report.unit"), t("report.template"), t("report.unitRate"), t("report.cost"), t("report.status"), t("report.diagnostic")], pageTotal: t("report.pageTotal") });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "takeoff-page-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير تقرير الصفحة CSV.");
  }

  function downloadReportExcel() {
    const xlsx = createQuantityReportXlsx({ projectName: workspaceQuery.data?.project.name ?? "Takeoff", pageName: page?.name ?? "Takeoff", currency: workspaceQuery.data?.project.currency ?? "USD", rows: reportRows, total: projectTotal, generatedAt: new Date().toLocaleString(locale === "ar" ? "ar" : "en-US") }, { sheetName: t("report.sheetName"), title: t("report.printTitle"), project: t("report.project"), page: t("report.page"), currency: t("report.currency"), exportedAt: t("report.exportedAt"), headers: [t("report.item"), t("report.kind"), t("report.quantity"), t("report.unit"), t("report.template"), t("report.unitRate"), t("report.cost"), t("report.status")], pageTotal: t("report.pageTotal"), manualPricing: t("report.manualPricing"), validStatus: t("report.statusValid"), rightToLeft: direction === "rtl" });
    const blob = new Blob([xlsx], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "takeoff-page-report.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير تقرير الصفحة Excel.");
  }

  function printPageReport() {
    const html = buildPrintableReportHtml({ projectName: workspaceQuery.data?.project.name ?? "Takeoff", pageName: page?.name ?? "Takeoff", currency: workspaceQuery.data?.project.currency ?? "USD", rows: reportRows, total: projectTotal, generatedAt: new Date().toLocaleString(locale === "ar" ? "ar" : "en-US") }, {
      language: locale,
      direction,
      title: t("report.printTitle"),
      headers: [t("report.item"), t("report.kind"), t("report.quantity"), t("report.unit"), t("report.template"), t("report.cost"), t("report.status")],
      pageTotal: t("report.pageTotal"),
      manualPricing: t("report.manualPricing"),
      generatedAt: t("report.generatedAt"),
      sourceNote: t("report.sourceNote"),
      formatQuantity: (quantity, unit) => quantity === null ? "—" : formatQuantity(quantity, unit, locale, unitSystem),
      formatCurrency: (amount, currency) => amount === null ? "—" : formatCurrency(amount, currency, locale),
      formatStatus: (status, diagnostic) => status === "VALID" ? t("report.statusValid") : diagnostic ?? status,
    });
    const printed = sendToPrintWindow(() => {
      const target = window.open("", "takeoff-print-report", "noopener,noreferrer,width=960,height=740");
      return target ? { document: target.document, focus: () => target.focus(), print: () => target.print() } : null;
    }, html);
    if (!printed) toast.error("حظر المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
  }

  function downloadProjectFile() {
    if (!projectId) return;
    exportProject.mutate(projectId, { onSuccess: (content) => {
      triggerProjectFileDownload(content);
      toast.success("تم تنزيل نسخة المشروع؛ لا تتضمن ملفات PDF الأصلية.");
    } });
  }

  function saveProjectVersion() {
    if (!projectId) return;
    createVersion.mutate({ projectId, label: versionLabel.trim() || `لقطة ${projectVersions.length + 1}` });
  }

  function deleteSelected() { if (!selected) return; pushHistory(); recordCommand("DELETE_TAKEOFF", { itemId: selected.id }); setItems((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(null); setSelectedIds(new Set()); }
  function duplicateSelected() {
    if (!selected) return;
    pushHistory();
    const copy = { ...selected, id: createId(), name: nextCopyName(selected.name, pageItems.map((item) => item.name), { fallback: t("workspace.measurementName.fallback"), copy: t("workspace.measurementName.copy") }), geometry: structuredClone(selected.geometry) };
    recordCommand("DUPLICATE_TAKEOFF", { sourceId: selected.id, itemId: copy.id });
    setItems((current) => [...current, copy]);
    setSelectedId(copy.id);
    setSelectedIds(new Set([copy.id]));
  }

  function deleteSelectedGroup() {
    const ids = selectedItems.map((item) => item.id);
    if (!ids.length) return;
    pushHistory();
    recordCommand("DELETE_TAKEOFF_GROUP", { itemIds: ids });
    setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
    setSelectedId(null);
    setSelectedIds(new Set());
  }

  function duplicateSelectedGroup() {
    if (!selectedItems.length) return;
    pushHistory();
    const usedNames = new Set(pageItems.map((item) => item.name));
    const copies = selectedItems.map((item) => {
      const name = nextCopyName(item.name, usedNames, { fallback: t("workspace.measurementName.fallback"), copy: t("workspace.measurementName.copy") });
      usedNames.add(name);
      return { ...item, id: createId(), name, geometry: structuredClone(item.geometry) };
    });
    recordCommand("DUPLICATE_TAKEOFF_GROUP", { sourceIds: selectedItems.map((item) => item.id), copyIds: copies.map((item) => item.id) });
    setItems((current) => [...current, ...copies]);
    setSelectedId(copies[0]?.id ?? null);
    setSelectedIds(new Set(copies.map((item) => item.id)));
  }

  function translateSelectedGroup() {
    if (!selectedItems.length) return;
    const offset = { x: Number(groupOffset.x), y: Number(groupOffset.y) };
    if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y) || (offset.x === 0 && offset.y === 0)) { toast.error("أدخل إزاحة X أو Y صالحة وغير صفرية."); return; }
    try {
      pushHistory();
      setItems((current) => current.map((item) => selectedIds.has(item.id) ? { ...item, geometry: translateMeasurementGeometry(item.geometry, offset) } : item));
      recordCommand("TRANSLATE_TAKEOFF_GROUP", { itemIds: selectedItems.map((item) => item.id), offset });
      toast.success("تم نقل عناصر المجموعة داخل مساحة الرسم.");
    } catch { toast.error("تعذر نقل المجموعة بسبب هندسة غير صالحة."); }
  }

  function save() {
    if (!projectId || !page) return;
    saveWorkspace.mutate({
      projectId,
      page: { id: page.id, name: page.name, scaleDrawingDistance: calibration?.drawingDistance ?? null, scaleWorldDistance: calibration?.worldDistance ?? null, scaleUnit: calibration?.unit ?? null },
      items: pageItems.map((item) => ({ id: item.id, pageId: item.pageId, kind: item.kind, name: item.name, color: item.color, geometryJson: JSON.stringify(item.geometry), rate: item.rate || "0", multiplier: item.multiplier || "1", templateId: item.templateId })),
      commandEvents: pendingCommands,
    });
  }

  function startRenamePage() {
    if (!page) return;
    setPageNameDraft(page.name);
    setIsRenamingPage(true);
  }

  function submitRenamePage() {
    if (!projectId || !page || !pageNameDraft.trim()) return;
    renamePage.mutate({ projectId, pageId: page.id, name: pageNameDraft.trim() });
  }

  function requestDeletePage() {
    if (!projectId || !page) return;
    if (pages.length <= 1) { toast.error("يجب أن يبقى في المشروع صفحة واحدة على الأقل."); return; }
    if (!window.confirm(`حذف «${page.name}» وكل عناصر القياس التابعة لها؟`)) return;
    deletePage.mutate({ projectId, pageId: page.id });
  }

  function moveActivePage(direction: -1 | 1) {
    if (!projectId || !page || reorderPages.isPending) return;
    const currentIndex = pages.findIndex((candidate) => candidate.id === page.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= pages.length) return;
    const orderedIds = pages.map((candidate) => candidate.id);
    [orderedIds[currentIndex], orderedIds[targetIndex]] = [orderedIds[targetIndex]!, orderedIds[currentIndex]!];
    reorderPages.mutate({ projectId, pageIds: orderedIds });
  }

  function saveReview() {
    if (!projectId || !page || !reviewDocumentId) { toast.message("اختر وثيقة مرجعية أولاً قبل حفظ المراجعة."); return; }
    createReview.mutate({ projectId, sourcePageId: page.id, referenceDocumentId: reviewDocumentId, label: reviewLabel.trim() || `مراجعة ${page.name}` });
  }

  async function importPdf(file: File) {
    if (!projectId) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("اختر ملف PDF فقط."); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("الحد الأقصى لملف PDF هو 25 ميغابايت."); return; }
    setIsImporting(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      let authorization = "";
      try {
        const raw = sessionStorage.getItem("manus-cookie");
        const prefix = `${COOKIE_NAME}=`;
        const pair = raw?.split(";").find((value) => value.trim().startsWith(prefix));
        const token = pair?.trim().slice(prefix.length);
        if (token) authorization = `Bearer ${token}`;
      } catch { /* Cookie-based authentication remains available. */ }
      const response = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: payload, credentials: "include", headers: authorization ? { Authorization: authorization } : undefined });
      const result = await response.json() as { pages?: Array<{ id: string }>; error?: string };
      if (!response.ok) throw new Error(result.error ?? "تعذر استيراد المستند.");
      setActivePageId(result.pages?.[0]?.id ?? null);
      await utils.projects.get.invalidate(projectId);
      toast.success(`تم استيراد ${result.pages?.length ?? 0} صفحة من ${file.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر استيراد ملف PDF.");
    } finally {
      setIsImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  useEffect(() => {
    if (!projectId) setLocation("/projects");
  }, [projectId, setLocation]);

  if (!projectId) return null;
  if (workspaceQuery.isLoading) return <div className="workspace-loading">جارٍ فتح مساحة العمل…</div>;
  if (!workspaceQuery.data || !page) return <div className="workspace-loading">تعذر فتح هذا المشروع. عد إلى قائمة المشاريع واختر مشروعاً صالحاً.</div>;

  const activeTool = localizedToolOptions.find((option) => option.tool === tool);
  const preview = (["AREA", "ROOF_AREA", "VOLUME", "LINEAR"] as Tool[]).includes(tool) ? [...draftPoints, ...(hoverPoint ? [hoverPoint] : [])] : [];
  const selectedReportRow = selected ? reportRows.find((row) => row.id === selected.id) : undefined;
  const selectedCost = selectedReportRow?.cost ?? null;
  const formatMeasuredValue = (value: number, kind: MeasurementKind) => {
    if (kind === "COUNT") return formatCount(value, locale);
    const sourceUnit = calibration?.unit ?? "m";
    if (kind === "AREA" || kind === "ROOF_AREA") return formatArea(value, sourceUnit, unitSystem, locale);
    if (kind === "VOLUME") return formatVolume(value, sourceUnit, unitSystem, locale);
    return formatLength(value, sourceUnit, unitSystem, locale);
  };

  return (
    <div className="takeoff-workspace" dir={direction}>
      <header className="workspace-topbar compact">
        <div className="project-heading"><Button variant="ghost" size="icon" onClick={() => setLocation("/projects")} aria-label="العودة إلى المشاريع"><ArrowLeft size={19} /></Button><div><p className="workspace-eyebrow">PROJECT / {page.name}</p><h1>{workspaceQuery.data.project.name}</h1></div></div>
        <div className="topbar-actions"><input ref={importInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importPdf(file); }} /><Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={isImporting}><FileUp size={15} />{isImporting ? "جارٍ الاستيراد" : "استيراد PDF"}</Button><Button variant="outline" size="sm" onClick={downloadProjectFile} disabled={exportProject.isPending}><Download size={15} />{exportProject.isPending ? "جارٍ التصدير" : "نسخة"}</Button><Button variant="outline" size="sm" onClick={() => createNativeSession.mutate()} disabled={createNativeSession.isPending}><Smartphone size={15} />{createNativeSession.isPending ? "جارٍ إنشاء الرمز" : "ربط Android"}</Button><Button variant={isTemplatesOpen ? "default" : "outline"} size="sm" onClick={() => setIsTemplatesOpen((current) => !current)}><Layers3 size={15} />القوالب</Button><Button variant={isReportOpen ? "default" : "outline"} size="sm" onClick={() => setIsReportOpen((current) => !current)}><Download size={15} />تقرير</Button>{page.backgroundUrl && page.pdfPageNumber && reviewDocuments.length > 0 && <label className="review-select">مراجعة<select value={reviewDocumentId ?? ""} onChange={(event) => setReviewDocumentId(event.target.value || null)}><option value="">بدون Overlay</option>{reviewDocuments.map((document) => <option key={document.id} value={document.id}>{document.originalName}</option>)}</select></label>}<Button variant={objectSnapEnabled ? "default" : "outline"} size="sm" onClick={() => setObjectSnapEnabled((current) => !current)} aria-pressed={objectSnapEnabled}><Crosshair size={15} />التقاط عناصر</Button><Button variant={gridSnapEnabled ? "default" : "outline"} size="sm" onClick={() => setGridSnapEnabled((current) => !current)} disabled={!calibration || isLegacyPage} aria-pressed={gridSnapEnabled}><Hash size={15} />التقاط شبكة</Button><Button variant="outline" size="sm" onClick={() => projectId && addBlankPage.mutate({ projectId })} disabled={addBlankPage.isPending}><Plus size={15} />صفحة فارغة</Button><Button variant="outline" size="icon" onClick={() => moveActivePage(1)} disabled={reorderPages.isPending || pages.findIndex((candidate) => candidate.id === page.id) >= pages.length - 1} aria-label="تحريك الصفحة للأسفل"><ChevronRight size={16} /></Button><Button variant="outline" size="icon" onClick={() => moveActivePage(-1)} disabled={reorderPages.isPending || pages.findIndex((candidate) => candidate.id === page.id) <= 0} aria-label="تحريك الصفحة للأعلى"><ChevronLeft size={16} /></Button><Button variant="outline" size="icon" onClick={startRenamePage} disabled={renamePage.isPending} aria-label="إعادة تسمية الصفحة"><Pencil size={15} /></Button><Button variant="outline" size="icon" onClick={requestDeletePage} disabled={deletePage.isPending || pages.length <= 1} className="danger-action" aria-label="حذف الصفحة"><Trash2 size={15} /></Button><span className={`scale-chip ${calibration ? "valid" : ""}`}><CircleDot size={14} />{calibration ? `1 وحدة رسم = ${calibration.factor.toFixed(3)} ${calibration.unit}` : "المقياس غير مضبوط"}</span><Button variant="outline" size="sm" onClick={undo} disabled={!history.length}><Undo2 size={15} />تراجع</Button><Button variant="outline" size="sm" onClick={redo} disabled={!future.length}><Redo2 size={15} />إعادة</Button><Button className="workspace-primary" size="sm" onClick={save} disabled={saveWorkspace.isPending}><Save size={15} />{saveWorkspace.isPending ? "جارٍ الحفظ" : "حفظ"}</Button></div>
      </header>

      <div className="workspace-preferences" aria-label="إعدادات اللغة والوحدات">
        <label>{t("settings.language")}<select value={locale} onChange={(event) => setLocale(event.target.value as "ar" | "en")}><option value="ar">{t("settings.arabic")}</option><option value="en">{t("settings.english")}</option></select></label>
        <label>{t("settings.units")}<select value={unitSystem} onChange={(event) => setUnitSystem(event.target.value as "metric" | "imperial")}><option value="metric">{t("settings.metric")}</option><option value="imperial">{t("settings.imperial")}</option></select></label>
        {selectedMeasurement?.status === "VALID" && selected ? <output>{formatMeasuredValue(selectedMeasurement.value, selected.kind)}</output> : null}
      </div>

      <div className="page-strip" aria-label="صفحات المشروع">
        <span className="page-strip-label">الصفحات</span>
        {isRenamingPage && <form className="page-rename-form" onSubmit={(event) => { event.preventDefault(); submitRenamePage(); }}><Input aria-label="اسم الصفحة" value={pageNameDraft} onChange={(event) => setPageNameDraft(event.target.value)} maxLength={160} autoFocus /><button type="submit" disabled={renamePage.isPending}>حفظ</button><button type="button" onClick={() => setIsRenamingPage(false)}>إلغاء</button></form>}
        <div className="page-tabs">{pages.map((candidate) => <button key={candidate.id} className={candidate.id === page?.id ? "active" : ""} onClick={() => setActivePageId(candidate.id)}>{candidate.backgroundUrl && candidate.pdfPageNumber ? <PdfThumbnail url={candidate.backgroundUrl} pageNumber={candidate.pdfPageNumber} /> : <span className="blank-page-thumbnail">رسم</span>}<span>{candidate.pdfPageNumber ? `PDF ${candidate.pdfPageNumber}` : "رسم"}</span><b>{candidate.name}</b></button>)}</div>
      </div>

      <div className="workspace-layout">
        <aside className="page-navigator" aria-label="الصفحات والقياسات">
          <div className="navigator-heading"><span>الصفحات، القياسات</span><span className="navigator-actions"><Button variant="ghost" size="icon" onClick={() => projectId && addBlankPage.mutate({ projectId })} aria-label="إضافة صفحة"><Plus size={15} /></Button><Button variant="ghost" size="icon" onClick={() => setIsTemplatesOpen((current) => !current)} aria-label="إظهار القوالب"><Layers3 size={15} /></Button></span></div>
          <div className="navigator-search"><Input value={itemSearchQuery} onChange={(event) => setItemSearchQuery(event.target.value)} placeholder="بحث في الصفحات أو القياسات" aria-label="بحث صفحات وقياسات" /></div>
          <div className="page-tree">{pages.map((candidate) => { const pageItemsCount = (workspaceQuery.data?.items ?? []).filter((item) => item.pageId === candidate.id).length; const active = candidate.id === page?.id; return <button key={candidate.id} type="button" className={`page-tree-row ${active ? "active" : ""}`} onClick={() => setActivePageId(candidate.id)}><span className="page-tree-icon">{candidate.pdfPageNumber ? "▧" : "□"}</span><span><b>{candidate.name}</b><small>{candidate.pdfPageNumber ? `PDF ${candidate.pdfPageNumber}` : "رسم حر"} · {pageItemsCount} عناصر</small></span><strong>{active ? "●" : ""}</strong></button>; })}</div>
          <div className="takeoff-tree"><span className="tree-label">قياسات الصفحة النشطة</span>{pageItems.length ? pageItems.map((item) => <button key={item.id} type="button" className={selectedIds.has(item.id) ? "active" : ""} onClick={() => { setSelectedId(item.id); setSelectedIds(new Set([item.id])); setTool("SELECT"); }}><i style={{ background: item.color }} /><span>{item.name}</span><small>{item.kind}</small></button>) : <p>لا توجد قياسات في هذه الصفحة.</p>}</div>
        </aside>
        <aside className="tool-rail" aria-label="أدوات القياس">
          <span className="rail-label">أدوات</span>
          {localizedToolOptions.map((option) => { const Icon = option.icon; return <button key={option.tool} className={`tool-button ${tool === option.tool ? "active" : ""}`} title={option.hint} onClick={() => { setTool(option.tool); setDraftPoints([]); setCalibrationPoints([]); }}><Icon size={19} /><span>{option.label}</span></button>; })}
          <div className="tool-divider" />
          <button className="tool-button" title="إنهاء الرسم" onClick={finishTool} disabled={!(["AREA", "ROOF_AREA", "VOLUME", "LINEAR", "COUNT", "ADD_HOLE"] as Tool[]).includes(tool)}><Check size={19} /><span>إنهاء</span></button>
          <button className="tool-button" title="إلغاء الرسم الحالي" onClick={() => { setDraftPoints([]); setCalibrationPoints([]); setTool("SELECT"); }}><X size={19} /><span>إلغاء</span></button>
        </aside>

        <section ref={canvasShellRef} className="canvas-shell" aria-label="مساحة الرسم والقياس">
          <div className="canvas-status"><span><Crosshair size={14} />{activeTool?.label}: {activeTool?.hint}</span><span>{pageItems.length} عناصر ملتزمة</span><span data-testid="pointer-input">إدخال: {t(pointerInputLabelKey(pointerInput))}</span>{isLegacyPage && <span>تنبيه: إحداثيات قديمة</span>}{selectedItems.length > 1 && <span>{selectedItems.length} عناصر محددة</span>}</div>
          <svg ref={svgRef} className="takeoff-canvas" style={{ touchAction: "none" }} viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} role="application" aria-label="مساحة رسم هندسية تفاعلية" onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel}>
            <defs><pattern id="workspace-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(168,210,203,.12)" strokeWidth="1" /></pattern><pattern id="workspace-major-grid" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" fill="url(#workspace-grid)" /><path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(197,255,85,.2)" strokeWidth="1" /></pattern></defs>
            <rect width={canvasSize.width} height={canvasSize.height} fill="var(--canvas)" opacity={page.backgroundUrl ? .24 : 1} /><rect width={canvasSize.width} height={canvasSize.height} fill="url(#workspace-major-grid)" opacity={page.backgroundUrl ? .34 : 1} />
            <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`}>
              {!page.backgroundUrl && <><path d="M110 130H520L660 245V550H290L195 455H110Z" fill="rgba(201,255,74,.045)" stroke="rgba(201,255,74,.42)" strokeWidth="2" strokeDasharray="8 8" />
              <path d="M150 210H420V430H150ZM530 350H615V490H530Z" fill="none" stroke="rgba(135,217,247,.25)" strokeWidth="1.5" /></>}
              {renderedPageItems.map((item) => <MeasurementShape key={item.id} item={item} selected={selectedIds.has(item.id)} screenScale={viewport.scale} />)}
              {renderedAnnotations.map((annotation) => <g key={annotation.id} className="page-annotation"><rect x={Number(annotation.x) - 5} y={Number(annotation.y) - 19} width={Math.max(86, annotation.text.length * 8)} height="26" rx="5" fill="rgba(16,43,57,.82)" stroke={annotation.color} strokeWidth="1.5" /><text x={annotation.x} y={Number(annotation.y) - 2} fill={annotation.color} fontSize="14" fontWeight="700">{annotation.text}</text></g>)}
              {preview.length > 0 && <polyline points={preview.map((point) => `${point.x},${point.y}`).join(" ")} fill={(["AREA", "ROOF_AREA", "VOLUME"] as Tool[]).includes(tool) ? "var(--surface-hi)" : "none"} stroke="var(--text)" strokeWidth="2.5" strokeDasharray="6 5" />}
              {draftPoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="5" fill="var(--text)" stroke="var(--canvas)" strokeWidth="2" />)}
              {snapIndicator && <g className={`snap-marker ${snapIndicator.kind.toLowerCase()}`}><circle cx={snapIndicator.point.x} cy={snapIndicator.point.y} r="9" fill="none" strokeWidth="2" /><path d={`M${snapIndicator.point.x - 14} ${snapIndicator.point.y}H${snapIndicator.point.x + 14}M${snapIndicator.point.x} ${snapIndicator.point.y - 14}V${snapIndicator.point.y + 14}`} strokeWidth="1.5" /></g>}
              {calibrationPoints.length > 0 && <><line x1={calibrationPoints[0]!.x} y1={calibrationPoints[0]!.y} x2={calibrationPoints[1]?.x ?? hoverPoint?.x ?? calibrationPoints[0]!.x} y2={calibrationPoints[1]?.y ?? hoverPoint?.y ?? calibrationPoints[0]!.y} stroke="var(--text)" strokeWidth="2" strokeDasharray="5 4" />{calibrationPoints.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="7" fill="var(--text)" />)}</>}
            </g>
          </svg>
          {page.backgroundUrl && page.pdfPageNumber && <PdfPlanLayer url={page.backgroundUrl} pageNumber={page.pdfPageNumber} pageSize={pageSize} viewport={viewport} />}
          {page.backgroundUrl && page.pdfPageNumber && comparisonPage?.backgroundUrl && comparisonPage.pdfPageNumber && <PdfReviewOverlay reference={{ url: comparisonPage.backgroundUrl, pageNumber: comparisonPage.pdfPageNumber, tone: "reference" }} current={{ url: page.backgroundUrl, pageNumber: page.pdfPageNumber, tone: "current" }} viewport={viewport} currentPageSize={pageSize} referencePageSize={{ width: Number(comparisonPage.pageWidth) || pageSize.width, height: Number(comparisonPage.pageHeight) || pageSize.height }} />}
          {reviewDocumentId && !comparisonPage && <div className="review-missing-page">لا توجد صفحة مقابلة برقم {page.pdfPageNumber} في النسخة المختارة.</div>}
          {isLegacyPage && <div className="legacy-coordinate-warning" role="alert"><strong>قياسات هذه الصفحة قديمة وغير قابلة للاعتماد.</strong><span>سيُعاد إسقاط الرسم على أبعاد الصفحة، وتُمسح المعايرة الحالية. يجب إدخال المقياس من جديد بعد التحويل.</span><Button size="sm" onClick={() => { if (projectId && window.confirm("سيُحوّل الرسم إلى إحداثيات الصفحة وتُمسح المعايرة والسياقات المحفوظة. هل تريد المتابعة؟")) convertLegacyPageGeometry.mutate({ projectId, pageId: page.id, pageWidth: pageSize.width, pageHeight: pageSize.height }); }} disabled={convertLegacyPageGeometry.isPending}>{convertLegacyPageGeometry.isPending ? "جارٍ التحويل" : "تحويل الصفحة وإعادة المعايرة"}</Button></div>}
          <div className="viewport-controls"><button onClick={() => setZoom((value) => Math.min(3.2, value + .15))} aria-label="تكبير"><ZoomIn size={18} /></button><button onClick={() => setZoom((value) => Math.max(.55, value - .15))} aria-label="تصغير"><ZoomOut size={18} /></button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="إعادة ضبط العرض"><Expand size={18} /></button></div>
          <div className="canvas-coordinates">{hoverPoint ? `X ${hoverPoint.x.toFixed(1)} / Y ${hoverPoint.y.toFixed(1)}` : "حرّك المؤشر لإظهار الإحداثيات"}</div>
        </section>

        <aside className="inspector-panel">
          <div className="inspector-heading"><span>المفتش</span><Layers3 size={17} /></div>
          <section className="ps-template-browser"><div className="ps-browser-heading"><span>القوالب، الأجزاء، المدخلات</span><Button variant="ghost" size="icon" onClick={() => setIsTemplatesOpen((current) => !current)} aria-label="فتح إدارة القوالب"><Plus size={14} /></Button></div><div className="ps-browser-tabs"><span className="active">Parts & Assemblies</span><span>Inputs</span></div><div className="ps-template-tree">{templates.length ? templates.map((template) => <button key={template.id} type="button" className={editingTemplateId === template.id ? "active" : ""} onClick={() => { editTemplate(template); setIsTemplatesOpen(true); }}><i style={{ background: template.kind === "ASSEMBLY" ? "var(--count)" : "var(--area)" }} /><span><b>{template.name}</b><small>{template.kind} · {template.unit}</small></span><em>{template.costItems?.length ?? 0}</em></button>) : <p>أضف Parts وAssemblies لتظهر هنا.</p>}</div></section>
          <ItemSearchPanel query={itemSearchQuery} onQueryChange={setItemSearchQuery} results={searchResults} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setSelectedIds(new Set([id])); setTool("SELECT"); }} />
          <section className="annotation-card"><span className="panel-kicker">MARKUP NOTE</span><h2>ملاحظة على المخطط</h2><p>اكتب الملاحظة ثم اختر أداة «ملاحظة» وانقر موضعها على الصفحة.</p><Input value={annotationText} onChange={(event) => setAnnotationText(event.target.value)} placeholder="نص الملاحظة" maxLength={500} /><div className="annotation-controls"><Input aria-label="لون الملاحظة" type="color" value={annotationColor} onChange={(event) => setAnnotationColor(event.target.value)} /><Button type="button" variant={tool === "ANNOTATE" ? "default" : "outline"} size="sm" onClick={() => setTool("ANNOTATE")} disabled={!annotationText.trim()}>وضع الملاحظة</Button></div>{pageAnnotations.length ? <div className="annotation-list">{pageAnnotations.map((annotation) => <div key={annotation.id}><span style={{ color: annotation.color }}>{annotation.text}</span><button type="button" aria-label={`حذف الملاحظة ${annotation.text}`} onClick={() => projectId && deleteAnnotation.mutate({ projectId, annotationId: annotation.id })}><Trash2 size={13} /></button></div>)}</div> : <small>لا توجد ملاحظات محفوظة على هذه الصفحة.</small>}</section>
          {selected && selectedReportRow ? <section className="multiplier-card"><span className="panel-kicker">TYPICAL TAKEOFF</span><h2>عامل التكرار</h2><Label>عدد الوحدات المتكررة<Input value={selected.multiplier} inputMode="decimal" onChange={(event) => updateSelectedMultiplier(event.target.value)} onBlur={commitSelectedMultiplier} aria-label="عامل تكرار العنصر" /></Label><small>الكمية الهندسية × العامل = {selectedReportRow.quantity?.toFixed(2) ?? "—"} {selectedReportRow.unit}</small></section> : null}
          {selectedReportRow?.costBreakdown.length ? <section className="cost-audit-card"><span className="panel-kicker">COST AUDIT</span><h2>تفصيل تكلفة العنصر</h2><div>{selectedReportRow.costBreakdown.map((entry) => <article key={entry.id}><span><b>{entry.name}</b><small>{entry.kind} · {entry.quantity.toFixed(2)} {entry.unit} × {entry.rate}{entry.wastePercent ? ` · هالك ${entry.wastePercent}%` : ""}</small></span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: workspaceQuery.data?.project.currency ?? "USD" }).format(entry.cost)}</strong></article>)}</div></section> : null}
          {isTemplatesOpen && <section className="estimate-library-card"><span className="panel-kicker">ESTIMATING LIBRARY</span><h2>مواد وعمالة القالب</h2><p>نظّم القوالب في مجلدات وأضف بنود تكلفة مستقلة يمكن مراجعتها في التقرير.</p><div className="template-folder-controls"><Input value={templateFolderName} onChange={(event) => setTemplateFolderName(event.target.value)} placeholder="اسم مجلد جديد" maxLength={120} /><Button type="button" variant="outline" size="sm" disabled={!templateFolderName.trim() || createTemplateFolder.isPending} onClick={() => createTemplateFolder.mutate({ name: templateFolderName.trim() })}>إضافة مجلد</Button></div><Label>مجلد القالب<select value={templateFolderId} onChange={(event) => setTemplateFolderId(event.target.value)}><option value="">بدون مجلد</option>{templateFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></Label>{templateFolderId && !editingTemplateId && <small>سيُربط المجلد عند حفظ القالب الجديد.</small>}{templateFolderId && editingTemplateId && <Button type="button" variant="outline" size="sm" onClick={() => deleteTemplateFolder.mutate(templateFolderId)} disabled={deleteTemplateFolder.isPending}>حذف المجلد الفارغ</Button>}{editingTemplateId ? <div className="cost-items-editor"><h3>بنود «{templates.find((template) => template.id === editingTemplateId)?.name ?? "القالب"}»</h3>{templates.find((template) => template.id === editingTemplateId)?.costItems.length ? <div className="cost-items-list">{templates.find((template) => template.id === editingTemplateId)?.costItems.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.kind} · {item.quantityFormula} × {item.rate}{Number(item.wastePercent) ? ` · هالك ${item.wastePercent}%` : ""}</small></span><button type="button" aria-label={`حذف بند ${item.name}`} onClick={() => deleteTemplateCostItem.mutate(item.id)}><Trash2 size={13} /></button></div>)}</div> : <small>لا توجد بنود تكلفة بعد؛ تبقى تكلفة القالب الأساسية كما هي.</small>}<form className="cost-item-form" onSubmit={(event) => { event.preventDefault(); submitTemplateCostItem(); }}><select value={costItemKind} onChange={(event) => setCostItemKind(event.target.value as "MATERIAL" | "LABOR" | "EQUIPMENT")}><option value="MATERIAL">مادة</option><option value="LABOR">عمالة</option><option value="EQUIPMENT">معدات</option></select><Input value={costItemName} onChange={(event) => setCostItemName(event.target.value)} placeholder="اسم البند" maxLength={160} /><Input value={costItemQuantityFormula} onChange={(event) => setCostItemQuantityFormula(event.target.value)} placeholder="صيغة الكمية: quantity" maxLength={500} /><div className="template-form-grid"><Input value={costItemUnit} onChange={(event) => setCostItemUnit(event.target.value)} placeholder="وحدة البند" maxLength={32} /><Input value={costItemRate} onChange={(event) => setCostItemRate(event.target.value)} inputMode="decimal" placeholder="سعر الوحدة" /><Input value={costItemWastePercent} onChange={(event) => setCostItemWastePercent(event.target.value)} inputMode="decimal" placeholder="هالك %" /></div><Button type="submit" className="workspace-primary full" disabled={createTemplateCostItem.isPending}>{createTemplateCostItem.isPending ? "جارٍ الإضافة" : "إضافة بند تكلفة"}</Button></form></div> : <small>اختر قالباً من القائمة ثم اضغط تحرير لإضافة مواده أو عمالته.</small>}</section>}
          <section className="versions-card"><span className="panel-kicker">PROJECT VERSIONS</span><h2>لقطات المشروع</h2><p>الاستعادة تنشئ مشروعاً جديداً ولا تستبدل المشروع المفتوح.</p><div className="versions-create"><Input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="اسم اللقطة (اختياري)" maxLength={160} /><Button variant="outline" size="sm" onClick={saveProjectVersion} disabled={createVersion.isPending}>{createVersion.isPending ? "جارٍ الحفظ" : "حفظ لقطة"}</Button></div>{projectVersions.length ? <div className="versions-list">{projectVersions.map((version) => <div key={version.id}><span><b>{version.label}</b><small>{new Date(version.createdAt).toLocaleString("ar")}</small></span><Button variant="outline" size="sm" onClick={() => { if (projectId && window.confirm(`استعادة «${version.label}» إلى مشروع جديد؟ لن يتغير المشروع المفتوح.`)) restoreVersion.mutate({ projectId, versionId: version.id }); }} disabled={restoreVersion.isPending}>استعادة آمنة</Button></div>)}</div> : <small>لا توجد لقطات محفوظة بعد.</small>}</section>
          {page.backgroundUrl && page.pdfPageNumber && <section className="review-history-card"><span className="panel-kicker">SAVED REVIEWS</span><h2>سجل المراجعات</h2><Input value={reviewLabel} onChange={(event) => setReviewLabel(event.target.value)} placeholder="اسم للمراجعة الجديدة (اختياري)" maxLength={160} /><Button variant="outline" size="sm" onClick={saveReview} disabled={!reviewDocumentId || createReview.isPending}><BookmarkPlus size={14} />{createReview.isPending ? "جارٍ الحفظ" : "حفظ الوثيقة المختارة"}</Button>{pageReviews.length ? <div className="review-history-list">{pageReviews.map((review) => <div key={review.id}><button type="button" onClick={() => setReviewDocumentId(review.referenceDocumentId)}><b>{review.label}</b><small>{reviewDocuments.find((document) => document.id === review.referenceDocumentId)?.originalName ?? "وثيقة مرجعية"}</small></button><button type="button" aria-label={`حذف ${review.label}`} onClick={() => { if (projectId && window.confirm(`حذف «${review.label}» من سجل المراجعات؟`)) deleteReview.mutate({ projectId, reviewId: review.id }); }}><Trash2 size={13} /></button></div>)}</div> : <p>اختر وثيقة مرجعية من شريط المراجعة ثم احفظها للعودة إليها.</p>}</section>}
          {isTemplatesOpen && <section className="templates-card"><span className="panel-kicker">PARTS & ASSEMBLIES</span><h2>مكتبة القوالب</h2><div className="template-list">{templates.length ? templates.map((template) => <div key={template.id} className="template-row"><button type="button" className="template-edit" onClick={() => editTemplate(template)}><b>{template.name}</b><small>{template.kind} · {template.formula}{template.dependencyIds.length ? ` · ${template.dependencyIds.length} مراجع` : ""}</small></button><button type="button" onClick={() => deleteTemplate.mutate(template.id)} disabled={deleteTemplate.isPending} aria-label={`حذف ${template.name}`}><Trash2 size={13} /></button></div>) : <p>أنشئ أول Part أو Assembly للاستخدام في عناصر القياس.</p>}</div><form className="template-form" onSubmit={(event) => { event.preventDefault(); submitTemplate(); }}><div className="template-form-heading"><b>{editingTemplateId ? "تعديل القالب" : "قالب جديد"}</b>{editingTemplateId && <Button type="button" variant="outline" size="sm" onClick={resetTemplateForm}>قالب جديد</Button>}</div><select value={templateKind} onChange={(event) => setTemplateKind(event.target.value as "PART" | "ASSEMBLY")} disabled={!!editingTemplateId}><option value="PART">Part</option><option value="ASSEMBLY">Assembly</option></select><Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="اسم القالب" maxLength={160} /><Input value={templateFormula} onChange={(event) => setTemplateFormula(event.target.value)} placeholder="quantity * rate" maxLength={500} /><small className={`formula-diagnostic ${templateFormulaDiagnostic.valid ? "valid" : "invalid"}`} role="status">{templateFormulaDiagnostic.valid ? t("formula.valid") : t(`formula.${templateFormulaDiagnostic.code}` as TranslationKey)}</small><div className="template-form-grid"><Input value={templateUnit} onChange={(event) => setTemplateUnit(event.target.value)} placeholder="الوحدة الناتجة (مثل m²)" maxLength={32} /><Input value={templateRate} onChange={(event) => setTemplateRate(event.target.value)} inputMode="decimal" placeholder="السعر" /></div><fieldset className="template-dependencies"><legend>مراجع القالب</legend><p>تُضاف قيمة كل قالب محدد إلى ناتج القالب الحالي بترتيب حتمي.</p>{templates.filter((template) => template.id !== editingTemplateId).length ? templates.filter((template) => template.id !== editingTemplateId).map((template) => <label key={template.id}><input type="checkbox" checked={templateDependencyIds.includes(template.id)} onChange={(event) => setTemplateDependencyIds((current) => event.target.checked ? [...current, template.id] : current.filter((id) => id !== template.id))} />{template.name}</label>) : <small>احفظ قالباً آخر أولاً ليصبح مرجعاً متاحاً.</small>}</fieldset><small className={`formula-diagnostic ${templateDependencyDiagnostic.valid ? "valid" : "invalid"}`} role="status">{templateDependencyDiagnostic.valid ? t("template.valid") : t(`template.${templateDependencyDiagnostic.code}` as TranslationKey)}{templateDependencyDiagnostic.cycleIds.length ? ` (${templateDependencyDiagnostic.cycleIds.join(" ← ")})` : ""}</small><Button className="workspace-primary full" type="submit" disabled={createTemplate.isPending || updateTemplate.isPending || !templateFormulaDiagnostic.valid || !templateDependencyDiagnostic.valid}>{editingTemplateId ? "حفظ التعديل" : "حفظ القالب"}</Button></form><small className="template-hint">المتغيرات المتاحة: quantity وrate وwaste. العمليات المسموح بها: + − × ÷ والأقواس. المراجع تضيف نواتج القوالب المختارة ولا تسمح بالدورات.</small></section>}
          {isReportOpen && <section className="report-card"><div className="report-card-heading"><div><span className="panel-kicker">QUANTITY REPORT</span><h2>تقرير الصفحة</h2></div><div className="report-card-actions"><Button variant="outline" size="sm" onClick={printPageReport}><Printer size={14} />طباعة</Button><Button variant="outline" size="sm" onClick={downloadReportExcel}><Download size={14} />Excel</Button><Button variant="outline" size="sm" onClick={downloadReportCsv}><Download size={14} />CSV</Button></div></div><div className="report-rows">{reportRows.length ? reportRows.map((row) => <div className="report-row" key={row.id}><div><b>{row.name}</b><small>{row.kind} · {row.status === "VALID" && row.quantity !== null ? formatQuantity(row.quantity, row.unit) : row.diagnostic ?? row.status}</small></div><strong>{row.cost !== null ? new Intl.NumberFormat("en-US", { style: "currency", currency: workspaceQuery.data?.project.currency ?? "USD" }).format(row.cost) : "—"}</strong></div>) : <p>لا توجد عناصر ملتزمة في هذه الصفحة.</p>}</div><div className="report-total"><span>إجمالي الصفحة</span><b>{new Intl.NumberFormat("en-US", { style: "currency", currency: workspaceQuery.data?.project.currency ?? "USD" }).format(projectTotal)}</b></div></section>}
          {tool === "CALIBRATE" && <div className="calibration-card"><span className="panel-kicker">SCALE EVIDENCE</span><h2>معايرة المقياس</h2><p>ضع نقطتين على بعد معروف، ثم أدخل المسافة الحقيقية.</p><div className="calibration-progress"><i className={calibrationPoints.length >= 1 ? "done" : ""} /> <i className={calibrationPoints.length >= 2 ? "done" : ""} /></div><Label>البعد المعروف<Input type="number" min="0.001" step="0.01" value={knownDistance} onChange={(event) => setKnownDistance(event.target.value)} /></Label><div className="unit-picker">{(["m", "ft", "cm", "in"] as const).map((choice) => <button key={choice} className={unit === choice ? "selected" : ""} onClick={() => setUnit(choice)}>{choice}</button>)}</div><Button className="workspace-primary full" onClick={applyCalibration} disabled={calibrationPoints.length !== 2}>اعتماد المقياس <Check size={15} /></Button><div className="scale-context-card"><span>سياقات المقياس المحفوظة</span><select value={page.activeScaleContextId ?? ""} onChange={(event) => { if (projectId && event.target.value) activateScaleContext.mutate({ projectId, pageId: page.id, contextId: event.target.value }); }}><option value="">معايرة غير محفوظة</option>{pageScaleContexts.map((context) => <option key={context.id} value={context.id}>{context.name} · 1:{(Number(context.worldDistance) / Number(context.drawingDistance)).toFixed(3)} {context.unit}</option>)}</select><Input value={scaleContextName} onChange={(event) => setScaleContextName(event.target.value)} placeholder="اسم السياق الجديد (اختياري)" maxLength={80} /><div><Button variant="outline" size="sm" onClick={saveScaleContext} disabled={!calibration || createScaleContext.isPending}>حفظ السياق</Button>{page.activeScaleContextId && <Button variant="outline" size="sm" className="danger-action" onClick={() => { if (projectId && window.confirm("حذف سياق المقياس النشط؟")) deleteScaleContext.mutate({ projectId, pageId: page.id, contextId: page.activeScaleContextId! }); }} disabled={deleteScaleContext.isPending}>حذف النشط</Button>}</div></div></div>}
          {selectedItems.length > 1 && <div className="group-selection-card"><span className="panel-kicker">MULTI-SELECTION</span><h2>{selectedItems.length} عناصر محددة</h2><p>استخدم Shift مع النقر لإضافة عنصر أو إزالته. تعمل الإجراءات أدناه على المجموعة فقط.</p><div className="group-offset-inputs"><Label>إزاحة X<Input inputMode="decimal" value={groupOffset.x} onChange={(event) => setGroupOffset((current) => ({ ...current, x: event.target.value }))} /></Label><Label>إزاحة Y<Input inputMode="decimal" value={groupOffset.y} onChange={(event) => setGroupOffset((current) => ({ ...current, y: event.target.value }))} /></Label></div><div className="inspector-actions"><Button variant="outline" size="sm" onClick={translateSelectedGroup}><Move size={14} />نقل المجموعة</Button><Button variant="outline" size="sm" onClick={duplicateSelectedGroup}><Copy size={14} />نسخ المجموعة</Button><Button variant="outline" size="sm" onClick={deleteSelectedGroup} className="danger-action"><Trash2 size={14} />حذف المجموعة</Button></div></div>}
          {selected && selectedMeasurement && selectedItems.length <= 1 && <div className="selected-card"><div className="selected-title"><span className="item-color" style={{ background: selected.color }} /><div><span className="panel-kicker">{selected.kind}</span><h2>{selected.name}</h2></div></div><div className="quantity-readout"><span>الكمية</span><strong>{selectedMeasurement.status === "VALID" ? formatQuantity(selectedMeasurement.value, selectedMeasurement.unit) : selectedMeasurement.diagnostic === "ROOF_SLOPE_REQUIRED" ? "أدخل ميل السقف" : selectedMeasurement.diagnostic === "VOLUME_DEPTH_REQUIRED" ? "أدخل عمقاً موجباً" : "يلزم ضبط المقياس"}</strong>{(["AREA", "ROOF_AREA", "VOLUME"] as MeasurementKind[]).includes(selected.kind) && selectedMeasurement.status === "VALID" && <small>القيمة الخام: {selectedMeasurement.rawValue.toFixed(2)} وحدة رسم مشتقة</small>}</div>{selected.kind === "ROOF_AREA" && <div className="specialized-inputs"><Label>ارتفاع الميل ({calibration?.unit ?? "وحدة"})<Input type="number" min="0" step="0.01" value={selected.geometry.slopeRise ?? 0} onChange={(event) => updateSelectedGeometryNumber("slopeRise", event.target.value)} onBlur={pushHistory} /></Label><Label>امتداد الميل ({calibration?.unit ?? "وحدة"})<Input type="number" min="0.001" step="0.01" value={selected.geometry.slopeRun ?? 12} onChange={(event) => updateSelectedGeometryNumber("slopeRun", event.target.value)} onBlur={pushHistory} /></Label></div>}{selected.kind === "VOLUME" && <div className="specialized-inputs"><Label>العمق الحقيقي ({calibration?.unit ?? "وحدة"})<Input type="number" min="0.001" step="0.01" value={selected.geometry.depth ?? 1} onChange={(event) => updateSelectedGeometryNumber("depth", event.target.value)} onBlur={pushHistory} /></Label></div>}<Label>القالب<select className="template-select" value={selected.templateId ?? ""} onChange={(event) => updateSelectedTemplate(event.target.value)}><option value="">تسعير يدوي</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.formula}</option>)}</select></Label>{selected.templateId ? <small className="template-assignment">الصيغة: {templates.find((template) => template.id === selected.templateId)?.formula ?? "قالب غير متاح"}</small> : <Label>سعر الوحدة<Input value={selected.rate} inputMode="decimal" onChange={(event) => updateSelectedRate(event.target.value)} onBlur={pushHistory} /></Label>}<div className="cost-readout"><span>تقدير هذا العنصر</span><b>{selectedCost !== null ? new Intl.NumberFormat("en-US", { style: "currency", currency: workspaceQuery.data.project.currency }).format(selectedCost) : "—"}</b></div><div className="inspector-actions"><Button variant="outline" size="sm" onClick={duplicateSelected}><Copy size={14} />نسخ</Button><Button variant="outline" size="sm" onClick={deleteSelected} className="danger-action"><Trash2 size={14} />حذف</Button></div></div>}
          {!selected && tool !== "CALIBRATE" && <div className="inspector-empty"><PenLine size={24} /><h2>ابدأ القياس</h2><p>اختر أداة، واضبط المقياس، ثم انقر داخل الرسم. تظهر الكمية والتكلفة هنا عند التزام العنصر.</p></div>}
          <div className="estimate-summary"><span className="panel-kicker">PAGE ESTIMATE</span><p>مجموع الصفحة</p><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: workspaceQuery.data.project.currency }).format(projectTotal)}</strong><small>{pageItems.length} عناصر مرتبطة بالصفحة · {workspaceQuery.data.commands.length + pendingCommands.length} أمرًا مسجلاً</small></div>
        </aside>
      </div>
    </div>
  );
}

function MeasurementShape({ item, selected, screenScale }: { item: Item; selected: boolean; screenScale: number }) {
  const pixel = 1 / Math.max(screenScale, 0.0001);
  const strokeWidth = (selected ? 4 : 2.5) * pixel;
  if (item.kind === "AREA" || item.kind === "ROOF_AREA" || item.kind === "VOLUME") {
    const rings = item.geometry.rings ?? [];
    return <g fillRule="evenodd"><path d={rings.map((ring) => `${ring.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")} Z`).join(" ")} fill={`${item.color}24`} stroke={item.color} strokeWidth={strokeWidth} fillRule="evenodd" />{rings.flatMap((ring, ringIndex) => ring.map((point, pointIndex) => <circle key={`${ringIndex}-${pointIndex}`} cx={point.x} cy={point.y} r={(selected ? 5 : 3) * pixel} fill={item.color} />))}</g>;
  }
  if (item.kind === "COUNT") return <g>{(item.geometry.marks ?? []).map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r={10 * pixel} fill={`${item.color}44`} stroke={item.color} strokeWidth={strokeWidth} /><text x={point.x} y={point.y + 4 * pixel} textAnchor="middle" fill={item.color} fontSize={10 * pixel}>{index + 1}</text></g>)}</g>;
  const points = item.geometry.points ?? [];
  if (item.kind === "SEGMENT") return <g>{Array.from({ length: Math.floor(points.length / 2) }, (_, index) => <line key={index} x1={points[index * 2]!.x} y1={points[index * 2]!.y} x2={points[index * 2 + 1]!.x} y2={points[index * 2 + 1]!.y} stroke={item.color} strokeWidth={strokeWidth} />)}</g>;
  return <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={item.color} strokeWidth={strokeWidth} />;
}
