import { describe, expect, it } from "vitest";
import { normalizePointerInput, pointerInputLabelKey } from "../shared/takeoff-core/pointerInput";

describe("pointer input normalization", () => {
  it("recognizes S Pen-compatible pen events", () => {
    expect(normalizePointerInput("pen")).toBe("pen");
    expect(pointerInputLabelKey("pen")).toBe("pointer.pen");
  });

  it("keeps touch distinct and defaults unknown input to mouse", () => {
    expect(normalizePointerInput("touch")).toBe("touch");
    expect(normalizePointerInput("unknown")).toBe("mouse");
  });
});
