// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemSearchPanel } from "../client/src/components/ItemSearchPanel";

describe("ItemSearchPanel", () => {
  it("selects the clicked result without mutating the supplied result", () => {
    const onSelect = vi.fn(); const onQueryChange = vi.fn();
    const result = { id: "item-1", name: "سقف رئيسي", kind: "ROOF_AREA", color: "#c9ff4a", templateName: "عزل" };
    render(createElement(ItemSearchPanel, { query: "سقف", onQueryChange, results: [result], selectedId: null, onSelect }));
    fireEvent.click(screen.getByRole("button", { name: /سقف رئيسي/i }));
    expect(onSelect).toHaveBeenCalledWith("item-1");
    expect(result).toEqual({ id: "item-1", name: "سقف رئيسي", kind: "ROOF_AREA", color: "#c9ff4a", templateName: "عزل" });
  });
});
