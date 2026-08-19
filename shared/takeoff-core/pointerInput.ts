export type PointerInputKind = "pen" | "touch" | "mouse";

export function normalizePointerInput(pointerType: string | undefined): PointerInputKind {
  if (pointerType === "pen") return "pen";
  if (pointerType === "touch") return "touch";
  return "mouse";
}

export function pointerInputLabel(pointerType: PointerInputKind): string {
  return pointerType === "pen" ? "قلم / S Pen" : pointerType === "touch" ? "لمس" : "فأرة";
}
