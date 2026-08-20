import { Input } from "@/components/ui/input";
import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "@/i18n";

export type ItemSearchResult = { id: string; name: string; kind: string; color: string; templateName?: string | null };

type ItemSearchPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  results: ItemSearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ItemSearchPanel({ query, onQueryChange, results, selectedId, onSelect }: ItemSearchPanelProps) {
  const { t } = useTranslation();
  return <section className="item-search" aria-label={t("search.label")}><label htmlFor="takeoff-item-search"><Search size={14} />{t("search.heading")}</label><Input id="takeoff-item-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("search.placeholder")} /><div className="item-search-results">{results.length ? results.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => onSelect(item.id)}><span className="item-color" style={{ background: item.color }} /><span><b>{item.name}</b><small>{item.kind}{item.templateName ? ` · ${item.templateName}` : ""}</small></span></button>) : <p>{t("search.empty")}</p>}</div><small className="item-search-hint">{t("search.hint")}</small></section>;
}
