export type MeasurementCopyLabels = { fallback: string; copy: string };

export function nextCopyName(sourceName: string, usedNames: Iterable<string>, labels: MeasurementCopyLabels) {
  const names = new Set(Array.from(usedNames, (name) => name.trim()));
  const base = sourceName.trim() || labels.fallback;
  let copyNumber = 1;
  while (names.has(`${base} — ${labels.copy} ${copyNumber}`)) copyNumber += 1;
  return `${base} — ${labels.copy} ${copyNumber}`;
}
