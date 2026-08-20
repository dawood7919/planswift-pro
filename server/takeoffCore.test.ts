import { describe, expect, it } from "vitest";
import {
  calculateMeasurement,
  createCalibration,
  polygonArea,
  polygonPerimeter,
  segmentLength,
  validatePolygonRings,
} from "../shared/takeoff-core";

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("takeoff geometry core", () => {
  it("derives net area and perimeter from an outer ring and a cutout", () => {
    const cutout = [
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ];
    expect(polygonArea([square, cutout])).toBe(96);
    expect(polygonPerimeter([square])).toBe(40);
  });

  it("calibrates drawing space and derives a scaled area", () => {
    const scale = createCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "m");
    const measurement = calculateMeasurement("AREA", { rings: [square] }, scale);
    expect(measurement).toMatchObject({ value: 400, rawValue: 100, unit: { kind: "AREA", unit: "m" }, status: "VALID" });
  });

  it("derives sloped roof area and volume from planar area with explicit real-world inputs", () => {
    const scale = createCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "m");
    expect(calculateMeasurement("ROOF_AREA", { rings: [square], slopeRise: 3, slopeRun: 4 }, scale)).toMatchObject({ value: 500, unit: { kind: "AREA", unit: "m" }, status: "VALID" });
    expect(calculateMeasurement("VOLUME", { rings: [square], depth: 2 }, scale)).toMatchObject({ value: 800, unit: { kind: "VOLUME", unit: "m" }, status: "VALID" });
  });

  it("requires a positive run for roof area and a positive depth for volume", () => {
    const scale = createCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, "m");
    expect(calculateMeasurement("ROOF_AREA", { rings: [square], slopeRise: 1, slopeRun: 0 }, scale)).toMatchObject({ status: "INVALID", diagnostic: "ROOF_SLOPE_REQUIRED" });
    expect(calculateMeasurement("VOLUME", { rings: [square], depth: 0 }, scale)).toMatchObject({ status: "INVALID", diagnostic: "VOLUME_DEPTH_REQUIRED" });
  });

  it("keeps disconnected segments distinct while summing their lengths", () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 14 }];
    expect(segmentLength(points)).toBe(7);
    expect(calculateMeasurement("COUNT", { marks: points })).toMatchObject({ value: 4, unit: { kind: "COUNT" } });
  });

  it("refuses measurements that lack calibration", () => {
    expect(calculateMeasurement("LINEAR", { points: square.slice(0, 2) })).toMatchObject({ status: "UNSCALED" });
  });

  it("rejects cutouts that escape the outer region or overlap a boundary", () => {
    const escapedCutout = [{ x: 8, y: 8 }, { x: 12, y: 8 }, { x: 12, y: 12 }, { x: 8, y: 12 }];
    expect(() => validatePolygonRings([square, escapedCutout])).toThrow("CUTOUT_OUTSIDE_OUTER_RING");
    expect(calculateMeasurement("AREA", { rings: [square, escapedCutout] }, createCalibration({ x: 0, y: 0 }, { x: 10, y: 0 }, 10, "m"))).toMatchObject({ status: "INVALID", diagnostic: "CUTOUT_OUTSIDE_OUTER_RING" });
  });

  it("rejects overlapping and self-intersecting cutouts", () => {
    const firstCutout = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }];
    const overlappingCutout = [{ x: 3, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 6 }, { x: 3, y: 6 }];
    const bowTie = [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }, { x: 5, y: 1 }];
    expect(() => validatePolygonRings([square, firstCutout, overlappingCutout])).toThrow("CUTOUTS_OVERLAP");
    expect(() => validatePolygonRings([square, bowTie])).toThrow("CUTOUT_SELF_INTERSECTION");
  });
});
