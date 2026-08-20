import { describe, expect, it } from "vitest";
import { getPdfRenderStatus, PDF_RENDER_ERROR } from "../shared/takeoff-core/pdfStatus";

describe("PDF presentation status", () => {
  it("gives failure priority over a stale loading state", () => {
    expect(getPdfRenderStatus(true, true)).toBe("ERROR");
    expect(getPdfRenderStatus(true, false)).toBe("LOADING");
    expect(getPdfRenderStatus(false, false)).toBe("READY");
  });

  it("exposes a language-neutral rendering error code", () => {
    expect(PDF_RENDER_ERROR).toBe("PDF_RENDER_ERROR");
  });
});
