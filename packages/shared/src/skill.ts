import type { AgentRole, EntityId, ISODateTimeString } from "./index.js";

export const SKILL_SOURCES = ["user", "agent", "template"] as const;

export type SkillSource = (typeof SKILL_SOURCES)[number];

export const SKILL_STATUSES = ["draft", "curated", "disabled"] as const;

export type SkillStatus = (typeof SKILL_STATUSES)[number];

export const SKILL_AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "enable",
  "disable",
] as const;

export type SkillAuditAction = (typeof SKILL_AUDIT_ACTIONS)[number];

export type SkillActor = AgentRole | "user";

export interface SkillEntry {
  readonly id: EntityId;
  readonly name: string;
  readonly description: string;
  readonly instruction: string;
  readonly tags: readonly string[];
  readonly source: SkillSource;
  readonly status: SkillStatus;
  readonly version: number;
  readonly createdBy: SkillActor;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}

export interface SkillAuditRecord {
  readonly id: EntityId;
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

export interface SkillSnapshot {
  readonly entries: readonly SkillEntry[];
  readonly auditTrail: readonly SkillAuditRecord[];
}

export function createEmptySkillSnapshot(): SkillSnapshot {
  return {
    entries: [],
    auditTrail: [],
  };
}

export interface UpsertSkillEntryInput {
  readonly id?: EntityId;
  readonly name: string;
  readonly description: string;
  readonly instruction: string;
  readonly tags?: readonly string[];
  readonly source: SkillSource;
  readonly status: SkillStatus;
  readonly createdBy: SkillActor;
  readonly reason: string;
  readonly createdAt: ISODateTimeString;
}

export interface DeleteSkillEntryInput {
  readonly id: EntityId;
  readonly actor: SkillActor;
  readonly reason: string;
  readonly createdAt: ISODateTimeString;
}

export interface SetSkillStatusInput {
  readonly id: EntityId;
  readonly status: Extract<SkillStatus, "curated" | "disabled">;
  readonly actor: SkillActor;
  readonly reason: string;
  readonly createdAt: ISODateTimeString;
}
