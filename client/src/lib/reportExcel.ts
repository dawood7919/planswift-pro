import type { ReportRow } from "@shared/takeoff-core/report";
import * as XLSX from "xlsx";

export type ExcelQuantityReport = {
  projectName: string;
  pageName: string;
  currency: string;
  generatedAt: string;
  rows: ReportRow[];
  total: number;
};

function statusLabel(row: ReportRow) {
  return row.status === "VALID" ? "صالح" : row.diagnostic ?? row.status;
}

export function createQuantityReportWorkbook(report: ExcelQuantityReport) {
  const matrix: Array<Array<string | number>> = [
    ["تقرير كميات Takeoff"],
    ["المشروع", report.projectName],
    ["الصفحة", report.pageName],
    ["العملة", report.currency],
    ["تاريخ التصدير", report.generatedAt],
    [],
    ["العنصر", "النوع", "الكمية", "الوحدة", "القالب", "سعر الوحدة", "التكلفة", "الحالة"],
    ...report.rows.map((row) => [row.name, row.kind, row.quantity ?? "", row.unit, row.templateName || "يدوي", row.unitRate ?? "", row.cost ?? "", statusLabel(row)]),
    [],
    ["إجمالي الصفحة", "", "", "", "", "", report.total, ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 22 }];
  sheet["!views"] = [{ rightToLeft: true }];
  for (const address of ["F8", "G8"]) if (sheet[address]) sheet[address].z = "#,##0.00";
  const totalCell = sheet["G" + (matrix.length)];
  if (totalCell) totalCell.z = "#,##0.00";
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "تقرير الكميات");
  return workbook;
}

export function createQuantityReportXlsx(report: ExcelQuantityReport): ArrayBuffer {
  return XLSX.write(createQuantityReportWorkbook(report), { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
