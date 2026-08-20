import { describe, expect, it } from "vitest";
import { ar } from "../client/src/i18n/ar";
import { en } from "../client/src/i18n/en";
import { formatArea, formatFeetInches, formatLength, formatVolume } from "../client/src/i18n/format";
import { inspectFormula } from "../shared/takeoff-core/formula";
import { inspectTemplateDependencies } from "../shared/takeoff-core/templateDeps";

describe("i18n and unit foundation", () => {
  it("keeps Arabic and English catalogue keys in parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });

  it("converts display units from immutable calibrated values with exact base factors", () => {
    expect(formatLength(1, "m", "imperial", "en")).toBe("3.28 ft");
    expect(formatArea(1, "m", "imperial", "en")).toBe("10.76 SF");
    expect(formatVolume(1, "m", "imperial", "en")).toBe("1.31 CY");
    expect(formatFeetInches(5.5)).toBe("5' 6\"");
  });

  it("keeps formula and dependency diagnostics as codes rather than Arabic UI strings", () => {
    expect(inspectFormula("quantity / 0")).toMatchObject({ valid: false, code: "FORMULA_DIVISION_BY_ZERO" });
    expect(inspectFormula("quantity / 0")).not.toHaveProperty("message");
    expect(inspectTemplateDependencies([{ id: "a", formula: "quantity", rate: "1", dependencyIds: ["a"] }])).toMatchObject({ valid: false, code: "TEMPLATE_DEPENDENCY_SELF_REFERENCE" });
  });
});
