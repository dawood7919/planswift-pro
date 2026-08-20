// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, createEvent, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidate = vi.fn();
const mutation = { mutate: vi.fn(), isPending: false };

/** A page carrying geometry from before page-anchored coordinates existed. */
const legacyPage = {
  id: "page-1",
  name: "المخطط القديم",
  backgroundUrl: "/source.pdf",
  pdfPageNumber: 1,
  documentId: "document-source",
  scaleDrawingDistance: "100",
  scaleWorldDistance: "5",
  scaleUnit: "m",
  pageWidth: "2000.0000",
  pageHeight: "1440.0000",
  pageRotation: 0,
  geometrySpace: "LEGACY_VIEWBOX",
};

const workspace = {
  project: { id: "project-1", name: "مشروع قديم", currency: "USD" },
  pages: [legacyPage],
  items: [{ id: "item-1", pageId: "page-1", kind: "COUNT", name: "علامات", color: "#f6cf62", geometryJson: JSON.stringify({ marks: [{ x: 500, y: 360 }] }), rate: "0", multiplier: "1", templateId: null }],
  commands: [], reviews: [], versions: [], scaleContexts: [], documents: [], annotations: [],
};

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ projects: { get: { invalidate } }, templates: { list: { invalidate }, folders: { list: { invalidate } } } }),
    projects: {
      get: { useQuery: () => ({ data: workspace, isLoading: false }) },
      saveWorkspace: { useMutation: () => mutation }, addBlankPage: { useMutation: () => mutation }, renamePage: { useMutation: () => mutation }, deletePage: { useMutation: () => mutation }, reorderPages: { useMutation: () => mutation }, exportProjectFile: { useMutation: () => mutation }, createVersion: { useMutation: () => mutation }, restoreVersion: { useMutation: () => mutation }, createScaleContext: { useMutation: () => mutation }, activateScaleContext: { useMutation: () => mutation }, deleteScaleContext: { useMutation: () => mutation }, createReview: { useMutation: () => mutation }, deleteReview: { useMutation: () => mutation }, createAnnotation: { useMutation: () => mutation }, deleteAnnotation: { useMutation: () => mutation }, migratePageGeometry: { useMutation: () => mutation },
    },
    auth: { createNativeSession: { useMutation: () => mutation } },
    templates: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => mutation }, update: { useMutation: () => mutation }, delete: { useMutation: () => mutation }, folders: { list: { useQuery: () => ({ data: [] }) }, create: { useMutation: () => mutation }, delete: { useMutation: () => mutation } }, costItems: { create: { useMutation: () => mutation }, delete: { useMutation: () => mutation } } },
  },
}));
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get() { return 2000; } });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return 1440; } });
vi.mock("wouter", () => ({ useRoute: () => [true, { projectId: "project-1" }], useLocation: () => ["/workspace/project-1", vi.fn()] }));
vi.mock("@/components/PdfPlanLayer", () => ({ default: () => null }));
vi.mock("@/components/PdfThumbnail", () => ({ default: () => null }));
vi.mock("@/components/PdfReviewOverlay", () => ({ default: () => null }));

import WorkspacePage from "../client/src/pages/WorkspacePage";

describe("legacy coordinate space", () => {
  beforeEach(() => { cleanup(); mutation.mutate.mockReset(); invalidate.mockReset(); });

  it("warns that the page's quantities cannot be trusted", () => {
    const view = render(createElement(WorkspacePage));
    const banner = view.container.querySelector(".legacy-space-banner");
    expect(banner).toBeTruthy();
    expect(banner!.textContent).toContain("غير موثوقة");
  });

  it("places legacy geometry on the page it was traced over", () => {
    const view = render(createElement(WorkspacePage));
    // A mark stored at the centre of the 1000x720 viewBox belongs at the centre of the page.
    const mark = view.container.querySelector(".takeoff-canvas circle")!;
    expect(Number(mark.getAttribute("cx"))).toBeCloseTo(1000, 6);
    expect(Number(mark.getAttribute("cy"))).toBeCloseTo(720, 6);
  });

  it("refuses new measurements until the page is converted", () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    const countTool = [...view.container.querySelectorAll(".tool-rail button")].find((button) => button.textContent?.includes("Count"));
    fireEvent.click(countTool!);
    const canvas = root.getByRole("application");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 2000, height: 1440 }) });
    Object.defineProperty(canvas, "setPointerCapture", { value: vi.fn() });
    const down = createEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", button: 0 });
    Object.defineProperties(down, { clientX: { value: 400 }, clientY: { value: 400 } });
    fireEvent(canvas, down);
    // No draft point may be committed while the page's space is ambiguous.
    expect(view.container.querySelectorAll(".takeoff-canvas circle")).toHaveLength(1);
  });

  it("sends the resolved page size when converting the page", () => {
    const view = render(createElement(WorkspacePage));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const convert = [...view.container.querySelectorAll(".legacy-space-banner button")][0]!;
    fireEvent.click(convert);
    expect(mutation.mutate).toHaveBeenCalledWith({ projectId: "project-1", pageId: "page-1", pageWidth: 2000, pageHeight: 1440 });
  });

  it("refuses to drag a vertex, which would mix the two coordinate spaces", () => {
    const view = render(createElement(WorkspacePage));
    const root = within(view.container);
    const canvas = root.getByRole("application");
    Object.defineProperty(canvas, "getBoundingClientRect", { value: () => ({ left: 0, top: 0, width: 2000, height: 1440 }) });
    Object.defineProperty(canvas, "setPointerCapture", { value: vi.fn() });
    // Press exactly on the displayed vertex, then drag well away from it.
    const down = createEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", button: 0 });
    Object.defineProperties(down, { clientX: { value: 1000 }, clientY: { value: 720 } });
    fireEvent(canvas, down);
    const move = createEvent.pointerMove(canvas, { pointerId: 1, pointerType: "mouse" });
    Object.defineProperties(move, { clientX: { value: 1400 }, clientY: { value: 900 } });
    fireEvent(canvas, move);
    const mark = view.container.querySelector(".takeoff-canvas circle")!;
    expect(Number(mark.getAttribute("cx"))).toBeCloseTo(1000, 6);
    expect(Number(mark.getAttribute("cy"))).toBeCloseTo(720, 6);
  });
});
