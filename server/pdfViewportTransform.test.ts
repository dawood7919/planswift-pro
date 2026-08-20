import { describe, expect, it } from "vitest";
import {
  BLANK_PAGE_SIZE,
  clampZoom,
  createPageViewport,
  fitScaleFor,
  fromLegacyViewBoxGeometry,
  fromLegacyViewBoxPoint,
  panForZoomAnchor,
  screenLengthToPage,
  toPagePoint,
  toScreenPoint,
  type ContainerSize,
  type PageSize,
} from "../shared/takeoff-core/viewport";
import { calculateMeasurement, createCalibration, type Point2D } from "../shared/takeoff-core";

/** A1 landscape in PDF points — deliberately not the 1000x720 the old code assumed. */
const A1: PageSize = { width: 2384, height: 1684 };

const containers: ContainerSize[] = [
  { width: 1200, height: 864 },
  { width: 900, height: 860 },
  { width: 1600, height: 700 },
];

const rect = { left: 0, top: 0 };

/** Where a fixed feature of the drawing lands on screen, then back to page space. */
function roundTripThroughScreen(pagePoint: Point2D, container: ContainerSize): Point2D {
  const viewport = createPageViewport(A1, container, 1, { x: 0, y: 0 });
  return toPagePoint(toScreenPoint(pagePoint, viewport), rect, viewport);
}

