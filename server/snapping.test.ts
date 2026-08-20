import { describe, expect, it } from "vitest";
import { snapPoint } from "../shared/takeoff-core/snapping";

describe("drawing snap resolver", () => {
  it("prioritizes an existing endpoint over a grid intersection", () => {
    expect(snapPoint({ x: 39, y: 41 }, { endpointCandidates: [{ x: 42, y: 42 }], radius: 8, gridSize: 40 })).toEqual({ point: { x: 42, y: 42 }, kind: "ENDPOINT" });
  });

  it("snaps to the nearest grid intersection within tolerance", () => {
    expect(snapPoint({ x: 77, y: 83 }, { endpointCandidates: [], radius: 6, gridSize: 40 })).toEqual({ point: { x: 80, y: 80 }, kind: "GRID" });
  });

  it("leaves points outside the snap radius unchanged and rejects invalid settings", () => {
    expect(snapPoint({ x: 70, y: 70 }, { endpointCandidates: [], radius: 5, gridSize: 40 })).toEqual({ point: { x: 70, y: 70 }, kind: "NONE" });
    expect(() => snapPoint({ x: 0, y: 0 }, { endpointCandidates: [], radius: 5, gridSize: 0 })).toThrow("INVALID_SNAP_INPUT");
    expect(() => snapPoint({ x: 0, y: 0 }, { endpointCandidates: [], radius: -1 })).toThrow("INVALID_SNAP_INPUT");
  });

  it("never snaps to the grid when grid snapping is disabled", () => {
    // The same click that grid snapping would have moved must be left exactly where it was.
    for (const options of [
      { endpointCandidates: [], radius: 6 },
      { endpointCandidates: [], radius: 6, gridSize: null },
    ]) {
      expect(snapPoint({ x: 77, y: 83 }, options)).toEqual({ point: { x: 77, y: 83 }, kind: "NONE" });
    }
  });

  it("still snaps to endpoints while grid snapping is disabled", () => {
    expect(snapPoint({ x: 39, y: 41 }, { endpointCandidates: [{ x: 42, y: 42 }], radius: 8 })).toEqual({ point: { x: 42, y: 42 }, kind: "ENDPOINT" });
  });
});
