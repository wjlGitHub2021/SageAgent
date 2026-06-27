import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const blockedPolicyEntries = [
  { ui: ".env", runtime: ".env" },
  { ui: ".env.*", runtime: ".env." },
  { ui: ".git/", runtime: ".git" },
  { ui: "node_modules/", runtime: "node_modules" },
  { ui: ".next/", runtime: ".next" },
  { ui: "dist/", runtime: "dist" },
  { ui: "build/", runtime: "build" },
  { ui: "coverage/", runtime: "coverage" },
  { ui: "tmp/", runtime: "tmp" },
  { ui: "playwright-report/", runtime: "playwright-report" },
  { ui: "test-results/", runtime: "test-results" },
] as const;

describe("web workspace policy copy", () => {
  it("covers the runtime read_project_file blocked path policy", async () => {
    const [pageSource, toolSource] = await Promise.all([
      readFile(path.resolve("apps/web/src/app/page.tsx"), "utf8"),
      readFile(
        path.resolve("packages/runtime/src/read-project-file-tool.ts"),
        "utf8",
      ),
    ]);

    for (const entry of blockedPolicyEntries) {
      expect(pageSource).toContain(entry.ui);
      expect(toolSource).toContain(entry.runtime);
    }

    expect(pageSource).toContain("SAGE_WORKSPACE_ROOT");
    expect(pageSource).toContain("read_project_file");
    expect(pageSource).toContain("64 KiB");
    expect(pageSource).toContain("binary");
    expect(pageSource).toContain("absolute");
  });

  it("does not hard-code the developer machine workspace path in Settings copy", async () => {
    const pageSource = await readFile(
      path.resolve("apps/web/src/app/page.tsx"),
      "utf8",
    );

    expect(pageSource).not.toContain("/Users/wangjinlong/DailySage");
  });
});
