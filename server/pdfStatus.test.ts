import { describe, expect, it } from "vitest";
import { getPdfRenderStatus, PDF_RENDER_ERROR_MESSAGE } from "../shared/takeoff-core/pdfStatus";

describe("PDF presentation status", () => {
  it("gives failure priority over a stale loading state", () => {
    expect(getPdfRenderStatus(true, true)).toBe("ERROR");
    expect(getPdfRenderStatus(true, false)).toBe("LOADING");
    expect(getPdfRenderStatus(false, false)).toBe("READY");
  });

  it("keeps a clear Arabic recovery message", () => {
    expect(PDF_RENDER_ERROR_MESSAGE).toContain("أعد المحاولة");
  });
});
