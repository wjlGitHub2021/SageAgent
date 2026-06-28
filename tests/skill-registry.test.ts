import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createEmptySkillSnapshot } from "@sage/shared";
import {
  createPersistentSkillRegistry,
  createSkillContextMessage,
  createSkillRegistry,
} from "@sage/runtime";

describe("skill registry", () => {
  it("supports create update curation delete and audit trail", () => {
    const registry = createSkillRegistry(createEmptySkillSnapshot());
    const created = registry.upsertEntry({
      name: "Review checklist",
      description: "Use a focused QA checklist before final answers.",
      instruction: "Check docs, tests, browser QA, and git status.",
      tags: ["qa", "review"],
      source: "user",
      status: "draft",
      createdBy: "user",
      reason: "Capture repeated QA flow",
      createdAt: "2026-06-28T10:00:00.000Z",
    });

    expect(created.version).toBe(1);
    expect(registry.listEntries("draft")).toHaveLength(1);

    const updated = registry.upsertEntry({
      id: created.id,
      name: "Review checklist",
      description: "Use a focused QA checklist before final answers.",
      instruction: "Check docs, tests, browser QA, git status, and push state.",
      tags: ["qa"],
      source: "user",
      status: "draft",
      createdBy: "supervisor",
      reason: "Refine checklist",
      createdAt: "2026-06-28T10:05:00.000Z",
    });

    expect(updated.version).toBe(2);
    expect(
      registry.setStatus({
        id: created.id,
        status: "curated",
        actor: "user",
        reason: "Approve for reuse",
        createdAt: "2026-06-28T10:06:00.000Z",
      })?.status,
    ).toBe("curated");
    expect(
      registry.deleteEntry({
        id: created.id,
        actor: "user",
        reason: "Remove test skill",
        createdAt: "2026-06-28T10:10:00.000Z",
      }),
    ).toBe(true);

    expect(registry.getSnapshot().auditTrail.map((record) => record.action)).toEqual([
      "create",
      "update",
      "enable",
      "delete",
    ]);
  });

  it("creates readable context only for curated skills", () => {
    const registry = createSkillRegistry(createEmptySkillSnapshot());
    registry.upsertEntry({
      name: "Reusable QA",
      description: "A reusable QA pass for local web changes.",
      instruction: "Run unit checks and perform browser smoke before commit.",
      source: "user",
      status: "curated",
      createdBy: "user",
      reason: "Approve QA skill",
      createdAt: "2026-06-28T10:00:00.000Z",
    });
    registry.upsertEntry({
      name: "Draft only",
      description: "This skill is not approved.",
      instruction: "This should not enter prompt context.",
      source: "agent",
      status: "draft",
      createdBy: "supervisor",
      reason: "Draft skill",
      createdAt: "2026-06-28T10:01:00.000Z",
    });
    registry.upsertEntry({
      name: "Disabled only",
      description: "This skill was turned off.",
      instruction: "This should not enter prompt context either.",
      source: "template",
      status: "disabled",
      createdBy: "user",
      reason: "Disabled skill",
      createdAt: "2026-06-28T10:02:00.000Z",
    });

    const message = createSkillContextMessage({
      snapshot: registry.getSnapshot(),
    });

    expect(message).toContain("Curated skill context");
    expect(message).toContain("Reusable QA");
    expect(message).not.toContain("Draft only");
    expect(message).not.toContain("Disabled only");
  });

  it("can persist skill registry snapshots to the local registry backend", async () => {
    const storagePath = path.join(
      os.tmpdir(),
      `sage-skill-registry-${Date.now()}.json`,
    );
    const registry = createPersistentSkillRegistry({
      storagePath,
      initialSnapshot: createEmptySkillSnapshot(),
    });

    const entry = registry.upsertEntry({
      name: "Local docs",
      description: "Prefer local project docs before broader assumptions.",
      instruction: "Read AGENTS.md and relevant docs before implementing.",
      source: "template",
      status: "curated",
      createdBy: "user",
      reason: "Store project workflow",
      createdAt: "2026-06-28T10:00:00.000Z",
    });

    const restoredRegistry = createPersistentSkillRegistry({
      storagePath,
      initialSnapshot: createEmptySkillSnapshot(),
    });

    expect(entry.id).toContain("skill-");
    expect(restoredRegistry.getSnapshot().entries).toEqual([
      expect.objectContaining({
        id: entry.id,
        name: "Local docs",
        status: "curated",
      }),
    ]);
    await fs.rm(storagePath, { force: true });
  });

  it("backs up invalid persisted snapshots before starting from an empty registry", async () => {
    const storageDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "sage-skill-registry-invalid-"),
    );
    const storagePath = path.join(storageDirectory, "skill-registry.json");
    await fs.writeFile(storagePath, "{not-json", "utf8");

    const registry = createPersistentSkillRegistry({
      storagePath,
      initialSnapshot: createEmptySkillSnapshot(),
    });

    expect(registry.getSnapshot().entries).toEqual([]);
    await expect(fs.access(storagePath)).rejects.toThrow();
    const backups = (await fs.readdir(storageDirectory)).filter((name) =>
      name.startsWith("skill-registry.json.invalid-"),
    );
    expect(backups).toHaveLength(1);
    await expect(
      fs.readFile(path.join(storageDirectory, backups[0] ?? ""), "utf8"),
    ).resolves.toBe("{not-json");

    await fs.rm(storageDirectory, { recursive: true, force: true });
  });
});