describe("page viewport transform", () => {
  it("fits the page isotropically and centres it", () => {
    const viewport = createPageViewport({ width: 1000, height: 500 }, { width: 800, height: 800 }, 1, { x: 0, y: 0 });
    // Width is the binding constraint: 800/1000 = 0.8 < 800/500 = 1.6.
    expect(viewport.scale).toBeCloseTo(0.8, 12);
    expect(viewport.offsetX).toBeCloseTo(0, 12);
    expect(viewport.offsetY).toBeCloseTo((800 - 500 * 0.8) / 2, 12);
  });

  it("composes zoom onto the fit scale and applies pan in screen pixels", () => {
    const base = createPageViewport(A1, containers[0]!, 1, { x: 0, y: 0 });
    const zoomed = createPageViewport(A1, containers[0]!, 2.5, { x: 40, y: -15 });
    expect(zoomed.scale).toBeCloseTo(base.scale * 2.5, 12);
    const unpanned = createPageViewport(A1, containers[0]!, 2.5, { x: 0, y: 0 });
    expect(zoomed.offsetX - unpanned.offsetX).toBeCloseTo(40, 12);
    expect(zoomed.offsetY - unpanned.offsetY).toBeCloseTo(-15, 12);
  });

  it("round-trips screen and page coordinates across containers, zooms and pans", () => {
    const points: Point2D[] = [{ x: 0, y: 0 }, { x: 2384, y: 1684 }, { x: 731.25, y: 1203.5 }];
    for (const container of containers) {
      for (const zoom of [0.25, 1, 3.7, 8]) {
        for (const pan of [{ x: 0, y: 0 }, { x: 123, y: -87 }]) {
          const viewport = createPageViewport(A1, container, zoom, pan);
          for (const point of points) {
            const back = toPagePoint(toScreenPoint(point, viewport), rect, viewport);
            expect(back.x).toBeCloseTo(point.x, 9);
            expect(back.y).toBeCloseTo(point.y, 9);
          }
        }
      }
    }
  });

  it("honours the element's bounding rect offset", () => {
    const viewport = createPageViewport(A1, containers[0]!, 1, { x: 0, y: 0 });
    const screen = toScreenPoint({ x: 400, y: 700 }, viewport);
    const shifted = toPagePoint({ x: screen.x + 250, y: screen.y + 90 }, { left: 250, top: 90 }, viewport);
    expect(shifted.x).toBeCloseTo(400, 9);
    expect(shifted.y).toBeCloseTo(700, 9);
  });

  it("reports a zero scale for an unmeasured container instead of NaN", () => {
    for (const container of [{ width: 0, height: 0 }, { width: 800, height: 0 }, { width: 0, height: 600 }]) {
      const viewport = createPageViewport(A1, container, 1, { x: 0, y: 0 });
      expect(viewport).toEqual({ scale: 0, offsetX: 0, offsetY: 0 });
      expect(Number.isNaN(viewport.scale)).toBe(false);
      expect(() => toPagePoint({ x: 10, y: 10 }, rect, viewport)).toThrow("VIEWPORT_NOT_MEASURED");
      expect(() => screenLengthToPage(12, viewport)).toThrow("VIEWPORT_NOT_MEASURED");
    }
  });

  it("rejects invalid page, zoom, container and pan inputs", () => {
    expect(() => createPageViewport({ width: 0, height: 100 }, containers[0]!, 1, { x: 0, y: 0 })).toThrow("INVALID_VIEWPORT");
    expect(() => createPageViewport({ width: 100, height: Number.NaN }, containers[0]!, 1, { x: 0, y: 0 })).toThrow("INVALID_VIEWPORT");
    expect(() => createPageViewport(A1, containers[0]!, 0, { x: 0, y: 0 })).toThrow("INVALID_VIEWPORT");
    expect(() => createPageViewport(A1, { width: -1, height: 100 }, 1, { x: 0, y: 0 })).toThrow("INVALID_VIEWPORT");
    expect(() => createPageViewport(A1, containers[0]!, 1, { x: Number.POSITIVE_INFINITY, y: 0 })).toThrow("INVALID_VIEWPORT");
  });

  it("converts a screen-pixel constant into page units so tolerances stay visually fixed", () => {
    const near = createPageViewport(A1, containers[0]!, 1, { x: 0, y: 0 });
    const far = createPageViewport(A1, containers[0]!, 4, { x: 0, y: 0 });
    expect(screenLengthToPage(12, far)).toBeCloseTo(screenLengthToPage(12, near) / 4, 12);
  });

  it("keeps the page point under the anchor fixed while zooming", () => {
    const container = containers[2]!;
    const anchor = { x: 1180, y: 240 };
    const pan = { x: 30, y: -20 };
    const before = createPageViewport(A1, container, 1.4, pan);
    const anchoredPage = toPagePoint(anchor, rect, before);
    const nextPan = panForZoomAnchor(A1, container, 1.4, 3.9, pan, anchor);
    const after = createPageViewport(A1, container, 3.9, nextPan);
    const stillThere = toScreenPoint(anchoredPage, after);
    expect(stillThere.x).toBeCloseTo(anchor.x, 9);
    expect(stillThere.y).toBeCloseTo(anchor.y, 9);
  });

  it("clamps zoom to a range usable on a large drawing", () => {
    expect(clampZoom(0.01)).toBe(0.25);
    expect(clampZoom(40)).toBe(8);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(fitScaleFor(BLANK_PAGE_SIZE, { width: 1000, height: 720 })).toBeCloseTo(1, 12);
  });
});

