import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createQuantityReportWorkbook, createQuantityReportXlsx } from "../client/src/lib/reportExcel";

const report = { projectName: "برج النور", pageName: "الدور الأول", currency: "USD", generatedAt: "2026-08-19", total: 40, rows: [{ id: "item-1", name: "بلاط", kind: "AREA" as const, quantity: 8, unit: "m²", unitRate: 5, cost: 40, templateName: "بلاط أرضي", status: "VALID" as const }] };
const arabicLabels = { sheetName: "تقرير الكميات", title: "تقرير كميات Takeoff", project: "المشروع", page: "الصفحة", currency: "العملة", exportedAt: "تاريخ التصدير", headers: ["العنصر", "النوع", "الكمية", "الوحدة", "القالب", "سعر الوحدة", "التكلفة", "الحالة"] as [string, string, string, string, string, string, string, string], pageTotal: "إجمالي الصفحة", manualPricing: "تسعير يدوي", validStatus: "صالح", rightToLeft: true };

describe("Excel quantity report", () => {
  it("creates an RTL workbook with Arabic headers, report row, and page total", () => {
    const workbook = createQuantityReportWorkbook(report, arabicLabels);
    const sheet = workbook.Sheets["تقرير الكميات"]!;
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as Array<Array<string | number>>;
    expect(workbook.SheetNames).toEqual(["تقرير الكميات"]);
    expect(sheet["!views"]?.[0]?.rightToLeft).toBe(true);
    expect(matrix).toContainEqual(["العنصر", "النوع", "الكمية", "الوحدة", "القالب", "سعر الوحدة", "التكلفة", "الحالة"]);
    expect(matrix).toContainEqual(["بلاط", "AREA", 8, "m²", "بلاط أرضي", 5, 40, "صالح"]);
    expect(matrix).toContainEqual(["إجمالي الصفحة", "", "", "", "", "", 40, ""]);
  });

  it("serializes the workbook to a non-empty XLSX binary", () => {
    expect(createQuantityReportXlsx(report, arabicLabels).byteLength).toBeGreaterThan(1_000);
  });
});
