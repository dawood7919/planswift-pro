import { describe, expect, it, vi } from "vitest";
import { saveProjectWorkspaceWithDatabase, type SaveWorkspaceInput } from "./db";

const input: SaveWorkspaceInput = {
  page: { id: "page-1", name: "المخطط" },
  items: [{ id: "item-new", pageId: "page-1", kind: "LINEAR", name: "جدار", color: "#22D3EE", geometryJson: "{\"points\":[]}", rate: "0", multiplier: "1" }],
  commandEvents: [],
};

describe("workspace atomic save", () => {
  it("rolls back the deletion when inserting a replacement measurement fails", async () => {
    let persistedItems = ["item-existing"];
    const transaction = vi.fn(async (work: (tx: unknown) => Promise<unknown>) => {
      let stagedItems = [...persistedItems];
      const tx = {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "owned" }] }) }) }),
        update: () => ({ set: () => ({ where: async () => undefined }) }),
        delete: () => ({ where: async () => { stagedItems = []; } }),
        insert: () => ({ values: async () => { throw new Error("DUPLICATE_ENTRY"); } }),
      };
      try {
        await work(tx);
        persistedItems = stagedItems;
      } catch (error) {
        throw error;
      }
    });
    const db = { transaction } as unknown as Parameters<typeof saveProjectWorkspaceWithDatabase>[0];

    await expect(saveProjectWorkspaceWithDatabase(db, 1, "project-1", input)).rejects.toThrow("DUPLICATE_ENTRY");
    expect(transaction).toHaveBeenCalledOnce();
    expect(persistedItems).toEqual(["item-existing"]);
  });
});
