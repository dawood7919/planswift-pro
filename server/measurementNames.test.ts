import { describe, expect, it } from "vitest";
import { nextCopyName } from "../client/src/lib/measurementNames";

const arLabels = { fallback: "قياس", copy: "نسخة" };

describe("measurement copy naming", () => {
  it("chooses the first unused suffix even after an earlier copy was deleted", () => {
    expect(nextCopyName("جدار", ["جدار", "جدار — نسخة 1", "جدار — نسخة 3"], arLabels)).toBe("جدار — نسخة 2");
  });

  it("normalizes an empty source name and remains collision-free for a batch", () => {
    const used = new Set(["قياس — نسخة 1"]);
    const first = nextCopyName(" ", used, arLabels);
    used.add(first);
    expect(first).toBe("قياس — نسخة 2");
    expect(nextCopyName(" ", used, arLabels)).toBe("قياس — نسخة 3");
  });
});
