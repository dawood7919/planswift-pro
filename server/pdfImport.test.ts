import { describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: pdfMocks.getDocument }));

import { getPdfPageMetadata } from "../server/pdfImport";

describe("PDF page metadata extraction", () => {
  it("captures rotated and mixed-size page dimensions per page", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn();
    pdfMocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn((pageNumber: number) => Promise.resolve(pageNumber === 1 ? { rotate: 90, getViewport: vi.fn(() => ({ width: 864, height: 1440 })), cleanup } : { rotate: 0, getViewport: vi.fn(() => ({ width: 595, height: 842 })), cleanup })),
        cleanup,
      }),
      destroy,
    });

    await expect(getPdfPageMetadata(Buffer.from("%PDF-test"))).resolves.toEqual([{ width: "864.0000", height: "1440.0000", rotation: 90 }, { width: "595.0000", height: "842.0000", rotation: 0 }]);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
