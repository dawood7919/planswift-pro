import { describe, expect, it } from "vitest";
import { normalizePointerInput, pointerInputLabel } from "../shared/takeoff-core/pointerInput";

describe("pointer input normalization", () => {
  it("recognizes S Pen-compatible pen events", () => {
    expect(normalizePointerInput("pen")).toBe("pen");
    expect(pointerInputLabel("pen")).toBe("قلم / S Pen");
  });

  it("keeps touch distinct and defaults unknown input to mouse", () => {
    expect(normalizePointerInput("touch")).toBe("touch");
    expect(normalizePointerInput("unknown")).toBe("mouse");
  });
});
