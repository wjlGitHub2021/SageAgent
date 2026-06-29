import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createEmptyMemorySnapshot } from "@sage/shared";
import {
  createMemoryContextMessage,
  createMemoryRegistry,
  createPersistentMemoryRegistry,
} from "@sage/runtime";

describe("memory registry", () => {
  it("supports create update delete and audit trail", () => {
    const registry = createMemoryRegistry(createEmptyMemorySnapshot());
    const created = registry.upsertEntry({
      scope: "workspace",
      title: "Safety boundary",
      content: "File writes require approval.",
      tags: ["policy", "approval"],
      createdBy: "user",
      reason: "Capture workspace policy",
      createdAt: "2026-06-28T10:00:00.000Z",
    });

    expect(created.title).toBe("Safety boundary");
    expect(registry.listEntries("workspace")).toHaveLength(1);

    const updated = registry.upsertEntry({
      id: created.id,
      scope: "workspace",
      title: "Safety boundary",
      content: "File writes and shell require approval.",
      tags: ["policy"],
      createdBy: "supervisor",
      reason: "Refine policy",
      createdAt: "2026-06-28T10:05:00.000Z",
    });

    expect(updated.updatedAt).toBe("2026-06-28T10:05:00.000Z");
    expect(
      registry.deleteEntry({
        id: created.id,
        actor: "user",
        reason: "Remove stale memory",
        createdAt: "2026-06-28T10:10:00.000Z",
      }),
    ).toBe(true);

    const snapshot = registry.getSnapshot();
    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.auditTrail.map((record) => record.action)).toEqual([
      "create",
      "update",
      "delete",
    ]);
  });

  it("creates readable memory context for supervisor prompts", () => {
    const registry = createMemoryRegistry(createEmptyMemorySnapshot());
    registry.upsertEntry({
      scope: "workspace",
      title: "Default model",
      content: "deepseek-v4-flash is the default model.",
      tags: ["model"],
      sourceThreadId: "thread-1",
      sourceRunId: "run-1",
      createdBy: "user",
      reason: "Capture model choice",
      createdAt: "2026-06-28T10:00:00.000Z",
    });

    const message = createMemoryContextMessage({
      snapshot: registry.getSnapshot(),
      currentThreadId: "thread-1",
      currentRunId: "run-1",
    });

    expect(message).toContain("Persisted memory context");
    expect(message).toContain("deepseek-v4-flash");
  });

  it("can persist memory registry snapshots to the local registry backend", () => {
    const storagePath = path.join(
      os.tmpdir(),
      `sage-memory-registry-${Date.now()}.json`,
    );
    const registry = createPersistentMemoryRegistry({
      storagePath,
      initialSnapshot: createEmptyMemorySnapshot(),
    });

    const entry = registry.upsertEntry({
      scope: "preference",
      title: "Locale",
      content: "Chinese is default.",
      createdBy: "user",
      reason: "Store locale preference",
      createdAt: "2026-06-28T10:00:00.000Z",
    });

    const restoredRegistry = createPersistentMemoryRegistry({
      storagePath,
      initialSnapshot: createEmptyMemorySnapshot(),
    });

    expect(entry.id).toContain("memory-");
    expect(restoredRegistry.getSnapshot().entries).toEqual([
      expect.objectContaining({
        id: entry.id,
        title: "Locale",
        content: "Chinese is default.",
      }),
    ]);
    void fs.rm(storagePath, { force: true });
  });

  it("backs up invalid persisted snapshots instead of silently overwriting them", async () => {
    const storageDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "sage-memory-registry-invalid-"),
    );
    const storagePath = path.join(storageDirectory, "memory-registry.json");
    await fs.writeFile(storagePath, "{not-json", "utf8");

    const registry = createPersistentMemoryRegistry({
      storagePath,
      initialSnapshot: createEmptyMemorySnapshot(),
    });

    expect(registry.getSnapshot().entries).toEqual([]);
    const backups = (await fs.readdir(storageDirectory)).filter((name) =>
      name.startsWith("memory-registry.json.invalid-"),
    );
    expect(backups).toHaveLength(1);
    await expect(
      fs.readFile(path.join(storageDirectory, backups[0] ?? ""), "utf8"),
    ).resolves.toBe("{not-json");

    await fs.rm(storageDirectory, { recursive: true, force: true });
  });

  it("drops structurally invalid entries while keeping valid ones", async () => {
    const storageDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "sage-memory-registry-badelem-"),
    );
    const storagePath = path.join(storageDirectory, "memory-registry.json");
    const validEntry = {
      id: "memory-keep",
      scope: "workspace",
      title: "Keep me",
      content: "valid",
      tags: ["ok"],
      sourceThreadId: null,
      sourceRunId: null,
      createdBy: "user",
      createdAt: "2026-06-29T10:00:00.000Z",
      updatedAt: "2026-06-29T10:00:00.000Z",
    };
    await fs.writeFile(
      storagePath,
      JSON.stringify({ entries: [validEntry, null, { id: "broken" }], auditTrail: [] }),
      "utf8",
    );

    const registry = createPersistentMemoryRegistry({
      storagePath,
      initialSnapshot: createEmptyMemorySnapshot(),
    });

    const entries = registry.getSnapshot().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("memory-keep");
    // 丢弃坏元素时备份原文件
    const backups = (await fs.readdir(storageDirectory)).filter((name) =>
      name.startsWith("memory-registry.json.invalid-"),
    );
    expect(backups).toHaveLength(1);

    await fs.rm(storageDirectory, { recursive: true, force: true });
  });
});
