import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, pageAnnotations, pageScaleContexts, projectCommands, projectDocuments, projectPages, projectReviews, projectVersions, projects, takeoffItems, takeoffTemplates, templateCostItems, templateDependencies, templateFolders, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from "nanoid";
import { parseProjectFile, PROJECT_FILE_VERSION, stringifyProjectFile, type TakeoffProjectFile } from "../shared/takeoff-core/projectFile";
import { inspectTemplateDependencies, type TemplateDependencyNode } from "../shared/takeoff-core/templateDeps";
import { BLANK_PAGE_SIZE, fromLegacyViewBoxGeometry } from "../shared/takeoff-core/viewport";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

/**
 * Pages with no PDF behind them use the synthetic page defined by the takeoff core, so a
 * blank drawing keeps the coordinates it always had while still being page-anchored.
 */
const BLANK_PAGE_DEFAULTS = {
  pageWidth: BLANK_PAGE_SIZE.width.toFixed(4),
  pageHeight: BLANK_PAGE_SIZE.height.toFixed(4),
  pageRotation: 0,
  geometrySpace: "PAGE_POINTS",
} as const;

export type CreateProjectInput = {
  name: string;
  clientName?: string;
  location?: string;
  currency: string;
  lengthUnit: string;
};

export async function listProjects(ownerId: number) {
  const db = requireDb(await getDb());
  return db.select().from(projects).where(eq(projects.ownerId, ownerId)).orderBy(desc(projects.updatedAt));
}

export async function createProject(ownerId: number, input: CreateProjectInput) {
  const db = requireDb(await getDb());
  const id = nanoid(20);
  const pageId = nanoid(20);
  await db.insert(projects).values({ id, ownerId, ...input });
  await db.insert(projectPages).values({ id: pageId, projectId: id, name: "الصفحة 1", sortOrder: 0, ...BLANK_PAGE_DEFAULTS });
  await db.insert(projectCommands).values({
    id: nanoid(20), projectId: id, sequence: 1, type: "CREATE_PROJECT", payloadJson: JSON.stringify({ pageId }),
  });
  return { id, pageId };
}

export async function getProjectWorkspace(ownerId: number, projectId: string) {
  const db = requireDb(await getDb());
  const project = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!project[0]) return null;
  const pages = await db.select().from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(projectPages.sortOrder);
  const items = await db.select().from(takeoffItems).where(eq(takeoffItems.projectId, projectId)).orderBy(takeoffItems.createdAt);
  const commands = await db.select().from(projectCommands).where(eq(projectCommands.projectId, projectId)).orderBy(projectCommands.sequence);
  const documents = await db.select().from(projectDocuments).where(eq(projectDocuments.projectId, projectId)).orderBy(desc(projectDocuments.createdAt));
  const reviews = await db.select().from(projectReviews).where(eq(projectReviews.projectId, projectId)).orderBy(desc(projectReviews.createdAt));
  const annotations = await db.select().from(pageAnnotations).where(eq(pageAnnotations.projectId, projectId)).orderBy(desc(pageAnnotations.createdAt));
  const scaleContexts = await db.select().from(pageScaleContexts).where(eq(pageScaleContexts.projectId, projectId)).orderBy(desc(pageScaleContexts.createdAt));
  const versions = await db.select({ id: projectVersions.id, label: projectVersions.label, createdAt: projectVersions.createdAt }).from(projectVersions).where(eq(projectVersions.projectId, projectId)).orderBy(desc(projectVersions.createdAt));
  return { project: project[0], pages, items, commands, documents, reviews, annotations, scaleContexts, versions };
}

export async function exportProjectFile(ownerId: number, projectId: string) {
  const workspace = await getProjectWorkspace(ownerId, projectId);
  if (!workspace) throw new Error("PROJECT_NOT_FOUND");
  const file: TakeoffProjectFile = {
    format: "takeoff-project",
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: workspace.project.name,
      clientName: workspace.project.clientName,
      location: workspace.project.location,
      currency: workspace.project.currency,
      lengthUnit: workspace.project.lengthUnit,
    },
    pages: workspace.pages.map((page) => ({ sourceId: page.id, name: page.name, sortOrder: page.sortOrder, scaleDrawingDistance: page.scaleDrawingDistance, scaleWorldDistance: page.scaleWorldDistance, scaleUnit: page.scaleUnit, pageWidth: page.pageWidth, pageHeight: page.pageHeight, pageRotation: page.pageRotation, geometrySpace: page.geometrySpace })),
    items: workspace.items.map((item) => ({ sourceId: item.id, pageSourceId: item.pageId, kind: item.kind, name: item.name, color: item.color, geometry: JSON.parse(item.geometryJson), rate: String(item.rate), multiplier: String(item.multiplier) })),
  };
  return stringifyProjectFile(file);
}

export async function listOwnedProjectDocuments(ownerId: number, projectId: string) {
  const db = requireDb(await getDb());
  const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return db.select({ id: projectDocuments.id, originalName: projectDocuments.originalName, byteSize: projectDocuments.byteSize, pageCount: projectDocuments.pageCount }).from(projectDocuments).where(eq(projectDocuments.projectId, projectId)).orderBy(desc(projectDocuments.createdAt));
}

