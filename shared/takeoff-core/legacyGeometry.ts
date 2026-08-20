import type { MeasurementGeometry, Point2D } from "./index";
import { legacyViewBoxPointToPage, type PageSize } from "./viewport";

export function legacyPointToPagePoint(point: Point2D, page: PageSize): Point2D {
  return legacyViewBoxPointToPage(point, page);
}

export function legacyGeometryToPagePoints(geometry: MeasurementGeometry, page: PageSize): MeasurementGeometry {
  return {
    ...geometry,
    points: geometry.points?.map((point) => legacyPointToPagePoint(point, page)),
    marks: geometry.marks?.map((point) => legacyPointToPagePoint(point, page)),
    rings: geometry.rings?.map((ring) => ring.map((point) => legacyPointToPagePoint(point, page))),
  };
}
