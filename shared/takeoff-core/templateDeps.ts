import { evaluateFormula, type FormulaVariables } from "./formula";

export type TemplateDependencyNode = {
  id: string;
  formula: string;
  rate: string | number;
  dependencyIds: string[];
};

export type TemplateDependencyDiagnostic = {
  valid: boolean;
  code: string | null;
  message: string;
  cycleIds: string[];
};

const dependencyMessages: Record<string, string> = {
  TEMPLATE_DEPENDENCY_DUPLICATE: "لا يمكن إضافة القالب نفسه أكثر من مرة ضمن المراجع.",
  TEMPLATE_DEPENDENCY_NOT_FOUND: "تتضمن المراجع قالباً غير متاح ضمن مكتبتك.",
  TEMPLATE_DEPENDENCY_SELF_REFERENCE: "لا يمكن للقالب أن يعتمد على نفسه.",
  TEMPLATE_DEPENDENCY_CYCLE: "تُنشئ المراجع حلقة بين القوالب؛ عدّل الاختيار قبل الحفظ.",
  TEMPLATE_DEPENDENCY_RATE_INVALID: "سعر أحد القوالب التابعة غير صالح للتقييم.",
  TEMPLATE_DEPENDENCY_RESULT_INVALID: "نتيجة تقييم تبعيات القالب غير صالحة.",
};

function nodeMap(templates: TemplateDependencyNode[]) {
  return new Map(templates.map((template) => [template.id, template]));
}

function dependenciesFor(template: TemplateDependencyNode, templatesById: Map<string, TemplateDependencyNode>) {
  if (new Set(template.dependencyIds).size !== template.dependencyIds.length) throw new Error("TEMPLATE_DEPENDENCY_DUPLICATE");
  if (template.dependencyIds.includes(template.id)) throw new Error("TEMPLATE_DEPENDENCY_SELF_REFERENCE");
  for (const dependencyId of template.dependencyIds) {
    if (!templatesById.has(dependencyId)) throw new Error("TEMPLATE_DEPENDENCY_NOT_FOUND");
  }
  return template.dependencyIds;
}

/** Returns the first depth-first cycle beginning at templateId, or an empty list when it is acyclic. */
export function detectTemplateCycle(templateId: string, templates: TemplateDependencyNode[]): string[] {
  const templatesById = nodeMap(templates);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (id: string): string[] => {
    const template = templatesById.get(id);
    if (!template) throw new Error("TEMPLATE_DEPENDENCY_NOT_FOUND");
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      return [...path.slice(cycleStart), id];
    }
    if (visited.has(id)) return [];
    visiting.add(id);
    path.push(id);
    for (const dependencyId of dependenciesFor(template, templatesById)) {
      const cycle = visit(dependencyId);
      if (cycle.length) return cycle;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return [];
  };

  return visit(templateId);
}

/** Produces a deterministic dependency-first order, rejecting every cyclic or invalid graph. */
export function topologicalTemplateOrder(templates: TemplateDependencyNode[]): string[] {
  const templatesById = nodeMap(templates);
  const ordered: string[] = [];
  const permanentlyVisited = new Set<string>();
  const temporarilyVisited = new Set<string>();

  const visit = (id: string) => {
    if (permanentlyVisited.has(id)) return;
    if (temporarilyVisited.has(id)) throw new Error("TEMPLATE_DEPENDENCY_CYCLE");
    const template = templatesById.get(id);
    if (!template) throw new Error("TEMPLATE_DEPENDENCY_NOT_FOUND");
    temporarilyVisited.add(id);
    for (const dependencyId of dependenciesFor(template, templatesById)) visit(dependencyId);
    temporarilyVisited.delete(id);
    permanentlyVisited.add(id);
    ordered.push(id);
  };

  for (const template of templates) visit(template.id);
  return ordered;
}

/** Gives a UI-safe validation result for a proposed complete template dependency graph. */
export function inspectTemplateDependencies(templates: TemplateDependencyNode[], focusTemplateId?: string): TemplateDependencyDiagnostic {
  try {
    const cycle = focusTemplateId ? detectTemplateCycle(focusTemplateId, templates) : templates.flatMap((template) => detectTemplateCycle(template.id, templates)).slice(0, 1);
    if (cycle.length) return { valid: false, code: "TEMPLATE_DEPENDENCY_CYCLE", message: dependencyMessages.TEMPLATE_DEPENDENCY_CYCLE, cycleIds: cycle };
    topologicalTemplateOrder(templates);
    return { valid: true, code: null, message: "مراجع القوالب صالحة وسيجري تقييمها بترتيب حتمي.", cycleIds: [] };
  } catch (error) {
    const code = error instanceof Error ? error.message : "TEMPLATE_DEPENDENCY_NOT_FOUND";
    return { valid: false, code, message: dependencyMessages[code] ?? "تعذر التحقق من مراجع القوالب.", cycleIds: [] };
  }
}

/** Evaluates a template's own formula then adds each dependency output in deterministic topological order. */
export function evaluateTemplateWithDependencies(templateId: string, templates: TemplateDependencyNode[], variables: FormulaVariables): { value: number; order: string[]; values: Record<string, number> } {
  const templatesById = nodeMap(templates);
  const order = topologicalTemplateOrder(templates);
  if (!templatesById.has(templateId)) throw new Error("TEMPLATE_DEPENDENCY_NOT_FOUND");
  const values: Record<string, number> = {};

  for (const id of order) {
    const template = templatesById.get(id)!;
    const rate = Number(template.rate);
    if (!Number.isFinite(rate)) throw new Error("TEMPLATE_DEPENDENCY_RATE_INVALID");
    const ownValue = evaluateFormula(template.formula, { ...variables, rate });
    const dependencyValue = template.dependencyIds.reduce((total, dependencyId) => total + values[dependencyId]!, 0);
    const value = ownValue + dependencyValue;
    if (!Number.isFinite(value)) throw new Error("TEMPLATE_DEPENDENCY_RESULT_INVALID");
    values[id] = value;
  }

  return { value: values[templateId]!, order, values };
}
