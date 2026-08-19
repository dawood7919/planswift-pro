import { describe, expect, it } from "vitest";
import { evaluateFormula, inspectFormula } from "../shared/takeoff-core/formula";

describe("safe formula evaluator", () => {
  it("evaluates variables with deterministic operator precedence and parentheses", () => {
    expect(evaluateFormula("quantity * rate + waste", { quantity: 12, rate: 4.5, waste: 3 })).toBe(57);
    expect(evaluateFormula("(quantity + waste) * rate", { quantity: 12, rate: 4.5, waste: 3 })).toBe(67.5);
  });

  it("rejects unknown variables, execution syntax, division by zero, and malformed expressions", () => {
    expect(() => evaluateFormula("quantity * secret", { quantity: 2 })).toThrow("FORMULA_VARIABLE_UNKNOWN");
    expect(() => evaluateFormula("globalThis.process", {})).toThrow("FORMULA_TOKEN_INVALID");
    expect(() => evaluateFormula("1 / 0", {})).toThrow("FORMULA_DIVISION_BY_ZERO");
    expect(() => evaluateFormula("(1 + 2", {})).toThrow("FORMULA_PARENTHESIS_INVALID");
  });

  it("returns display-safe diagnostics and declared variables for template authoring", () => {
    expect(inspectFormula("quantity * rate + waste")).toMatchObject({ valid: true, code: null, variables: ["quantity", "rate", "waste"] });
    expect(inspectFormula("quantity * secret")).toMatchObject({ valid: false, code: "FORMULA_VARIABLE_UNKNOWN", variables: ["quantity", "secret"] });
    expect(inspectFormula("quantity / 0")).toMatchObject({ valid: false, code: "FORMULA_DIVISION_BY_ZERO" });
  });
});
