import { describe, expect, it, vi } from "vitest";
import { readProjectImportFile, triggerProjectFileDownload } from "../client/src/lib/projectFileBrowser";

describe("project file browser adapter", () => {
  it("reads a non-empty project file and rejects oversized or blank uploads before mutation", async () => {
    await expect(readProjectImportFile({ size: 20, text: async () => "{\"format\":\"takeoff-project\"}" })).resolves.toContain("takeoff-project");
    await expect(readProjectImportFile({ size: 5_000_001, text: async () => "{}" })).rejects.toThrow("PROJECT_FILE_TOO_LARGE");
    await expect(readProjectImportFile({ size: 1, text: async () => "   " })).rejects.toThrow("PROJECT_FILE_EMPTY");
  });

  it("creates a Blob URL, clicks a download anchor, and revokes the URL", () => {
    const click = vi.fn(); const revokeObjectUrl = vi.fn(); const anchor = { href: "", download: "", click };
    triggerProjectFileDownload("{\"format\":\"takeoff-project\"}", "backup.json", {
      createBlob: () => new Blob(["backup"]), createObjectUrl: () => "blob:takeoff", revokeObjectUrl, createAnchor: () => anchor,
    });
    expect(anchor).toMatchObject({ href: "blob:takeoff", download: "backup.json" });
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:takeoff");
  });
});
