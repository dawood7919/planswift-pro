import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdfPlanStatusOverlay } from "../client/src/components/PdfPlanStatusOverlay";
import { PDF_RENDER_ERROR_MESSAGE } from "../shared/takeoff-core/pdfStatus";

describe("PdfPlanStatusOverlay", () => {
  it("renders a visible alert and recovery control for a failed PDF page", () => {
    const markup = renderToStaticMarkup(createElement(PdfPlanStatusOverlay, { status: "ERROR", error: PDF_RENDER_ERROR_MESSAGE, onRetry: vi.fn() }));
    expect(markup).toContain('class="pdf-plan-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(PDF_RENDER_ERROR_MESSAGE);
    expect(markup).toContain("إعادة محاولة العرض");
  });

  it("renders the loading state without a recovery control", () => {
    const markup = renderToStaticMarkup(createElement(PdfPlanStatusOverlay, { status: "LOADING", error: null, onRetry: vi.fn() }));
    expect(markup).toContain("جارٍ عرض صفحة PDF");
    expect(markup).not.toContain("إعادة محاولة العرض");
  });
});
