import type { ReportRow } from "./report";

export type PrintableReport = {
  projectName: string;
  pageName: string;
  currency: string;
  rows: ReportRow[];
  total: number;
  generatedAt: string;
};

export type PrintableReportLabels = {
  language: string;
  direction: "rtl" | "ltr";
  title: string;
  headers: [string, string, string, string, string, string, string];
  pageTotal: string;
  manualPricing: string;
  generatedAt: string;
  sourceNote: string;
  formatQuantity: (quantity: number | null, unit: string) => string;
  formatCurrency: (amount: number | null, currency: string) => string;
  formatStatus: (status: string, diagnostic?: string | null) => string;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export function buildPrintableReportHtml(report: PrintableReport, labels: PrintableReportLabels): string {
  const rows = report.rows.map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.kind)}</td><td>${escapeHtml(labels.formatQuantity(row.quantity, row.unit))}</td><td>${escapeHtml(row.unit)}</td><td>${escapeHtml(row.templateName || labels.manualPricing)}</td><td>${escapeHtml(labels.formatCurrency(row.cost, report.currency))}</td><td>${escapeHtml(labels.formatStatus(row.status, row.diagnostic))}</td></tr>`).join("");
  const [item, kind, quantity, unit, template, cost, status] = labels.headers;
  const textAlign = labels.direction === "rtl" ? "right" : "left";
  return `<!doctype html><html lang="${escapeHtml(labels.language)}" dir="${labels.direction}"><head><meta charset="utf-8"><title>${escapeHtml(labels.title)} · ${escapeHtml(report.projectName)}</title><style>body{font-family:Arial,sans-serif;color:#173946;margin:34px;background:#fff}header{border-bottom:3px solid #c9ff4a;padding-bottom:14px;margin-bottom:24px}h1{margin:0;font-size:25px}p{margin:6px 0;color:#557078;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#102b39;color:#fff;text-align:${textAlign};padding:10px}td{border-bottom:1px solid #d9e1df;padding:9px;text-align:${textAlign}}tfoot td{font-weight:700;background:#eaffbe}.foot{margin-top:22px;color:#718187;font-size:10px}@media print{body{margin:14mm}thead{display:table-header-group}}</style></head><body><header><h1>${escapeHtml(labels.title)}</h1><p>${escapeHtml(report.projectName)} · ${escapeHtml(report.pageName)}</p></header><table><thead><tr><th>${escapeHtml(item)}</th><th>${escapeHtml(kind)}</th><th>${escapeHtml(quantity)}</th><th>${escapeHtml(unit)}</th><th>${escapeHtml(template)}</th><th>${escapeHtml(cost)}</th><th>${escapeHtml(status)}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="5">${escapeHtml(labels.pageTotal)}</td><td>${escapeHtml(labels.formatCurrency(report.total, report.currency))}</td><td></td></tr></tfoot></table><p class="foot">${escapeHtml(labels.generatedAt)} ${escapeHtml(report.generatedAt)} · ${escapeHtml(labels.sourceNote)}</p></body></html>`;
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