export async function getOwnedProjectDocument(ownerId: number, projectId: string, documentId: string) {
  const db = requireDb(await getDb());
  const [document] = await db.select({ id: projectDocuments.id, storageKey: projectDocuments.storageKey, originalName: projectDocuments.originalName, mimeType: projectDocuments.mimeType }).from(projectDocuments)
    .innerJoin(projects, eq(projects.id, projectDocuments.projectId))
    .where(and(eq(projectDocuments.id, documentId), eq(projectDocuments.projectId, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  if (!document) throw new Error("PROJECT_DOCUMENT_NOT_FOUND");
  return document;
}

export async function importProjectFile(ownerId: number, file: TakeoffProjectFile) {
  const db = requireDb(await getDb());
  const projectId = nanoid(20);
  const pageIds = new Map(file.pages.map((page) => [page.sourceId, nanoid(20)]));
  const firstPage = file.pages.slice().sort((left, right) => left.sortOrder - right.sortOrder)[0];
  await db.insert(projects).values({ id: projectId, ownerId, name: file.project.name, clientName: file.project.clientName, location: file.project.location, currency: file.project.currency, lengthUnit: file.project.lengthUnit });
  await db.insert(projectPages).values(file.pages.map((page) => ({ id: pageIds.get(page.sourceId)!, projectId, name: page.name, sortOrder: page.sortOrder, scaleDrawingDistance: page.scaleDrawingDistance, scaleWorldDistance: page.scaleWorldDistance, scaleUnit: page.scaleUnit, pageWidth: page.pageWidth, pageHeight: page.pageHeight, pageRotation: page.pageRotation, geometrySpace: page.geometrySpace })));
  if (file.items.length) {
    await db.insert(takeoffItems).values(file.items.map((item) => ({ id: nanoid(20), projectId, pageId: pageIds.get(item.pageSourceId)!, kind: item.kind, name: item.name, color: item.color, geometryJson: JSON.stringify(item.geometry), rate: item.rate, multiplier: item.multiplier ?? "1", templateId: null })));
  }
  await db.insert(projectCommands).values({ id: nanoid(20), projectId, sequence: 1, type: "IMPORT_PROJECT_FILE", payloadJson: JSON.stringify({ version: file.version, itemCount: file.items.length, pageCount: file.pages.length }) });
  return { id: projectId, pageId: pageIds.get(firstPage!.sourceId)! };
}

export async function createProjectVersion(ownerId: number, projectId: string, label: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const snapshotJson = await exportProjectFile(ownerId, projectId);
  const version = { id: nanoid(20), projectId, label, snapshotJson };
  await db.insert(projectVersions).values(version);
  await appendProjectCommand(db, projectId, "CREATE_PROJECT_VERSION", { versionId: version.id, label });
  return { id: version.id, label: version.label };
}

export async function restoreProjectVersion(ownerId: number, projectId: string, versionId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [version] = await db.select().from(projectVersions).where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId))).limit(1);
  if (!version) throw new Error("PROJECT_VERSION_NOT_FOUND");
  const snapshot = parseProjectFile(version.snapshotJson);
  const suffix = ` — استعادة ${version.label}`;
  const restored = await importProjectFile(ownerId, { ...snapshot, project: { ...snapshot.project, name: `${snapshot.project.name.slice(0, Math.max(1, 160 - suffix.length))}${suffix}` } });
  await appendProjectCommand(db, projectId, "RESTORE_PROJECT_VERSION", { versionId, restoredProjectId: restored.id });
  return restored;
}

export type ImportPdfInput = {
  originalName: string;
  storageKey: string;
  storageUrl: string;
  byteSize: number;
  /** One entry per sheet, in page order, sized in PDF points with /Rotate applied. */
  pageGeometry: Array<{ width: number; height: number; rotation: number }>;
};

