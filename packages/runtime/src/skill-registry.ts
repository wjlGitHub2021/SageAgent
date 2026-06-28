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
  DeleteSkillEntryInput,
  EntityId,
  ISODateTimeString,
  SetSkillStatusInput,
  SkillActor,
  SkillAuditAction,
  SkillAuditRecord,
  SkillEntry,
  SkillSnapshot,
  SkillStatus,
  UpsertSkillEntryInput,
} from "@sage/shared";
import { createEmptySkillSnapshot } from "@sage/shared";

export interface SkillRegistry {
  getSnapshot(): SkillSnapshot;
  listEntries(status?: SkillStatus): readonly SkillEntry[];
  getEntry(skillId: EntityId): SkillEntry | undefined;
  upsertEntry(input: UpsertSkillEntryInput): SkillEntry;
  setStatus(input: SetSkillStatusInput): SkillEntry | undefined;
  deleteEntry(input: DeleteSkillEntryInput): boolean;
  recordAudit(input: SkillAuditInput): SkillAuditRecord;
}

export interface SkillAuditInput {
  readonly skillId: EntityId;
  readonly action: SkillAuditAction;
  readonly actor: SkillActor;
  readonly reason: string;
  readonly summary: string;
  readonly name: string;
  readonly status: SkillStatus;
  readonly version: number;
  readonly createdAt: ISODateTimeString;
}

export function createSkillRegistry(
  initialSnapshot: SkillSnapshot = createEmptySkillSnapshot(),
): SkillRegistry {
  return new LocalSkillRegistry(initialSnapshot);
}

export interface CreatePersistentSkillRegistryInput {
  readonly initialSnapshot?: SkillSnapshot;
  readonly storagePath?: string;
}

export function createPersistentSkillRegistry(
  input: CreatePersistentSkillRegistryInput = {},
): SkillRegistry {
  return new PersistentSkillRegistry({
    initialSnapshot: input.initialSnapshot ?? createEmptySkillSnapshot(),
    storagePath: input.storagePath ?? resolveDefaultStoragePath(),
  });
}

class LocalSkillRegistry implements SkillRegistry {
  private readonly entries = new Map<EntityId, SkillEntry>();
  private readonly auditTrail = new Map<EntityId, SkillAuditRecord>();

  constructor(initialSnapshot: SkillSnapshot) {
    for (const entry of initialSnapshot.entries) {
      this.entries.set(entry.id, entry);
    }

    for (const audit of initialSnapshot.auditTrail) {
      this.auditTrail.set(audit.id, audit);
    }
  }

  getSnapshot(): SkillSnapshot {
    return createSnapshot(this.entries, this.auditTrail);
  }

  listEntries(status?: SkillStatus): readonly SkillEntry[] {
    const entries = [...this.entries.values()];
    return status ? entries.filter((entry) => entry.status === status) : entries;
  }

  getEntry(skillId: EntityId): SkillEntry | undefined {
    return this.entries.get(skillId);
  }

  upsertEntry(input: UpsertSkillEntryInput): SkillEntry {
    const previous = this.entries.get(input.id ?? "");
    const entry = upsertEntryInMap(this.entries, input);
    this.recordAudit({
      skillId: entry.id,
      action: previous ? "update" : "create",
      actor: input.createdBy,
      reason: input.reason,
      summary: summarizeSkillEntry(entry),
      name: entry.name,
      status: entry.status,
      version: entry.version,
      createdAt: input.createdAt.trim(),
    });
    return entry;
  }

  setStatus(input: SetSkillStatusInput): SkillEntry | undefined {
    const entry = setStatusInMap(this.entries, input);
    if (!entry) return undefined;

    this.recordAudit({
      skillId: entry.id,
      action: input.status === "curated" ? "enable" : "disable",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeSkillEntry(entry),
      name: entry.name,
      status: entry.status,
      version: entry.version,
      createdAt: input.createdAt.trim(),
    });
    return entry;
  }

  deleteEntry(input: DeleteSkillEntryInput): boolean {
    const existing = this.entries.get(input.id);
    if (!existing) return false;

    this.entries.delete(input.id);
    this.recordAudit({
      skillId: input.id,
      action: "delete",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeSkillEntry(existing),
      name: existing.name,
      status: existing.status,
      version: existing.version,
      createdAt: input.createdAt.trim(),
    });

    return true;
  }

  recordAudit(input: SkillAuditInput): SkillAuditRecord {
    const record = createAuditRecord(input);
    this.auditTrail.set(record.id, record);
    return record;
  }
}

class PersistentSkillRegistry implements SkillRegistry {
  private readonly storagePath: string;
  private readonly entries = new Map<EntityId, SkillEntry>();
  private readonly auditTrail = new Map<EntityId, SkillAuditRecord>();

  constructor(input: { readonly initialSnapshot: SkillSnapshot; readonly storagePath: string }) {
    this.storagePath = input.storagePath;
    this.loadSnapshot(input.initialSnapshot);
  }

  getSnapshot(): SkillSnapshot {
    return createSnapshot(this.entries, this.auditTrail);
  }

