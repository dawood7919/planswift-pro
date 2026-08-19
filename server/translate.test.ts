import { describe, expect, it } from "vitest";
import { translateMeasurementGeometry } from "../shared/takeoff-core/translate";

describe("translateMeasurementGeometry", () => {
  it("translates areas, linear paths, and count marks without changing their structure", () => {
    expect(translateMeasurementGeometry({ rings: [[{ x: 1, y: 2 }, { x: 3, y: 4 }]] }, { x: 10, y: -1 })).toEqual({ rings: [[{ x: 11, y: 1 }, { x: 13, y: 3 }]] });
    expect(translateMeasurementGeometry({ points: [{ x: 5, y: 6 }] }, { x: -2, y: 4 })).toEqual({ points: [{ x: 3, y: 10 }] });
    expect(translateMeasurementGeometry({ marks: [{ x: 7, y: 8 }] }, { x: 1, y: 1 })).toEqual({ marks: [{ x: 8, y: 9 }] });
  });

  it("rejects non-finite offsets and leaves the source geometry untouched", () => {
    const source = { points: [{ x: 5, y: 6 }] };
    expect(() => translateMeasurementGeometry(source, { x: Number.NaN, y: 1 })).toThrow("INVALID_GEOMETRY_OFFSET");
    expect(source).toEqual({ points: [{ x: 5, y: 6 }] });
  });
});
