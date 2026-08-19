import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createPdfViewportMatrix, formatCssMatrix } from "@shared/takeoff-core/viewport";
import { getPdfRenderStatus, PDF_RENDER_ERROR_MESSAGE } from "@shared/takeoff-core/pdfStatus";
import { PdfPlanStatusOverlay } from "./PdfPlanStatusOverlay";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfPlanLayerProps = {
  url: string;
  pageNumber: number;
  zoom: number;
  pan: { x: number; y: number };
};

export function getPdfPageCount(buffer: ArrayBuffer) {
  const task = getDocument({ data: new Uint8Array(buffer) });
  return task.promise.then((document) => {
    const count = document.numPages;
    document.cleanup();
    return count;
  });
}

export default function PdfPlanLayer({ url, pageNumber, zoom, pan }: PdfPlanLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const [layerSize, setLayerSize] = useState({ width: 0, height: 0 });
  const transform = formatCssMatrix(createPdfViewportMatrix(zoom, pan, layerSize));

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const update = () => setLayerSize({ width: layer.clientWidth, height: layer.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(layer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | null = null;

    async function renderPage() {
      try {
        setError(null);
        setIsRendering(true);
        task = getDocument({ url });
        const document = await task.promise;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.65 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        document.cleanup();
        if (!cancelled) setIsRendering(false);
      } catch {
        if (!cancelled) { setError(PDF_RENDER_ERROR_MESSAGE); setIsRendering(false); }
      }
    }

    void renderPage();
    return () => { cancelled = true; task?.destroy(); };
  }, [url, pageNumber, renderAttempt]);

  const status = getPdfRenderStatus(isRendering, Boolean(error));

  return (
    <div ref={layerRef} className="pdf-plan-layer" aria-label={`صفحة PDF رقم ${pageNumber}`}>
      <div className="pdf-plan-transform" style={{ transform }}>
      <canvas ref={canvasRef} />
      </div>
      <PdfPlanStatusOverlay status={status} error={error} onRetry={() => setRenderAttempt((attempt) => attempt + 1)} />
    </div>
  );
}
