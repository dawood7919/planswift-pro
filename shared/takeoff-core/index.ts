export type MeasurementKind = "AREA" | "ROOF_AREA" | "VOLUME" | "LINEAR" | "SEGMENT" | "COUNT";

export type Point2D = {
  x: number;
  y: number;
};

export type CalibrationScale = {
  drawingDistance: number;
  worldDistance: number;
  unit: "m" | "ft" | "cm" | "in";
  factor: number;
};

export type MeasurementGeometry = {
  points?: Point2D[];
  rings?: Point2D[][];
  marks?: Point2D[];
  /** Vertical rise and horizontal run are provided in the calibrated real-world unit. */
  slopeRise?: number;
  slopeRun?: number;
  /** Depth is provided in the calibrated real-world unit. */
  depth?: number;
};

export type MeasurementResult = {
  value: number;
  rawValue: number;
  unit: string;
  status: "VALID" | "UNSCALED" | "INVALID";
  diagnostic?: string;
};

const EPSILON = 1e-9;

function isFinitePoint(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function ensureFinitePoints(points: Point2D[]): void {
  if (points.some((point) => !isFinitePoint(point))) {
    throw new Error("INVALID_POINT");
  }
}

export function distance(first: Point2D, second: Point2D): number {
  ensureFinitePoints([first, second]);
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function polylineLength(points: Point2D[]): number {
  if (points.length < 2) return 0;
  ensureFinitePoints(points);
  return points.slice(1).reduce((total, point, index) => total + distance(points[index]!, point), 0);
}

export function segmentLength(points: Point2D[]): number {
  if (points.length % 2 !== 0) {
    throw new Error("SEGMENTS_REQUIRE_POINT_PAIRS");
  }
  ensureFinitePoints(points);
  let total = 0;
  for (let index = 0; index < points.length; index += 2) {
    total += distance(points[index]!, points[index + 1]!);
  }
  return total;
}

export function signedRingArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  ensureFinitePoints(points);
  let doubleArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return doubleArea / 2;
}

function orientation(first: Point2D, second: Point2D, third: Point2D): number {
  return (second.y - first.y) * (third.x - second.x) - (second.x - first.x) * (third.y - second.y);
}

function onSegment(first: Point2D, middle: Point2D, last: Point2D): boolean {
  return middle.x <= Math.max(first.x, last.x) + EPSILON && middle.x + EPSILON >= Math.min(first.x, last.x)
    && middle.y <= Math.max(first.y, last.y) + EPSILON && middle.y + EPSILON >= Math.min(first.y, last.y);
}

function segmentsIntersect(firstStart: Point2D, firstEnd: Point2D, secondStart: Point2D, secondEnd: Point2D): boolean {
  const one = orientation(firstStart, firstEnd, secondStart);
  const two = orientation(firstStart, firstEnd, secondEnd);
  const three = orientation(secondStart, secondEnd, firstStart);
  const four = orientation(secondStart, secondEnd, firstEnd);
  if (((one > EPSILON && two < -EPSILON) || (one < -EPSILON && two > EPSILON)) && ((three > EPSILON && four < -EPSILON) || (three < -EPSILON && four > EPSILON))) return true;
  if (Math.abs(one) <= EPSILON && onSegment(firstStart, secondStart, firstEnd)) return true;
  if (Math.abs(two) <= EPSILON && onSegment(firstStart, secondEnd, firstEnd)) return true;
  if (Math.abs(three) <= EPSILON && onSegment(secondStart, firstStart, secondEnd)) return true;
  if (Math.abs(four) <= EPSILON && onSegment(secondStart, firstEnd, secondEnd)) return true;
  return false;
}

function ringEdgesIntersect(first: Point2D[], second: Point2D[]): boolean {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex]!;
    const firstEnd = first[(firstIndex + 1) % first.length]!;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex]!;
      const secondEnd = second[(secondIndex + 1) % second.length]!;
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true;
    }
  }
  return false;
}

function hasSelfIntersection(ring: Point2D[]): boolean {
  for (let firstIndex = 0; firstIndex < ring.length; firstIndex += 1) {
    const firstStart = ring[firstIndex]!;
    const firstEnd = ring[(firstIndex + 1) % ring.length]!;
    for (let secondIndex = firstIndex + 1; secondIndex < ring.length; secondIndex += 1) {
      if (Math.abs(firstIndex - secondIndex) <= 1 || (firstIndex === 0 && secondIndex === ring.length - 1)) continue;
      const secondStart = ring[secondIndex]!;
      const secondEnd = ring[(secondIndex + 1) % ring.length]!;
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true;
    }
  }
  return false;
}

function isPointInsideRing(point: Point2D, ring: Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index]!;
    const previousPoint = ring[previous]!;
    const crosses = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