export async function importPdfDocument(ownerId: number, projectId: string, input: ImportPdfInput) {
  const db = requireDb(await getDb());
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!project[0]) throw new Error("PROJECT_NOT_FOUND");

  if (!input.pageGeometry.length) throw new Error("VALID_PAGE_COUNT_REQUIRED");
  const existingPages = await db.select({ sortOrder: projectPages.sortOrder }).from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(desc(projectPages.sortOrder)).limit(1);
  const documentId = nanoid(20);
  const startOrder = (existingPages[0]?.sortOrder ?? -1) + 1;
  const pageRows = input.pageGeometry.map((geometry, index) => ({
    id: nanoid(20),
    projectId,
    name: `${input.originalName.replace(/\.pdf$/i, "")} — ${index + 1}`,
    sortOrder: startOrder + index,
    backgroundUrl: input.storageUrl,
    documentId,
    pdfPageNumber: index + 1,
    pageWidth: geometry.width.toFixed(4),
    pageHeight: geometry.height.toFixed(4),
    pageRotation: geometry.rotation,
    // Pages imported from here on capture points directly in page space.
    geometrySpace: "PAGE_POINTS" as const,
  }));
  await db.insert(projectDocuments).values({
    id: documentId,
    projectId,
    originalName: input.originalName,
    storageKey: input.storageKey,
    storageUrl: input.storageUrl,
    mimeType: "application/pdf",
    byteSize: input.byteSize,
    pageCount: input.pageGeometry.length,
  });
  await db.insert(projectPages).values(pageRows);
  const lastCommand = await db.select({ sequence: projectCommands.sequence }).from(projectCommands).where(eq(projectCommands.projectId, projectId)).orderBy(desc(projectCommands.sequence)).limit(1);
  await db.insert(projectCommands).values({
    id: nanoid(20),
    projectId,
    sequence: (lastCommand[0]?.sequence ?? 0) + 1,
    type: "IMPORT_PDF",
    payloadJson: JSON.stringify({ documentId, pageCount: input.pageGeometry.length, originalName: input.originalName }),
  });
  return { documentId, pages: pageRows.map(({ id, name, sortOrder, pdfPageNumber, backgroundUrl }) => ({ id, name, sortOrder, pdfPageNumber, backgroundUrl })) };
}

async function requireOwnedProject(ownerId: number, projectId: string) {
  const db = requireDb(await getDb());
  const project = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!project[0]) throw new Error("PROJECT_NOT_FOUND");
  return db;
}

async function appendProjectCommand(
  db: ReturnType<typeof drizzle>,
  projectId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  const lastCommand = await db.select({ sequence: projectCommands.sequence }).from(projectCommands).where(eq(projectCommands.projectId, projectId)).orderBy(desc(projectCommands.sequence)).limit(1);
  await db.insert(projectCommands).values({
    id: nanoid(20),
    projectId,
    sequence: (lastCommand[0]?.sequence ?? 0) + 1,
    type,
    payloadJson: JSON.stringify(payload),
  });
}

async function normalizePageOrder(db: ReturnType<typeof drizzle>, projectId: string) {
  const pages = await db.select({ id: projectPages.id, sortOrder: projectPages.sortOrder }).from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(projectPages.sortOrder);
  const offset = Math.max(...pages.map((page) => page.sortOrder), 0) + pages.length + 1;
  for (const page of pages) {
    await db.update(projectPages).set({ sortOrder: page.sortOrder + offset }).where(and(eq(projectPages.id, page.id), eq(projectPages.projectId, projectId)));
  }
  for (let sortOrder = 0; sortOrder < pages.length; sortOrder += 1) {
    const page = pages[sortOrder]!;
    await db.update(projectPages).set({ sortOrder }).where(and(eq(projectPages.id, page.id), eq(projectPages.projectId, projectId)));
  }
  return pages;
}

export async function addBlankProjectPage(ownerId: number, projectId: string, name = "رسم جديد") {
  const db = await requireOwnedProject(ownerId, projectId);
  const existing = await db.select({ sortOrder: projectPages.sortOrder }).from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(desc(projectPages.sortOrder)).limit(1);
  const page = { id: nanoid(20), projectId, name, sortOrder: (existing[0]?.sortOrder ?? -1) + 1, ...BLANK_PAGE_DEFAULTS };
  await db.insert(projectPages).values(page);
  await appendProjectCommand(db, projectId, "CREATE_PAGE", { pageId: page.id, name: page.name });
  return page;
}

export async function renameProjectPage(ownerId: number, projectId: string, pageId: string, name: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const page = await db.select({ id: projectPages.id }).from(projectPages).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId))).limit(1);
  if (!page[0]) throw new Error("PAGE_NOT_FOUND");
  await db.update(projectPages).set({ name }).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));
  await appendProjectCommand(db, projectId, "RENAME_PAGE", { pageId, name });
  return { id: pageId, name };
}

export async function deleteProjectPage(ownerId: number, projectId: string, pageId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const pages = await db.select({ id: projectPages.id }).from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(projectPages.sortOrder);
  if (pages.length <= 1) throw new Error("LAST_PAGE_REQUIRED");
  if (!pages.some((page) => page.id === pageId)) throw new Error("PAGE_NOT_FOUND");
  await db.delete(takeoffItems).where(and(eq(takeoffItems.projectId, projectId), eq(takeoffItems.pageId, pageId)));
  await db.delete(projectPages).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));
  const remaining = await normalizePageOrder(db, projectId);
  await appendProjectCommand(db, projectId, "DELETE_PAGE", { pageId });
  return { deletedPageId: pageId, nextPageId: remaining[0]?.id ?? null };
}

/**
 * Rebases a page's takeoff geometry from the legacy stretched viewBox onto the page itself.
 *
 * The scale is deliberately cleared: the old calibration factor described the stretched
 * space, so it is meaningless here. The quantities that page reported before this call
 * cannot be reconstructed — the container aspect ratio at capture time was never stored —
 * so the page must be re-calibrated, and this is why the migration is never automatic.
 */
