export type ReviewablePage = {
  id: string;
  documentId: string | null;
  pdfPageNumber: number | null;
  backgroundUrl: string | null;
};

/** Finds the page with the same PDF number in a selected, different document. */
export function findComparablePdfPage(
  activePage: ReviewablePage | undefined,
  pages: ReviewablePage[],
  referenceDocumentId: string | null,
): ReviewablePage | null {
  if (!activePage?.pdfPageNumber || !referenceDocumentId || referenceDocumentId === activePage.documentId) return null;
  return pages.find((page) => page.documentId === referenceDocumentId && page.pdfPageNumber === activePage.pdfPageNumber && Boolean(page.backgroundUrl)) ?? null;
}
