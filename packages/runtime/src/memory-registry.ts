import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type {
  DeleteMemoryEntryInput,
  EntityId,
  ISODateTimeString,
  MemoryActor,
  MemoryAuditAction,
  MemoryAuditRecord,
  MemoryEntry,
  MemoryScope,
  MemorySnapshot,
  UpsertMemoryEntryInput,
} from "@sage/shared";
import { createEmptyMemorySnapshot } from "@sage/shared";

export interface MemoryRegistry {
  getSnapshot(): MemorySnapshot;
  listEntries(scope?: MemoryScope): readonly MemoryEntry[];
  getEntry(memoryId: EntityId): MemoryEntry | undefined;
  upsertEntry(input: UpsertMemoryEntryInput): MemoryEntry;
  deleteEntry(input: DeleteMemoryEntryInput): boolean;
  recordAudit(input: MemoryAuditInput): MemoryAuditRecord;
}

export interface MemoryAuditInput {
  readonly memoryId: EntityId;
  readonly action: MemoryAuditAction;
  readonly actor: MemoryActor;
  readonly reason: string;
  readonly summary: string;
  readonly scope: MemoryScope;
  readonly title: string;
  readonly sourceThreadId: EntityId | null;
  readonly sourceRunId: EntityId | null;
  readonly createdAt: ISODateTimeString;
}

export function createMemoryRegistry(
  initialSnapshot: MemorySnapshot = createEmptyMemorySnapshot(),
): MemoryRegistry {
  return new LocalMemoryRegistry(initialSnapshot);
}

export interface CreatePersistentMemoryRegistryInput {
  readonly initialSnapshot?: MemorySnapshot;
  readonly storagePath?: string;
}

export function createPersistentMemoryRegistry(
  input: CreatePersistentMemoryRegistryInput = {},
): MemoryRegistry {
  return new PersistentMemoryRegistry({
    initialSnapshot: input.initialSnapshot ?? createEmptyMemorySnapshot(),
    storagePath: input.storagePath ?? resolveDefaultStoragePath(),
  });
}

class LocalMemoryRegistry implements MemoryRegistry {
  private readonly entries = new Map<EntityId, MemoryEntry>();
  private readonly auditTrail = new Map<EntityId, MemoryAuditRecord>();

  constructor(initialSnapshot: MemorySnapshot) {
    for (const entry of initialSnapshot.entries) {
      this.entries.set(entry.id, entry);
    }

    for (const audit of initialSnapshot.auditTrail) {
      this.auditTrail.set(audit.id, audit);
    }
  }

  getSnapshot(): MemorySnapshot {
    return {
      entries: [...this.entries.values()].sort((left, right) =>
        compareIsoDateTime(left.updatedAt, right.updatedAt) ||
        left.title.localeCompare(right.title),
      ),
      auditTrail: [...this.auditTrail.values()].sort((left, right) =>
        compareIsoDateTime(left.createdAt, right.createdAt) ||
        left.id.localeCompare(right.id),
      ),
    };
  }

  listEntries(scope?: MemoryScope): readonly MemoryEntry[] {
    const entries = [...this.entries.values()];
    return scope ? entries.filter((entry) => entry.scope === scope) : entries;
  }

  getEntry(memoryId: EntityId): MemoryEntry | undefined {
    return this.entries.get(memoryId);
  }

  upsertEntry(input: UpsertMemoryEntryInput): MemoryEntry {
    const now = input.createdAt.trim();
    const id = (input.id ?? createMemoryId()).trim();
    const previous = this.entries.get(id);
    const entry: MemoryEntry = {
      id,
      scope: input.scope,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: normalizeTags(input.tags ?? []),
      sourceThreadId: input.sourceThreadId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      createdBy: input.createdBy,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    this.entries.set(id, entry);
    this.recordAudit({
      memoryId: id,
      action: previous ? "update" : "create",
      actor: input.createdBy,
      reason: input.reason,
      summary: summarizeMemoryEntry(entry),
      scope: entry.scope,
      title: entry.title,
      sourceThreadId: entry.sourceThreadId,
      sourceRunId: entry.sourceRunId,
      createdAt: now,
    });

    return entry;
  }

  deleteEntry(input: DeleteMemoryEntryInput): boolean {
    const existing = this.entries.get(input.id);
    if (!existing) return false;

    this.entries.delete(input.id);
    this.recordAudit({
      memoryId: input.id,
      action: "delete",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeMemoryEntry(existing),
      scope: existing.scope,
      title: existing.title,
      sourceThreadId: existing.sourceThreadId,
      sourceRunId: existing.sourceRunId,
      createdAt: input.createdAt.trim(),
    });

    return true;
  }

  recordAudit(input: MemoryAuditInput): MemoryAuditRecord {
    const record: MemoryAuditRecord = {
      id: createMemoryAuditId(),
      memoryId: input.memoryId,
      action: input.action,
      actor: input.actor,
      reason: input.reason.trim(),
      summary: input.summary.trim(),
      scope: input.scope,
      title: input.title.trim(),
      sourceThreadId: input.sourceThreadId,
      sourceRunId: input.sourceRunId,
      createdAt: input.createdAt.trim(),
    };

    this.auditTrail.set(record.id, record);
    return record;
  }
}

class PersistentMemoryRegistry implements MemoryRegistry {
  private readonly storagePath: string;
  private readonly entries = new Map<EntityId, MemoryEntry>();
  private readonly auditTrail = new Map<EntityId, MemoryAuditRecord>();

