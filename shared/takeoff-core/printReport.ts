import type { ReportRow } from "./report";

export type PrintableReport = {
  projectName: string;
  pageName: string;
  currency: string;
  rows: ReportRow[];
  total: number;
  generatedAt: string;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function money(value: number | null, currency: string) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function buildPrintableReportHtml(report: PrintableReport): string {
  const rows = report.rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.kind)}</td><td>${row.quantity === null ? "—" : escapeHtml(row.quantity.toFixed(3))}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.templateName || "يدوي")}</td><td>${escapeHtml(money(row.cost, report.currency))}</td><td>${escapeHtml(row.status === "VALID" ? "صالح" : row.diagnostic ?? row.status)}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${escapeHtml(report.projectName)}</title><style>body{font-family:Arial,sans-serif;color:#173946;margin:34px;background:#fff}header{border-bottom:3px solid #c9ff4a;padding-bottom:14px;margin-bottom:24px}h1{margin:0;font-size:25px}p{margin:6px 0;color:#557078;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#102b39;color:#fff;text-align:right;padding:10px}td{border-bottom:1px solid #d9e1df;padding:9px;text-align:right}tfoot td{font-weight:700;background:#eaffbe}.foot{margin-top:22px;color:#718187;font-size:10px}@media print{body{margin:14mm}thead{display:table-header-group}}</style></head><body><header><h1>تقرير كميات Takeoff</h1><p>${escapeHtml(report.projectName)} · ${escapeHtml(report.pageName)}</p></header><table><thead><tr><th>العنصر</th><th>النوع</th><th>الكمية</th><th>الوحدة</th><th>القالب</th><th>التكلفة</th><th>الحالة</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="5">إجمالي الصفحة</td><td>${escapeHtml(money(report.total, report.currency))}</td><td></td></tr></tfoot></table><p class="foot">تم الإنشاء في ${escapeHtml(report.generatedAt)} · الحسابات مستمدة من عناصر القياس المحفوظة.</p></body></html>`;
}

export type PrintWindow = { document: { open: () => void; write: (html: string) => void; close: () => void }; focus: () => void; print: () => void };

export function sendToPrintWindow(openWindow: () => PrintWindow | null, html: string): boolean {
  const target = openWindow();
  if (!target) return false;
  target.document.open();
  target.document.write(html);
  target.document.close();
  target.focus();
  target.print();
  return true;
}
