import { describe, expect, it } from "vitest";
import { searchTakeoffItems } from "../shared/takeoff-core/itemSearch";

const items = [
  { id: "a", name: "سقف رئيسي", kind: "ROOF_AREA", templateName: "عزل حراري" },
  { id: "b", name: "جدار خارجي", kind: "LINEAR", templateName: "دهان" },
  { id: "c", name: "فتحات", kind: "COUNT", templateName: null },
];

describe("searchTakeoffItems", () => {
  it("finds a measurement by Arabic name and template terms", () => {
    expect(searchTakeoffItems(items, "سقف عزل").map((item) => item.id)).toEqual(["a"]);
    expect(searchTakeoffItems(items, "دهان").map((item) => item.id)).toEqual(["b"]);
  });

  it("normalizes common Arabic variants and preserves source order", () => {
    expect(searchTakeoffItems(items, "سقف رئيسى").map((item) => item.id)).toEqual(["a"]);
    expect(searchTakeoffItems(items, "").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
