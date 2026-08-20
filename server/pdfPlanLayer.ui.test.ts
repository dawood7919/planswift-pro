// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument: pdfMocks.getDocument, GlobalWorkerOptions: {} }));
vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, string | number>) => ({ "pdf.loading": "جارٍ عرض صفحة PDF…", "pdf.error": "تعذر عرض صفحة PDF. تأكد من أن الملف صالح ثم أعد المحاولة.", "pdf.retry": "إعادة محاولة العرض", "pdf.pageLabel": `صفحة PDF رقم ${values?.pageNumber ?? ""}` }[key] ?? key) }) }));

import PdfPlanLayer from "../client/src/components/PdfPlanLayer";

describe("PdfPlanLayer failure recovery", () => {
  afterEach(() => { pdfMocks.getDocument.mockReset(); vi.unstubAllGlobals(); });

  it("renders the actual error overlay and retries after a PDF load failure", async () => {
    pdfMocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("load failed")), destroy: vi.fn() }));
    render(createElement(PdfPlanLayer, { url: "/invalid.pdf", pageNumber: 1, pageSize: { width: 320, height: 480 }, viewport: { scale: 1, offsetX: 0, offsetY: 0 } }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("تعذر عرض صفحة PDF"));
    fireEvent.click(screen.getByRole("button", { name: "إعادة محاولة العرض" }));
    await waitFor(() => expect(pdfMocks.getDocument).toHaveBeenCalledTimes(2));
  });

  it("renders a successful PDF page behind the shared viewport transform", async () => {
    const pageRender = vi.fn(() => ({ promise: Promise.resolve() }));
    const cleanup = vi.fn();
    pdfMocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve({ getPage: vi.fn(() => Promise.resolve({ getViewport: vi.fn(() => ({ width: 320, height: 480 })), render: pageRender, cleanup: vi.fn() })), cleanup }), destroy: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    const view = render(createElement(PdfPlanLayer, { url: "/valid.pdf", pageNumber: 2, pageSize: { width: 320, height: 480 }, viewport: { scale: 1, offsetX: 10, offsetY: -5 } }));
    await waitFor(() => expect(pageRender).toHaveBeenCalledTimes(1));
    const canvas = view.container.querySelector("canvas")!;
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(480);
    expect(view.container.querySelector(".pdf-plan-loading")).toBeNull();
    expect(canvas.getAttribute("style")).toContain("left: 10px");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
