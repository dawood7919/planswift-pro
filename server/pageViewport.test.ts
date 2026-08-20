import { describe, expect, it } from "vitest";
import { calculateMeasurement, type CalibrationScale, type Point2D } from "../shared/takeoff-core";
import { createPageViewport, toPagePoint, toScreenPoint } from "../shared/takeoff-core/viewport";

const page = { width: 1440, height: 864 };
const calibration: CalibrationScale = { drawingDistance: 72, worldDistance: 1, unit: "m", factor: 1 / 72 };
const polygon: Point2D[] = [{ x: 144, y: 144 }, { x: 864, y: 144 }, { x: 864, y: 576 }, { x: 144, y: 576 }];

describe("page anchored viewport", () => {
  it("keeps the same calibrated quantity across container aspect ratios", () => {
    const quantities = [[1200, 864], [900, 860], [1600, 700]].map(([width, height]) => {
      const viewport = createPageViewport(page, { width, height }, 1, { x: 0, y: 0 });
      const roundTripped = polygon.map((point) => toPagePoint(toScreenPoint(point, viewport), { left: 0, top: 0, width, height }, viewport));
      return calculateMeasurement("AREA", { rings: [roundTripped] }, calibration).value;
    });

    expect(quantities[0]).toBeCloseTo(quantities[1]!, 12);
    expect(quantities[1]).toBeCloseTo(quantities[2]!, 12);
  });

  it("uses an isotropic page mapping for equal horizontal and vertical lengths", () => {
    const viewport = createPageViewport(page, { width: 900, height: 860 }, 1.75, { x: 23, y: -11 });
    const horizontal = calculateMeasurement("LINEAR", { points: [toPagePoint(toScreenPoint({ x: 120, y: 300 }, viewport), { left: 0, top: 0, width: 900, height: 860 }, viewport), toPagePoint(toScreenPoint({ x: 480, y: 300 }, viewport), { left: 0, top: 0, width: 900, height: 860 }, viewport)] }, calibration).value;
    const vertical = calculateMeasurement("LINEAR", { points: [toPagePoint(toScreenPoint({ x: 120, y: 300 }, viewport), { left: 0, top: 0, width: 900, height: 860 }, viewport), toPagePoint(toScreenPoint({ x: 120, y: 660 }, viewport), { left: 0, top: 0, width: 900, height: 860 }, viewport)] }, calibration).value;

    expect(horizontal).toBeCloseTo(vertical, 12);
  });
});
