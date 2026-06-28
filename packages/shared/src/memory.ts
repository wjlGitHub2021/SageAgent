import type { AgentRole, EntityId, ISODateTimeString } from "./index.js";

export const MEMORY_SCOPES = [
  "workspace",
  "thread",
  "run",
  "preference",
  "constraint",
  "insight",
] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
] as const;

export type MemoryAuditAction = (typeof MEMORY_AUDIT_ACTIONS)[number];

export type MemoryActor = AgentRole | "user";

export interface MemoryEntry {
  readonly id: EntityId;
  readonly scope: MemoryScope;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly sourceThreadId: EntityId | null;
  readonly sourceRunId: EntityId | null;
  readonly createdBy: MemoryActor;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}

export interface MemoryAuditRecord {
  readonly id: EntityId;
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

export interface MemorySnapshot {
  readonly entries: readonly MemoryEntry[];
  readonly auditTrail: readonly MemoryAuditRecord[];
}

export function createEmptyMemorySnapshot(): MemorySnapshot {
  return {
    entries: [],
    auditTrail: [],
  };
}

export interface UpsertMemoryEntryInput {
  readonly id?: EntityId;
  readonly scope: MemoryScope;
  readonly title: string;
  readonly content: string;
  readonly tags?: readonly string[];
  readonly sourceThreadId?: EntityId | null;
  readonly sourceRunId?: EntityId | null;
  readonly createdBy: MemoryActor;
  readonly reason: string;
  readonly createdAt: ISODateTimeString;
}

export interface DeleteMemoryEntryInput {
  readonly id: EntityId;
  readonly actor: MemoryActor;
  readonly reason: string;
  readonly createdAt: ISODateTimeString;
}
