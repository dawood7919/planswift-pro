import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../client/src/lib/requestTimeout";

describe("fetchWithTimeout", () => {
  it("aborts a stalled request after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const pending = fetchWithTimeout("/api/trpc/auth.me", undefined, 25, fetchImpl as typeof fetch);
    const rejection = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    vi.useRealTimers();
  });

  it("preserves credentials for a successful request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("ok"));
    await expect(fetchWithTimeout("/api/trpc/auth.me", { method: "GET" }, 100, fetchImpl)).resolves.toBeInstanceOf(Response);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "include" });
  });
});
