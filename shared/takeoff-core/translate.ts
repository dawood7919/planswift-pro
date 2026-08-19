import type { MeasurementGeometry, Point2D } from "./index";

export type GeometryOffset = { x: number; y: number };

function translatePoint(point: Point2D, offset: GeometryOffset): Point2D {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new Error("INVALID_GEOMETRY_OFFSET");
  return { x: point.x + offset.x, y: point.y + offset.y };
}

export function translateMeasurementGeometry(geometry: MeasurementGeometry, offset: GeometryOffset): MeasurementGeometry {
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) throw new Error("INVALID_GEOMETRY_OFFSET");
  return {
    ...geometry,
    points: geometry.points?.map((point) => translatePoint(point, offset)),
    marks: geometry.marks?.map((point) => translatePoint(point, offset)),
    rings: geometry.rings?.map((ring) => ring.map((point) => translatePoint(point, offset))),
  };
}
