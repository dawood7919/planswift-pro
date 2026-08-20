import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";

const nativeProjectIdPattern = /^[A-Za-z0-9_-]{8,36}$/;

type NativeProjectSummary = {
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  currency: string;
  lengthUnit: string;
  updatedAt: string;
};

export function toNativeProjectSummaries(projects: Array<{
  id: string;
  name: string;
  clientName: string | null;
  location: string | null;
  currency: string;
  lengthUnit: string;
  updatedAt: Date;
}>): NativeProjectSummary[] {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    location: project.location,
    currency: project.currency,
    lengthUnit: project.lengthUnit,
    updatedAt: project.updatedAt.toISOString(),
  }));
}

function sendNativeError(response: Response, error: unknown) {
  const code = error instanceof Error ? error.message : "NATIVE_API_UNAVAILABLE";
  if (code === "PROJECT_NOT_FOUND" || code === "PROJECT_DOCUMENT_NOT_FOUND") {
    response.status(404).json({ error: code });
    return;
  }
  if (code.includes("Invalid session") || code.includes("User not found") || code.includes("Failed to sync user")) {
    response.status(401).json({ error: "NATIVE_SESSION_INVALID" });
    return;
  }
  console.error("[Native API] Request failed", error);
  response.status(503).json({ error: "NATIVE_API_UNAVAILABLE" });
}

async function nativeUser(request: Request, response: Response) {
  try {
    return await sdk.authenticateRequest(request);
  } catch (error) {
    sendNativeError(response, error);
    return null;
  }
}

export function registerNativeApiRoutes(app: Express) {
  app.get("/api/native/v1/projects", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const user = await nativeUser(request, response);
    if (!user) return;
    try {
      response.json({ projects: toNativeProjectSummaries(await db.listProjects(user.id)) });
    } catch (error) {
      sendNativeError(response, error);
    }
  });

  app.get("/api/native/v1/projects/:projectId/project-file", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const user = await nativeUser(request, response);
    if (!user) return;
    const projectId = request.params.projectId;
    if (!nativeProjectIdPattern.test(projectId)) {
      response.status(400).json({ error: "PROJECT_ID_INVALID" });
      return;
    }
    try {
      const projectFile = await db.exportProjectFile(user.id, projectId);
      response.type("application/json").send(projectFile);
    } catch (error) {
      sendNativeError(response, error);
    }
  });

  app.get("/api/native/v1/projects/:projectId/documents", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const user = await nativeUser(request, response);
    if (!user) return;
    const projectId = request.params.projectId;
    if (!nativeProjectIdPattern.test(projectId)) {
      response.status(400).json({ error: "PROJECT_ID_INVALID" });
      return;
    }
    try {
      response.json({ documents: await db.listOwnedProjectDocuments(user.id, projectId) });
    } catch (error) {
      sendNativeError(response, error);
    }
  });

  app.get("/api/native/v1/projects/:projectId/reviews", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const user = await nativeUser(request, response);
    if (!user) return;
    const projectId = request.params.projectId;
    if (!nativeProjectIdPattern.test(projectId)) {
      response.status(400).json({ error: "PROJECT_ID_INVALID" });
      return;
    }
    try {
      response.json({ reviews: await db.listNativeProjectReviews(user.id, projectId) });
    } catch (error) {
      sendNativeError(response, error);
    }
  });

  app.get("/api/native/v1/projects/:projectId/documents/:documentId/download", async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const user = await nativeUser(request, response);
    if (!user) return;
    const { projectId, documentId } = request.params;
    if (!nativeProjectIdPattern.test(projectId) || !nativeProjectIdPattern.test(documentId)) {
      response.status(400).json({ error: "PROJECT_OR_DOCUMENT_ID_INVALID" });
      return;
    }
    try {
      const document = await db.getOwnedProjectDocument(user.id, projectId, documentId);
      if (document.mimeType !== "application/pdf") {
        response.status(415).json({ error: "PDF_DOCUMENT_REQUIRED" });
        return;
      }
      response.redirect(302, await storageGetSignedUrl(document.storageKey));
    } catch (error) {
      sendNativeError(response, error);
    }
  });
}
