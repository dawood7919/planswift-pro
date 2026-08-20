export type FormulaVariables = Record<string, number>;
export const TEMPLATE_FORMULA_VARIABLES = ["quantity", "rate", "waste"] as const;
export type FormulaDiagnostic = { valid: boolean; code: string | null; variables: string[] };

type Token = { type: "NUMBER" | "IDENTIFIER" | "OPERATOR" | "LEFT_PAREN" | "RIGHT_PAREN" | "END"; value?: string };

function tokenize(formula: string): Token[] {
  if (formula.length === 0 || formula.length > 500) throw new Error("FORMULA_LENGTH_INVALID");
  const tokens: Token[] = [];
  let index = 0;
  while (index < formula.length) {
    const rest = formula.slice(index);
    const whitespace = rest.match(/^\s+/)?.[0];
    if (whitespace) { index += whitespace.length; continue; }
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)/)?.[0];
    if (number) { tokens.push({ type: "NUMBER", value: number }); index += number.length; continue; }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (identifier) { tokens.push({ type: "IDENTIFIER", value: identifier }); index += identifier.length; continue; }
    const char = formula[index]!;
    if (["+", "-", "*", "/"].includes(char)) { tokens.push({ type: "OPERATOR", value: char }); index += 1; continue; }
    if (char === "(") { tokens.push({ type: "LEFT_PAREN" }); index += 1; continue; }
    if (char === ")") { tokens.push({ type: "RIGHT_PAREN" }); index += 1; continue; }
    throw new Error("FORMULA_TOKEN_INVALID");
  }
  if (tokens.length > 200) throw new Error("FORMULA_TOO_COMPLEX");
  return [...tokens, { type: "END" }];
}

/** Evaluates +, -, *, /, parentheses, and named finite variables without executing code. */
export function evaluateFormula(formula: string, variables: FormulaVariables): number {
  const tokens = tokenize(formula);
  let cursor = 0;
  const current = () => tokens[cursor]!;
  const consume = () => tokens[cursor++]!;

  const parsePrimary = (): number => {
    const token = consume();
    if (token.type === "NUMBER") return Number(token.value);
    if (token.type === "IDENTIFIER") {
      const value = variables[token.value!];
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("FORMULA_VARIABLE_UNKNOWN");
      return value;
    }
    if (token.type === "OPERATOR" && token.value === "-") return -parsePrimary();
    if (token.type === "LEFT_PAREN") {
      const value = parseExpression();
      if (consume().type !== "RIGHT_PAREN") throw new Error("FORMULA_PARENTHESIS_INVALID");
      return value;
    }
    throw new Error("FORMULA_EXPRESSION_INVALID");
  };

  const parseProduct = (): number => {
    let value = parsePrimary();
    while (current().type === "OPERATOR" && ["*", "/"].includes(current().value!)) {
      const operator = consume().value;
      const operand = parsePrimary();
      if (operator === "/" && operand === 0) throw new Error("FORMULA_DIVISION_BY_ZERO");
      value = operator === "*" ? value * operand : value / operand;
    }
    return value;
  };

  const parseExpression = (): number => {
    let value = parseProduct();
    while (current().type === "OPERATOR" && ["+", "-"].includes(current().value!)) {
      const operator = consume().value;
      const operand = parseProduct();
      value = operator === "+" ? value + operand : value - operand;
    }
    return value;
  };

  const result = parseExpression();
  if (current().type !== "END") throw new Error("FORMULA_TRAILING_TOKENS");
  if (!Number.isFinite(result)) throw new Error("FORMULA_RESULT_INVALID");
  return result;
}

/** Parses a formula without executing code and exposes locale-neutral diagnostics for template authoring. */
export function inspectFormula(formula: string): FormulaDiagnostic {
  try {
    const variables = Array.from(new Set(tokenize(formula).filter((token) => token.type === "IDENTIFIER").map((token) => token.value!)));
    if (variables.some((variable) => !(TEMPLATE_FORMULA_VARIABLES as readonly string[]).includes(variable))) return { valid: false, code: "FORMULA_VARIABLE_UNKNOWN", variables };
    evaluateFormula(formula, Object.fromEntries(TEMPLATE_FORMULA_VARIABLES.map((variable) => [variable, 1])));
    return { valid: true, code: null, variables };
  } catch (error) {
    const code = error instanceof Error ? error.message : "FORMULA_EXPRESSION_INVALID";
    return { valid: false, code, variables: [] };
  }
}
