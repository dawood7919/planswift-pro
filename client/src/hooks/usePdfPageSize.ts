import { useEffect, useState } from "react";
import type { PageSize } from "@shared/takeoff-core/viewport";
import { acquirePdfDocument } from "@/lib/pdfDocuments";

/**
 * Reads a PDF page's rotation-normalized size in points.
 *
 * Only needed for pages imported before the size was captured at upload time; pages with
 * stored dimensions must use those and never call this.
 */
export function usePdfPageSize(url: string | null, pageNumber: number | null): PageSize | null {
  const [size, setSize] = useState<PageSize | null>(null);

  useEffect(() => {
    setSize(null);
    if (!url || !pageNumber) return;
    let cancelled = false;
    const lease = acquirePdfDocument(url);

    void (async () => {
      try {
        const document = await lease.document;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        page.cleanup?.();
        if (cancelled || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) return;
        setSize({ width: viewport.width, height: viewport.height });
      } catch {
        // A page whose size cannot be read stays unmeasured; the caller blocks migration.
      }
    })();

    return () => { cancelled = true; lease.release(); };
  }, [url, pageNumber]);

  return size;
}
