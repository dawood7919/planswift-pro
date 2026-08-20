// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setLocation = vi.fn();
const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

const workspace = {
  project: { id: "project-1", name: "عيادة هاربر بوينت", clientName: "ميريديان", location: "تامبا", currency: "USD" },
  pages: [
    { id: "page-1", name: "A-101 المخطط الأول", pdfPageNumber: 1, scaleDrawingDistance: "10", scaleWorldDistance: "20", scaleUnit: "m", geometrySpace: "PAGE_POINTS" },
    { id: "page-2", name: "A-102 صفحة قديمة", pdfPageNumber: 2, scaleDrawingDistance: "10", scaleWorldDistance: "20", scaleUnit: "m", geometrySpace: "LEGACY_VIEWBOX" },
  ],
  items: [
    { id: "item-1", pageId: "page-1", kind: "AREA", name: "بلاطة", geometryJson: JSON.stringify({ rings: [square] }), rate: "2", multiplier: "1", templateId: null },
    { id: "item-2", pageId: "page-2", kind: "AREA", name: "بلاطة قديمة", geometryJson: JSON.stringify({ rings: [square] }), rate: "5", multiplier: "1", templateId: null },
  ],
  commands: [], reviews: [], versions: [], scaleContexts: [], documents: [], annotations: [],
};

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    projects: { get: { useQuery: () => ({ data: workspace, isLoading: false }) } },
    templates: { list: { useQuery: () => ({ data: [] }) } },
  },
}));
vi.mock("wouter", () => ({
  useRoute: () => [true, { projectId: "project-1" }],
  useLocation: () => ["/projects/project-1", setLocation],
}));
vi.mock("@/components/PdfThumbnail", () => ({ default: () => null }));

import ProjectPage from "../client/src/pages/ProjectPage";

describe("project shell", () => {
  beforeEach(() => { cleanup(); setLocation.mockReset(); });

  it("presents sheets, takeoff and estimate as three peer tabs", () => {
    const view = render(createElement(ProjectPage));
    const tabs = within(view.container).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["الأوراق", "القياسات", "التقدير"]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("lists every sheet with its measurement count", () => {
    const view = render(createElement(ProjectPage));
    const cards = view.container.querySelectorAll(".sheet-card");
    expect(cards).toHaveLength(2);
    expect(cards[0]!.textContent).toContain("A-101");
    // The legacy sheet is flagged on the card itself.
    expect(cards[1]!.className).toContain("untrusted");
  });

  it("warns that legacy sheets are excluded from the totals", () => {
    const view = render(createElement(ProjectPage));
    expect(view.container.querySelector(".project-notice")!.textContent).toContain("1 صفحة بإحداثيات قديمة");
  });

  it("rolls quantities up across the project on the takeoff tab", () => {
    const view = render(createElement(ProjectPage));
    fireEvent.click(within(view.container).getByRole("tab", { name: "القياسات" }));
    const tile = view.container.querySelector(".quantity-tile")!;
    // 100 drawing units squared at factor 2 gives 400 m2 from the one trustworthy sheet.
    expect(tile.textContent).toContain("m²");
    expect(tile.textContent).toContain("400");
    expect(view.container.querySelectorAll(".quantity-tile")).toHaveLength(1);
  });

  it("totals cost only over trustworthy sheets on the estimate tab", () => {
    const view = render(createElement(ProjectPage));
    fireEvent.click(within(view.container).getByRole("tab", { name: "التقدير" }));
    // 400 m2 at 2 per unit; the legacy sheet's 2000 is deliberately excluded.
    expect(view.container.querySelector(".bid-total strong")!.textContent).toBe("$800.00");
    expect(view.container.querySelectorAll(".cost-line")).toHaveLength(1);
  });

  it("opens the plan viewer from the shell", () => {
    const view = render(createElement(ProjectPage));
    fireEvent.click(within(view.container).getByRole("button", { name: "فتح المخطط" }));
    expect(setLocation).toHaveBeenCalledWith("/workspace/project-1");
  });
});
