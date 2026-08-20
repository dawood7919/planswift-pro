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

  it("does not expose storage keys in the Android project summary", () => {
    const [project] = toNativeProjectSummaries([{
      id: "project-000000000001",
      name: "مشروع آمن",
      clientName: null,
      location: null,
      currency: "SAR",
      lengthUnit: "m",
      updatedAt: new Date("2026-08-19T20:00:00.000Z"),
    }]);

    expect(project).not.toHaveProperty("storageKey");
    expect(project).not.toHaveProperty("storageUrl");
  });

  it("keeps Android summary output limited to project metadata", () => {
    const [project] = toNativeProjectSummaries([{
      id: "project-000000000001",
      name: "مراجعة مخطط",
      clientName: "عميل",
      location: "موقع",
      currency: "SAR",
      lengthUnit: "m",
      updatedAt: new Date("2026-08-19T20:00:00.000Z"),
    }]);

    expect(Object.keys(project).sort()).toEqual(["clientName", "currency", "id", "lengthUnit", "location", "name", "updatedAt"]);
  });
});
