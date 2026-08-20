import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("مسار توزيع PWA", () => {
  it("يوفر manifest صالحاً لتثبيت Takeoff في نافذة مستقلة باتجاه عربي", async () => {
    const source = await readFile(
      path.join(projectRoot, "client/public/manifest.webmanifest"),
      "utf8",
    );
    const manifest = JSON.parse(source) as Record<string, unknown>;

    expect(manifest).toMatchObject({
      name: "Takeoff Platform",
      start_url: "/",
      display: "standalone",
      lang: "ar",
      dir: "rtl",
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: "any maskable" }),
      ]),
    );
  });

  it("يربط manifest وغلاف service worker، مع عدم تخزين استجابات API المحمية", async () => {
    const [indexHtml, entry, worker] = await Promise.all([
      readFile(path.join(projectRoot, "client/index.html"), "utf8"),
      readFile(path.join(projectRoot, "client/src/main.tsx"), "utf8"),
      readFile(path.join(projectRoot, "client/public/service-worker.js"), "utf8"),
    ]);

    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(entry).toContain('navigator.serviceWorker.register("/service-worker.js")');
    expect(worker).toContain('const SHELL = ["/", "/manifest.webmanifest"]');
    expect(worker).toContain('request.url.includes("/api/")');
  });
});
