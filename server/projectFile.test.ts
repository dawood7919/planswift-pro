import { describe, expect, it } from "vitest";
import { parseProjectFile, stringifyProjectFile, type TakeoffProjectFile } from "../shared/takeoff-core/projectFile";

const file: TakeoffProjectFile = {
  format: "takeoff-project", version: 2, exportedAt: "2026-08-20T00:00:00.000Z",
  project: { name: "مشروع تصدير", clientName: null, location: null, currency: "USD", lengthUnit: "m" },
  pages: [{ sourceId: "page-source-1", name: "رسم 1", sortOrder: 0, scaleDrawingDistance: "10", scaleWorldDistance: "20", scaleUnit: "m", pageWidth: "1440.0000", pageHeight: "864.0000", pageRotation: 0, geometrySpace: "PAGE_POINTS" }],
  items: [{ sourceId: "item-source-1", pageSourceId: "page-source-1", kind: "AREA", name: "مساحة", color: "#c9ff4a", geometry: { rings: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }]] }, rate: "3", multiplier: "2" }],
};

describe("project file format", () => {
  it("round-trips an auditable v2 project file", () => {
    expect(parseProjectFile(stringifyProjectFile(file))).toMatchObject({ format: "takeoff-project", version: 2, pages: [{ name: "رسم 1", geometrySpace: "PAGE_POINTS", pageWidth: "1440.0000" }], items: [{ kind: "AREA", multiplier: "2" }] });
  });

  it("accepts a v1 file and marks its geometry as legacy", () => {
    const legacy = structuredClone(file) as Record<string, unknown>;
    legacy.version = 1;
    const pages = legacy.pages as Array<Record<string, unknown>>;
    delete pages[0]!.pageWidth;
    delete pages[0]!.pageHeight;
    delete pages[0]!.pageRotation;
    delete pages[0]!.geometrySpace;

    expect(parseProjectFile(JSON.stringify(legacy))).toMatchObject({ version: 2, pages: [{ geometrySpace: "LEGACY_VIEWBOX", pageWidth: null, pageHeight: null, pageRotation: 0 }] });
  });

  it("rejects foreign page references, invalid geometry, and unsupported versions before import", () => {
    const unknownPage = structuredClone(file); unknownPage.items[0]!.pageSourceId = "missing";
    expect(() => parseProjectFile(JSON.stringify(unknownPage))).toThrow("PROJECT_FILE_ITEM_INVALID");
    const invalidPolygon = structuredClone(file); invalidPolygon.items[0]!.geometry = { rings: [[{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 5, y: 0 }]] };
    expect(() => parseProjectFile(JSON.stringify(invalidPolygon))).toThrow("OUTER_RING_SELF_INTERSECTION");
    const invalidMultiplier = structuredClone(file); invalidMultiplier.items[0]!.multiplier = "0";
    expect(() => parseProjectFile(JSON.stringify(invalidMultiplier))).toThrow("PROJECT_FILE_ITEM_INVALID");
    expect(() => parseProjectFile(JSON.stringify({ ...file, version: 3 }))).toThrow("PROJECT_FILE_VERSION_INVALID");
  });
});