export async function migratePageGeometry(
  ownerId: number,
  projectId: string,
  pageId: string,
  pageSize: { width: number; height: number },
) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [page] = await db.select().from(projectPages).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId))).limit(1);
  if (!page) throw new Error("PAGE_NOT_FOUND");
  if (page.geometrySpace === "PAGE_POINTS") throw new Error("PAGE_ALREADY_MIGRATED");

  const stored = Number(page.pageWidth) > 0 && Number(page.pageHeight) > 0
    ? { width: Number(page.pageWidth), height: Number(page.pageHeight) }
    : null;
  // Trust a recorded size over anything the client reports.
  const resolved = stored ?? pageSize;
  if (!Number.isFinite(resolved.width) || !Number.isFinite(resolved.height) || resolved.width <= 0 || resolved.height <= 0) {
    throw new Error("PAGE_SIZE_REQUIRED");
  }

  const pageItems = await db.select().from(takeoffItems).where(and(eq(takeoffItems.projectId, projectId), eq(takeoffItems.pageId, pageId)));
  for (const item of pageItems) {
    const geometry = fromLegacyViewBoxGeometry(JSON.parse(item.geometryJson), resolved);
    await db.update(takeoffItems).set({ geometryJson: JSON.stringify(geometry) }).where(eq(takeoffItems.id, item.id));
  }

  await db.update(projectPages).set({
    pageWidth: resolved.width.toFixed(4),
    pageHeight: resolved.height.toFixed(4),
    geometrySpace: "PAGE_POINTS",
    scaleDrawingDistance: null,
    scaleWorldDistance: null,
    scaleUnit: null,
    activeScaleContextId: null,
  }).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));

  await appendProjectCommand(db, projectId, "MIGRATE_PAGE_GEOMETRY", { pageId, itemCount: pageItems.length, pageWidth: resolved.width, pageHeight: resolved.height });
  return { pageId, itemCount: pageItems.length, requiresRecalibration: true as const };
}

export async function reorderProjectPages(ownerId: number, projectId: string, pageIds: string[]) {
  const db = await requireOwnedProject(ownerId, projectId);
  const pages = await db.select({ id: projectPages.id, sortOrder: projectPages.sortOrder }).from(projectPages).where(eq(projectPages.projectId, projectId)).orderBy(projectPages.sortOrder);
  if (pages.length !== pageIds.length || new Set(pageIds).size !== pageIds.length || pages.some((page) => !pageIds.includes(page.id))) {
    throw new Error("INVALID_PAGE_ORDER");
  }
  const offset = Math.max(...pages.map((page) => page.sortOrder), 0) + pages.length + 1;
  for (const page of pages) {
    await db.update(projectPages).set({ sortOrder: page.sortOrder + offset }).where(and(eq(projectPages.id, page.id), eq(projectPages.projectId, projectId)));
  }
  for (let sortOrder = 0; sortOrder < pageIds.length; sortOrder += 1) {
    const pageId = pageIds[sortOrder]!;
    await db.update(projectPages).set({ sortOrder }).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));
  }
  await appendProjectCommand(db, projectId, "REORDER_PAGES", { pageIds });
  return { pageIds };
}

export type CreateScaleContextInput = {
  pageId: string;
  name: string;
  drawingDistance: number;
  worldDistance: number;
  unit: string;
};

export async function createPageScaleContext(ownerId: number, projectId: string, input: CreateScaleContextInput) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [page] = await db.select({ id: projectPages.id }).from(projectPages).where(and(eq(projectPages.id, input.pageId), eq(projectPages.projectId, projectId))).limit(1);
  if (!page) throw new Error("PAGE_NOT_FOUND");
  const context = { id: nanoid(20), projectId, pageId: input.pageId, name: input.name, drawingDistance: input.drawingDistance.toString(), worldDistance: input.worldDistance.toString(), unit: input.unit };
  await db.insert(pageScaleContexts).values(context);
  await db.update(projectPages).set({ activeScaleContextId: context.id, scaleDrawingDistance: context.drawingDistance, scaleWorldDistance: context.worldDistance, scaleUnit: context.unit }).where(and(eq(projectPages.id, input.pageId), eq(projectPages.projectId, projectId)));
  await appendProjectCommand(db, projectId, "CREATE_SCALE_CONTEXT", { contextId: context.id, pageId: input.pageId, name: input.name });
  return context;
}

export async function activatePageScaleContext(ownerId: number, projectId: string, pageId: string, contextId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [context] = await db.select().from(pageScaleContexts).where(and(eq(pageScaleContexts.id, contextId), eq(pageScaleContexts.projectId, projectId), eq(pageScaleContexts.pageId, pageId))).limit(1);
  if (!context) throw new Error("SCALE_CONTEXT_NOT_FOUND");
  await db.update(projectPages).set({ activeScaleContextId: context.id, scaleDrawingDistance: context.drawingDistance, scaleWorldDistance: context.worldDistance, scaleUnit: context.unit }).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));
  await appendProjectCommand(db, projectId, "ACTIVATE_SCALE_CONTEXT", { contextId, pageId });
  return context;
}

