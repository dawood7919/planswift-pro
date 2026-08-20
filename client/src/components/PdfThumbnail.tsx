import React, { useEffect, useRef } from "react";
import { acquirePdfDocument } from "@/lib/pdfDocuments";

type PdfThumbnailProps = { url: string; pageNumber: number };

export default function PdfThumbnail({ url, pageNumber }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    // Shared with the plan layer and every other thumbnail of the same drawing.
    const lease = acquirePdfDocument(url);

    void (async () => {
      try {
        const document = await lease.document;
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.22 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        page.cleanup?.();
      } catch {
        // A thumbnail that cannot be drawn simply stays blank.
      }
    })();

    return () => { cancelled = true; renderTask?.cancel(); lease.release(); };
  }, [url, pageNumber]);

  return <canvas ref={canvasRef} className="pdf-page-thumbnail" aria-hidden="true" />;
}
