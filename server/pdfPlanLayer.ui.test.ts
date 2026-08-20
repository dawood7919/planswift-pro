// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument: pdfMocks.getDocument, GlobalWorkerOptions: {} }));

import PdfPlanLayer from "../client/src/components/PdfPlanLayer";
import { PDF_RENDER_ERROR_MESSAGE } from "../shared/takeoff-core/pdfStatus";
import { createPageViewport } from "../shared/takeoff-core/viewport";

const page = { width: 800, height: 600 };
const viewport = createPageViewport(page, { width: 1200, height: 900 }, 1.5, { x: 10, y: -5 });

describe("PdfPlanLayer failure recovery", () => {
  afterEach(() => { pdfMocks.getDocument.mockReset(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renders the actual error overlay and retries after a PDF load failure", async () => {
    pdfMocks.getDocument.mockImplementation(() => ({ promise: Promise.reject(new Error("load failed")), destroy: vi.fn() }));
    render(createElement(PdfPlanLayer, { url: "/invalid.pdf", pageNumber: 1, page, viewport }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(PDF_RENDER_ERROR_MESSAGE));
    fireEvent.click(screen.getByRole("button", { name: "إعادة محاولة العرض" }));
    await waitFor(() => expect(pdfMocks.getDocument).toHaveBeenCalledTimes(2));
  });

  it("sizes and positions the raster from the shared page viewport", async () => {
    const pageRender = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    const cleanup = vi.fn();
    pdfMocks.getDocument.mockImplementation(() => ({
      promise: Promise.resolve({
        getPage: vi.fn(() => Promise.resolve({ getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: page.width * scale, height: page.height * scale })), render: pageRender })),
        cleanup,
      }),
      destroy: vi.fn(),
    }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);

    const view = render(createElement(PdfPlanLayer, { url: "/valid.pdf", pageNumber: 2, page, viewport }));
    await waitFor(() => expect(pageRender).toHaveBeenCalledTimes(1));

    const canvas = view.container.querySelector("canvas")!;
    // CSS size follows the viewport exactly, so the raster stays registered with the overlay.
    expect(canvas.style.width).toBe(`${page.width * viewport.scale}px`);
    expect(canvas.style.height).toBe(`${page.height * viewport.scale}px`);
    expect(canvas.style.transform).toBe(`translate(${viewport.offsetX}px, ${viewport.offsetY}px)`);
    expect(view.container.querySelector(".pdf-plan-loading")).toBeNull();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("waits for a measured viewport instead of rasterising into a zero-sized layer", () => {
    const unmeasured = createPageViewport(page, { width: 0, height: 0 }, 1, { x: 0, y: 0 });
    render(createElement(PdfPlanLayer, { url: "/valid.pdf", pageNumber: 1, page, viewport: unmeasured }));
    expect(pdfMocks.getDocument).not.toHaveBeenCalled();
  });
});