export async function deletePageScaleContext(ownerId: number, projectId: string, pageId: string, contextId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [context] = await db.select({ id: pageScaleContexts.id }).from(pageScaleContexts).where(and(eq(pageScaleContexts.id, contextId), eq(pageScaleContexts.projectId, projectId), eq(pageScaleContexts.pageId, pageId))).limit(1);
  if (!context) throw new Error("SCALE_CONTEXT_NOT_FOUND");
  const [page] = await db.select({ activeScaleContextId: projectPages.activeScaleContextId }).from(projectPages).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId))).limit(1);
  await db.delete(pageScaleContexts).where(and(eq(pageScaleContexts.id, contextId), eq(pageScaleContexts.projectId, projectId), eq(pageScaleContexts.pageId, pageId)));
  if (page?.activeScaleContextId === contextId) await db.update(projectPages).set({ activeScaleContextId: null, scaleDrawingDistance: null, scaleWorldDistance: null, scaleUnit: null }).where(and(eq(projectPages.id, pageId), eq(projectPages.projectId, projectId)));
  await appendProjectCommand(db, projectId, "DELETE_SCALE_CONTEXT", { contextId, pageId });
  return { deleted: true };
}

export type CreateProjectReviewInput = {
  sourcePageId: string;
  referenceDocumentId: string;
  label: string;
  note?: string;
};

export async function listProjectReviews(ownerId: number, projectId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  return db.select().from(projectReviews).where(eq(projectReviews.projectId, projectId)).orderBy(desc(projectReviews.createdAt));
}

export async function listNativeProjectReviews(ownerId: number, projectId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  return db.select({
    id: projectReviews.id,
    sourcePageId: projectReviews.sourcePageId,
    referenceDocumentId: projectReviews.referenceDocumentId,
    label: projectReviews.label,
    note: projectReviews.note,
    referenceDocumentName: projectDocuments.originalName,
    createdAt: projectReviews.createdAt,
  }).from(projectReviews)
    .innerJoin(projectDocuments, eq(projectDocuments.id, projectReviews.referenceDocumentId))
    .where(eq(projectReviews.projectId, projectId))
    .orderBy(desc(projectReviews.createdAt));
}

export async function createProjectReview(ownerId: number, projectId: string, input: CreateProjectReviewInput) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [sourcePage] = await db.select({ id: projectPages.id, documentId: projectPages.documentId }).from(projectPages).where(and(eq(projectPages.id, input.sourcePageId), eq(projectPages.projectId, projectId))).limit(1);
  const [referenceDocument] = await db.select({ id: projectDocuments.id }).from(projectDocuments).where(and(eq(projectDocuments.id, input.referenceDocumentId), eq(projectDocuments.projectId, projectId))).limit(1);
  if (!sourcePage || !referenceDocument) throw new Error("REVIEW_CONTEXT_NOT_FOUND");
  if (sourcePage.documentId === input.referenceDocumentId) throw new Error("REFERENCE_DOCUMENT_SAME_AS_SOURCE");
  const existing = await db.select({ id: projectReviews.id }).from(projectReviews).where(and(eq(projectReviews.projectId, projectId), eq(projectReviews.sourcePageId, input.sourcePageId), eq(projectReviews.referenceDocumentId, input.referenceDocumentId))).limit(1);
  if (existing[0]) throw new Error("REVIEW_ALREADY_EXISTS");
  const review = { id: nanoid(20), projectId, sourcePageId: input.sourcePageId, referenceDocumentId: input.referenceDocumentId, label: input.label, note: input.note || null };
  await db.insert(projectReviews).values(review);
  await appendProjectCommand(db, projectId, "SAVE_REVIEW", { reviewId: review.id, sourcePageId: input.sourcePageId, referenceDocumentId: input.referenceDocumentId });
  return review;
}

export async function deleteProjectReview(ownerId: number, projectId: string, reviewId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [review] = await db.select({ id: projectReviews.id }).from(projectReviews).where(and(eq(projectReviews.id, reviewId), eq(projectReviews.projectId, projectId))).limit(1);
  if (!review) throw new Error("REVIEW_NOT_FOUND");
  await db.delete(projectReviews).where(and(eq(projectReviews.id, reviewId), eq(projectReviews.projectId, projectId)));
  await appendProjectCommand(db, projectId, "DELETE_REVIEW", { reviewId });
  return { deleted: true };
}

export type CreatePageAnnotationInput = { pageId: string; text: string; x: string; y: string; color: string };

export async function listPageAnnotations(ownerId: number, projectId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  return db.select().from(pageAnnotations).where(eq(pageAnnotations.projectId, projectId)).orderBy(desc(pageAnnotations.createdAt));
}

