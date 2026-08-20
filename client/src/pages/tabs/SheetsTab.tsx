import React from "react";
import PdfThumbnail from "@/components/PdfThumbnail";
import { Button } from "@/components/ui/button";
import type { ProjectRollup } from "@shared/takeoff-core/projectRollup";

type Props = { rollup: ProjectRollup; onOpenPlan: () => void };

/** Every sheet with its measurement count and the state of its scale. */
export default function SheetsTab({ rollup, onOpenPlan }: Props) {
  if (!rollup.pages.length) {
    return <div className="large-empty"><div className="empty-symbol">▤</div><p>لا توجد أوراق في هذا المشروع بعد. افتح المخطط واستورد ملف PDF.</p></div>;
  }

  return (
    <div className="sheet-grid">
      {rollup.pages.map(({ page, rows, untrusted }) => {
        const valid = rows.filter((row) => row.status === "VALID").length;
        return (
          <article key={page.id} className={`sheet-card ${untrusted ? "untrusted" : ""}`}>
            <div className="sheet-card-preview">
              {page.pdfPageNumber ? <span className="sheet-card-badge">PDF {page.pdfPageNumber}</span> : <span className="sheet-card-badge">رسم حر</span>}
            </div>
            <div className="sheet-card-copy">
              <b>{page.name}</b>
              <small>
                {rows.length} عنصر
                {rows.length ? ` · ${valid} بكمية صالحة` : ""}
                {untrusted ? " · إحداثيات قديمة" : page.scaleUnit ? ` · مقياس ${page.scaleUnit}` : " · بلا مقياس"}
              </small>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenPlan}>فتح</Button>
          </article>
        );
      })}
    </div>
  );
}
