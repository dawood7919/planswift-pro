import React, { type ComponentProps } from "react";

type PdfPlanStatusOverlayProps = {
  status: "LOADING" | "ERROR" | "READY";
  error: string | null;
  onRetry: () => void;
};

export function PdfPlanStatusOverlay({ status, error, onRetry }: PdfPlanStatusOverlayProps) {
  if (status === "LOADING") return <span className="pdf-plan-loading" aria-live="polite">جارٍ عرض صفحة PDF…</span>;
  if (status !== "ERROR") return null;
  return <div className="pdf-plan-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>إعادة محاولة العرض</button></div>;
}

export type PdfPlanStatusOverlayElement = ComponentProps<typeof PdfPlanStatusOverlay>;
