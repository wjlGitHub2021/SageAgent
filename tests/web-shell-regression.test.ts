import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("web shell regression guards", () => {
  it("keeps the initial workbench in home state until a run is selected", async () => {
    const pageSource = await readFile(
      path.resolve("apps/web/src/app/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain(
      "const [hasSelectedRun, setHasSelectedRun] = useState(false)",
    );
    expect(pageSource).toContain("const selectedRun = hasSelectedRun ? activeRun : null");
    expect(pageSource).toContain("setHasSelectedRun(true)");
    expect(pageSource).toContain("setHasSelectedRun(false)");
    expect(pageSource).toContain("hasSelectedRun && run.id === activeRunId");
  });

  it("routes all dialog close controls through the focus-restoring helpers", async () => {
    const pageSource = await readFile(
      path.resolve("apps/web/src/app/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("settingsTriggerRef.current?.focus()");
    expect(pageSource).toContain("memoryTriggerRef.current?.focus()");
    expect(pageSource).toContain("skillTriggerRef.current?.focus()");
    expect(pageSource).toContain("ref={settingsDialogRef}");
    expect(pageSource).toContain("ref={memoryDialogRef}");
    expect(pageSource).toContain("ref={skillDialogRef}");
    expect(pageSource).toContain("closeSettings();");
    expect(pageSource).toContain("closeMemoryEditor();");
    expect(pageSource).toContain("closeSkillEditor();");
    expect(pageSource).not.toContain("onClick={() => setIsSettingsOpen(false)}");
    expect(pageSource).not.toContain("onClick={() => setIsMemoryEditorOpen(false)}");
    expect(pageSource).not.toContain("onClick={() => setIsSkillEditorOpen(false)}");
  });
});
