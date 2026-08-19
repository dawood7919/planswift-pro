import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MVP baseline documentation", () => {
  it("records the web MVP scope and its explicit platform and service boundaries", () => {
    const document = readFileSync(new URL("../docs/mvp-baseline.md", import.meta.url), "utf8");
    const matrix = readFileSync(new URL("../docs/mvp-verification-matrix.md", import.meta.url), "utf8");
    expect(document).toContain("MVP ويب أولاً");
    expect(document).toContain("76 اختبار Vitest");
    expect(document).toContain("Windows وAndroid/S Pen");
    expect(document).toContain("OAuth وDatabase وStorage");
    expect(matrix).toContain("مصفوفة تحقق MVP");
    expect(matrix).toContain("PDF والصفحات والتحويل");
    expect(matrix).toContain("Windows وAndroid/S Pen");
  });
});