export async function createPageAnnotation(ownerId: number, projectId: string, input: CreatePageAnnotationInput) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [page] = await db.select({ id: projectPages.id }).from(projectPages).where(and(eq(projectPages.id, input.pageId), eq(projectPages.projectId, projectId))).limit(1);
  if (!page) throw new Error("ANNOTATION_PAGE_NOT_FOUND");
  const annotation = { id: nanoid(20), projectId, pageId: input.pageId, ownerId, text: input.text, x: input.x, y: input.y, color: input.color };
  await db.insert(pageAnnotations).values(annotation);
  await appendProjectCommand(db, projectId, "CREATE_ANNOTATION", { annotationId: annotation.id, pageId: input.pageId, x: input.x, y: input.y });
  return annotation;
}

export async function deletePageAnnotation(ownerId: number, projectId: string, annotationId: string) {
  const db = await requireOwnedProject(ownerId, projectId);
  const [annotation] = await db.select({ id: pageAnnotations.id, pageId: pageAnnotations.pageId }).from(pageAnnotations).where(and(eq(pageAnnotations.id, annotationId), eq(pageAnnotations.projectId, projectId), eq(pageAnnotations.ownerId, ownerId))).limit(1);
  if (!annotation) throw new Error("ANNOTATION_NOT_FOUND");
  await db.delete(pageAnnotations).where(and(eq(pageAnnotations.id, annotationId), eq(pageAnnotations.projectId, projectId), eq(pageAnnotations.ownerId, ownerId)));
  await appendProjectCommand(db, projectId, "DELETE_ANNOTATION", { annotationId, pageId: annotation.pageId });
  return { deleted: true };
}

export type CreateTemplateInput = {
  kind: "PART" | "ASSEMBLY";
  name: string;
  formula: string;
  unit: string;
  rate: string;
  folderId?: string | null;
  dependencyIds?: string[];
};

export type UpdateTemplateInput = Omit<CreateTemplateInput, "kind">;

export function requireOwnedTemplate<T extends { id: string }>(template: T | undefined): T {
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  return template;
}

export function assertOwnedTemplateIds(requestedIds: string[], ownedTemplates: Array<{ id: string }>) {
  if (requestedIds.length !== ownedTemplates.length || requestedIds.some((templateId) => !ownedTemplates.some((template) => template.id === templateId))) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
}

async function requireOwnedTemplateFolder(db: ReturnType<typeof drizzle>, ownerId: number, folderId: string | null | undefined) {
  if (!folderId) return null;
  const [folder] = await db.select({ id: templateFolders.id }).from(templateFolders).where(and(eq(templateFolders.id, folderId), eq(templateFolders.ownerId, ownerId))).limit(1);
  if (!folder) throw new Error("TEMPLATE_FOLDER_NOT_FOUND");
  return folder;
}

function normalizeTemplateDependencyIds(dependencyIds: string[] | undefined) {
  const normalized = dependencyIds ?? [];
  if (normalized.some((templateId) => !templateId)) throw new Error("TEMPLATE_DEPENDENCY_NOT_FOUND");
  if (new Set(normalized).size !== normalized.length) throw new Error("TEMPLATE_DEPENDENCY_DUPLICATE");
  return normalized;
}

function toTemplateDependencyNodes(templates: Array<{ id: string; formula: string; rate: string | number; dependencyIds: string[] }>): TemplateDependencyNode[] {
  return templates.map((template) => ({ id: template.id, formula: template.formula, rate: template.rate, dependencyIds: template.dependencyIds }));
}

async function listTemplateDependencies(db: ReturnType<typeof drizzle>, ownerId: number, templateIds: string[]) {
  if (!templateIds.length) return [];
  return db.select().from(templateDependencies).where(and(eq(templateDependencies.ownerId, ownerId), inArray(templateDependencies.templateId, templateIds)));
}

async function listTemplateCostItems(db: ReturnType<typeof drizzle>, ownerId: number, templateIds: string[]) {
  if (!templateIds.length) return [];
  return db.select().from(templateCostItems).where(and(eq(templateCostItems.ownerId, ownerId), inArray(templateCostItems.templateId, templateIds)));
}

async function insertTemplateDependencies(db: ReturnType<typeof drizzle>, ownerId: number, templateId: string, dependencyIds: string[]) {
  if (!dependencyIds.length) return;
  await db.insert(templateDependencies).values(dependencyIds.map((dependsOnTemplateId) => ({ id: nanoid(20), ownerId, templateId, dependsOnTemplateId })));
}

export async function listTakeoffTemplates(ownerId: number) {
  const db = requireDb(await getDb());
  const templates = await db.select().from(takeoffTemplates).where(eq(takeoffTemplates.ownerId, ownerId)).orderBy(desc(takeoffTemplates.updatedAt));
  const templateIds = templates.map((template) => template.id);
  const [dependencies, costItems] = await Promise.all([listTemplateDependencies(db, ownerId, templateIds), listTemplateCostItems(db, ownerId, templateIds)]);
  return templates.map((template) => ({
    ...template,
    dependencyIds: dependencies.filter((dependency) => dependency.templateId === template.id).map((dependency) => dependency.dependsOnTemplateId),
    costItems: costItems.filter((item) => item.templateId === template.id),
  }));
}

