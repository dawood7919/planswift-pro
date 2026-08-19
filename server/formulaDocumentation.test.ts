import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("template formula documentation", () => {
  it("documents variables, units, and explicit cycle-safe template dependencies", () => {
    const document = readFileSync("docs/template-formulas.md", "utf8");
    expect(document).toContain("`quantity`");
    expect(document).toContain("الوحدة الناتجة");
    expect(document).toContain("مراجع صريحة");
    expect(document).toContain("ترتيب طوبولوجي حتمي");
  });
});
