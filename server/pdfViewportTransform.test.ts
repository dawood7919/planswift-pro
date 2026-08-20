import { describe, expect, it } from "vitest";
import { createPageViewport, toPagePoint, toScreenPoint } from "../shared/takeoff-core/viewport";

describe("PDF page viewport transform", () => {
  it("fits the rotated PDF page with one scale and centred offsets", () => {
    const viewport = createPageViewport({ width: 1200, height: 900 }, { width: 1600, height: 700 }, 1, { x: 10, y: -5 });
    expect(viewport.scale).toBeCloseTo(700 / 900, 12);
    expect(viewport.offsetX).toBeCloseTo((1600 - 1200 * (700 / 900)) / 2 + 10, 12);
    expect(viewport.offsetY).toBe(-5);
  });

  it("round-trips points after zoom and pan without a separate CSS transform", () => {
    const viewport = createPageViewport({ width: 1440, height: 864 }, { width: 900, height: 860 }, 1.75, { x: 23, y: -11 });
    const screen = toScreenPoint({ x: 720, y: 432 }, viewport);
    expect(toPagePoint({ x: screen.x + 30, y: screen.y + 50 }, { left: 30, top: 50, width: 900, height: 860 }, viewport)).toEqual({ x: 720, y: 432 });
  });

  it("returns a safe zero-scale viewport before the container has dimensions", () => {
    expect(createPageViewport({ width: 1000, height: 720 }, { width: 0, height: 0 }, 1, { x: 0, y: 0 })).toEqual({ scale: 0, offsetX: 0, offsetY: 0 });
    expect(() => createPageViewport({ width: 0, height: 720 }, { width: 1000, height: 720 }, 1, { x: 0, y: 0 })).toThrow("INVALID_VIEWPORT");
  });
});
