// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
const workspace = {
  project: { id: "project-1", name: "مشروع الاختبار", currency: "USD" },
  pages: [{ id: "page-1", name: "المخطط", backgroundUrl: "/source.pdf", pdfPageNumber: 1, documentId: "document-source", scaleDrawingDistance: null, scaleWorldDistance: null, scaleUnit: null }],
  items: [{ id: "item-1", pageId: "page-1", kind: "COUNT", name: "فتحات رئيسية", color: "#f6cf62", geometryJson: JSON.stringify({ marks: [{ x: 120, y: 150 }] }), rate: "0", templateId: null }, { id: "item-2", pageId: "page-1", kind: "COUNT", name: "فتحات ثانوية", color: "#f6cf62", geometryJson: JSON.stringify({ marks: [{ x: 220, y: 150 }] }), rate: "0", templateId: null }],
  commands: [], reviews: [], versions: [{ id: "version-1", label: "قبل التعديل", createdAt: new Date("2026-08-19T00:00:00Z") }], scaleContexts: [{ id: "scale-context-1", pageId: "page-1", name: "مقياس معماري", drawingDistance: "10", worldDistance: "1", unit: "m" }], documents: [{ id: "document-source", originalName: "الأصل.pdf" }, { id: "document-reference", originalName: "مرجع.pdf" }],
};

const mutation = { mutate: vi.fn(), isPending: false };
const templates = [
  { id: "template-a", name: "قالب الأساس", kind: "PART", formula: "quantity * rate", unit: "m²", rate: "10", dependencyIds: ["template-b"], costItems: [] },
  { id: "template-b", name: "قالب التنفيذ", kind: "ASSEMBLY", formula: "quantity * rate", unit: "m²", rate: "5", dependencyIds: [], costItems: [] },
];
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ projects: { get: { invalidate }, }, templates: { list: { invalidate }, folders: { list: { invalidate } } } }),
    projects: {
      get: { useQuery: () => ({ data: workspace, isLoading: false }) },
      saveWorkspace: { useMutation: () => mutation }, addBlankPage: { useMutation: () => mutation }, renamePage: { useMutation: () => mutation }, deletePage: { useMutation: () => mutation }, reorderPages: { useMutation: () => mutation }, exportProjectFile: { useMutation: () => mutation }, createVersion: { useMutation: () => mutation }, restoreVersion: { useMutation: () => mutation }, createScaleContext: { useMutation: () => mutation }, activateScaleContext: { useMutation: () => mutation }, deleteScaleContext: { useMutation: () => mutation }, createReview: { useMutation: () => mutation }, deleteReview: { useMutation: () => mutation }, createAnnotation: { useMutation: () => mutation }, deleteAnnotation: { useMutation: () => mutation },
    },
    templates: { list: { useQuery: () => ({ data: templates }) }, create: { useMutation: () => mutation }, update: { useMutation: () => mutation }, delete: { useMutation: () => mutation }, folders: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => mutation }, delete: { useMutation: () => mutation } }, costItems: { create: { useMutation: () => mutation }, delete: { useMutation: () => mutation } } },
  },
}));
vi.mock("wouter", () => ({ useRoute: () => [true, { projectId: "project-1" }], useLocation: () => ["/workspace/project-1", vi.fn()] }));
vi.mock("@/components/PdfPlanLayer", () => ({ default: () => null }));
vi.mock("@/components/PdfThumbnail", () => ({ default: () => null }));
vi.mock("@/components/PdfReviewOverlay", () => ({ default: () => null }));

import WorkspacePage from "../client/src/pages/WorkspacePage";

