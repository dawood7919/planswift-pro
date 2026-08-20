import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageSize, PageViewport } from "@shared/takeoff-core/viewport";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfLayer = { url: string; pageNumber: number; tone: "reference" | "current" };
type PdfReviewOverlayProps = { reference: PdfLayer; current: PdfLayer; viewport: PageViewport; currentPageSize: PageSize; referencePageSize: PageSize };
const MAX_CANVAS_PIXELS = 16_700_000;

function ReviewCanvas({ layer, pageSize, viewport }: { layer: PdfLayer; pageSize: PageSize; viewport: PageViewport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (viewport.scale === 0) return;
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | null = null;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setFailed(false);
          task = getDocument({ url: layer.url });
          const document = await task.promise;
          const page = await document.getPage(layer.pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const requested = viewport.scale * Math.max(1, window.devicePixelRatio || 1);
          const scale = Math.min(requested, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, baseViewport.width * baseViewport.height)));
          const renderViewport = page.getViewport({ scale });
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context || cancelled) return;
          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);
          renderTask = page.render({ canvas, canvasContext: context, viewport: renderViewport });
          await renderTask.promise;
          page.cleanup();
          document.cleanup();
        } catch (error) {
          if (!cancelled && !(error instanceof Error && /cancel/i.test(error.name))) setFailed(true);
        }
      })();
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timeout); renderTask?.cancel(); task?.destroy(); };
  }, [layer.pageNumber, layer.url, viewport.scale]);
  if (failed) return null;
  return <canvas ref={canvasRef} className={`pdf-review-canvas ${layer.tone}`} style={{ left: viewport.offsetX, top: viewport.offsetY, width: pageSize.width * viewport.scale, height: pageSize.height * viewport.scale }} aria-hidden="true" />;
}

export default function PdfReviewOverlay({ reference, current, viewport, currentPageSize, referencePageSize }: PdfReviewOverlayProps) {
  return <div className="pdf-review-overlay" aria-label="مراجعة اختلاف الوثيقتين"><ReviewCanvas layer={reference} pageSize={referencePageSize} viewport={viewport} /><ReviewCanvas layer={current} pageSize={currentPageSize} viewport={viewport} /><div className="pdf-review-legend"><span className="reference">النسخة المرجعية</span><span className="current">النسخة الحالية</span></div></div>;
}
