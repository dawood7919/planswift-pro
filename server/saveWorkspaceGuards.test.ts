import { describe, expect, it } from "vitest";
import { assertGeometryFits, assertItemsBelongToPage, assertUniqueItemNames } from "./db";

type Item = Parameters<typeof assertUniqueItemNames>[0][number];

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    pageId: "page-1",
    kind: "AREA",
    name: "مساحة 1",
    color: "#22d3ee",
    geometryJson: JSON.stringify({ rings: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]] }),
    rate: "0",
    multiplier: "1",
    templateId: null,
    ...overrides,
  };
}

/**
 * A save deletes every row on the page before inserting the replacements. These guards run
 * first so a rejected save never reaches the delete — without them, a duplicate name or an
 * oversized geometry failed at the insert and left the page empty.
 */
describe("workspace save guards", () => {
  it("rejects two items sharing a name on the same page", () => {
    expect(() => assertUniqueItemNames([item(), item({ id: "item-2" })])).toThrow("DUPLICATE_ITEM_NAME");
    expect(() => assertUniqueItemNames([item(), item({ id: "item-2", name: "مساحة 2" })])).not.toThrow();
  });

  it("rejects geometry that would be truncated by the TEXT column", () => {
    const points = Array.from({ length: 4000 }, (_, index) => ({ x: index + 0.1234, y: index + 0.5678 }));
    const huge = item({ geometryJson: JSON.stringify({ points }) });
    expect(Buffer.byteLength(huge.geometryJson, "utf8")).toBeGreaterThan(60_000);
    expect(() => assertGeometryFits([huge])).toThrow("GEOMETRY_TOO_LARGE");
    expect(() => assertGeometryFits([item()])).not.toThrow();
  });

  it("rejects an item addressed to a different page than the one being replaced", () => {
    expect(() => assertItemsBelongToPage([item({ pageId: "page-2" })], "page-1")).toThrow("ITEM_PAGE_MISMATCH");
    expect(() => assertItemsBelongToPage([item()], "page-1")).not.toThrow();
  });

  it("accepts an empty page, which legitimately clears every measurement", () => {
    expect(() => assertUniqueItemNames([])).not.toThrow();
    expect(() => assertGeometryFits([])).not.toThrow();
    expect(() => assertItemsBelongToPage([], "page-1")).not.toThrow();
  });
});
