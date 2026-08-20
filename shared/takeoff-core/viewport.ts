import type { MeasurementGeometry, Point2D } from "./index";

/**
 * Page-anchored viewport transform.
 *
 * Takeoff geometry is stored in *page space*: PDF points (1/72"), rotation-normalized,
 * origin at the page's top-left, y increasing downward — exactly the space of
 * `pdfjsPage.getViewport({ scale: 1 })`.
 *
 * The mapping from page space to the screen is deliberately **isotropic**: one scalar
 * scale for both axes. That is what makes a measured quantity depend only on the drawing
 * and its calibration, never on the container's aspect ratio. Anisotropic fitting silently
 * scales x and y differently, so a single calibration factor cannot describe both axes and
 * every measurement becomes direction-dependent.
 */

export type PageSize = { width: number; height: number };

export type ContainerSize = { width: number; height: number };

export type PanOffset = { x: number; y: number };

/** Screen placement of the page: `screen = page * scale + offset`. */
export type Viewport = { scale: number; offsetX: number; offsetY: number };

/** The subset of DOMRect this module needs, so it stays DOM-free and testable in Node. */
export type ClientRectLike = { left: number; top: number };

export type ClientPoint = { x: number; y: number };

/** Synthetic page used by pages that have no PDF behind them. */
export const BLANK_PAGE_SIZE: PageSize = { width: 1000, height: 720 };

/**
 * The stretched SVG user space used before page-anchored coordinates existed.
 * Retained only to map `LEGACY_VIEWBOX` geometry onto its page for display and migration.
 */
export const LEGACY_VIEW_BOX: PageSize = { width: 1000, height: 720 };

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Builds the page → screen transform.
 *
 * A container that has not been laid out yet (zero width or height) yields a zero scale
 * rather than NaN or Infinity; `toPagePoint` refuses to invert such a viewport.
 */
export function createPageViewport(
  page: PageSize,
  container: ContainerSize,
  zoom: number,
  pan: PanOffset,
): Viewport {
  if (!isPositiveFinite(page.width) || !isPositiveFinite(page.height)) throw new Error("INVALID_VIEWPORT");
  if (!isPositiveFinite(zoom)) throw new Error("INVALID_VIEWPORT");
  if (!isNonNegativeFinite(container.width) || !isNonNegativeFinite(container.height)) throw new Error("INVALID_VIEWPORT");
  if (!Number.isFinite(pan.x) || !Number.isFinite(pan.y)) throw new Error("INVALID_VIEWPORT");

  if (container.width === 0 || container.height === 0) {
    return { scale: 0, offsetX: 0, offsetY: 0 };
  }

  const fitScale = Math.min(container.width / page.width, container.height / page.height);
  const scale = fitScale * zoom;
  return {
    scale,
    offsetX: (container.width - page.width * scale) / 2 + pan.x,
    offsetY: (container.height - page.height * scale) / 2 + pan.y,
  };
}

/** Scale at which the whole page fits the container, ignoring zoom and pan. */
export function fitScaleFor(page: PageSize, container: ContainerSize): number {
  return createPageViewport(page, container, 1, { x: 0, y: 0 }).scale;
}

export function isMeasuredViewport(viewport: Viewport): boolean {
  return isPositiveFinite(viewport.scale);
}

export function toScreenPoint(point: Point2D, viewport: Viewport): ClientPoint {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  };
}

/** Exact inverse of `toScreenPoint`, relative to the surface's bounding rect. */
export function toPagePoint(client: ClientPoint, rect: ClientRectLike, viewport: Viewport): Point2D {
  if (!isMeasuredViewport(viewport)) throw new Error("VIEWPORT_NOT_MEASURED");
  return {
    x: (client.x - rect.left - viewport.offsetX) / viewport.scale,
    y: (client.y - rect.top - viewport.offsetY) / viewport.scale,
  };
}

/** Converts a screen-pixel constant (hit tolerance, snap radius) into page units. */
export function screenLengthToPage(pixels: number, viewport: Viewport): number {
  if (!isMeasuredViewport(viewport)) throw new Error("VIEWPORT_NOT_MEASURED");
  return pixels / viewport.scale;
}

/**
 * Zooms about a fixed screen anchor, keeping the page point under it in place.
 * Returns the pan that preserves the anchor at the new zoom.
 */
export function panForZoomAnchor(
  page: PageSize,
  container: ContainerSize,
  previousZoom: number,
  nextZoom: number,
  pan: PanOffset,
  anchor: ClientPoint,
): PanOffset {
  const before = createPageViewport(page, container, previousZoom, pan);
  if (!isMeasuredViewport(before)) return pan;
  const anchored = toPagePoint(anchor, { left: 0, top: 0 }, before);
  // The centring term itself depends on zoom, so solve for the pan that puts the
  // required offset back rather than nudging the previous one by the zoom ratio.
  const nextScale = createPageViewport(page, container, nextZoom, { x: 0, y: 0 }).scale;
  return {
    x: anchor.x - anchored.x * nextScale - (container.width - page.width * nextScale) / 2,
    y: anchor.y - anchored.y * nextScale - (container.height - page.height * nextScale) / 2,
  };
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// ------------------------------------------------------------- legacy migration

/**
 * Maps a point captured in the legacy stretched 1000x720 SVG space onto its page.
 *
 * This preserves where the shape *looked* like it was, which is the only recoverable
 * property: the container aspect ratio at capture time was never stored, so the
 * real-world quantity that geometry once reported cannot be reconstructed. Pages carrying
 * legacy geometry must be re-calibrated before their quantities can be trusted.
 */
export function fromLegacyViewBoxPoint(point: Point2D, page: PageSize): Point2D {
  if (!isPositiveFinite(page.width) || !isPositiveFinite(page.height)) throw new Error("INVALID_VIEWPORT");
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error("INVALID_POINT");
  return {
    x: (point.x / LEGACY_VIEW_BOX.width) * page.width,
    y: (point.y / LEGACY_VIEW_BOX.height) * page.height,
  };
}

export function fromLegacyViewBoxGeometry(geometry: MeasurementGeometry, page: PageSize): MeasurementGeometry {
  return {
    ...geometry,
    points: geometry.points?.map((point) => fromLegacyViewBoxPoint(point, page)),
    marks: geometry.marks?.map((point) => fromLegacyViewBoxPoint(point, page)),
    rings: geometry.rings?.map((ring) => ring.map((point) => fromLegacyViewBoxPoint(point, page))),
  };
}