  listEntries(status?: SkillStatus): readonly SkillEntry[] {
    const entries = [...this.entries.values()];
    return status ? entries.filter((entry) => entry.status === status) : entries;
  }

  getEntry(skillId: EntityId): SkillEntry | undefined {
    return this.entries.get(skillId);
  }

  upsertEntry(input: UpsertSkillEntryInput): SkillEntry {
    const previous = this.entries.get(input.id ?? "");
    const entry = upsertEntryInMap(this.entries, input);
    this.recordAudit({
      skillId: entry.id,
      action: previous ? "update" : "create",
      actor: input.createdBy,
      reason: input.reason,
      summary: summarizeSkillEntry(entry),
      name: entry.name,
      status: entry.status,
      version: entry.version,
      createdAt: input.createdAt.trim(),
    });
    this.save();
    return entry;
  }

  setStatus(input: SetSkillStatusInput): SkillEntry | undefined {
    const entry = setStatusInMap(this.entries, input);
    if (!entry) return undefined;

    this.recordAudit({
      skillId: entry.id,
      action: input.status === "curated" ? "enable" : "disable",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeSkillEntry(entry),
      name: entry.name,
      status: entry.status,
      version: entry.version,
      createdAt: input.createdAt.trim(),
    });
    this.save();
    return entry;
  }

  deleteEntry(input: DeleteSkillEntryInput): boolean {
    const existing = this.entries.get(input.id);
    if (!existing) return false;

    this.entries.delete(input.id);
    this.recordAudit({
      skillId: input.id,
      action: "delete",
      actor: input.actor,
      reason: input.reason,
      summary: summarizeSkillEntry(existing),
      name: existing.name,
      status: existing.status,
      version: existing.version,
      createdAt: input.createdAt.trim(),
    });
    this.save();

    return true;
  }

  recordAudit(input: SkillAuditInput): SkillAuditRecord {
    const record = createAuditRecord(input);
    this.auditTrail.set(record.id, record);
    return record;
  }

  private loadSnapshot(initialSnapshot: SkillSnapshot): void {
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

function createSnapshot(
  entries: ReadonlyMap<EntityId, SkillEntry>,
  auditTrail: ReadonlyMap<EntityId, SkillAuditRecord>,
): SkillSnapshot {
  return {
    entries: [...entries.values()].sort((left, right) =>
      compareIsoDateTime(left.updatedAt, right.updatedAt) ||
      left.name.localeCompare(right.name),
    ),
    auditTrail: [...auditTrail.values()].sort((left, right) =>
      compareIsoDateTime(left.createdAt, right.createdAt) ||
      left.id.localeCompare(right.id),
    ),
  };
}

function upsertEntryInMap(
  entries: Map<EntityId, SkillEntry>,
  input: UpsertSkillEntryInput,
): SkillEntry {
  const now = input.createdAt.trim();
  const id = (input.id ?? createSkillId()).trim();
  const previous = entries.get(id);
  const entry: SkillEntry = {
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    instruction: input.instruction.trim(),
    tags: normalizeTags(input.tags ?? []),
    source: input.source,
    status: input.status,
    version: previous ? previous.version + 1 : 1,
    createdBy: input.createdBy,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };

  entries.set(id, entry);
  return entry;
}

function setStatusInMap(
  entries: Map<EntityId, SkillEntry>,
  input: SetSkillStatusInput,
): SkillEntry | undefined {
  const existing = entries.get(input.id);
  if (!existing) return undefined;

  const entry: SkillEntry = {
    ...existing,
    status: input.status,
    updatedAt: input.createdAt.trim(),
  };
  entries.set(input.id, entry);
  return entry;
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

function summarizeSkillEntry(entry: SkillEntry): string {
  return `${entry.status}: ${entry.name} v${entry.version}`;
}

function createAuditRecord(input: SkillAuditInput): SkillAuditRecord {
  return {
    id: createSkillAuditId(),
    skillId: input.skillId,
    action: input.action,
    actor: input.actor,
    reason: input.reason.trim(),
    summary: input.summary.trim(),
    name: input.name.trim(),
    status: input.status,
    version: input.version,
    createdAt: input.createdAt.trim(),
  };
}

function createSkillId(): string {
  return `skill-${randomUUID()}`;
}

function createSkillAuditId(): string {
  return `skill-audit-${randomUUID()}`;
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

  return path.resolve(workspaceRoot, ".sage", "skill-registry.json");
}

function normalizeWorkspaceRoot(value: string): string {
  return path.resolve(value);
}

function readPersistedSnapshot(storagePath: string): SkillSnapshot | null {
  if (!existsSync(storagePath)) return null;

  const raw = readFileSync(storagePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupInvalidSnapshot(storagePath);
    return null;
  }

  if (!isSkillSnapshot(parsed)) {
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

function persistSnapshot(storagePath: string, snapshot: SkillSnapshot): void {
  const directory = path.dirname(storagePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(storagePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

function isSkillSnapshot(value: unknown): value is SkillSnapshot {
  return isSkillSnapshotRecord(value) &&
    Array.isArray(value.entries) &&
    Array.isArray(value.auditTrail);
}

function isSkillSnapshotRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
