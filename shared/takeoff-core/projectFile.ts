import { validatePolygonRings, type MeasurementGeometry, type MeasurementKind, type Point2D } from "./index";

export const PROJECT_FILE_VERSION = 2;

export type GeometrySpace = "LEGACY_VIEWBOX" | "PAGE_POINTS";

export type ProjectFilePage = {
  sourceId: string;
  name: string;
  sortOrder: number;
  scaleDrawingDistance: string | null;
  scaleWorldDistance: string | null;
  scaleUnit: string | null;
  pageWidth: string | null;
  pageHeight: string | null;
  pageRotation: number;
  geometrySpace: GeometrySpace;
};

export type ProjectFileItem = {
  sourceId: string;
  pageSourceId: string;
  kind: MeasurementKind;
  name: string;
  color: string;
  geometry: MeasurementGeometry;
  rate: string;
  multiplier?: string;
};

export type TakeoffProjectFile = {
  format: "takeoff-project";
  version: number;
  exportedAt: string;
  project: { name: string; clientName: string | null; location: string | null; currency: string; lengthUnit: string };
  pages: ProjectFilePage[];
  items: ProjectFileItem[];
};

const kinds: MeasurementKind[] = ["AREA", "ROOF_AREA", "VOLUME", "LINEAR", "SEGMENT", "COUNT"];

function isPoint(value: unknown): value is Point2D {
  return Boolean(value) && typeof value === "object" && Number.isFinite((value as Point2D).x) && Number.isFinite((value as Point2D).y);
}

function assertText(value: unknown, code: string, maximum: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(code);
}

function nullablePositiveDecimal(value: unknown, code: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d+(\.\d{1,4})?$/.test(value) || Number(value) <= 0) throw new Error(code);
  return value;
}

function assertGeometry(kind: MeasurementKind, geometry: unknown) {
  if (!geometry || typeof geometry !== "object") throw new Error("PROJECT_FILE_GEOMETRY_INVALID");
  const value = geometry as MeasurementGeometry;
  if (["AREA", "ROOF_AREA", "VOLUME"].includes(kind)) {
    if (!Array.isArray(value.rings) || value.rings.some((ring) => !Array.isArray(ring) || ring.some((point) => !isPoint(point)))) throw new Error("PROJECT_FILE_GEOMETRY_INVALID");
    validatePolygonRings(value.rings);
    return;
  }
  const points = kind === "COUNT" ? value.marks : value.points;
  if (!Array.isArray(points) || points.some((point) => !isPoint(point))) throw new Error("PROJECT_FILE_GEOMETRY_INVALID");
}

export function parseProjectFile(source: string): TakeoffProjectFile {
  if (source.length > 5_000_000) throw new Error("PROJECT_FILE_TOO_LARGE");
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("PROJECT_FILE_JSON_INVALID"); }
  if (!parsed || typeof parsed !== "object") throw new Error("PROJECT_FILE_INVALID");
  const file = parsed as Partial<TakeoffProjectFile>;
  if (file.format !== "takeoff-project" || (file.version !== 1 && file.version !== PROJECT_FILE_VERSION)) throw new Error("PROJECT_FILE_VERSION_INVALID");
  if (!file.project || !Array.isArray(file.pages) || !Array.isArray(file.items) || file.pages.length < 1 || file.pages.length > 100 || file.items.length > 10_000) throw new Error("PROJECT_FILE_STRUCTURE_INVALID");
  assertText(file.project.name, "PROJECT_FILE_NAME_INVALID", 160);
  assertText(file.project.currency, "PROJECT_FILE_CURRENCY_INVALID", 8);
  assertText(file.project.lengthUnit, "PROJECT_FILE_UNIT_INVALID", 16);
  const pageIds = new Set<string>();
  const pages: ProjectFilePage[] = file.pages.map((page) => {
    assertText(page.sourceId, "PROJECT_FILE_PAGE_INVALID", 100);
    assertText(page.name, "PROJECT_FILE_PAGE_INVALID", 160);
    if (!Number.isInteger(page.sortOrder) || page.sortOrder < 0 || pageIds.has(page.sourceId)) throw new Error("PROJECT_FILE_PAGE_INVALID");
    pageIds.add(page.sourceId);
    if (file.version === 1) {
      return { sourceId: page.sourceId, name: page.name, sortOrder: page.sortOrder, scaleDrawingDistance: page.scaleDrawingDistance ?? null, scaleWorldDistance: page.scaleWorldDistance ?? null, scaleUnit: page.scaleUnit ?? null, pageWidth: null, pageHeight: null, pageRotation: 0, geometrySpace: "LEGACY_VIEWBOX" };
    }
    if (page.geometrySpace !== "LEGACY_VIEWBOX" && page.geometrySpace !== "PAGE_POINTS") throw new Error("PROJECT_FILE_PAGE_INVALID");
    const pageWidth = nullablePositiveDecimal(page.pageWidth, "PROJECT_FILE_PAGE_INVALID");
    const pageHeight = nullablePositiveDecimal(page.pageHeight, "PROJECT_FILE_PAGE_INVALID");
    if (page.geometrySpace === "PAGE_POINTS" && (!pageWidth || !pageHeight)) throw new Error("PROJECT_FILE_PAGE_INVALID");
    if (!Number.isInteger(page.pageRotation) || ![0, 90, 180, 270].includes(page.pageRotation)) throw new Error("PROJECT_FILE_PAGE_INVALID");
    return { sourceId: page.sourceId, name: page.name, sortOrder: page.sortOrder, scaleDrawingDistance: page.scaleDrawingDistance ?? null, scaleWorldDistance: page.scaleWorldDistance ?? null, scaleUnit: page.scaleUnit ?? null, pageWidth, pageHeight, pageRotation: page.pageRotation, geometrySpace: page.geometrySpace };
  });
  file.items.forEach((item) => { assertText(item.sourceId, "PROJECT_FILE_ITEM_INVALID", 100); assertText(item.pageSourceId, "PROJECT_FILE_ITEM_INVALID", 100); assertText(item.name, "PROJECT_FILE_ITEM_INVALID", 160); if (!pageIds.has(item.pageSourceId) || !kinds.includes(item.kind) || !/^#[0-9a-fA-F]{6}$/.test(item.color) || !/^\d+(\.\d{1,4})?$/.test(item.rate) || (item.multiplier !== undefined && (!/^\d+(\.\d{1,4})?$/.test(item.multiplier) || Number(item.multiplier) <= 0))) throw new Error("PROJECT_FILE_ITEM_INVALID"); assertGeometry(item.kind, item.geometry); });
  return { ...file, version: PROJECT_FILE_VERSION, pages } as TakeoffProjectFile;
}

export function stringifyProjectFile(file: TakeoffProjectFile): string {
  return JSON.stringify(parseProjectFile(JSON.stringify(file)), null, 2);
}
