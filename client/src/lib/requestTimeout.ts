export const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  fetchImpl: typeof fetch = globalThis.fetch,
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  try {
    return await fetchImpl(input, { ...(init ?? {}), credentials: "include", signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}
