import React, { type ComponentProps } from "react";

type PdfPlanStatusOverlayProps = {
  status: "LOADING" | "ERROR" | "READY";
  error: string | null;
  onRetry: () => void;
};

export function PdfPlanStatusOverlay({ status, error, onRetry }: PdfPlanStatusOverlayProps) {
  const { t } = useTranslation();
  if (status === "LOADING") return <span className="pdf-plan-loading" aria-live="polite">{t("pdf.loading")}</span>;
  if (status !== "ERROR") return null;
  return <div className="pdf-plan-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>{t("pdf.retry")}</button></div>;
}

export type PdfPlanStatusOverlayElement = ComponentProps<typeof PdfPlanStatusOverlay>;
import { useTranslation } from "@/i18n";
