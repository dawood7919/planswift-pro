import React, { useMemo } from "react";
import type { ProjectRollup } from "@shared/takeoff-core/projectRollup";

type Props = { rollup: ProjectRollup; currency: string };

/**
 * Cost rolled up across every trustworthy sheet, grouped by cost-item name so the same
 * assembly measured on four sheets reads as one line.
 */
export default function EstimateTab({ rollup, currency }: Props) {
  const money = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }), [currency]);

  const lines = useMemo(() => {
    const byName = new Map<string, { name: string; cost: number; takeoffs: number }>();
    for (const entry of rollup.pages) {
      if (entry.untrusted) continue;
      for (const row of entry.rows) {
        if (row.cost === null) continue;
        const name = row.templateName || row.name;
        const line = byName.get(name) ?? { name, cost: 0, takeoffs: 0 };
        line.cost += row.cost;
        line.takeoffs += 1;
        byName.set(name, line);
      }
    }
    return Array.from(byName.values()).sort((left, right) => right.cost - left.cost);
  }, [rollup.pages]);

  if (!lines.length) {
    return <div className="large-empty"><div className="empty-symbol">$</div><p>لا توجد تكلفة محسوبة بعد. اضبط المقياس وأسند القوالب إلى القياسات.</p></div>;
  }

  return (
    <div className="estimate-tab">
      <div className="bid-total">
        <span className="panel-kicker">إجمالي التقدير</span>
        <strong>{money.format(rollup.cost)}</strong>
        <small>{lines.length} بند · {rollup.pages.filter((entry) => !entry.untrusted).length} ورقة</small>
      </div>

      <div className="cost-lines">
        {lines.map((line) => {
          const share = rollup.cost > 0 ? line.cost / rollup.cost : 0;
          return (
            <article key={line.name} className="cost-line">
              <div className="cost-line-head">
                <b>{line.name}</b>
                <strong>{money.format(line.cost)}</strong>
              </div>
              <div className="cost-line-bar"><i style={{ inlineSize: `${Math.max(share * 100, 1)}%` }} /></div>
              <small>{line.takeoffs} قياس · {(share * 100).toFixed(1)}٪ من الإجمالي</small>
            </article>
          );
        })}
      </div>
    </div>
  );
}
