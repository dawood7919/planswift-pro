export const PDF_RENDER_ERROR = "PDF_RENDER_ERROR";

export function getPdfRenderStatus(isRendering: boolean, hasError: boolean): "LOADING" | "ERROR" | "READY" {
  if (hasError) return "ERROR";
  return isRendering ? "LOADING" : "READY";
}
