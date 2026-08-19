import { describe, expect, it } from "vitest";
import { findComparablePdfPage } from "../shared/takeoff-core/documentReview";

const pages = [
  { id: "old-1", documentId: "old", pdfPageNumber: 1, backgroundUrl: "old.pdf" },
  { id: "old-2", documentId: "old", pdfPageNumber: 2, backgroundUrl: "old.pdf" },
  { id: "new-1", documentId: "new", pdfPageNumber: 1, backgroundUrl: "new.pdf" },
];

describe("document review matching", () => {
  it("matches a selected document by identical PDF page number", () => {
    expect(findComparablePdfPage(pages[0], pages, "new")).toMatchObject({ id: "new-1" });
  });

  it("refuses the active document and reports missing matching pages", () => {
    expect(findComparablePdfPage(pages[0], pages, "old")).toBeNull();
    expect(findComparablePdfPage(pages[1], pages, "new")).toBeNull();
  });
});
