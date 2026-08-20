import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const shell = readFileSync(resolve(root, "client/src/pages/ProjectPage.tsx"), "utf8");

describe("project shell", () => {
  it("registers the project overview route before the focused workspace route", () => {
    expect(app).toContain('path={"/projects/:projectId"}');
    expect(app.indexOf('path={"/projects/:projectId"}')).toBeLessThan(app.indexOf('path={"/workspace/:projectId"}'));
  });

  it("exposes sheets, takeoff, and estimate surfaces with a focused plan action", () => {
    expect(shell).toContain('id: "sheets"');
    expect(shell).toContain('id: "takeoff"');
    expect(shell).toContain('id: "estimate"');
    expect(shell).toContain('setLocation(`/workspace/${project.id}`)');
    expect(shell).toContain('className="project-tabs"');
  });
});
