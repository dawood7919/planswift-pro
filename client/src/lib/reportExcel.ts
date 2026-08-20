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

export type ExcelQuantityReportLabels = {
  sheetName: string;
  title: string;
  project: string;
  page: string;
  currency: string;
  exportedAt: string;
  headers: [string, string, string, string, string, string, string, string];
  pageTotal: string;
  manualPricing: string;
  validStatus: string;
  rightToLeft: boolean;
};

function statusLabel(row: ReportRow, labels: ExcelQuantityReportLabels) {
  return row.status === "VALID" ? labels.validStatus : row.diagnostic ?? row.status;
}

export function createQuantityReportWorkbook(report: ExcelQuantityReport, labels: ExcelQuantityReportLabels) {
  const matrix: Array<Array<string | number>> = [
    [labels.title],
    [labels.project, report.projectName],
    [labels.page, report.pageName],
    [labels.currency, report.currency],
    [labels.exportedAt, report.generatedAt],
    [],
    labels.headers,
    ...report.rows.map((row) => [row.name, row.kind, row.quantity ?? "", row.unit, row.templateName || labels.manualPricing, row.unitRate ?? "", row.cost ?? "", statusLabel(row, labels)]),
    [],
    [labels.pageTotal, "", "", "", "", "", report.total, ""],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  sheet["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 22 }];
  sheet["!views"] = [{ rightToLeft: labels.rightToLeft }];
  for (const address of ["F8", "G8"]) if (sheet[address]) sheet[address].z = "#,##0.00";
  const totalCell = sheet["G" + (matrix.length)];
  if (totalCell) totalCell.z = "#,##0.00";
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, labels.sheetName);
  return workbook;
}

export function createQuantityReportXlsx(report: ExcelQuantityReport, labels: ExcelQuantityReportLabels): ArrayBuffer {
  return XLSX.write(createQuantityReportWorkbook(report, labels), { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
