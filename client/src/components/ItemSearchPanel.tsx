import { Input } from "@/components/ui/input";
import React from "react";
import { Search } from "lucide-react";

export type ItemSearchResult = { id: string; name: string; kind: string; color: string; templateName?: string | null };

type ItemSearchPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  results: ItemSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ItemSearchPanel({ query, onQueryChange, results, selectedId, onSelect }: ItemSearchPanelProps) {
  return <section className="item-search" aria-label="بحث عناصر القياس"><label htmlFor="takeoff-item-search"><Search size={14} />بحث العناصر</label><Input id="takeoff-item-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="اسم، نوع، أو قالب" /><div className="item-search-results">{results.length ? results.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => onSelect(item.id)}><span className="item-color" style={{ background: item.color }} /><span><b>{item.name}</b><small>{item.kind}{item.templateName ? ` · ${item.templateName}` : ""}</small></span></button>) : <p>لا توجد عناصر مطابقة في هذه الصفحة.</p>}</div><small className="item-search-hint">البحث يحدد العنصر فقط ولا يغيّر القياسات أو الحفظ.</small></section>;
}
