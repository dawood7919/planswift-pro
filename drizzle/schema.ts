import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  name: varchar("name", { length: 160 }).notNull(),
  clientName: varchar("clientName", { length: 160 }),
  location: varchar("location", { length: 200 }),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  lengthUnit: varchar("lengthUnit", { length: 8 }).notNull().default("m"),
  schemaVersion: int("schemaVersion").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("projects_owner_name_idx").on(table.ownerId, table.name)]);

export const projectPages = mysqlTable("projectPages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  name: varchar("name", { length: 160 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  scaleDrawingDistance: decimal("scaleDrawingDistance", { precision: 16, scale: 6 }),
  scaleWorldDistance: decimal("scaleWorldDistance", { precision: 16, scale: 6 }),
  scaleUnit: varchar("scaleUnit", { length: 8 }),
  activeScaleContextId: varchar("activeScaleContextId", { length: 36 }),
  backgroundUrl: text("backgroundUrl"),
  documentId: varchar("documentId", { length: 36 }),
  pdfPageNumber: int("pdfPageNumber"),
  /** Page size in PDF points (1/72"), rotation-normalized. Blank pages use 1000x720. */
  pageWidth: decimal("pageWidth", { precision: 12, scale: 4 }),
  pageHeight: decimal("pageHeight", { precision: 12, scale: 4 }),
  /** The source PDF's /Rotate value, already applied to pageWidth and pageHeight. */
  pageRotation: int("pageRotation").notNull().default(0),
  /**
   * Coordinate space of this page's takeoff geometry. Rows created before page-anchored
   * coordinates existed stay LEGACY_VIEWBOX until an explicit, re-calibrating migration.
   */
  geometrySpace: mysqlEnum("geometrySpace", ["LEGACY_VIEWBOX", "PAGE_POINTS"]).notNull().default("LEGACY_VIEWBOX"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("project_pages_order_idx").on(table.projectId, table.sortOrder)]);

export const projectDocuments = mysqlTable("projectDocuments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  originalName: varchar("originalName", { length: 240 }).notNull(),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  byteSize: int("byteSize").notNull(),
  pageCount: int("pageCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projectReviews = mysqlTable("projectReviews", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  sourcePageId: varchar("sourcePageId", { length: 36 }).notNull().references(() => projectPages.id),
  referenceDocumentId: varchar("referenceDocumentId", { length: 36 }).notNull().references(() => projectDocuments.id),
  label: varchar("label", { length: 160 }).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("project_reviews_context_idx").on(table.projectId, table.sourcePageId, table.referenceDocumentId)]);

