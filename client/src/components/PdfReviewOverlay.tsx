import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createPdfViewportMatrix, formatCssMatrix } from "@shared/takeoff-core/viewport";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfLayer = { url: string; pageNumber: number; tone: "reference" | "current" };

type PdfReviewOverlayProps = {
  reference: PdfLayer;
  current: PdfLayer;
  zoom: number;
  pan: { x: number; y: number };
};

function ReviewCanvas({ layer, transform }: { layer: PdfLayer; transform: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url: layer.url });
    async function render() {
      try {
        setFailed(false);
        const document = await task.promise;
        const page = await document.getPage(layer.pageNumber);
        const viewport = page.getViewport({ scale: 1.65 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        document.cleanup();
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void render();
    return () => { cancelled = true; task.destroy(); };
  }, [layer.pageNumber, layer.url]);

  if (failed) return null;
  return <canvas ref={canvasRef} className={`pdf-review-canvas ${layer.tone}`} style={{ transform }} aria-hidden="true" />;
}

export default function PdfReviewOverlay({ reference, current, zoom, pan }: PdfReviewOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => setSize({ width: root.clientWidth, height: root.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);
  const transform = formatCssMatrix(createPdfViewportMatrix(zoom, pan, size));
  return <div ref={rootRef} className="pdf-review-overlay" aria-label="مراجعة اختلاف الوثيقتين"><ReviewCanvas layer={reference} transform={transform} /><ReviewCanvas layer={current} transform={transform} /><div className="pdf-review-legend"><span className="reference">النسخة المرجعية</span><span className="current">النسخة الحالية</span></div></div>;
}