describe("WorkspacePage search integration", () => {
  beforeEach(() => { cleanup(); mutation.mutate.mockClear(); });

  function openTemplateManager(container: HTMLElement) {
    const templateButton = [...container.querySelectorAll<HTMLButtonElement>(".topbar-actions button")].find((button) => button.textContent?.includes("القوالب"));
    expect(templateButton).toBeTruthy();
    fireEvent.click(templateButton!);
  }

  it("selects the measurement and returns to SELECT after clicking a search result", async () => {
    render(createElement(WorkspacePage));
    await waitFor(() => expect(document.querySelector(".item-search-results button")).toBeTruthy());
    const panButton = [...document.querySelectorAll(".tool-rail button")].find((button) => button.textContent?.includes("تحريك"));
    expect(panButton).toBeTruthy();
    fireEvent.click(panButton!);
    expect(screen.getByText(/تحريك: سحب مساحة الرسم/)).toBeTruthy();
    fireEvent.click([...document.querySelectorAll(".item-search-results button")].find((button) => button.textContent?.includes("فتحات رئيسية"))!);
    expect(screen.getByText(/تحديد: اختيار عنصر/)).toBeTruthy();
    expect(document.querySelector(".selected-card")?.textContent).toContain("فتحات رئيسية");
    expect(workspace.items[0]?.geometryJson).toBe(JSON.stringify({ marks: [{ x: 120, y: 150 }] }));
  });

  it("shows a desktop working set with pages, takeoffs, tools, canvas, and template browser", () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    expect(root.getByLabelText("الصفحات والقياسات")).toBeTruthy();
    expect(root.getByText("قياسات الصفحة النشطة")).toBeTruthy();
    expect(root.getByRole("application", { name: "مساحة رسم هندسية تفاعلية" })).toBeTruthy();
    expect(root.getByText("القوالب، الأجزاء، المدخلات")).toBeTruthy();
  });

  it("updates the selected item multiplier and records an audit command", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    fireEvent.click([...view.container.querySelectorAll(".item-search-results button")].find((button) => button.textContent?.includes("فتحات رئيسية"))!);
    const multiplier = root.getByRole("textbox", { name: "عامل تكرار العنصر" });
    fireEvent.change(multiplier, { target: { value: "3" } });
    fireEvent.blur(multiplier);
    expect((multiplier as HTMLInputElement).value).toBe("3");
    const saveButton = view.container.querySelector("header .workspace-primary");
    expect(saveButton).toBeTruthy();
    fireEvent.click(saveButton!);
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ id: "item-1", multiplier: "3" })]), commandEvents: expect.arrayContaining([expect.objectContaining({ type: "SET_TAKEOFF_MULTIPLIER" })]) }));
  });

  it("creates a text annotation at the chosen canvas position", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    fireEvent.change(root.getByPlaceholderText("نص الملاحظة"), { target: { value: "تأكد من منسوب السقف" } });
    const noteTool = [...view.container.querySelectorAll(".tool-rail button")].find((button) => button.textContent?.includes("ملاحظة"));
    expect(noteTool).toBeTruthy();
    fireEvent.click(noteTool!);
    const canvas = root.getByRole("application");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 720 }) });
    Object.defineProperty(canvas, "setPointerCapture", { value: vi.fn() });
    const annotationDown = createEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", button: 0 });
    Object.defineProperties(annotationDown, { clientX: { value: 320 }, clientY: { value: 180 } });
    fireEvent(canvas, annotationDown);
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", pageId: "page-1", text: "تأكد من منسوب السقف", x: "320.0000", y: "180.0000", color: "#ff9c7b" }));
  });

  it("saves the selected reference document as a project review", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    await waitFor(() => expect(root.getByRole("combobox")).toBeTruthy());
    fireEvent.change(root.getByRole("combobox"), { target: { value: "document-reference" } });
    fireEvent.click(root.getByRole("button", { name: /حفظ الوثيقة المختارة/ }));
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", sourcePageId: "page-1", referenceDocumentId: "document-reference", label: "مراجعة المخطط" }));
  });

  it("shows the Excel export action when the page report is opened", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    fireEvent.click(root.getByRole("button", { name: /تقرير/ }));
    await waitFor(() => expect(root.getByRole("button", { name: "Excel" })).toBeTruthy());
  });

  it("activates a saved scale context from the calibration card", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    const calibrateButton = [...view.container.querySelectorAll(".tool-rail button")].find((button) => button.textContent?.includes("معايرة"));
    fireEvent.click(calibrateButton!);
    const scaleSelect = root.getAllByRole("combobox").find((select) => select.textContent?.includes("مقياس معماري"));
    expect(scaleSelect).toBeTruthy();
    fireEvent.change(scaleSelect!, { target: { value: "scale-context-1" } });
    expect(mutation.mutate).toHaveBeenCalledWith({ projectId: "project-1", pageId: "page-1", contextId: "scale-context-1" });
  });

  it("shows formula diagnostics and prevents saving an invalid template formula", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    openTemplateManager(view.container);
    fireEvent.change(root.getByPlaceholderText("quantity * rate"), { target: { value: "quantity * secret" } });
    expect(root.getAllByRole("status").some((status) => status.textContent?.includes("متغير غير مسموح"))).toBe(true);
    expect((root.getByRole("button", { name: "حفظ القالب" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a dependency cycle and disables saving it before calling the API", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    openTemplateManager(view.container);
    const editButton = [...view.container.querySelectorAll<HTMLButtonElement>(".template-edit")].find((button) => button.textContent?.includes("قالب التنفيذ"));
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton!);
    fireEvent.click(root.getByLabelText("قالب الأساس"));
    expect([...root.getAllByRole("status")].some((status) => status.textContent?.includes("حلقة بين القوالب"))).toBe(true);
    expect((root.getByRole("button", { name: "حفظ التعديل" }) as HTMLButtonElement).disabled).toBe(true);
    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("creates an auditable material cost item for the template being edited", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    openTemplateManager(view.container);
    const editButton = [...view.container.querySelectorAll(".template-edit")].find((button) => button.textContent?.includes("قالب الأساس"));
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton!);
    expect(root.getByText(/مواد وعمالة القالب/)).toBeTruthy();
    fireEvent.change(root.getByPlaceholderText("اسم البند"), { target: { value: "بلاط" } });
    fireEvent.change(root.getByPlaceholderText("سعر الوحدة"), { target: { value: "8" } });
    fireEvent.click(root.getByRole("button", { name: /إضافة بند تكلفة/ }));
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({ templateId: "template-a", kind: "MATERIAL", name: "بلاط", quantityFormula: "quantity", rate: "8", wastePercent: "0" }));
  });

  it("creates and safely restores a project version from the inspector", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    fireEvent.change(root.getByPlaceholderText("اسم اللقطة (اختياري)"), { target: { value: "بعد المراجعة" } });
    fireEvent.click(root.getByRole("button", { name: "حفظ لقطة" }));
    expect(mutation.mutate).toHaveBeenCalledWith({ projectId: "project-1", label: "بعد المراجعة" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(root.getByRole("button", { name: "استعادة آمنة" }));
    expect(mutation.mutate).toHaveBeenCalledWith({ projectId: "project-1", versionId: "version-1" });
  });

  it("keeps core workspace actions available at a narrow mobile width", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    expect(root.getByRole("application")).toBeTruthy();
    const snapButton = root.getByRole("button", { name: /التقاط/ });
    fireEvent.click(snapButton);
    expect(snapButton.getAttribute("aria-pressed")).toBe("false");
    fireEvent.change(root.getByPlaceholderText("اسم، نوع، أو قالب"), { target: { value: "ثانوية" } });
    fireEvent.click([...view.container.querySelectorAll(".item-search-results button")].find((button) => button.textContent?.includes("فتحات ثانوية"))!);
    expect(view.container.querySelector(".selected-card")?.textContent).toContain("فتحات ثانوية");
  });

  it("selects, duplicates, and deletes a measurement group using Shift selection", async () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    const canvas = root.getByRole("application");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 1000, height: 720 }) });
    Object.defineProperty(canvas, "setPointerCapture", { value: vi.fn() });
    const firstDown = createEvent.pointerDown(canvas, { pointerId: 1 });
    Object.defineProperties(firstDown, { clientX: { value: 120 }, clientY: { value: 150 } });
    fireEvent(canvas, firstDown);
    await waitFor(() => expect(view.container.querySelector(".selected-card")).toBeTruthy());
    const secondDown = createEvent.pointerDown(canvas, { pointerId: 2, shiftKey: true });
    Object.defineProperties(secondDown, { clientX: { value: 220 }, clientY: { value: 150 }, shiftKey: { value: true } });
    fireEvent(canvas, secondDown);
    await waitFor(() => expect(view.container.querySelector(".group-selection-card")?.textContent).toContain("2 عناصر محددة"));
    const group = view.container.querySelector(".group-selection-card");
    fireEvent.click(within(group!).getByRole("button", { name: /نقل المجموعة/ }));
    expect([...canvas.querySelectorAll("circle")].some((circle) => circle.getAttribute("cx") === "130")).toBe(true);
    fireEvent.click(within(group!).getByRole("button", { name: /نسخ المجموعة/ }));
    expect(root.getByText(/4 عناصر ملتزمة/)).toBeTruthy();
    fireEvent.click(within(view.container.querySelector(".group-selection-card")!).getByRole("button", { name: /حذف المجموعة/ }));
    expect(root.getByText(/2 عناصر ملتزمة/)).toBeTruthy();
  });
});
