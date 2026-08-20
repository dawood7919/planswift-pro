// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument: pdfMocks.getDocument, GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/pdf.worker.mjs" }));

import { acquirePdfDocument, cachedPdfDocumentCount, clearPdfDocumentCache, IDLE_EVICTION_MS } from "../client/src/lib/pdfDocuments";

function mockDocument(numPages = 7) {
  const destroy = vi.fn();
  pdfMocks.getDocument.mockImplementation(() => ({
    promise: Promise.resolve({ numPages, getPage: vi.fn(), cleanup: vi.fn(), destroy }),
    destroy: pdfMocks.destroy,
  }));
  return destroy;
}

describe("shared pdf document cache", () => {
  afterEach(() => { clearPdfDocumentCache(); pdfMocks.getDocument.mockReset(); pdfMocks.destroy.mockReset(); vi.useRealTimers(); });

  it("loads one document however many holders ask for the same url", async () => {
    mockDocument();
    // A 20-page drawing previously opened one document per thumbnail plus the plan layer.
    const leases = Array.from({ length: 21 }, () => acquirePdfDocument("/plan.pdf"));
    await Promise.all(leases.map((lease) => lease.document));
    expect(pdfMocks.getDocument).toHaveBeenCalledTimes(1);
    expect(cachedPdfDocumentCount()).toBe(1);
    leases.forEach((lease) => lease.release());
  });

  it("keeps separate documents for separate urls", async () => {
    mockDocument();
    const first = acquirePdfDocument("/a.pdf");
    const second = acquirePdfDocument("/b.pdf");
    await Promise.all([first.document, second.document]);
    expect(pdfMocks.getDocument).toHaveBeenCalledTimes(2);
    expect(cachedPdfDocumentCount()).toBe(2);
    first.release();
    second.release();
  });

  it("keeps a released document warm so flipping pages does not reparse it", async () => {
    mockDocument();
    const first = acquirePdfDocument("/plan.pdf");
    await first.document;
    vi.useFakeTimers();
    first.release();
    // Still cached: the user is likely to come straight back to this drawing.
    expect(cachedPdfDocumentCount()).toBe(1);
    const revisit = acquirePdfDocument("/plan.pdf");
    vi.advanceTimersByTime(IDLE_EVICTION_MS * 2);
    expect(cachedPdfDocumentCount()).toBe(1);
    expect(pdfMocks.getDocument).toHaveBeenCalledTimes(1);
    revisit.release();
  });

  it("evicts once the document has been idle and unreferenced", async () => {
    vi.useFakeTimers();
    mockDocument();
    const lease = acquirePdfDocument("/plan.pdf");
    await lease.document;
    lease.release();
    vi.advanceTimersByTime(IDLE_EVICTION_MS + 1);
    expect(cachedPdfDocumentCount()).toBe(0);
  });

  it("does not evict while another holder still has a reference", async () => {
    vi.useFakeTimers();
    mockDocument();
    const first = acquirePdfDocument("/plan.pdf");
    const second = acquirePdfDocument("/plan.pdf");
    first.release();
    vi.advanceTimersByTime(IDLE_EVICTION_MS + 1);
    expect(cachedPdfDocumentCount()).toBe(1);
    second.release();
    vi.advanceTimersByTime(IDLE_EVICTION_MS + 1);
    expect(cachedPdfDocumentCount()).toBe(0);
  });

  it("ignores a repeated release so it cannot evict a document others hold", async () => {
    vi.useFakeTimers();
    mockDocument();
    const first = acquirePdfDocument("/plan.pdf");
    const second = acquirePdfDocument("/plan.pdf");
    first.release();
    first.release();
    first.release();
    vi.advanceTimersByTime(IDLE_EVICTION_MS + 1);
    // The second holder is still using it.
    expect(cachedPdfDocumentCount()).toBe(1);
    second.release();
  });

  it("does not cache a failed load, so a retry can actually succeed", async () => {
    pdfMocks.getDocument.mockImplementationOnce(() => ({ promise: Promise.reject(new Error("load failed")), destroy: vi.fn() }));
    const failed = acquirePdfDocument("/plan.pdf");
    await expect(failed.document).rejects.toThrow("load failed");
    expect(cachedPdfDocumentCount()).toBe(0);
    failed.release();

    mockDocument();
    const retry = acquirePdfDocument("/plan.pdf");
    await expect(retry.document).resolves.toMatchObject({ numPages: 7 });
    retry.release();
  });
});
