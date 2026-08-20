/**
 * Shared pdf.js document cache.
 *
 * Every component that shows a sheet used to call `getDocument({ url })` for itself, so a
 * 20-page drawing opened 21 independent copies of the same file — one per thumbnail plus the
 * plan layer — each fetching, parsing and holding its own worker state.
 *
 * Documents are now reference-counted per URL. A released document is kept alive briefly so
 * that flipping between pages of the same drawing reuses it instead of reparsing, and pdf.js
 * itself is imported lazily so the renderer can be split out of the initial bundle.
 */

type PdfPage = {
  getViewport(options: { scale: number; rotation?: number }): { width: number; height: number };
  render(options: Record<string, unknown>): { promise: Promise<void>; cancel: () => void };
  rotate?: number;
  cleanup?: () => void;
};

export type PdfDocument = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  cleanup(): void;
  destroy?: () => Promise<void> | void;
};

type CacheEntry = {
  document: Promise<PdfDocument>;
  refs: number;
  evictTimer: ReturnType<typeof setTimeout> | null;
  destroyTask: (() => void) | null;
};

/** How long an unreferenced document stays warm before it is torn down. */
export const IDLE_EVICTION_MS = 30_000;

const cache = new Map<string, CacheEntry>();

let pdfjs: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = (async () => {
      const [module, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      module.GlobalWorkerOptions.workerSrc = worker.default;
      return module;
    })();
  }
  return pdfjs;
}

function evict(url: string, entry: CacheEntry) {
  cache.delete(url);
  entry.destroyTask?.();
  void entry.document.then((document) => document.destroy?.()).catch(() => undefined);
}

export type PdfLease = {
  /** Resolves to the shared document. Never destroy it directly — release the lease. */
  document: Promise<PdfDocument>;
  release: () => void;
};

/**
 * Takes a reference on the document for `url`, loading it if nobody holds one yet.
 * Every acquire must be paired with exactly one `release`.
 */
export function acquirePdfDocument(url: string): PdfLease {
  let entry = cache.get(url);

  if (entry) {
    if (entry.evictTimer) {
      clearTimeout(entry.evictTimer);
      entry.evictTimer = null;
    }
    entry.refs += 1;
  } else {
    const created: CacheEntry = { document: null as unknown as Promise<PdfDocument>, refs: 1, evictTimer: null, destroyTask: null };
    created.document = loadPdfjs()
      .then((module) => {
        const task = module.getDocument({ url });
        created.destroyTask = () => void task.destroy();
        return task.promise as unknown as Promise<PdfDocument>;
      })
      .catch((error: unknown) => {
        // A failed load must not be cached, or the retry affordance could never succeed.
        if (cache.get(url) === created) cache.delete(url);
        throw error;
      });
    cache.set(url, created);
    entry = created;
  }

  const held = entry;
  let released = false;
  return {
    document: held.document,
    release: () => {
      // Guard against a double release, which would evict a document others still hold.
      if (released) return;
      released = true;
      held.refs -= 1;
      if (held.refs > 0 || cache.get(url) !== held) return;
      held.evictTimer = setTimeout(() => evict(url, held), IDLE_EVICTION_MS);
    },
  };
}

/** Drops every cached document immediately. Intended for tests and sign-out. */
export function clearPdfDocumentCache() {
  for (const [url, entry] of Array.from(cache.entries())) {
    if (entry.evictTimer) clearTimeout(entry.evictTimer);
    evict(url, entry);
  }
}

export function cachedPdfDocumentCount() {
  return cache.size;
}
