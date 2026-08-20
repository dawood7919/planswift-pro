import { useEffect, useRef, useState } from "react";
import { isMeasuredViewport, type PageSize, type Viewport } from "@shared/takeoff-core/viewport";
import { acquirePdfDocument } from "@/lib/pdfDocuments";

type PdfLayer = { url: string; pageNumber: number; tone: "reference" | "current" };

type PdfReviewOverlayProps = {
  reference: PdfLayer;
  current: PdfLayer;
  /**
   * Both sheets are placed on the *current* page's viewport. A reference sheet of a
   * different size keeps its own aspect ratio rather than being stretched to match, so a
   * genuine size change between revisions stays visible instead of being hidden.
   */
  page: PageSize;
  viewport: Viewport;
};

function ReviewCanvas({ layer, page, viewport }: { layer: PdfLayer; page: PageSize; viewport: Viewport }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState<PageSize | null>(null);

  useEffect(() => {
    let cancelled = false;
    const lease = acquirePdfDocument(layer.url);
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    async function render() {
      try {
        setFailed(false);
        const document = await lease.document;
        const pdfPage = await document.getPage(layer.pageNumber);
        const pdfViewport = pdfPage.getViewport({ scale: 1.65 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(pdfViewport.width);
        canvas.height = Math.ceil(pdfViewport.height);
        renderTask = pdfPage.render({ canvas, canvasContext: context, viewport: pdfViewport });
        await renderTask.promise;
        pdfPage.cleanup?.();
        if (!cancelled) setSize({ width: pdfViewport.width / 1.65, height: pdfViewport.height / 1.65 });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void render();
    return () => { cancelled = true; renderTask?.cancel(); lease.release(); };
  }, [layer.pageNumber, layer.url]);

  if (failed) return null;
  const drawn = size ?? page;
  return (
    <canvas
      ref={canvasRef}
      className={`pdf-review-canvas ${layer.tone}`}
      style={{
        width: `${drawn.width * viewport.scale}px`,
        height: `${drawn.height * viewport.scale}px`,
        transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px)`,
      }}
      aria-hidden="true"
    />
  );
}

export default function PdfReviewOverlay({ reference, current, page, viewport }: PdfReviewOverlayProps) {
  if (!isMeasuredViewport(viewport)) return null;
  return (
    <div className="pdf-review-overlay" aria-label="مراجعة اختلاف الوثيقتين">
      <ReviewCanvas layer={reference} page={page} viewport={viewport} />
      <ReviewCanvas layer={current} page={page} viewport={viewport} />
      <div className="pdf-review-legend"><span className="reference">النسخة المرجعية</span><span className="current">النسخة الحالية</span></div>
    </div>
  );
}
