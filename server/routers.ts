import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { evaluateFormula } from "../shared/takeoff-core/formula";
import { parseProjectFile } from "../shared/takeoff-core/projectFile";

const projectIdSchema = z.string().min(8).max(36);
const itemSchema = z.object({
  id: z.string().min(8).max(36),
  pageId: z.string().min(8).max(36),
  kind: z.enum(["AREA", "ROOF_AREA", "VOLUME", "LINEAR", "SEGMENT", "COUNT"]),
  name: z.string().trim().min(1).max(160),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      geometryJson: z.string().min(2).max(100_000),
      rate: z.string().regex(/^\d+(\.\d{1,4})?$/),
      multiplier: z.string().regex(/^\d+(\.\d{1,4})?$/).default("1").refine((value) => Number(value) > 0, "MULTIPLIER_INVALID"),
      templateId: z.string().min(8).max(36).nullable().optional(),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    createNativeSession: protectedProcedure.mutation(async ({ ctx }) => {
      const token = await sdk.createSessionToken(ctx.user.openId, { expiresInMs: 7 * 24 * 60 * 60 * 1000, name: ctx.user.name?.trim() || "Android Device" });
      return { token, expiresInSeconds: 7 * 24 * 60 * 60 };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  templates: router({
    list: protectedProcedure.query(({ ctx }) => db.listTakeoffTemplates(ctx.user.id)),
    get: protectedProcedure.input(z.string().min(8).max(36)).query(({ ctx, input }) => db.getTakeoffTemplate(ctx.user.id, input)),
    create: protectedProcedure.input(z.object({
      kind: z.enum(["PART", "ASSEMBLY"]),
      name: z.string().trim().min(2).max(160),
      formula: z.string().trim().min(1).max(500),
      unit: z.string().trim().min(1).max(32).default("وحدة"),
      rate: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0"),
      folderId: z.string().min(8).max(36).nullable().optional(),
      dependencyIds: z.array(z.string().min(8).max(36)).max(100).default([]).refine((ids) => new Set(ids).size === ids.length, "TEMPLATE_DEPENDENCY_DUPLICATE"),
    })).mutation(({ ctx, input }) => {
      evaluateFormula(input.formula, { quantity: 1, rate: 1, waste: 0 });
      return db.createTakeoffTemplate(ctx.user.id, input);
    }),
    update: protectedProcedure.input(z.object({
      templateId: z.string().min(8).max(36),
      name: z.string().trim().min(2).max(160),
      formula: z.string().trim().min(1).max(500),
      unit: z.string().trim().min(1).max(32).default("وحدة"),
      rate: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0"),
      folderId: z.string().min(8).max(36).nullable().optional(),
      dependencyIds: z.array(z.string().min(8).max(36)).max(100).refine((ids) => new Set(ids).size === ids.length, "TEMPLATE_DEPENDENCY_DUPLICATE"),
    })).mutation(({ ctx, input }) => {
      evaluateFormula(input.formula, { quantity: 1, rate: 1, waste: 0 });
      return db.updateTakeoffTemplate(ctx.user.id, input.templateId, input);
    }),
    delete: protectedProcedure.input(z.string().min(8).max(36)).mutation(({ ctx, input }) => db.deleteTakeoffTemplate(ctx.user.id, input)),
    folders: router({
      list: protectedProcedure.query(({ ctx }) => db.listTemplateFolders(ctx.user.id)),
      create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(({ ctx, input }) => db.createTemplateFolder(ctx.user.id, input.name)),
      delete: protectedProcedure.input(z.string().min(8).max(36)).mutation(({ ctx, input }) => db.deleteTemplateFolder(ctx.user.id, input)),
    }),
    costItems: router({
      create: protectedProcedure.input(z.object({
        templateId: z.string().min(8).max(36),
        kind: z.enum(["MATERIAL", "LABOR", "EQUIPMENT"]),
        name: z.string().trim().min(2).max(160),
        quantityFormula: z.string().trim().min(1).max(500),
        unit: z.string().trim().min(1).max(32).default("وحدة"),
        rate: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0"),
        wastePercent: z.string().regex(/^\d+(\.\d{1,4})?$/).default("0").refine((value) => Number(value) <= 100, "WASTE_PERCENT_OUT_OF_RANGE"),
      })).mutation(({ ctx, input }) => {
        evaluateFormula(input.quantityFormula, { quantity: 1, rate: 1, waste: 0 });
        return db.createTemplateCostItem(ctx.user.id, input);
      }),
      delete: protectedProcedure.input(z.string().min(8).max(36)).mutation(({ ctx, input }) => db.deleteTemplateCostItem(ctx.user.id, input)),
    }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjects(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(160),
      clientName: z.string().trim().max(160).optional(),
      location: z.string().trim().max(200).optional(),
      currency: z.string().trim().min(3).max(8).default("USD"),
      lengthUnit: z.enum(["m", "ft", "cm", "in"]).default("m"),
    })).mutation(({ ctx, input }) => db.createProject(ctx.user.id, input)),
    get: protectedProcedure.input(projectIdSchema).query(({ ctx, input }) => db.getProjectWorkspace(ctx.user.id, input)),
    exportProjectFile: protectedProcedure.input(projectIdSchema).mutation(({ ctx, input }) => db.exportProjectFile(ctx.user.id, input)),
    importProjectFile: protectedProcedure.input(z.string().min(2).max(5_000_000)).mutation(({ ctx, input }) => db.importProjectFile(ctx.user.id, parseProjectFile(input))),
    addBlankPage: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      name: z.string().trim().min(1).max(160).default("رسم جديد"),
    })).mutation(({ ctx, input }) => db.addBlankProjectPage(ctx.user.id, input.projectId, input.name)),
    renamePage: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      pageId: projectIdSchema,
      name: z.string().trim().min(1).max(160),
    })).mutation(({ ctx, input }) => db.renameProjectPage(ctx.user.id, input.projectId, input.pageId, input.name)),
    deletePage: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      pageId: projectIdSchema,
    })).mutation(({ ctx, input }) => db.deleteProjectPage(ctx.user.id, input.projectId, input.pageId)),
    reorderPages: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      pageIds: z.array(projectIdSchema).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "PAGE_IDS_MUST_BE_UNIQUE"),
    })).mutation(({ ctx, input }) => db.reorderProjectPages(ctx.user.id, input.projectId, input.pageIds)),
    createScaleContext: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      pageId: projectIdSchema,
      name: z.string().trim().min(2).max(80),
      drawingDistance: z.number().positive(),
      worldDistance: z.number().positive(),
      unit: z.enum(["m", "ft", "cm", "in"]),
    })).mutation(({ ctx, input }) => db.createPageScaleContext(ctx.user.id, input.projectId, input)),
    activateScaleContext: protectedProcedure.input(z.object({ projectId: projectIdSchema, pageId: projectIdSchema, contextId: projectIdSchema })).mutation(({ ctx, input }) => db.activatePageScaleContext(ctx.user.id, input.projectId, input.pageId, input.contextId)),
    deleteScaleContext: protectedProcedure.input(z.object({ projectId: projectIdSchema, pageId: projectIdSchema, contextId: projectIdSchema })).mutation(({ ctx, input }) => db.deletePageScaleContext(ctx.user.id, input.projectId, input.pageId, input.contextId)),
    listReviews: protectedProcedure.input(projectIdSchema).query(({ ctx, input }) => db.listProjectReviews(ctx.user.id, input)),
    createReview: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      sourcePageId: projectIdSchema,
      referenceDocumentId: projectIdSchema,
      label: z.string().trim().min(2).max(160),
      note: z.string().trim().max(2_000).optional(),
    })).mutation(({ ctx, input }) => db.createProjectReview(ctx.user.id, input.projectId, input)),
    deleteReview: protectedProcedure.input(z.object({ projectId: projectIdSchema, reviewId: projectIdSchema })).mutation(({ ctx, input }) => db.deleteProjectReview(ctx.user.id, input.projectId, input.reviewId)),
    listAnnotations: protectedProcedure.input(projectIdSchema).query(({ ctx, input }) => db.listPageAnnotations(ctx.user.id, input)),
    createAnnotation: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      pageId: projectIdSchema,
      text: z.string().trim().min(1).max(500),
      x: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
      y: z.string().regex(/^-?\d+(\.\d{1,4})?$/),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })).mutation(({ ctx, input }) => db.createPageAnnotation(ctx.user.id, input.projectId, input)),
    deleteAnnotation: protectedProcedure.input(z.object({ projectId: projectIdSchema, annotationId: projectIdSchema })).mutation(({ ctx, input }) => db.deletePageAnnotation(ctx.user.id, input.projectId, input.annotationId)),
    createVersion: protectedProcedure.input(z.object({ projectId: projectIdSchema, label: z.string().trim().min(2).max(160) })).mutation(({ ctx, input }) => db.createProjectVersion(ctx.user.id, input.projectId, input.label)),
    restoreVersion: protectedProcedure.input(z.object({ projectId: projectIdSchema, versionId: projectIdSchema })).mutation(({ ctx, input }) => db.restoreProjectVersion(ctx.user.id, input.projectId, input.versionId)),
    saveWorkspace: protectedProcedure.input(z.object({
      projectId: projectIdSchema,
      page: z.object({
        id: projectIdSchema,
        name: z.string().trim().min(1).max(160),
        scaleDrawingDistance: z.number().positive().nullable().optional(),
        scaleWorldDistance: z.number().positive().nullable().optional(),
        scaleUnit: z.enum(["m", "ft", "cm", "in"]).nullable().optional(),
      }),
      items: z.array(itemSchema).max(1_000),
      commandEvents: z.array(z.object({
        type: z.string().trim().min(3).max(80),
        payloadJson: z.string().min(2).max(20_000),
      })).max(100).default([]),
    })).mutation(({ ctx, input }) => db.saveProjectWorkspace(ctx.user.id, input.projectId, { page: input.page, items: input.items, commandEvents: input.commandEvents })),
  }),
});

export type AppRouter = typeof appRouter;
