import { describe, expect, it } from "vitest";
import {
  buildProjectRollup,
  isUntrustedPage,
  pageCalibration,
  quantityGroupFor,
  type RollupItem,
  type RollupPage,
} from "../shared/takeoff-core/projectRollup";

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

function page(overrides: Partial<RollupPage> = {}): RollupPage {
  return {
    id: "page-1",
    name: "الصفحة 1",
    scaleDrawingDistance: "10",
    scaleWorldDistance: "20",
    scaleUnit: "m",
    geometrySpace: "PAGE_POINTS",
    ...overrides,
  };
}

function areaItem(overrides: Partial<RollupItem> = {}): RollupItem {
  return {
    id: "item-1",
    pageId: "page-1",
    name: "بلاطة",
    kind: "AREA",
    geometry: { rings: [square] },
    rate: "2",
    template: null,
    ...overrides,
  };
}

describe("page calibration", () => {
  it("derives the factor from the stored scale", () => {
    expect(pageCalibration(page())).toEqual({ drawingDistance: 10, worldDistance: 20, unit: "m", factor: 2 });
  });

  it("returns null for any incomplete or non-positive scale", () => {
    expect(pageCalibration(page({ scaleUnit: null }))).toBeNull();
    expect(pageCalibration(page({ scaleDrawingDistance: null }))).toBeNull();
    expect(pageCalibration(page({ scaleWorldDistance: "0" }))).toBeNull();
    expect(pageCalibration(page({ scaleDrawingDistance: "-4" }))).toBeNull();
  });
});

describe("quantity grouping", () => {
  it("reads the way an estimator does", () => {
    expect(quantityGroupFor("AREA")).toBe("AREA");
    expect(quantityGroupFor("ROOF_AREA")).toBe("AREA");
    expect(quantityGroupFor("VOLUME")).toBe("VOLUME");
    expect(quantityGroupFor("COUNT")).toBe("COUNT");
    expect(quantityGroupFor("LINEAR")).toBe("LENGTH");
    expect(quantityGroupFor("SEGMENT")).toBe("LENGTH");
  });

  it("treats a page with no recorded coordinate space as legacy", () => {
    expect(isUntrustedPage(page({ geometrySpace: null }))).toBe(true);
    expect(isUntrustedPage(page({ geometrySpace: undefined }))).toBe(true);
    expect(isUntrustedPage(page())).toBe(false);
  });
});

describe("project roll-up", () => {
  it("sums cost across pages that each carry their own scale", () => {
    const pages = [page(), page({ id: "page-2", scaleWorldDistance: "30" })];
    const items = [areaItem(), areaItem({ id: "item-2", pageId: "page-2" })];
    const rollup = buildProjectRollup(pages, items);
    // 100 drawing units squared, scaled by 2^2 and 3^2, at a rate of 2.
    expect(rollup.pages[0]!.cost).toBeCloseTo(400 * 2, 9);
    expect(rollup.pages[1]!.cost).toBeCloseTo(900 * 2, 9);
    expect(rollup.cost).toBeCloseTo(400 * 2 + 900 * 2, 9);
  });

  it("aggregates quantities per unit and never merges different units", () => {
    const pages = [page(), page({ id: "page-2", scaleUnit: "ft" })];
    const items = [areaItem(), areaItem({ id: "item-2", pageId: "page-2" })];
    const rollup = buildProjectRollup(pages, items);
    expect(rollup.quantities.map((entry) => entry.unit).sort()).toEqual(["ft²", "m²"]);
    expect(rollup.quantities.every((entry) => entry.itemCount === 1)).toBe(true);
  });

  it("excludes legacy pages from the totals and counts them separately", () => {
    const pages = [page(), page({ id: "page-2", geometrySpace: "LEGACY_VIEWBOX" })];
    const items = [areaItem(), areaItem({ id: "item-2", pageId: "page-2" })];
    const rollup = buildProjectRollup(pages, items);
    expect(rollup.untrustedPageCount).toBe(1);
    // Only the trustworthy page contributes.
    expect(rollup.cost).toBeCloseTo(400 * 2, 9);
    expect(rollup.quantities).toHaveLength(1);
    // Its rows are still computed, so the page can show its own figures with a warning.
    expect(rollup.pages[1]!.rows).toHaveLength(1);
  });

  it("counts uncalibrated pages without dropping their items from the page view", () => {
    const pages = [page({ id: "page-2", scaleUnit: null })];
    const rollup = buildProjectRollup(pages, [areaItem({ pageId: "page-2" })]);
    expect(rollup.uncalibratedPageCount).toBe(1);
    expect(rollup.cost).toBe(0);
    expect(rollup.pages[0]!.rows[0]).toMatchObject({ status: "UNSCALED" });
  });

  it("handles a project with no pages or no items", () => {
    expect(buildProjectRollup([], [])).toMatchObject({ cost: 0, quantities: [], untrustedPageCount: 0 });
    expect(buildProjectRollup([page()], []).pages[0]!.rows).toEqual([]);
  });
});
