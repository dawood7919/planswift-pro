import { describe, expect, it } from "vitest";
import { assertOwnedTemplateIds, getTakeoffTemplate, requireOwnedTemplate } from "./db";

function templateLookup(rows: Array<{ id: string }>, dependencyRows: Array<{ dependsOnTemplateId: string }> = []) {
  let selectCount = 0;
  return {
    select: () => {
      const result = selectCount++ === 0 ? rows : dependencyRows;
      return {
        from: () => ({
          where: () => Object.assign(Promise.resolve(result), { limit: async () => result }),
        }),
      };
    },
  };
}

describe("template ownership guards", () => {
  it("rejects a missing template returned by an owner-scoped lookup", () => {
    expect(() => requireOwnedTemplate(undefined)).toThrow("TEMPLATE_NOT_FOUND");
    expect(requireOwnedTemplate({ id: "template-owned-1" })).toEqual({ id: "template-owned-1" });
  });

  it("rejects every requested template id that is absent from the owner-scoped lookup", () => {
    expect(() => assertOwnedTemplateIds(["template-owned-1", "template-foreign-2"], [{ id: "template-owned-1" }])).toThrow("TEMPLATE_NOT_FOUND");
    expect(() => assertOwnedTemplateIds(["template-owned-1"], [{ id: "template-owned-1" }])).not.toThrow();
  });

  it("reads an owner-scoped template directly and rejects a lookup with no owned row", async () => {
    await expect(getTakeoffTemplate(41, "template-owned-1", templateLookup([{ id: "template-owned-1" }]))).resolves.toEqual({ id: "template-owned-1", dependencyIds: [], costItems: [] });
    await expect(getTakeoffTemplate(99, "template-owned-1", templateLookup([]))).rejects.toThrow("TEMPLATE_NOT_FOUND");
  });
});
