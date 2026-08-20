import { describe, expect, it } from "vitest";
import { parseProjectFile, PROJECT_FILE_VERSION, stringifyProjectFile, type TakeoffProjectFile } from "../shared/takeoff-core/projectFile";

const file: TakeoffProjectFile = {
  format: "takeoff-project", version: 1, exportedAt: "2026-08-19T00:00:00.000Z",
  project: { name: "مشروع تصدير", clientName: null, location: null, currency: "USD", lengthUnit: "m" },
  pages: [{ sourceId: "page-source-1", name: "رسم 1", sortOrder: 0, scaleDrawingDistance: "10", scaleWorldDistance: "20", scaleUnit: "m" }],
  items: [{ sourceId: "item-source-1", pageSourceId: "page-source-1", kind: "AREA", name: "مساحة", color: "#c9ff4a", geometry: { rings: [[{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }]] }, rate: "3", multiplier: "2" }],
};

describe("project file format", () => {
  it("round-trips an auditable project file", () => {
    expect(parseProjectFile(stringifyProjectFile(file))).toMatchObject({ format: "takeoff-project", pages: [{ name: "رسم 1" }], items: [{ kind: "AREA", multiplier: "2" }] });
  });

  it("rejects foreign page references and invalid geometry before import", () => {
    const unknownPage = structuredClone(file); unknownPage.items[0]!.pageSourceId = "missing";
    expect(() => parseProjectFile(JSON.stringify(unknownPage))).toThrow("PROJECT_FILE_ITEM_INVALID");
    const invalidPolygon = structuredClone(file); invalidPolygon.items[0]!.geometry = { rings: [[{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }, { x: 5, y: 0 }]] };
    expect(() => parseProjectFile(JSON.stringify(invalidPolygon))).toThrow("OUTER_RING_SELF_INTERSECTION");
    const invalidMultiplier = structuredClone(file); invalidMultiplier.items[0]!.multiplier = "0";
    expect(() => parseProjectFile(JSON.stringify(invalidMultiplier))).toThrow("PROJECT_FILE_ITEM_INVALID");
  });

  it("accepts a version 1 file and marks its pages as legacy geometry", () => {
    const legacy = structuredClone(file);
    legacy.version = 1;
    const parsed = parseProjectFile(JSON.stringify(legacy));
    // Version 1 never recorded a page size or a coordinate space.
    expect(parsed.version).toBe(PROJECT_FILE_VERSION);
    expect(parsed.pages[0]).toMatchObject({ geometrySpace: "LEGACY_VIEWBOX", pageWidth: null, pageHeight: null, pageRotation: 0 });
  });

  it("preserves a version 2 page's size and coordinate space", () => {
    const current = structuredClone(file);
    current.version = 2;
    current.pages[0] = { ...current.pages[0]!, pageWidth: "2384.0000", pageHeight: "1684.0000", pageRotation: 90, geometrySpace: "PAGE_POINTS" };
    expect(parseProjectFile(JSON.stringify(current)).pages[0]).toMatchObject({
      pageWidth: "2384.0000", pageHeight: "1684.0000", pageRotation: 90, geometrySpace: "PAGE_POINTS",
    });
  });

  it("rejects an unsupported version and a page-anchored page with no page size", () => {
    const future = structuredClone(file); (future as { version: number }).version = 3;
    expect(() => parseProjectFile(JSON.stringify(future))).toThrow("PROJECT_FILE_VERSION_INVALID");

    const unanchored = structuredClone(file);
    unanchored.pages[0] = { ...unanchored.pages[0]!, geometrySpace: "PAGE_POINTS", pageWidth: null, pageHeight: null };
    expect(() => parseProjectFile(JSON.stringify(unanchored))).toThrow("PROJECT_FILE_PAGE_INVALID");

    const badRotation = structuredClone(file);
    badRotation.pages[0] = { ...badRotation.pages[0]!, pageRotation: 45 };
    expect(() => parseProjectFile(JSON.stringify(badRotation))).toThrow("PROJECT_FILE_PAGE_INVALID");
  });
});
