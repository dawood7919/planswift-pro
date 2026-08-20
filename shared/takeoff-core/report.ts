import { calculateMeasurement, measurementUnitCode, type CalibrationScale, type MeasurementGeometry, type MeasurementKind } from "./index";
import { evaluateFormula } from "./formula";
import { evaluateTemplateWithDependencies, type TemplateDependencyNode } from "./templateDeps";

export type ReportSourceItem = {
  id: string;
  name: string;
  kind: MeasurementKind;
  geometry: MeasurementGeometry;
  rate: string;
  multiplier?: string | number;
  template?: {
    id: string;
    name: string;
    formula: string;
    rate: string | number;
    dependencyIds?: string[];
    costItems?: Array<{ id: string; kind: "MATERIAL" | "LABOR" | "EQUIPMENT"; name: string; quantityFormula: string; unit: string; rate: string | number; wastePercent: string | number }>;
  } | null;
};

export type CostBreakdownRow = {
  id: string;
  kind: "TEMPLATE" | "MATERIAL" | "LABOR" | "EQUIPMENT";
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  wastePercent: number;
  cost: number;
};

export type ReportRow = {
  id: string;
  name: string;
  kind: MeasurementKind;
  quantity: number | null;
  unit: string;
  unitRate: number | null;
  cost: number | null;
  costBreakdown: CostBreakdownRow[];
  templateName: string;
  status: "VALID" | "UNSCALED" | "INVALID";
  diagnostic?: string;
};

export function buildQuantityReport(items: ReportSourceItem[], scale?: CalibrationScale | null, allTemplates: TemplateDependencyNode[] = []): ReportRow[] {
  return items.map((item) => {
    const result = calculateMeasurement(item.kind, item.geometry, scale);
    if (result.status !== "VALID") return { id: item.id, name: item.name, kind: item.kind, quantity: null, unit: measurementUnitCode(result.unit), unitRate: null, cost: null, costBreakdown: [], templateName: item.template?.name ?? "", status: result.status, diagnostic: result.diagnostic };
    const quantity = result.value * Number(item.multiplier ?? 1);
    const template = item.template;
    const unitRate = Number(template?.rate ?? item.rate);
    try {
      const baseCost = template
        ? allTemplates.length
          ? evaluateTemplateWithDependencies(template.id, allTemplates, { quantity, rate: unitRate, waste: 0 }).value
          : evaluateFormula(template.formula, { quantity, rate: unitRate, waste: 0 })
        : quantity * unitRate;
      const costBreakdown: CostBreakdownRow[] = [{ id: template?.id ?? item.id, kind: "TEMPLATE", name: template?.name ?? "MANUAL_PRICING", quantity, unit: measurementUnitCode(result.unit), rate: unitRate, wastePercent: 0, cost: baseCost }];
      for (const costItem of template?.costItems ?? []) {
        const wastePercent = Number(costItem.wastePercent);
        const componentQuantity = evaluateFormula(costItem.quantityFormula, { quantity, rate: Number(costItem.rate), waste: wastePercent / 100 });
        const cost = componentQuantity * Number(costItem.rate) * (1 + wastePercent / 100);
        costBreakdown.push({ id: costItem.id, kind: costItem.kind, name: costItem.name, quantity: componentQuantity, unit: costItem.unit, rate: Number(costItem.rate), wastePercent, cost });
      }
      const cost = costBreakdown.reduce((total, entry) => total + entry.cost, 0);
      return { id: item.id, name: item.name, kind: item.kind, quantity, unit: measurementUnitCode(result.unit), unitRate, cost, costBreakdown, templateName: template?.name ?? "", status: "VALID" };
    } catch (error) {
      return { id: item.id, name: item.name, kind: item.kind, quantity, unit: measurementUnitCode(result.unit), unitRate, cost: null, costBreakdown: [], templateName: template?.name ?? "", status: "INVALID", diagnostic: error instanceof Error ? error.message : "REPORT_CALCULATION_FAILED" };
    }
  });
}

export function reportTotal(rows: ReportRow[]): number {
  return rows.reduce((total, row) => total + (row.cost ?? 0), 0);
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Creates UTF-8 CSV content that preserves Arabic labels and quotes unsafe cells. */
export type CsvReportLabels = { headers: [string, string, string, string, string, string, string, string, string]; pageTotal: string };

export function reportToCsv(rows: ReportRow[], total: number, currency: string, labels: CsvReportLabels): string {
  const header = labels.headers;
  const content = rows.map((row) => [row.name, row.kind, row.quantity, row.unit, row.templateName, row.unitRate, row.cost, row.status, row.diagnostic ?? ""].map(csvEscape).join(","));
  content.push([labels.pageTotal, "", "", "", "", "", total, currency, ""].map(csvEscape).join(","));
  return `\uFEFF${header.map(csvEscape).join(",")}\n${content.join("\n")}\n`;
}
