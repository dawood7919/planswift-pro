import type { CalibrationScale, MeasurementKind } from "./index";
import { buildQuantityReport, reportTotal, type ReportRow, type ReportSourceItem } from "./report";
import type { TemplateDependencyNode } from "./templateDeps";

/**
 * Project-wide roll-up.
 *
 * Every page carries its own calibration, so quantities can only be summed per page and then
 * aggregated by unit — never by adding raw geometry across pages. Pages whose geometry is
 * still in the legacy coordinate space are reported separately rather than folded into the
 * totals, because their quantities are known to be untrustworthy.
 */

export type RollupPage = {
  id: string;
  name: string;
  pdfPageNumber?: number | null;
  scaleDrawingDistance: string | number | null;
  scaleWorldDistance: string | number | null;
  scaleUnit: string | null;
  geometrySpace?: "LEGACY_VIEWBOX" | "PAGE_POINTS" | null;
};

export type RollupItem = ReportSourceItem & { pageId: string };

export type PageRollup = {
  page: RollupPage;
  rows: ReportRow[];
  cost: number;
  /** True when this page's geometry predates page-anchored coordinates. */
  untrusted: boolean;
};

export type QuantityTotal = { unit: string; value: number; itemCount: number };

export type ProjectRollup = {
  pages: PageRollup[];
  /** Summed only over pages with trustworthy geometry. */
  cost: number;
  quantities: QuantityTotal[];
  untrustedPageCount: number;
  uncalibratedPageCount: number;
};

/** Rebuilds a page's calibration from its stored scale, or null when it has none. */
export function pageCalibration(page: RollupPage): CalibrationScale | null {
  const drawingDistance = Number(page.scaleDrawingDistance);
  const worldDistance = Number(page.scaleWorldDistance);
  const unit = page.scaleUnit as CalibrationScale["unit"] | null;
  if (!unit || !Number.isFinite(drawingDistance) || !Number.isFinite(worldDistance) || drawingDistance <= 0 || worldDistance <= 0) {
    return null;
  }
  return { drawingDistance, worldDistance, unit, factor: worldDistance / drawingDistance };
}

export function isUntrustedPage(page: RollupPage): boolean {
  return (page.geometrySpace ?? "LEGACY_VIEWBOX") === "LEGACY_VIEWBOX";
}

/** Groups measurement kinds the way an estimator reads them: area, length, count, volume. */
export function quantityGroupFor(kind: MeasurementKind): "AREA" | "LENGTH" | "COUNT" | "VOLUME" {
  if (kind === "AREA" || kind === "ROOF_AREA") return "AREA";
  if (kind === "VOLUME") return "VOLUME";
  if (kind === "COUNT") return "COUNT";
  return "LENGTH";
}

export function buildProjectRollup(
  pages: RollupPage[],
  items: RollupItem[],
  templates: TemplateDependencyNode[] = [],
): ProjectRollup {
  const pageRollups = pages.map<PageRollup>((page) => {
    const rows = buildQuantityReport(items.filter((item) => item.pageId === page.id), pageCalibration(page), templates);
    return { page, rows, cost: reportTotal(rows), untrusted: isUntrustedPage(page) };
  });

  // Quantities are keyed by their resolved unit, so m2 and ft2 never merge into one figure.
  const byUnit = new Map<string, QuantityTotal>();
  let cost = 0;
  for (const entry of pageRollups) {
    if (entry.untrusted) continue;
    cost += entry.cost;
    for (const row of entry.rows) {
      if (row.status !== "VALID" || row.quantity === null) continue;
      const total = byUnit.get(row.unit) ?? { unit: row.unit, value: 0, itemCount: 0 };
      total.value += row.quantity;
      total.itemCount += 1;
      byUnit.set(row.unit, total);
    }
  }

  return {
    pages: pageRollups,
    cost,
    quantities: Array.from(byUnit.values()).sort((left, right) => left.unit.localeCompare(right.unit)),
    untrustedPageCount: pageRollups.filter((entry) => entry.untrusted).length,
    uncalibratedPageCount: pages.filter((page) => !isUntrustedPage(page) && !pageCalibration(page)).length,
  };
}
