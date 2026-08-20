export function nextCopyName(sourceName: string, usedNames: Iterable<string>) {
  const names = new Set(Array.from(usedNames, (name) => name.trim()));
  const base = sourceName.trim() || "قياس";
  let copyNumber = 1;
  while (names.has(`${base} — نسخة ${copyNumber}`)) copyNumber += 1;
  return `${base} — نسخة ${copyNumber}`;
}