/** Text markup anchored to a project page in the same coordinate space as takeoff geometry. */
export const pageAnnotations = mysqlTable("pageAnnotations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  pageId: varchar("pageId", { length: 36 }).notNull().references(() => projectPages.id),
  ownerId: int("ownerId").notNull().references(() => users.id),
  text: varchar("text", { length: 500 }).notNull(),
  x: decimal("x", { precision: 12, scale: 4 }).notNull(),
  y: decimal("y", { precision: 12, scale: 4 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#FF9C7B"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("page_annotations_page_position_idx").on(table.pageId, table.x, table.y)]);

export const projectVersions = mysqlTable("projectVersions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  label: varchar("label", { length: 160 }).notNull(),
  snapshotJson: text("snapshotJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("project_versions_project_label_idx").on(table.projectId, table.label)]);

export const pageScaleContexts = mysqlTable("pageScaleContexts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  pageId: varchar("pageId", { length: 36 }).notNull().references(() => projectPages.id),
  name: varchar("name", { length: 80 }).notNull(),
  drawingDistance: decimal("drawingDistance", { precision: 16, scale: 6 }).notNull(),
  worldDistance: decimal("worldDistance", { precision: 16, scale: 6 }).notNull(),
  unit: varchar("unit", { length: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("page_scale_context_name_idx").on(table.pageId, table.name)]);

/** Owner-scoped folders organize reusable estimating templates without sharing library state across users. */
export const templateFolders = mysqlTable("templateFolders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("template_folders_owner_name_idx").on(table.ownerId, table.name)]);

export const takeoffTemplates = mysqlTable("takeoffTemplates", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  folderId: varchar("folderId", { length: 36 }).references(() => templateFolders.id),
  kind: mysqlEnum("kind", ["PART", "ASSEMBLY"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  formula: varchar("formula", { length: 500 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull().default("وحدة"),
  rate: decimal("rate", { precision: 16, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("takeoff_templates_owner_name_idx").on(table.ownerId, table.name)]);

/** Explicit owner-scoped graph edges used by assemblies to include template outputs. */
export const templateDependencies = mysqlTable("templateDependencies", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  templateId: varchar("templateId", { length: 36 }).notNull().references(() => takeoffTemplates.id),
  dependsOnTemplateId: varchar("dependsOnTemplateId", { length: 36 }).notNull().references(() => takeoffTemplates.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("template_dependencies_unique_edge_idx").on(table.templateId, table.dependsOnTemplateId),
  uniqueIndex("template_dependencies_owner_template_idx").on(table.ownerId, table.templateId, table.dependsOnTemplateId),
]);

/** Auditable cost lines calculated from the measured quantity of a template-backed takeoff. */
export const templateCostItems = mysqlTable("templateCostItems", {
  id: varchar("id", { length: 36 }).primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id),
  templateId: varchar("templateId", { length: 36 }).notNull().references(() => takeoffTemplates.id),
  kind: mysqlEnum("kind", ["MATERIAL", "LABOR", "EQUIPMENT"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  quantityFormula: varchar("quantityFormula", { length: 500 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull().default("وحدة"),
  rate: decimal("rate", { precision: 16, scale: 4 }).notNull().default("0"),
  wastePercent: decimal("wastePercent", { precision: 8, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("template_cost_items_template_name_idx").on(table.templateId, table.name)]);

export const takeoffItems = mysqlTable("takeoffItems", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  pageId: varchar("pageId", { length: 36 }).notNull().references(() => projectPages.id),
  templateId: varchar("templateId", { length: 36 }).references(() => takeoffTemplates.id),
  kind: mysqlEnum("kind", ["AREA", "ROOF_AREA", "VOLUME", "LINEAR", "SEGMENT", "COUNT"]).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#C9FF4A"),
  geometryJson: text("geometryJson").notNull(),
  rate: decimal("rate", { precision: 16, scale: 4 }).notNull().default("0"),
  multiplier: decimal("multiplier", { precision: 12, scale: 4 }).notNull().default("1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [uniqueIndex("takeoff_items_page_name_idx").on(table.pageId, table.name)]);

export const projectCommands = mysqlTable("projectCommands", {
  id: varchar("id", { length: 36 }).primaryKey(),
  projectId: varchar("projectId", { length: 36 }).notNull().references(() => projects.id),
  sequence: int("sequence").notNull(),
  type: varchar("type", { length: 80 }).notNull(),
  payloadJson: text("payloadJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("project_commands_sequence_idx").on(table.projectId, table.sequence)]);

export type Project = typeof projects.$inferSelect;
export type ProjectPage = typeof projectPages.$inferSelect;
export type TakeoffItem = typeof takeoffItems.$inferSelect;
export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type ProjectReview = typeof projectReviews.$inferSelect;
export type PageAnnotation = typeof pageAnnotations.$inferSelect;
export type ProjectVersion = typeof projectVersions.$inferSelect;
export type PageScaleContext = typeof pageScaleContexts.$inferSelect;
export type TakeoffTemplate = typeof takeoffTemplates.$inferSelect;
export type TemplateDependency = typeof templateDependencies.$inferSelect;
export type TemplateFolder = typeof templateFolders.$inferSelect;
export type TemplateCostItem = typeof templateCostItems.$inferSelect;
