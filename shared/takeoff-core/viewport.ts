export type ViewBoxPan = { x: number; y: number };

export type LayerSize = { width: number; height: number };

export type CssMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export const TAKEOFF_VIEW_BOX = { width: 1000, height: 720 } as const;

/**
 * Maps the SVG viewBox transform `translate(pan) scale(zoom)` to an equivalent
 * CSS matrix for the PDF layer, preserving the same transform order.
 */
export function createPdfViewportMatrix(zoom: number, pan: ViewBoxPan, layer: LayerSize): CssMatrix {
  if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(pan.x) || !Number.isFinite(pan.y)
    || !Number.isFinite(layer.width) || !Number.isFinite(layer.height) || layer.width < 0 || layer.height < 0) {
    throw new Error("INVALID_VIEWPORT_TRANSFORM");
  }

  return {
    a: zoom,
    b: 0,
    c: 0,
    d: zoom,
    e: (pan.x / TAKEOFF_VIEW_BOX.width) * layer.width,
    f: (pan.y / TAKEOFF_VIEW_BOX.height) * layer.height,
  };
}

export function formatCssMatrix(matrix: CssMatrix): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}
