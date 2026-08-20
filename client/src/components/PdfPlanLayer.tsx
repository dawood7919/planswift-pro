import React, { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageSize, PageViewport } from "@shared/takeoff-core/viewport";
import { getPdfRenderStatus, PDF_RENDER_ERROR } from "@shared/takeoff-core/pdfStatus";
import { useTranslation } from "@/i18n";
import { PdfPlanStatusOverlay } from "./PdfPlanStatusOverlay";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfPlanLayerProps = {
  url: string;
  pageNumber: number;
  pageSize: PageSize;
  viewport: PageViewport;
};

const MAX_CANVAS_PIXELS = 16_700_000;

export function getPdfPageCount(buffer: ArrayBuffer) {
  const task = getDocument({ data: new Uint8Array(buffer) });
  return task.promise.then((document) => {
    const count = document.numPages;
    document.cleanup();
    return count;
  });
}

export default function PdfPlanLayer({ url, pageNumber, pageSize, viewport }: PdfPlanLayerProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const cssWidth = pageSize.width * viewport.scale;
  const cssHeight = pageSize.height * viewport.scale;

  useEffect(() => {
    if (viewport.scale === 0) return;
    let cancelled = false;
    let documentTask: ReturnType<typeof getDocument> | null = null;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          setError(null);
          setIsRendering(true);
          documentTask = getDocument({ url });
          const document = await documentTask.promise;
          const page = await document.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const dpr = Math.max(1, window.devicePixelRatio || 1);
          const requestedScale = viewport.scale * dpr;
          const cappedScale = Math.min(requestedScale, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, baseViewport.width * baseViewport.height)));
          const renderViewport = page.getViewport({ scale: cappedScale });
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context || cancelled) return;
          canvas.width = Math.ceil(renderViewport.width);
          canvas.height = Math.ceil(renderViewport.height);
          renderTask = page.render({ canvas, canvasContext: context, viewport: renderViewport });
          await renderTask.promise;
          page.cleanup();
          document.cleanup();
          if (!cancelled) setIsRendering(false);
        } catch (error) {
          if (!cancelled && !(error instanceof Error && /cancel/i.test(error.name))) { setError(PDF_RENDER_ERROR); setIsRendering(false); }
        }
      })();
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timeout); renderTask?.cancel(); documentTask?.destroy(); };
  }, [url, pageNumber, renderAttempt, viewport.scale]);

  const status = getPdfRenderStatus(isRendering, Boolean(error));
  return (
    <div className="pdf-plan-layer" aria-label={t("pdf.pageLabel", { pageNumber })}>
      <canvas ref={canvasRef} style={{ left: viewport.offsetX, top: viewport.offsetY, width: cssWidth, height: cssHeight }} />
      <PdfPlanStatusOverlay status={status} error={error ? t("pdf.error") : null} onRetry={() => setRenderAttempt((attempt) => attempt + 1)} />
    </div>
  );
}