  constructor(input: { readonly initialSnapshot: MemorySnapshot; readonly storagePath: string }) {
    this.storagePath = input.storagePath;
    this.loadSnapshot(input.initialSnapshot);
  }

  getSnapshot(): MemorySnapshot {
    return {
      entries: [...this.entries.values()].sort((left, right) =>
        compareIsoDateTime(left.updatedAt, right.updatedAt) ||
        left.title.localeCompare(right.title),
      ),
      auditTrail: [...this.auditTrail.values()].sort((left, right) =>
        compareIsoDateTime(left.createdAt, right.createdAt) ||
        left.id.localeCompare(right.id),
      ),
    };
  }

  listEntries(scope?: MemoryScope): readonly MemoryEntry[] {
    const entries = [...this.entries.values()];
    return scope ? entries.filter((entry) => entry.scope === scope) : entries;
  }

  getEntry(memoryId: EntityId): MemoryEntry | undefined {
    return this.entries.get(memoryId);
  }

  upsertEntry(input: UpsertMemoryEntryInput): MemoryEntry {
    const now = input.createdAt.trim();
    const id = (input.id ?? createMemoryId()).trim();
    const previous = this.entries.get(id);
    const entry: MemoryEntry = {
      id,
      scope: input.scope,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: normalizeTags(input.tags ?? []),
      sourceThreadId: input.sourceThreadId ?? null,
      sourceRunId: input.sourceRunId ?? null,
      createdBy: input.createdBy,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };

    this.entries.set(id, entry);
    this.recordAudit({
      memoryId: id,
      action: previous ? "update" : "create",
      actor: input.createdBy,
      reason: input.reason,
      summary: summarizeMemoryEntry(entry),
      scope: entry.scope,
      title: entry.title,
      sourceThreadId: entry.sourceThreadId,
      sourceRunId: entry.sourceRunId,
      createdAt: now,
    });
    this.save();

    return entry;
  }

  deleteEntry(input: DeleteMemoryEntryInput): boolean {
    const existing = this.entries.get(input.id);
    if (!existing) return false;

    this.entries.delete(input.id);
    this.recordAudit({
      memoryId: input.id,
      action: "delete",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeMemoryEntry(existing),
      scope: existing.scope,
      title: existing.title,
      sourceThreadId: existing.sourceThreadId,
      sourceRunId: existing.sourceRunId,
      createdAt: input.createdAt.trim(),
    });
    this.save();

    return true;
  }

  recordAudit(input: MemoryAuditInput): MemoryAuditRecord {
    const record: MemoryAuditRecord = {
      id: createMemoryAuditId(),
      memoryId: input.memoryId,
      action: input.action,
      actor: input.actor,
      reason: input.reason.trim(),
      summary: input.summary.trim(),
      scope: input.scope,
      title: input.title.trim(),
      sourceThreadId: input.sourceThreadId,
      sourceRunId: input.sourceRunId,
      createdAt: input.createdAt.trim(),
    };

    this.auditTrail.set(record.id, record);
    return record;
  }

  private loadSnapshot(initialSnapshot: MemorySnapshot): void {
    const persisted = readPersistedSnapshot(this.storagePath);
    const snapshot = persisted ?? initialSnapshot;

    for (const entry of snapshot.entries) {
      this.entries.set(entry.id, entry);
    }

    for (const audit of snapshot.auditTrail) {
      this.auditTrail.set(audit.id, audit);
    }
  }

  private save(): void {
    persistSnapshot(this.storagePath, this.getSnapshot());
  }
}

function normalizeTags(tags: readonly string[]): readonly string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  );
}

function summarizeMemoryEntry(entry: MemoryEntry): string {
  return `${entry.scope}: ${entry.title}`;
}

function createMemoryId(): string {
  return `memory-${randomUUID()}`;
}

function createMemoryAuditId(): string {
  return `memory-audit-${randomUUID()}`;
}

function compareIsoDateTime(left: string, right: string): number {
  return left.localeCompare(right);
}

function resolveDefaultStoragePath(): string {
  const workspaceRoot = normalizeWorkspaceRoot(
    process.env.SAGE_WORKSPACE_ROOT ??
      process.env.INIT_CWD ??
      process.cwd(),
  );

  return path.resolve(workspaceRoot, ".sage", "memory-registry.json");
}

function normalizeWorkspaceRoot(value: string): string {
  return path.resolve(value);
}

function readPersistedSnapshot(storagePath: string): MemorySnapshot | null {
  if (!existsSync(storagePath)) return null;

  // 读取异常（如权限错误）直接抛出，让调用方感知，而不是当作“无数据”静默吞掉；
  // 仅当文件存在但内容损坏（JSON 解析或 schema 不符）时，先备份坏文件再视为无数据，
  // 避免下一次 save() 用空快照覆盖原本可人工恢复的记忆。
  const raw = readFileSync(storagePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupInvalidSnapshot(storagePath);
    return null;
  }

  if (!isMemorySnapshot(parsed)) {
    backupInvalidSnapshot(storagePath);
    return null;
  }

  return parsed;
}

function backupInvalidSnapshot(storagePath: string): void {
  if (!existsSync(storagePath)) return;

  const backupPath = `${storagePath}.invalid-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  renameSync(storagePath, backupPath);
}

function persistSnapshot(storagePath: string, snapshot: MemorySnapshot): void {
  const directory = path.dirname(storagePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(storagePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function isMemorySnapshot(value: unknown): value is MemorySnapshot {
  return isMemorySnapshotRecord(value) &&
    Array.isArray(value.entries) &&
    Array.isArray(value.auditTrail);
}

function isMemorySnapshotRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
