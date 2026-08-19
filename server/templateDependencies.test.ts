import { describe, expect, it } from "vitest";
import { detectTemplateCycle, evaluateTemplateWithDependencies, inspectTemplateDependencies, topologicalTemplateOrder, type TemplateDependencyNode } from "../shared/takeoff-core/templateDeps";

const templates: TemplateDependencyNode[] = [
  { id: "root-template", formula: "quantity * rate", rate: "1", dependencyIds: ["assembly-template"] },
  { id: "assembly-template", formula: "0", rate: "0", dependencyIds: ["labor-template", "material-template"] },
  { id: "labor-template", formula: "quantity * rate", rate: "10", dependencyIds: [] },
  { id: "material-template", formula: "quantity * rate", rate: "2", dependencyIds: [] },
];

describe("template dependency graph", () => {
  it("orders dependencies before their consumer and evaluates each node once", () => {
    expect(topologicalTemplateOrder(templates)).toEqual(["labor-template", "material-template", "assembly-template", "root-template"]);
    expect(evaluateTemplateWithDependencies("root-template", templates, { quantity: 5, rate: 999, waste: 0 })).toEqual({
      value: 65,
      order: ["labor-template", "material-template", "assembly-template", "root-template"],
      values: { "labor-template": 50, "material-template": 10, "assembly-template": 60, "root-template": 65 },
    });
  });

  it("reports a closed cycle before evaluation", () => {
    const cyclic: TemplateDependencyNode[] = [
      { id: "a-template", formula: "1", rate: "0", dependencyIds: ["b-template"] },
      { id: "b-template", formula: "1", rate: "0", dependencyIds: ["c-template"] },
      { id: "c-template", formula: "1", rate: "0", dependencyIds: ["a-template"] },
    ];
    expect(detectTemplateCycle("a-template", cyclic)).toEqual(["a-template", "b-template", "c-template", "a-template"]);
    expect(inspectTemplateDependencies(cyclic, "a-template")).toMatchObject({ valid: false, code: "TEMPLATE_DEPENDENCY_CYCLE", cycleIds: ["a-template", "b-template", "c-template", "a-template"] });
    expect(() => topologicalTemplateOrder(cyclic)).toThrow("TEMPLATE_DEPENDENCY_CYCLE");
  });

  it("rejects references missing from the owner-visible graph and duplicate edges", () => {
    expect(inspectTemplateDependencies([{ id: "only-template", formula: "1", rate: "0", dependencyIds: ["missing-template"] }], "only-template")).toMatchObject({ valid: false, code: "TEMPLATE_DEPENDENCY_NOT_FOUND" });
    expect(inspectTemplateDependencies([{ id: "only-template", formula: "1", rate: "0", dependencyIds: ["other-template", "other-template"] }, { id: "other-template", formula: "1", rate: "0", dependencyIds: [] }], "only-template")).toMatchObject({ valid: false, code: "TEMPLATE_DEPENDENCY_DUPLICATE" });
  });
});