type TemplateLookupDb = { select: () => unknown };

export async function getTakeoffTemplate(ownerId: number, templateId: string, testDb?: TemplateLookupDb) {
  const db = (testDb ?? requireDb(await getDb())) as ReturnType<typeof drizzle>;
  const templates = await db.select().from(takeoffTemplates).where(and(eq(takeoffTemplates.id, templateId), eq(takeoffTemplates.ownerId, ownerId))).limit(1);
  const template = requireOwnedTemplate(templates[0]);
  const [dependencies, costItems] = await Promise.all([listTemplateDependencies(db, ownerId, [template.id]), listTemplateCostItems(db, ownerId, [template.id])]);
  return { ...template, dependencyIds: dependencies.map((dependency) => dependency.dependsOnTemplateId), costItems };
}

export async function createTakeoffTemplate(ownerId: number, input: CreateTemplateInput) {
  const db = requireDb(await getDb());
  await requireOwnedTemplateFolder(db, ownerId, input.folderId);
  const dependencyIds = normalizeTemplateDependencyIds(input.dependencyIds);
  if (dependencyIds.length) {
    const ownedDependencies = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.ownerId, ownerId), inArray(takeoffTemplates.id, dependencyIds)));
    assertOwnedTemplateIds(dependencyIds, ownedDependencies);
  }
  const template = { id: nanoid(20), ownerId, folderId: input.folderId ?? null, kind: input.kind, name: input.name, formula: input.formula, unit: input.unit, rate: input.rate };
  const existingTemplates = await listTakeoffTemplates(ownerId);
  const diagnostic = inspectTemplateDependencies(toTemplateDependencyNodes([...existingTemplates, { ...template, dependencyIds }]), template.id);
  if (!diagnostic.valid) throw new Error(diagnostic.code!);
  await db.insert(takeoffTemplates).values(template);
  await insertTemplateDependencies(db, ownerId, template.id, dependencyIds);
  return { ...template, dependencyIds, costItems: [] };
}

export async function updateTakeoffTemplate(ownerId: number, templateId: string, input: UpdateTemplateInput) {
  const db = requireDb(await getDb());
  const existingTemplates = await listTakeoffTemplates(ownerId);
  const existing = requireOwnedTemplate(existingTemplates.find((template) => template.id === templateId));
  await requireOwnedTemplateFolder(db, ownerId, input.folderId);
  const dependencyIds = normalizeTemplateDependencyIds(input.dependencyIds);
  if (dependencyIds.length) {
    const ownedDependencies = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.ownerId, ownerId), inArray(takeoffTemplates.id, dependencyIds)));
    assertOwnedTemplateIds(dependencyIds, ownedDependencies);
  }
  const proposedTemplates = existingTemplates.map((template) => template.id === templateId ? { ...template, name: input.name, formula: input.formula, unit: input.unit, rate: input.rate, dependencyIds } : template);
  const diagnostic = inspectTemplateDependencies(toTemplateDependencyNodes(proposedTemplates), templateId);
  if (!diagnostic.valid) throw new Error(diagnostic.code!);
  await db.update(takeoffTemplates).set({ folderId: input.folderId ?? null, name: input.name, formula: input.formula, unit: input.unit, rate: input.rate }).where(and(eq(takeoffTemplates.id, templateId), eq(takeoffTemplates.ownerId, ownerId)));
  await db.delete(templateDependencies).where(and(eq(templateDependencies.ownerId, ownerId), eq(templateDependencies.templateId, templateId)));
  await insertTemplateDependencies(db, ownerId, templateId, dependencyIds);
  return { ...existing, ...input, dependencyIds };
}

export async function deleteTakeoffTemplate(ownerId: number, templateId: string) {
  const db = requireDb(await getDb());
  const template = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.id, templateId), eq(takeoffTemplates.ownerId, ownerId))).limit(1);
  requireOwnedTemplate(template[0]);
  const dependents = await db.select({ id: templateDependencies.id }).from(templateDependencies).where(and(eq(templateDependencies.ownerId, ownerId), eq(templateDependencies.dependsOnTemplateId, templateId))).limit(1);
  if (dependents[0]) throw new Error("TEMPLATE_DEPENDENCY_IN_USE");
  await db.update(takeoffItems).set({ templateId: null }).where(eq(takeoffItems.templateId, templateId));
  await db.delete(templateDependencies).where(and(eq(templateDependencies.ownerId, ownerId), eq(templateDependencies.templateId, templateId)));
  await db.delete(templateCostItems).where(and(eq(templateCostItems.ownerId, ownerId), eq(templateCostItems.templateId, templateId)));
  await db.delete(takeoffTemplates).where(and(eq(takeoffTemplates.id, templateId), eq(takeoffTemplates.ownerId, ownerId)));
  return { deleted: true };
}

export type TemplateCostItemInput = {
  templateId: string;
  kind: "MATERIAL" | "LABOR" | "EQUIPMENT";
  name: string;
  quantityFormula: string;
  unit: string;
  rate: string;
  wastePercent: string;
};

