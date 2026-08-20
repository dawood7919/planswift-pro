import type { Point2D } from "./index";

export type PageSize = { width: number; height: number };
export type ContainerSize = { width: number; height: number };
export type ViewportPan = { x: number; y: number };
export type ViewportRect = { left: number; top: number; width: number; height: number };

export type PageViewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

/** Synthetic page space for freehand drawing; it is not a replacement for PDF dimensions. */
export const DEFAULT_BLANK_PAGE_SIZE: PageSize = { width: 1000, height: 720 };

function finite(value: number) {
  return Number.isFinite(value);
}

function assertPage(page: PageSize) {
  if (!finite(page.width) || !finite(page.height) || page.width <= 0 || page.height <= 0) throw new Error("INVALID_VIEWPORT");
}

function assertContainer(container: ContainerSize) {
  if (!finite(container.width) || !finite(container.height) || container.width < 0 || container.height < 0) throw new Error("INVALID_VIEWPORT");
}

function assertPan(pan: ViewportPan) {
  if (!finite(pan.x) || !finite(pan.y)) throw new Error("INVALID_VIEWPORT");
}

/**
 * Maps top-left PDF page points into CSS pixels with one isotropic scale.
 * Pan is deliberately retained in CSS pixels, independent from zoom.
 */
export function createPageViewport(page: PageSize, container: ContainerSize, zoom: number, pan: ViewportPan): PageViewport {
  assertPage(page);
  assertContainer(container);
  assertPan(pan);
  if (!finite(zoom) || zoom <= 0) throw new Error("INVALID_VIEWPORT");
  if (container.width === 0 || container.height === 0) return { scale: 0, offsetX: pan.x, offsetY: pan.y };
  const scale = Math.min(container.width / page.width, container.height / page.height) * zoom;
  if (!finite(scale) || scale <= 0) throw new Error("INVALID_VIEWPORT");
  return {
    scale,
    offsetX: (container.width - page.width * scale) / 2 + pan.x,
    offsetY: (container.height - page.height * scale) / 2 + pan.y,
  };
}

export function toScreenPoint(page: Point2D, viewport: PageViewport): Point2D {
  if (!finite(page.x) || !finite(page.y) || !finite(viewport.scale) || !finite(viewport.offsetX) || !finite(viewport.offsetY) || viewport.scale < 0) throw new Error("INVALID_VIEWPORT");
  return { x: page.x * viewport.scale + viewport.offsetX, y: page.y * viewport.scale + viewport.offsetY };
}

export function toPagePoint(client: Point2D, rect: ViewportRect, viewport: PageViewport): Point2D {
  if (!finite(client.x) || !finite(client.y) || !finite(rect.left) || !finite(rect.top) || !finite(rect.width) || !finite(rect.height) || rect.width < 0 || rect.height < 0 || !finite(viewport.scale) || !finite(viewport.offsetX) || !finite(viewport.offsetY) || viewport.scale < 0) throw new Error("INVALID_VIEWPORT");
  if (viewport.scale === 0) return { x: 0, y: 0 };
  return {
    x: (client.x - rect.left - viewport.offsetX) / viewport.scale,
    y: (client.y - rect.top - viewport.offsetY) / viewport.scale,
  };
}

export function legacyViewBoxPointToPage(point: Point2D, page: PageSize): Point2D {
  assertPage(page);
  if (!finite(point.x) || !finite(point.y)) throw new Error("INVALID_VIEWPORT");
  return { x: point.x * page.width / 1000, y: point.y * page.height / 720 };
}