export function validatePolygonRings(rings: Point2D[][]): void {
  const outer = rings[0];
  if (!outer || outer.length < 3) throw new Error("OUTER_RING_REQUIRES_THREE_POINTS");
  if (hasSelfIntersection(outer)) throw new Error("OUTER_RING_SELF_INTERSECTION");
  for (let holeIndex = 1; holeIndex < rings.length; holeIndex += 1) {
    const hole = rings[holeIndex]!;
    if (hole.length < 3) throw new Error("CUTOUT_REQUIRES_THREE_POINTS");
    if (hasSelfIntersection(hole)) throw new Error("CUTOUT_SELF_INTERSECTION");
    if (hole.some((point) => !isPointInsideRing(point, outer)) || ringEdgesIntersect(outer, hole)) throw new Error("CUTOUT_OUTSIDE_OUTER_RING");
    for (let otherIndex = 1; otherIndex < holeIndex; otherIndex += 1) {
      const otherHole = rings[otherIndex]!;
      if (hole.some((point) => isPointInsideRing(point, otherHole)) || otherHole.some((point) => isPointInsideRing(point, hole)) || ringEdgesIntersect(hole, otherHole)) throw new Error("CUTOUTS_OVERLAP");
    }
  }
}

export function polygonArea(rings: Point2D[][]): number {
  validatePolygonRings(rings);
  const outer = Math.abs(signedRingArea(rings[0]!));
  const holes = rings.slice(1).reduce((total, ring) => total + Math.abs(signedRingArea(ring)), 0);
  const netArea = outer - holes;
  if (netArea < -EPSILON) {
    throw new Error("HOLES_EXCEED_OUTER_RING");
  }
  return Math.max(0, netArea);
}

export function polygonPerimeter(rings: Point2D[][]): number {
  return rings.reduce((total, ring) => {
    if (ring.length < 2) return total;
    return total + polylineLength([...ring, ring[0]!]);
  }, 0);
}

export function createCalibration(
  first: Point2D,
  second: Point2D,
  worldDistance: number,
  unit: CalibrationScale["unit"],
): CalibrationScale {
  const drawingDistance = distance(first, second);
  if (drawingDistance <= EPSILON || !Number.isFinite(worldDistance) || worldDistance <= 0) {
    throw new Error("INVALID_CALIBRATION");
  }
  return { drawingDistance, worldDistance, unit, factor: worldDistance / drawingDistance };
}

function areaUnit(unit: CalibrationScale["unit"]): string {
  return `${unit}²`;
}

function volumeUnit(unit: CalibrationScale["unit"]): string {
  return `${unit}³`;
}

export function calculateMeasurement(
  kind: MeasurementKind,
  geometry: MeasurementGeometry,
  scale?: CalibrationScale | null,
): MeasurementResult {
  try {
    if (kind === "COUNT") {
      const count = geometry.marks?.length ?? geometry.points?.length ?? 0;
      return { value: count, rawValue: count, unit: "عدد", status: "VALID" };
    }

    if (!scale) {
      return { value: 0, rawValue: 0, unit: "", status: "UNSCALED", diagnostic: "CALIBRATION_REQUIRED" };
    }

    if (kind === "AREA" || kind === "ROOF_AREA" || kind === "VOLUME") {
      const rawArea = polygonArea(geometry.rings ?? (geometry.points ? [geometry.points] : []));
      const scaledArea = rawArea * scale.factor ** 2;
      if (kind === "AREA") return { value: scaledArea, rawValue: rawArea, unit: areaUnit(scale.unit), status: "VALID" };

      if (kind === "ROOF_AREA") {
        const rise = geometry.slopeRise;
        const run = geometry.slopeRun;
        if (typeof rise !== "number" || typeof run !== "number" || !Number.isFinite(rise) || !Number.isFinite(run) || run <= EPSILON || rise < 0) throw new Error("ROOF_SLOPE_REQUIRED");
        const multiplier = Math.sqrt(1 + (rise / run) ** 2);
        return { value: scaledArea * multiplier, rawValue: rawArea * multiplier, unit: areaUnit(scale.unit), status: "VALID" };
      }

      const depth = geometry.depth;
      if (!Number.isFinite(depth) || depth! <= EPSILON) throw new Error("VOLUME_DEPTH_REQUIRED");
      return { value: scaledArea * depth!, rawValue: rawArea * (depth! / scale.factor), unit: volumeUnit(scale.unit), status: "VALID" };
    }

    const rawValue = kind === "LINEAR"
      ? polylineLength(geometry.points ?? [])
      : segmentLength(geometry.points ?? []);
    return { value: rawValue * scale.factor, rawValue, unit: scale.unit, status: "VALID" };
  } catch (error) {
    return {
      value: 0,
      rawValue: 0,
      unit: scale?.unit ?? "",
      status: "INVALID",
      diagnostic: error instanceof Error ? error.message : "MEASUREMENT_FAILED",
    };
  }
}

export function formatQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(value)} ${unit}`.trim();
}
