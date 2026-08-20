export type PointerInputKind = "pen" | "touch" | "mouse";

export function normalizePointerInput(pointerType: string | undefined): PointerInputKind {
  if (pointerType === "pen") return "pen";
  if (pointerType === "touch") return "touch";
  return "mouse";
}

export type PointerInputLabelKey = "pointer.pen" | "pointer.touch" | "pointer.mouse";

export function pointerInputLabelKey(pointerType: PointerInputKind): PointerInputLabelKey {
  return pointerType === "pen" ? "pointer.pen" : pointerType === "touch" ? "pointer.touch" : "pointer.mouse";
}
