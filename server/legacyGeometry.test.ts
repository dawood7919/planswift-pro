import { describe, expect, it } from "vitest";
import { legacyGeometryToPagePoints } from "../shared/takeoff-core/legacyGeometry";
import { DEFAULT_BLANK_PAGE_SIZE } from "../shared/takeoff-core/viewport";

describe("legacy viewBox migration", () => {
  it("maps known legacy geometry to page points for a PDF page", () => {
    const geometry = legacyGeometryToPagePoints({ rings: [[{ x: 0, y: 0 }, { x: 500, y: 360 }, { x: 1000, y: 720 }]] }, { width: 1440, height: 864 });
    expect(geometry.rings?.[0]).toEqual([{ x: 0, y: 0 }, { x: 720, y: 432 }, { x: 1440, y: 864 }]);
  });

  it("keeps legacy geometry identical for the synthetic blank page", () => {
    const geometry = legacyGeometryToPagePoints({ points: [{ x: 200, y: 300 }] }, DEFAULT_BLANK_PAGE_SIZE);
    expect(geometry.points).toEqual([{ x: 200, y: 300 }]);
  });
});
