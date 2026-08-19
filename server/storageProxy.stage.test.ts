import { describe, expect, it, vi } from "vitest";

const storageGetSignedUrl = vi.fn();
vi.mock("../server/storage", () => ({ storageGetSignedUrl }));

describe("stage storage proxy contract", () => {
  it("keeps the stage object endpoint behind the application proxy", async () => {
    process.env.TAKEOFF_S3_ENDPOINT = "http://takeoff-stage-minio:9000";
    storageGetSignedUrl.mockResolvedValue("http://takeoff-stage-minio:9000/takeoff-stage/object.pdf");
    const sourceFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/pdf" } }));
    const { registerStorageProxy } = await import("../server/_core/storageProxy");
    const routes = new Map<string, (req: any, res: any) => Promise<void>>();
    registerStorageProxy({ get: (path: string, handler: (req: any, res: any) => Promise<void>) => routes.set(path, handler) } as any);
    const result: { status?: number; body?: Buffer; type?: string; cache?: string } = {};
    const res = { status: (code: number) => { result.status = code; return res; }, send: (body: Buffer) => { result.body = body; return res; }, type: (value: string) => { result.type = value; return res; }, set: (name: string, value: string) => { if (name === "Cache-Control") result.cache = value; return res; } };
    await routes.get("/manus-storage/*")!({ params: { 0: "object.pdf" } }, res);
    expect(storageGetSignedUrl).toHaveBeenCalledWith("object.pdf");
    expect(result).toMatchObject({ status: 200, type: "application/pdf", cache: "no-store" });
    expect(result.body).toEqual(Buffer.from([1, 2, 3]));
    global.fetch = sourceFetch;
    delete process.env.TAKEOFF_S3_ENDPOINT;
  });
});
