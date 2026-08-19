import { describe, expect, it } from "vitest";
import { toNativeProjectSummaries } from "./nativeApi";

describe("native API project summaries", () => {
  it("returns only the project fields needed by the Android project picker", () => {
    const result = toNativeProjectSummaries([{
      id: "project-000000000001",
      name: "برج تجاري",
      clientName: "عميل",
      location: "الرياض",
      currency: "SAR",
      lengthUnit: "m",
      updatedAt: new Date("2026-08-19T20:00:00.000Z"),
    }]);

    expect(result).toEqual([{
      id: "project-000000000001",
      name: "برج تجاري",
      clientName: "عميل",
      location: "الرياض",
      currency: "SAR",
      lengthUnit: "m",
      updatedAt: "2026-08-19T20:00:00.000Z",
    }]);
  });
});
