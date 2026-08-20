import { describe, expect, it } from "vitest";
import { snapPoint } from "../shared/takeoff-core/snapping";

describe("drawing snap resolver", () => {
  it("prioritizes an existing endpoint over a grid intersection", () => {
    expect(snapPoint({ x: 39, y: 41 }, { endpointCandidates: [{ x: 42, y: 42 }], radius: 8, gridSize: 40, objectSnapEnabled: true, gridSnapEnabled: true })).toEqual({ point: { x: 42, y: 42 }, kind: "ENDPOINT" });
  });

  it("does not snap to the grid while grid snapping is disabled", () => {
    expect(snapPoint({ x: 77, y: 83 }, { endpointCandidates: [], radius: 6, gridSize: 40, objectSnapEnabled: true, gridSnapEnabled: false })).toEqual({ point: { x: 77, y: 83 }, kind: "NONE" });
  });

  it("snaps to the grid only when it is explicitly enabled and validates only active grid settings", () => {
    expect(snapPoint({ x: 77, y: 83 }, { endpointCandidates: [], radius: 6, gridSize: 40, objectSnapEnabled: false, gridSnapEnabled: true })).toEqual({ point: { x: 80, y: 80 }, kind: "GRID" });
    expect(snapPoint({ x: 70, y: 70 }, { endpointCandidates: [], radius: 5, gridSize: 0, objectSnapEnabled: false, gridSnapEnabled: false })).toEqual({ point: { x: 70, y: 70 }, kind: "NONE" });
    expect(() => snapPoint({ x: 0, y: 0 }, { endpointCandidates: [], radius: 5, gridSize: 0, objectSnapEnabled: false, gridSnapEnabled: true })).toThrow("INVALID_SNAP_INPUT");
  });
});