describe("measurement is independent of the container", () => {
  // A calibration drawn along a horizontal dimension line 400 pt long, known to be 10 m.
  const calibrationA: Point2D = { x: 200, y: 300 };
  const calibrationB: Point2D = { x: 600, y: 300 };
  const horizontal: Point2D[] = [{ x: 200, y: 900 }, { x: 600, y: 900 }];
  const vertical: Point2D[] = [{ x: 900, y: 400 }, { x: 900, y: 800 }];
  const room: Point2D[] = [
    { x: 1200, y: 400 },
    { x: 1600, y: 400 },
    { x: 1600, y: 800 },
    { x: 1200, y: 800 },
  ];

  /**
   * The estimator always clicks the same features of the drawing. Only the window differs.
   * Under the previous stretched viewBox this produced 10.000 m, 7.535 m and 16.457 m for
   * the same vertical wall — the defect this suite exists to prevent from returning.
   */
  function quantitiesFor(container: ContainerSize) {
    const scale = createCalibration(
      roundTripThroughScreen(calibrationA, container),
      roundTripThroughScreen(calibrationB, container),
      10,
      "m",
    );
    const capture = (points: Point2D[]) => points.map((point) => roundTripThroughScreen(point, container));
    return {
      horizontal: calculateMeasurement("LINEAR", { points: capture(horizontal) }, scale),
      vertical: calculateMeasurement("LINEAR", { points: capture(vertical) }, scale),
      area: calculateMeasurement("AREA", { rings: [capture(room)] }, scale),
    };
  }

  it("reports the same quantity at every container aspect ratio", () => {
    const results = containers.map(quantitiesFor);
    for (const result of results) {
      expect(result.horizontal.status).toBe("VALID");
      expect(result.horizontal.value).toBeCloseTo(10, 9);
      expect(result.vertical.value).toBeCloseTo(10, 9);
      expect(result.area.value).toBeCloseTo(100, 8);
    }
    for (const result of results.slice(1)) {
      expect(result.horizontal.value).toBeCloseTo(results[0]!.horizontal.value, 9);
      expect(result.vertical.value).toBeCloseTo(results[0]!.vertical.value, 9);
      expect(result.area.value).toBeCloseTo(results[0]!.area.value, 8);
    }
  });

  it("measures equal vertical and horizontal lengths identically", () => {
    for (const container of containers) {
      const { horizontal: h, vertical: v } = quantitiesFor(container);
      expect(v.value).toBeCloseTo(h.value, 9);
    }
  });

  it("maps a fixed screen distance to the same page distance along both axes", () => {
    for (const container of containers) {
      const viewport = createPageViewport(A1, container, 1, { x: 0, y: 0 });
      const origin = toPagePoint({ x: 300, y: 300 }, rect, viewport);
      const alongX = toPagePoint({ x: 400, y: 300 }, rect, viewport);
      const alongY = toPagePoint({ x: 300, y: 400 }, rect, viewport);
      expect(alongX.x - origin.x).toBeCloseTo(alongY.y - origin.y, 9);
    }
  });
});

describe("legacy viewBox geometry", () => {
  it("maps legacy points onto the page they were drawn over", () => {
    expect(fromLegacyViewBoxPoint({ x: 500, y: 360 }, A1)).toEqual({ x: 1192, y: 842 });
    expect(fromLegacyViewBoxPoint({ x: 0, y: 0 }, A1)).toEqual({ x: 0, y: 0 });
    expect(fromLegacyViewBoxPoint({ x: 1000, y: 720 }, A1)).toEqual({ x: 2384, y: 1684 });
  });

  it("is the identity on a blank page, which already used the legacy dimensions", () => {
    const point = { x: 412.5, y: 199.25 };
    expect(fromLegacyViewBoxPoint(point, BLANK_PAGE_SIZE)).toEqual(point);
  });

  it("converts every ring, point and mark of a geometry while preserving other fields", () => {
    const converted = fromLegacyViewBoxGeometry(
      { rings: [[{ x: 500, y: 360 }]], points: [{ x: 1000, y: 0 }], marks: [{ x: 0, y: 720 }], depth: 3, slopeRise: 4, slopeRun: 12 },
      A1,
    );
    expect(converted.rings).toEqual([[{ x: 1192, y: 842 }]]);
    expect(converted.points).toEqual([{ x: 2384, y: 0 }]);
    expect(converted.marks).toEqual([{ x: 0, y: 1684 }]);
    expect(converted).toMatchObject({ depth: 3, slopeRise: 4, slopeRun: 12 });
  });

  it("rejects an invalid page or point", () => {
    expect(() => fromLegacyViewBoxPoint({ x: 1, y: 1 }, { width: 0, height: 10 })).toThrow("INVALID_VIEWPORT");
    expect(() => fromLegacyViewBoxPoint({ x: Number.NaN, y: 1 }, A1)).toThrow("INVALID_POINT");
  });
});
