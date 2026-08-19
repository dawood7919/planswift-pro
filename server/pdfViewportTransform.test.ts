import { describe, expect, it } from "vitest";
import { createPdfViewportMatrix, formatCssMatrix } from "../shared/takeoff-core/viewport";

describe("PDF viewport transform", () => {
  it("maps SVG pan units to the actual PDF layer dimensions", () => {
    const matrix = createPdfViewportMatrix(1.5, { x: 150, y: 72 }, { width: 1200, height: 900 });
    expect(matrix).toEqual({ a: 1.5, b: 0, c: 0, d: 1.5, e: 180, f: 90 });
  });

  it("keeps the CSS matrix transform order equivalent to SVG translate then scale", () => {
    const matrix = createPdfViewportMatrix(2, { x: 100, y: -36 }, { width: 1000, height: 720 });
    expect(formatCssMatrix(matrix)).toBe("matrix(2, 0, 0, 2, 100, -36)");
  });

  it("allows an unmeasured layer initially but rejects invalid transform inputs", () => {
    expect(createPdfViewportMatrix(1, { x: 0, y: 0 }, { width: 0, height: 0 })).toMatchObject({ e: 0, f: 0 });
    expect(() => createPdfViewportMatrix(0, { x: 0, y: 0 }, { width: 1000, height: 720 })).toThrow("INVALID_VIEWPORT_TRANSFORM");
  });
});
