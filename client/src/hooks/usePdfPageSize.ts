import { useEffect, useState } from "react";
import type { PageSize } from "@shared/takeoff-core/viewport";

/**
 * Reads a PDF page's rotation-normalized size in points.
 *
 * Only needed for pages imported before the size was captured at upload time; pages with
 * stored dimensions must use those and never call this.
 *
 * pdf.js is imported lazily so that merely referencing this hook does not pull the renderer
 * into the module graph — it keeps the workspace bundle splittable and lets DOM tests that
 * do not exercise PDF rendering run without a canvas implementation.
 */
export function usePdfPageSize(url: string | null, pageNumber: number | null): PageSize | null {
  const [size, setSize] = useState<PageSize | null>(null);

  useEffect(() => {
    setSize(null);
    if (!url || !pageNumber) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;

    void (async () => {
      try {
        const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = worker.default;
        const task = getDocument({ url });
        destroy = () => void task.destroy();
        const document = await task.promise;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        document.cleanup();
        if (cancelled || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) return;
        setSize({ width: viewport.width, height: viewport.height });
      } catch {
        // A page whose size cannot be read stays unmeasured; the caller blocks migration.
      }
    })();

    return () => { cancelled = true; destroy?.(); };
  }, [url, pageNumber]);

  return size;
}
