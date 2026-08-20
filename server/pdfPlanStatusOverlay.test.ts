import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: (key: string) => ({ "pdf.loading": "جارٍ عرض صفحة PDF…", "pdf.retry": "إعادة محاولة العرض" }[key] ?? key) }) }));
import { PdfPlanStatusOverlay } from "../client/src/components/PdfPlanStatusOverlay";

describe("PdfPlanStatusOverlay", () => {
  it("renders a visible alert and recovery control for a failed PDF page", () => {
    const markup = renderToStaticMarkup(createElement(PdfPlanStatusOverlay, { status: "ERROR", error: "تعذر عرض صفحة PDF. تأكد من أن الملف صالح ثم أعد المحاولة.", onRetry: vi.fn() }));
    expect(markup).toContain('class="pdf-plan-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("تعذر عرض صفحة PDF");
    expect(markup).toContain("إعادة محاولة العرض");
  });

  it("renders the loading state without a recovery control", () => {
    const markup = renderToStaticMarkup(createElement(PdfPlanStatusOverlay, { status: "LOADING", error: null, onRetry: vi.fn() }));
    expect(markup).toContain("جارٍ عرض صفحة PDF");
    expect(markup).not.toContain("إعادة محاولة العرض");
  });
});
