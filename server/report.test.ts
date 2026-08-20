import { describe, expect, it } from "vitest";
import { createCalibration } from "../shared/takeoff-core";
import { buildQuantityReport, reportToCsv, reportTotal } from "../shared/takeoff-core/report";

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

describe("quantity report", () => {
  it("derives report rows and totals from scaled quantities and templates", () => {
    const rows = buildQuantityReport([
      { id: "area-1", name: "بلاط", kind: "AREA", geometry: { rings: [square] }, rate: "5" },
      { id: "count-1", name: "صندوق", kind: "COUNT", geometry: { marks: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, rate: "0", template: { name: "تركيب", formula: "quantity * rate + waste", rate: "12" } },
    ], createCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "m"));
    expect(rows.map((row) => row.cost)).toEqual([2000, 24]);
    expect(reportTotal(rows)).toBe(2024);
  });

  it("quotes CSV fields and retains invalid measurement diagnostics", () => {
    const rows = buildQuantityReport([{ id: "line-1", name: "بند, خاص", kind: "LINEAR", geometry: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, rate: "2" }], null);
    const csv = reportToCsv(rows, reportTotal(rows), "USD", { headers: ["Item", "Kind", "Quantity", "Unit", "Template", "Rate", "Cost", "Status", "Diagnostic"], pageTotal: "Page total" });
    expect(csv).toContain('"بند, خاص"');
    expect(csv).toContain("UNSCALED");
    expect(csv.startsWith("\uFEFFItem")).toBe(true);
  });

  it("includes explicit dependency outputs in the template cost", () => {
    const templates = [
      { id: "assembly", formula: "quantity * rate", rate: "1", dependencyIds: ["labor", "material"] },
      { id: "labor", formula: "quantity * rate", rate: "10", dependencyIds: [] },
      { id: "material", formula: "quantity * rate", rate: "2", dependencyIds: [] },
    ];
    const rows = buildQuantityReport([{ id: "count-assembly", name: "تركيب مركب", kind: "COUNT", geometry: { marks: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, rate: "0", template: { id: "assembly", name: "تركيب", formula: "quantity * rate", rate: "1", dependencyIds: ["labor", "material"] } }], null, templates);
    expect(rows[0]?.cost).toBe(26);
  });

  it("adds auditable material and labor cost lines with explicit waste", () => {
    const rows = buildQuantityReport([{ id: "count-cost-lines", name: "تشطيب", kind: "COUNT", geometry: { marks: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, rate: "0", template: {
      id: "finish", name: "تشطيب", formula: "0", rate: "0", costItems: [
        { id: "material", kind: "MATERIAL", name: "بلاط", quantityFormula: "quantity", unit: "m²", rate: "10", wastePercent: "5" },
        { id: "labor", kind: "LABOR", name: "تركيب", quantityFormula: "quantity", unit: "m²", rate: "3", wastePercent: "0" },
      ],
    } }], null);
    expect(rows[0]?.cost).toBe(27);
    expect(rows[0]?.costBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "MATERIAL", quantity: 2, wastePercent: 5, cost: 21 }),
      expect.objectContaining({ kind: "LABOR", quantity: 2, wastePercent: 0, cost: 6 }),
    ]));
  });

  it("applies a positive multiplier to the measured quantity and cost", () => {
    const rows = buildQuantityReport([{ id: "count-typical", name: "نافذة نموذجية", kind: "COUNT", geometry: { marks: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, rate: "4", multiplier: "3" }], null);
    expect(rows[0]).toMatchObject({ quantity: 6, cost: 24 });
    expect(rows[0]?.costBreakdown[0]).toMatchObject({ quantity: 6, cost: 24 });
  });
});
