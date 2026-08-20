import React, { useEffect, useRef, useState } from "react";
import { isMeasuredViewport, type PageSize, type Viewport } from "@shared/takeoff-core/viewport";
import { getPdfRenderStatus, PDF_RENDER_ERROR_MESSAGE } from "@shared/takeoff-core/pdfStatus";
import { acquirePdfDocument } from "@/lib/pdfDocuments";
import { PdfPlanStatusOverlay } from "./PdfPlanStatusOverlay";

type PdfPlanLayerProps = {
  url: string;
  pageNumber: number;
  /** Page size in PDF points — the same space the takeoff overlay draws in. */
  page: PageSize;
  viewport: Viewport;
};

/** Beyond this the backing store risks exceeding the browser's canvas limit. */
const MAX_CANVAS_PIXELS = 16_700_000;
const RERENDER_DEBOUNCE_MS = 120;

/**
 * Chooses the rasterisation scale, honouring device pixel ratio but never asking for a
 * backing store the browser will refuse to allocate.
 */
function rasterScale(page: PageSize, cssScale: number): number {
  const requested = cssScale * (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const pixels = page.width * page.height * requested * requested;
  if (pixels <= MAX_CANVAS_PIXELS) return requested;
  return Math.sqrt(MAX_CANVAS_PIXELS / (page.width * page.height));
}

export default function PdfPlanLayer({ url, pageNumber, page, viewport }: PdfPlanLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const measured = isMeasuredViewport(viewport);

  // Rasterise at discrete steps so a continuous zoom gesture does not queue a render per frame.
  const stepFor = (scale: number) => Math.round(Math.log2(scale) * 2);
  // Seeded from the scale we are already at, so mounting rasterises once rather than
  // painting at a placeholder step and immediately repainting at the real one.
  const [rasterStep, setRasterStep] = useState(() => (measured ? stepFor(viewport.scale) : 0));
  useEffect(() => {
    if (!measured) return;
    const step = stepFor(viewport.scale);
    if (step === rasterStep) return;
    const timer = setTimeout(() => setRasterStep(step), RERENDER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [measured, viewport.scale, rasterStep]);

  useEffect(() => {
    if (!measured) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    const lease = acquirePdfDocument(url);

    async function renderPage() {
      try {
        setError(null);
        setIsRendering(true);
        const document = await lease.document;
        const pdfPage = await document.getPage(pageNumber);
        const scale = rasterScale(page, Math.pow(2, rasterStep / 2));
        const pdfViewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(pdfViewport.width);
        canvas.height = Math.ceil(pdfViewport.height);
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport: pdfViewport });
        await renderTask.promise;
        pdfPage.cleanup?.();
        if (!cancelled) setIsRendering(false);
      } catch {
        if (!cancelled) { setError(PDF_RENDER_ERROR_MESSAGE); setIsRendering(false); }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      // The cancelled flag alone does not stop pdf.js painting into a reused canvas.
      renderTask?.cancel();
      lease.release();
    };
  }, [url, pageNumber, renderAttempt, rasterStep, page.width, page.height, measured]);

  const status = getPdfRenderStatus(isRendering, Boolean(error));

  return (
    <div className="pdf-plan-layer" aria-label={`صفحة PDF رقم ${pageNumber}`}>
      <canvas
        ref={canvasRef}
        className="pdf-plan-page"
        style={{
          // CSS size follows the shared viewport exactly, so the raster and the takeoff
          // overlay stay registered at any container shape.
          width: `${page.width * viewport.scale}px`,
          height: `${page.height * viewport.scale}px`,
          transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px)`,
        }}
      />
      <PdfPlanStatusOverlay status={status} error={error} onRetry={() => setRenderAttempt((attempt) => attempt + 1)} />
    </div>
  );
}
