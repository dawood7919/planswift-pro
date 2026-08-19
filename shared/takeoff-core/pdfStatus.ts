export const PDF_RENDER_ERROR_MESSAGE = "تعذر عرض صفحة PDF. تأكد من أن الملف صالح ثم أعد المحاولة.";

export function getPdfRenderStatus(isRendering: boolean, hasError: boolean): "LOADING" | "ERROR" | "READY" {
  if (hasError) return "ERROR";
  return isRendering ? "LOADING" : "READY";
}
