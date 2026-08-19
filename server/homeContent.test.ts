import { describe, expect, it } from "vitest";
import { faqItems, roadmap, toolCards } from "../client/src/pages/homeContent";

describe("landing page content", () => {
  it("provides the four core takeoff tools and estimating", () => {
    expect(toolCards.map((tool) => tool.title)).toEqual(["Area", "Linear", "Segment", "Count", "التقدير"]);
  });

  it("keeps the roadmap ordered from MVP to full release", () => {
    expect(roadmap).toHaveLength(4);
    expect(roadmap[0]?.title).toContain("MVP");
    expect(roadmap.at(-1)?.title).toContain("الإصدار الكامل");
  });

  it("includes clear answers for the FAQ section", () => {
    expect(faqItems).toHaveLength(4);
    expect(faqItems.every((item) => item.question.length > 0 && item.answer.length > 0)).toBe(true);
  });
});
