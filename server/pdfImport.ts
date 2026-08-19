import type { Express, Request } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const maxPdfBytes = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPdfBytes, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")),
});

async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const task = getDocument({ data: new Uint8Array(buffer) });
  try {
    const document = await task.promise;
    const pageCount = document.numPages;
    document.cleanup();
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 500) throw new Error("VALID_PAGE_COUNT_REQUIRED");
    return pageCount;
  } finally {
    await task.destroy();
  }
}

export function registerPdfImportRoutes(app: Express) {
  app.post("/api/projects/:projectId/documents", upload.single("file"), async (request, response) => {
    try {
      const user = await sdk.authenticateRequest(request);
      if (!user) return response.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
      const file = request.file;
      if (!file || file.size === 0 || file.size > maxPdfBytes) return response.status(400).json({ error: "PDF_FILE_REQUIRED" });
      if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return response.status(400).json({ error: "INVALID_PDF_FILE" });
      const pageCount = await getPdfPageCount(file.buffer);

      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "drawing.pdf";
      const stored = await storagePut(`takeoff/${user.id}/${request.params.projectId}/documents/${nanoid(12)}-${safeName}`, file.buffer, "application/pdf");
      const imported = await db.importPdfDocument(user.id, request.params.projectId, {
        originalName: file.originalname.slice(0, 240),
        storageKey: stored.key,
        storageUrl: stored.url,
        byteSize: file.size,
        pageCount,
      });
      return response.status(201).json(imported);
    } catch (error) {
      const message = error instanceof Error ? error.message : "DOCUMENT_IMPORT_FAILED";
      const status = message === "PROJECT_NOT_FOUND" ? 404 : message === "INVALID_PDF_FILE" || message === "VALID_PAGE_COUNT_REQUIRED" ? 400 : 500;
      return response.status(status).json({ error: message });
    }
  });
}
