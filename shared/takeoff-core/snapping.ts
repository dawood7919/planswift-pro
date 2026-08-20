import type { Point2D } from "./index";

export type SnapKind = "NONE" | "ENDPOINT" | "GRID";

export type SnapResult = { point: Point2D; kind: SnapKind };

export type SnapOptions = {
  endpointCandidates: Point2D[];
  radius: number;
  gridSize: number;
  objectSnapEnabled: boolean;
  gridSnapEnabled: boolean;
};

function finitePoint(point: Point2D) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function nearestWithin(point: Point2D, candidates: Point2D[], radius: number): Point2D | null {
  let nearest: Point2D | null = null;
  let nearestDistance = radius;
  for (const candidate of candidates) {
    if (!finitePoint(candidate)) continue;
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * Resolves a drawing point deterministically. Existing endpoints intentionally
 * have priority over grid intersections so shared geometry remains connected.
 */
export function snapPoint(point: Point2D, options: SnapOptions): SnapResult {
  if (!finitePoint(point) || !Number.isFinite(options.radius) || options.radius < 0 || !Number.isFinite(options.gridSize)) {
    throw new Error("INVALID_SNAP_INPUT");
  }
  if (options.objectSnapEnabled) {
    const endpoint = nearestWithin(point, options.endpointCandidates, options.radius);
    if (endpoint) return { point: { ...endpoint }, kind: "ENDPOINT" };
  }
  if (!options.gridSnapEnabled) return { point: { ...point }, kind: "NONE" };
  if (options.gridSize <= 0) throw new Error("INVALID_SNAP_INPUT");
  const gridPoint = {
    x: Math.round(point.x / options.gridSize) * options.gridSize,
    y: Math.round(point.y / options.gridSize) * options.gridSize,
  };
  if (Math.hypot(gridPoint.x - point.x, gridPoint.y - point.y) <= options.radius) return { point: gridPoint, kind: "GRID" };
  return { point: { ...point }, kind: "NONE" };
}