export async function listTemplateFolders(ownerId: number) {
  const db = requireDb(await getDb());
  return db.select().from(templateFolders).where(eq(templateFolders.ownerId, ownerId)).orderBy(templateFolders.name);
}

export async function createTemplateFolder(ownerId: number, name: string) {
  const db = requireDb(await getDb());
  const folder = { id: nanoid(20), ownerId, name };
  await db.insert(templateFolders).values(folder);
  return folder;
}

export async function deleteTemplateFolder(ownerId: number, folderId: string) {
  const db = requireDb(await getDb());
  const [folder] = await db.select({ id: templateFolders.id }).from(templateFolders).where(and(eq(templateFolders.id, folderId), eq(templateFolders.ownerId, ownerId))).limit(1);
  if (!folder) throw new Error("TEMPLATE_FOLDER_NOT_FOUND");
  const [inUse] = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.ownerId, ownerId), eq(takeoffTemplates.folderId, folderId))).limit(1);
  if (inUse) throw new Error("TEMPLATE_FOLDER_IN_USE");
  await db.delete(templateFolders).where(and(eq(templateFolders.id, folderId), eq(templateFolders.ownerId, ownerId)));
  return { deleted: true };
}

export async function createTemplateCostItem(ownerId: number, input: TemplateCostItemInput) {
  const db = requireDb(await getDb());
  const [template] = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.id, input.templateId), eq(takeoffTemplates.ownerId, ownerId))).limit(1);
  requireOwnedTemplate(template);
  const item = { id: nanoid(20), ownerId, ...input };
  await db.insert(templateCostItems).values(item);
  return item;
}

export async function deleteTemplateCostItem(ownerId: number, costItemId: string) {
  const db = requireDb(await getDb());
  const [item] = await db.select({ id: templateCostItems.id }).from(templateCostItems).where(and(eq(templateCostItems.id, costItemId), eq(templateCostItems.ownerId, ownerId))).limit(1);
  if (!item) throw new Error("TEMPLATE_COST_ITEM_NOT_FOUND");
  await db.delete(templateCostItems).where(and(eq(templateCostItems.id, costItemId), eq(templateCostItems.ownerId, ownerId)));
  return { deleted: true };
}

export type SaveWorkspaceInput = {
  page: {
    id: string;
    name: string;
    scaleDrawingDistance?: number | null;
    scaleWorldDistance?: number | null;
    scaleUnit?: string | null;
  };
  items: Array<{
    id: string;
    pageId: string;
    kind: "AREA" | "ROOF_AREA" | "VOLUME" | "LINEAR" | "SEGMENT" | "COUNT";
    name: string;
    color: string;
    geometryJson: string;
    rate: string;
    multiplier: string;
    templateId?: string | null;
  }>;
  commandEvents: Array<{ type: string; payloadJson: string }>;
};

export async function saveProjectWorkspace(ownerId: number, projectId: string, input: SaveWorkspaceInput) {
  const db = requireDb(await getDb());
  const existing = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId))).limit(1);
  if (!existing[0]) throw new Error("PROJECT_NOT_FOUND");
  const templateIds = Array.from(new Set(input.items.flatMap((item) => item.templateId ? [item.templateId] : [])));
  if (templateIds.length) {
    const templates = await db.select({ id: takeoffTemplates.id }).from(takeoffTemplates).where(and(eq(takeoffTemplates.ownerId, ownerId), inArray(takeoffTemplates.id, templateIds)));
    assertOwnedTemplateIds(templateIds, templates);
  }
  await db.update(projectPages).set({
    name: input.page.name,
    scaleDrawingDistance: input.page.scaleDrawingDistance === null ? null : input.page.scaleDrawingDistance?.toString(),
    scaleWorldDistance: input.page.scaleWorldDistance === null ? null : input.page.scaleWorldDistance?.toString(),
    scaleUnit: input.page.scaleUnit ?? null,
  }).where(and(eq(projectPages.id, input.page.id), eq(projectPages.projectId, projectId)));
  await db.delete(takeoffItems).where(and(eq(takeoffItems.projectId, projectId), eq(takeoffItems.pageId, input.page.id)));
  if (input.items.length) {
    await db.insert(takeoffItems).values(input.items.map((item) => ({ ...item, projectId })));
  }
  const lastCommand = await db.select({ sequence: projectCommands.sequence }).from(projectCommands).where(eq(projectCommands.projectId, projectId)).orderBy(desc(projectCommands.sequence)).limit(1);
  const firstSequence = (lastCommand[0]?.sequence ?? 0) + 1;
  const commandRows = input.commandEvents.map((event, index) => ({ id: nanoid(20), projectId, sequence: firstSequence + index, type: event.type, payloadJson: event.payloadJson }));
  commandRows.push({ id: nanoid(20), projectId, sequence: firstSequence + commandRows.length, type: "SAVE_WORKSPACE", payloadJson: JSON.stringify({ itemCount: input.items.length }) });
  await db.insert(projectCommands).values(commandRows);
  return { saved: true };
}
