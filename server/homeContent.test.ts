import { describe, expect, it } from "vitest";
import { faqItems, roadmap, toolCards } from "../client/src/pages/homeContent";

describe("landing page content", () => {
  it("provides the four core takeoff tools and estimating", () => {
    expect(toolCards.map((tool) => tool.titleKey)).toEqual(["home.tool.area.title", "home.tool.linear.title", "home.tool.segment.title", "home.tool.count.title", "home.tool.estimate.title"]);
    expect(toolCards.every((tool) => tool.eyebrowKey.endsWith(".eyebrow") && tool.descriptionKey.endsWith(".description"))).toBe(true);
  });

  it("keeps the roadmap ordered from MVP to full release", () => {
    expect(roadmap).toHaveLength(4);
    expect(roadmap[0]?.titleKey).toBe("home.roadmap.1.title");
    expect(roadmap.at(-1)?.titleKey).toBe("home.roadmap.4.title");
  });

  it("includes clear answers for the FAQ section", () => {
    expect(faqItems).toHaveLength(4);
    expect(faqItems.every((item) => item.questionKey.startsWith("home.faq.") && item.answerKey.startsWith("home.faq."))).toBe(true);
  });
});
