import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const projectDb = vi.hoisted(() => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getProjectWorkspace: vi.fn(),
  exportProjectFile: vi.fn(),
  importProjectFile: vi.fn(),
  createProjectVersion: vi.fn(),
  restoreProjectVersion: vi.fn(),
  saveProjectWorkspace: vi.fn(),
  addBlankProjectPage: vi.fn(),
  renameProjectPage: vi.fn(),
  deleteProjectPage: vi.fn(),
  reorderProjectPages: vi.fn(),
  createPageScaleContext: vi.fn(),
  activatePageScaleContext: vi.fn(),
  deletePageScaleContext: vi.fn(),
  listProjectReviews: vi.fn(),
  createProjectReview: vi.fn(),
  deleteProjectReview: vi.fn(),
  listPageAnnotations: vi.fn(),
  createPageAnnotation: vi.fn(),
  deletePageAnnotation: vi.fn(),
  listTakeoffTemplates: vi.fn(),
  getTakeoffTemplate: vi.fn(),
  createTakeoffTemplate: vi.fn(),
  deleteTakeoffTemplate: vi.fn(),
}));

vi.mock("./db", () => projectDb);

import { appRouter } from "./routers";

const user = {
  id: 41,
  openId: "takeoff-test-user",
  email: "engineer@example.com",
  name: "Engineer",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function authenticatedContext(): TrpcContext {
  return { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function anonymousContext(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function alternateUserContext(): TrpcContext {
  return { user: { ...user, id: 99, openId: "other-user" }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("projects router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("protects template operations before reaching persistence", async () => {
    const caller = appRouter.createCaller(anonymousContext()).templates;
    await expect(caller.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.create({ kind: "PART", name: "تبليط", formula: "quantity * rate", unit: "m²", rate: "3" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.delete("template-0001")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(projectDb.listTakeoffTemplates).not.toHaveBeenCalled();
  });

  it("creates a validated template for its authenticated owner", async () => {
    projectDb.createTakeoffTemplate.mockResolvedValue({ id: "template-0001", name: "تبليط", formula: "quantity * rate" });
    const result = await appRouter.createCaller(authenticatedContext()).templates.create({ kind: "PART", name: "تبليط", formula: "quantity * rate", unit: "m²", rate: "3" });
    expect(result).toMatchObject({ id: "template-0001" });
    expect(projectDb.createTakeoffTemplate).toHaveBeenCalledWith(user.id, expect.objectContaining({ name: "تبليط", kind: "PART" }));
  });

  it("rejects unsafe template formulas before persistence", async () => {
    await expect(appRouter.createCaller(authenticatedContext()).templates.create({ kind: "ASSEMBLY", name: "غير آمن", formula: "globalThis.process", unit: "وحدة", rate: "0" })).rejects.toThrow("FORMULA_TOKEN_INVALID");
    expect(projectDb.createTakeoffTemplate).not.toHaveBeenCalled();
  });

  it("scopes template list and deletion to the authenticated owner", async () => {
    projectDb.listTakeoffTemplates.mockResolvedValue([]);
    projectDb.getTakeoffTemplate.mockResolvedValue({ id: "template-0001", ownerId: 99 });
    projectDb.deleteTakeoffTemplate.mockResolvedValue({ deleted: true });
    const caller = appRouter.createCaller(alternateUserContext()).templates;
    await caller.list();
    await caller.get("template-0001");
    await caller.delete("template-0001");
    expect(projectDb.listTakeoffTemplates).toHaveBeenCalledWith(99);
    expect(projectDb.getTakeoffTemplate).toHaveBeenCalledWith(99, "template-0001");
    expect(projectDb.deleteTakeoffTemplate).toHaveBeenCalledWith(99, "template-0001");
  });

  it("lists projects only for the authenticated user", async () => {
    projectDb.listProjects.mockResolvedValue([{ id: "project-0001", ownerId: user.id, name: "Tower" }]);
    const result = await appRouter.createCaller(authenticatedContext()).projects.list();
    expect(projectDb.listProjects).toHaveBeenCalledWith(user.id);
    expect(result).toHaveLength(1);
  });

  it("refuses project routes before invoking storage when no user is authenticated", async () => {
    const caller = appRouter.createCaller(anonymousContext()).projects;
    await expect(caller.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.create({ name: "Private project", currency: "USD", lengthUnit: "m" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.get("project-0001")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.addBlankPage({ projectId: "project-0001", name: "رسم" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.renamePage({ projectId: "project-0001", pageId: "page-0001", name: "رسم" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.deletePage({ projectId: "project-0001", pageId: "page-0001" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createScaleContext({ projectId: "project-0001", pageId: "page-0001", name: "مقياس معماري", drawingDistance: 10, worldDistance: 1, unit: "m" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.activateScaleContext({ projectId: "project-0001", pageId: "page-0001", contextId: "scale-context-1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.deleteScaleContext({ projectId: "project-0001", pageId: "page-0001", contextId: "scale-context-1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.listReviews("project-0001")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createReview({ projectId: "project-0001", sourcePageId: "page-0001", referenceDocumentId: "document-0001", label: "مراجعة 1" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.deleteReview({ projectId: "project-0001", reviewId: "review-0001" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createVersion({ projectId: "project-0001", label: "قبل التعديل" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.restoreVersion({ projectId: "project-0001", versionId: "version-0001" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.saveWorkspace({
      projectId: "project-0001",
      page: { id: "page-0001", name: "الصفحة 1" },
      items: [],
      commandEvents: [],
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(projectDb.listProjects).not.toHaveBeenCalled();
    expect(projectDb.createProject).not.toHaveBeenCalled();
    expect(projectDb.getProjectWorkspace).not.toHaveBeenCalled();
    expect(projectDb.saveProjectWorkspace).not.toHaveBeenCalled();
    expect(projectDb.addBlankProjectPage).not.toHaveBeenCalled();
  });

  it("creates a project with validated project metadata", async () => {
    projectDb.createProject.mockResolvedValue({ id: "project-0001", pageId: "page-0001" });
    const result = await appRouter.createCaller(authenticatedContext()).projects.create({ name: "Tower A", currency: "USD", lengthUnit: "m" });
    expect(projectDb.createProject).toHaveBeenCalledWith(user.id, expect.objectContaining({ name: "Tower A", currency: "USD", lengthUnit: "m" }));
    expect(result).toEqual({ id: "project-0001", pageId: "page-0001" });
  });

  it("opens a saved workspace with its pages, measurements, and command audit", async () => {
    projectDb.getProjectWorkspace.mockResolvedValue({
      project: { id: "project-0001", name: "Tower A" },
      pages: [{ id: "page-0001", name: "الصفحة 1" }],
      items: [{ id: "item-0001", kind: "AREA" }],
      commands: [{ id: "command-0001", type: "CALIBRATE_SCALE" }],
    });
    const result = await appRouter.createCaller(authenticatedContext()).projects.get("project-0001");
    expect(projectDb.getProjectWorkspace).toHaveBeenCalledWith(user.id, "project-0001");
    expect(result?.commands).toHaveLength(1);
    expect(result?.items).toHaveLength(1);
  });

  it("exports a project and imports a validated copy for the authenticated owner", async () => {
    projectDb.exportProjectFile.mockResolvedValue("{\"format\":\"takeoff-project\"}");
    projectDb.importProjectFile.mockResolvedValue({ id: "project-imported-1", pageId: "page-imported-1" });
    const caller = appRouter.createCaller(authenticatedContext()).projects;
    await expect(caller.exportProjectFile("project-0001")).resolves.toContain("takeoff-project");
    await expect(caller.importProjectFile(JSON.stringify({
      format: "takeoff-project", version: 1, exportedAt: "2026-08-19T00:00:00.000Z",
      project: { name: "نسخة", clientName: null, location: null, currency: "USD", lengthUnit: "m" },
      pages: [{ sourceId: "page-source-1", name: "رسم", sortOrder: 0, scaleDrawingDistance: null, scaleWorldDistance: null, scaleUnit: null }],
      items: [],
    }))).resolves.toMatchObject({ id: "project-imported-1" });
    expect(projectDb.exportProjectFile).toHaveBeenCalledWith(user.id, "project-0001");
    expect(projectDb.importProjectFile).toHaveBeenCalledWith(user.id, expect.objectContaining({ format: "takeoff-project" }));
  });

  it("passes the requesting owner identity into workspace lookup", async () => {
    projectDb.getProjectWorkspace.mockResolvedValue(null);
    await expect(appRouter.createCaller(alternateUserContext()).projects.get("project-0001")).resolves.toBeNull();
    expect(projectDb.getProjectWorkspace).toHaveBeenCalledWith(99, "project-0001");
  });

  it("saves a measurement workspace with a command event", async () => {
    projectDb.saveProjectWorkspace.mockResolvedValue({ saved: true });
    const payload = {
      projectId: "project-0001",
      page: { id: "page-0001", name: "الصفحة 1", scaleDrawingDistance: 10, scaleWorldDistance: 20, scaleUnit: "m" as const },
      items: [{ id: "item-0001", pageId: "page-0001", kind: "AREA" as const, name: "مساحة 1", color: "#c9ff4a", geometryJson: "{\"rings\":[]}", rate: "2.5" }],
      commandEvents: [{ type: "CALIBRATE_SCALE", payloadJson: "{\"worldDistance\":20}" }],
    };
    await expect(appRouter.createCaller(authenticatedContext()).projects.saveWorkspace(payload)).resolves.toEqual({ saved: true });
    expect(projectDb.saveProjectWorkspace).toHaveBeenCalledWith(user.id, payload.projectId, expect.objectContaining({ commandEvents: payload.commandEvents, items: [{ ...payload.items[0], multiplier: "1" }] }));
  });

  it("accepts specialized roof and volume measurements for the authenticated owner", async () => {
    projectDb.saveProjectWorkspace.mockResolvedValue({ saved: true });
    const caller = appRouter.createCaller(authenticatedContext()).projects;
    await expect(caller.saveWorkspace({
      projectId: "project-0001",
      page: { id: "page-0001", name: "الصفحة 1" },
      items: [
        { id: "item-roof-1", pageId: "page-0001", kind: "ROOF_AREA", name: "سقف", color: "#d7a6ff", geometryJson: "{\"rings\":[]}", rate: "12" },
        { id: "item-volume-1", pageId: "page-0001", kind: "VOLUME", name: "خرسانة", color: "#a4f1c2", geometryJson: "{\"rings\":[]}", rate: "18.5" },
      ],
      commandEvents: [],
    })).resolves.toEqual({ saved: true });
    expect(projectDb.saveProjectWorkspace).toHaveBeenCalledWith(user.id, "project-0001", expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ kind: "ROOF_AREA" }), expect.objectContaining({ kind: "VOLUME" })]) }));
  });

  it("surfaces rejection of an item linked to a template not owned by the caller", async () => {
    projectDb.saveProjectWorkspace.mockRejectedValue(new Error("TEMPLATE_NOT_FOUND"));
    const caller = appRouter.createCaller(authenticatedContext()).projects;
    await expect(caller.saveWorkspace({
      projectId: "project-0001",
      page: { id: "page-0001", name: "الصفحة 1" },
      items: [{ id: "item-0001", pageId: "page-0001", kind: "AREA", name: "مساحة", color: "#c9ff4a", geometryJson: "{\"rings\":[]}", rate: "0", templateId: "template-foreign-1" }],
      commandEvents: [],
    })).rejects.toThrow("TEMPLATE_NOT_FOUND");
    expect(projectDb.saveProjectWorkspace).toHaveBeenCalledWith(user.id, "project-0001", expect.objectContaining({ items: [expect.objectContaining({ templateId: "template-foreign-1" })] }));
  });

  it("passes authenticated page management requests with the requesting owner's identity", async () => {
    projectDb.addBlankProjectPage.mockResolvedValue({ id: "page-0002", name: "رسم جديد", sortOrder: 1 });
    projectDb.renameProjectPage.mockResolvedValue({ id: "page-0002", name: "المخطط التنفيذي" });
    projectDb.deleteProjectPage.mockResolvedValue({ deletedPageId: "page-0002", nextPageId: "page-0001" });
    projectDb.reorderProjectPages.mockResolvedValue({ pageIds: ["page-0002", "page-0001"] });
    const caller = appRouter.createCaller(authenticatedContext()).projects;
    await expect(caller.addBlankPage({ projectId: "project-0001", name: "رسم جديد" })).resolves.toMatchObject({ id: "page-0002" });
    await caller.renamePage({ projectId: "project-0001", pageId: "page-0002", name: "المخطط التنفيذي" });
    await caller.reorderPages({ projectId: "project-0001", pageIds: ["page-0002", "page-0001"] });
    await caller.deletePage({ projectId: "project-0001", pageId: "page-0002" });
    expect(projectDb.addBlankProjectPage).toHaveBeenCalledWith(user.id, "project-0001", "رسم جديد");
    expect(projectDb.renameProjectPage).toHaveBeenCalledWith(user.id, "project-0001", "page-0002", "المخطط التنفيذي");
    expect(projectDb.reorderProjectPages).toHaveBeenCalledWith(user.id, "project-0001", ["page-0002", "page-0001"]);
    expect(projectDb.deleteProjectPage).toHaveBeenCalledWith(user.id, "project-0001", "page-0002");
  });

  it("scopes saved review list, creation, and deletion to the authenticated owner", async () => {
    projectDb.listProjectReviews.mockResolvedValue([]);
    projectDb.createProjectReview.mockResolvedValue({ id: "review-0001", label: "مراجعة الواجهة" });
    projectDb.deleteProjectReview.mockResolvedValue({ deleted: true });
    const caller = appRouter.createCaller(alternateUserContext()).projects;
    await expect(caller.listReviews("project-0001")).resolves.toEqual([]);
    await expect(caller.createReview({ projectId: "project-0001", sourcePageId: "page-0001", referenceDocumentId: "document-0001", label: "مراجعة الواجهة", note: "نسخة مرجعية" })).resolves.toMatchObject({ id: "review-0001" });
    await expect(caller.deleteReview({ projectId: "project-0001", reviewId: "review-0001" })).resolves.toEqual({ deleted: true });
    expect(projectDb.listProjectReviews).toHaveBeenCalledWith(99, "project-0001");
    expect(projectDb.createProjectReview).toHaveBeenCalledWith(99, "project-0001", expect.objectContaining({ sourcePageId: "page-0001", referenceDocumentId: "document-0001", label: "مراجعة الواجهة" }));
    expect(projectDb.deleteProjectReview).toHaveBeenCalledWith(99, "project-0001", "review-0001");
  });

  it("scopes page annotation list, creation, and deletion to the authenticated owner", async () => {
    projectDb.listPageAnnotations.mockResolvedValue([]);
    projectDb.createPageAnnotation.mockResolvedValue({ id: "annotation-0001", text: "ملاحظة" });
    projectDb.deletePageAnnotation.mockResolvedValue({ deleted: true });
    const caller = appRouter.createCaller(alternateUserContext()).projects;
    await expect(caller.listAnnotations("project-0001")).resolves.toEqual([]);
    await expect(caller.createAnnotation({ projectId: "project-0001", pageId: "page-0001", text: "ملاحظة", x: "120", y: "240", color: "#ff9c7b" })).resolves.toMatchObject({ id: "annotation-0001" });
    await expect(caller.deleteAnnotation({ projectId: "project-0001", annotationId: "annotation-0001" })).resolves.toEqual({ deleted: true });
    expect(projectDb.listPageAnnotations).toHaveBeenCalledWith(99, "project-0001");
    expect(projectDb.createPageAnnotation).toHaveBeenCalledWith(99, "project-0001", expect.objectContaining({ pageId: "page-0001", text: "ملاحظة", x: "120", y: "240" }));
    expect(projectDb.deletePageAnnotation).toHaveBeenCalledWith(99, "project-0001", "annotation-0001");
  });

  it("scopes multi-scale context management to the authenticated owner", async () => {
    projectDb.createPageScaleContext.mockResolvedValue({ id: "scale-context-1", name: "مقياس معماري" });
    projectDb.activatePageScaleContext.mockResolvedValue({ id: "scale-context-1" });
    projectDb.deletePageScaleContext.mockResolvedValue({ deleted: true });
    const caller = appRouter.createCaller(alternateUserContext()).projects;
    await expect(caller.createScaleContext({ projectId: "project-0001", pageId: "page-0001", name: "مقياس معماري", drawingDistance: 10, worldDistance: 1, unit: "m" })).resolves.toMatchObject({ id: "scale-context-1" });
    await expect(caller.activateScaleContext({ projectId: "project-0001", pageId: "page-0001", contextId: "scale-context-1" })).resolves.toMatchObject({ id: "scale-context-1" });
    await expect(caller.deleteScaleContext({ projectId: "project-0001", pageId: "page-0001", contextId: "scale-context-1" })).resolves.toEqual({ deleted: true });
    expect(projectDb.createPageScaleContext).toHaveBeenCalledWith(99, "project-0001", expect.objectContaining({ pageId: "page-0001", unit: "m" }));
    expect(projectDb.activatePageScaleContext).toHaveBeenCalledWith(99, "project-0001", "page-0001", "scale-context-1");
    expect(projectDb.deletePageScaleContext).toHaveBeenCalledWith(99, "project-0001", "page-0001", "scale-context-1");
  });

  it("creates and restores project versions only for the requesting owner", async () => {
    projectDb.createProjectVersion.mockResolvedValue({ id: "version-0001", label: "قبل التعديل" });
    projectDb.restoreProjectVersion.mockResolvedValue({ id: "project-restored-1", pageId: "page-restored-1" });
    const caller = appRouter.createCaller(alternateUserContext()).projects;
    await expect(caller.createVersion({ projectId: "project-0001", label: "قبل التعديل" })).resolves.toMatchObject({ id: "version-0001" });
    await expect(caller.restoreVersion({ projectId: "project-0001", versionId: "version-0001" })).resolves.toMatchObject({ id: "project-restored-1" });
    expect(projectDb.createProjectVersion).toHaveBeenCalledWith(99, "project-0001", "قبل التعديل");
    expect(projectDb.restoreProjectVersion).toHaveBeenCalledWith(99, "project-0001", "version-0001");
  });

  it("rejects invalid rate values before reaching persistence", async () => {
    await expect(appRouter.createCaller(authenticatedContext()).projects.saveWorkspace({
      projectId: "project-0001",
      page: { id: "page-0001", name: "الصفحة 1" },
      items: [{ id: "item-0001", kind: "COUNT", name: "عداد 1", color: "#f6cf62", geometryJson: "{}", rate: "unsafe" }],
      commandEvents: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(projectDb.saveProjectWorkspace).not.toHaveBeenCalled();
  });
});
