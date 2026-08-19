import { useEffect, useRef } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PdfThumbnailProps = { url: string; pageNumber: number };

export default function PdfThumbnail({ url, pageNumber }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });
    void task.promise.then(async (document) => {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.22 });
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || cancelled) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      document.cleanup();
    }).catch(() => undefined);
    return () => { cancelled = true; void task.destroy(); };
  }, [url, pageNumber]);

  return <canvas ref={canvasRef} className="pdf-page-thumbnail" aria-hidden="true" />;
}
