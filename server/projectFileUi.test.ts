import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const projectsPage = readFileSync(resolve(root, "client/src/pages/ProjectsPage.tsx"), "utf8");
const workspacePage = readFileSync(resolve(root, "client/src/pages/WorkspacePage.tsx"), "utf8");

describe("project file UI wiring", () => {
  it("wires the import and per-project backup controls to protected mutations", () => {
    expect(projectsPage).toContain("trpc.projects.importProjectFile.useMutation");
    expect(projectsPage).toContain("trpc.projects.exportProjectFile.useMutation");
    expect(projectsPage).toContain('accept="application/json,.json"');
    expect(projectsPage).toContain("downloadProjectFile(project.id, project.name)");
  });

  it("keeps workspace project backup wired to the same protected export path", () => {
    expect(workspacePage).toContain("trpc.projects.exportProjectFile.useMutation");
    expect(workspacePage).toContain("triggerProjectFileDownload(content)");
  });
});
