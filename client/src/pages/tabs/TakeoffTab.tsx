import React, { useMemo, useState } from "react";
import { formatQuantity } from "@shared/takeoff-core";
import { quantityGroupFor, type ProjectRollup } from "@shared/takeoff-core/projectRollup";

type Props = { rollup: ProjectRollup };

const filters = [
  { id: "ALL", label: "الكل" },
  { id: "AREA", label: "مساحة" },
  { id: "LENGTH", label: "طول" },
  { id: "COUNT", label: "عدد" },
  { id: "VOLUME", label: "حجم" },
] as const;

/** Every measurement in the project, grouped by the sheet it was taken from. */
export default function TakeoffTab({ rollup }: Props) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("ALL");

  const groups = useMemo(
    () => rollup.pages
      .map((entry) => ({
        ...entry,
        rows: filter === "ALL" ? entry.rows : entry.rows.filter((row) => quantityGroupFor(row.kind) === filter),
      }))
      .filter((entry) => entry.rows.length > 0),
    [rollup.pages, filter],
  );

  return (
    <div className="takeoff-tab">
      <div className="quantity-tiles">
        {rollup.quantities.length
          ? rollup.quantities.map((total) => (
              <div key={total.unit} className="quantity-tile">
                <span className="panel-kicker">{total.unit}</span>
                <strong>{formatQuantity(total.value, total.unit)}</strong>
                <small>{total.itemCount} عنصر</small>
              </div>
            ))
          : <p className="muted-note">لا توجد كميات صالحة بعد. اضبط مقياس كل ورقة أولاً.</p>}
      </div>

      <div className="filter-chips" role="group" aria-label="تصفية حسب النوع">
        {filters.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={filter === entry.id} className={filter === entry.id ? "active" : ""} onClick={() => setFilter(entry.id)}>
            {entry.label}
          </button>
        ))}
      </div>

      {groups.length ? groups.map(({ page, rows, untrusted }) => (
        <section key={page.id} className="takeoff-group">
          <h2>{page.name}{untrusted ? <em className="untrusted-flag">إحداثيات قديمة</em> : null}</h2>
          <div className="report-rows">
            {rows.map((row) => (
              <div key={row.id} className="report-row">
                <div>
                  <b>{row.name}</b>
                  <small>{row.kind} · {row.status === "VALID" && row.quantity !== null ? formatQuantity(row.quantity, row.unit) : row.diagnostic ?? row.status}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )) : <div className="large-empty"><p>لا توجد قياسات مطابقة لهذا التصنيف.</p></div>}
    </div>
  );
}
