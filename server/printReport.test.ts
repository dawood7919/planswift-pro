import { describe, expect, it, vi } from "vitest";
import { buildPrintableReportHtml, sendToPrintWindow } from "../shared/takeoff-core/printReport";

const report = { projectName: "مشروع <خاص>", pageName: "صفحة 1", currency: "USD", generatedAt: "2026-08-19T00:00:00.000Z", total: 12, rows: [{ id: "1", name: "بند &", kind: "AREA" as const, quantity: 4, unit: "m²", unitRate: 3, cost: 12, templateName: "", status: "VALID" as const }] };

describe("print report", () => {
  it("creates an escaped Arabic HTML report with a total", () => {
    const html = buildPrintableReportHtml(report);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("مشروع &lt;خاص&gt;");
    expect(html).toContain("بند &amp;");
    expect(html).toContain("إجمالي الصفحة");
  });

  it("writes and prints through the supplied browser window", () => {
    const document = { open: vi.fn(), write: vi.fn(), close: vi.fn() }; const window = { document, focus: vi.fn(), print: vi.fn() };
    expect(sendToPrintWindow(() => window, "<html></html>")).toBe(true);
    expect(document.write).toHaveBeenCalledWith("<html></html>");
    expect(window.print).toHaveBeenCalledOnce();
    expect(sendToPrintWindow(() => null, "<html></html>")).toBe(false);
  });
});
