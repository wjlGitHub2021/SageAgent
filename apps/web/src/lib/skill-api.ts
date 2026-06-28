import {
  SKILL_SOURCES,
  SKILL_STATUSES,
  type SkillActor,
  type SkillSource,
  type SkillStatus,
} from "@sage/shared";

export type CreateSkillRequest = {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly description?: unknown;
  readonly instruction?: unknown;
  readonly tags?: unknown;
  readonly source?: unknown;
  readonly status?: unknown;
  readonly createdBy?: unknown;
  readonly reason?: unknown;
};

export type UpdateSkillRequest = CreateSkillRequest;

export type SkillInputResult =
  | {
      ok: true;
      id: string | undefined;
      name: string;
      description: string;
      instruction: string;
      tags: readonly string[];
      source: SkillSource;
      status: SkillStatus;
      createdBy: SkillActor;
      reason: string;
    }
  | { ok: false; code: string; message: string; status: 400 };

export function normalizeCreateSkillRequest(value: unknown): SkillInputResult {
  return normalizeSkillRequest(value);
}

export function normalizeUpdateSkillRequest(value: unknown): SkillInputResult {
  return normalizeSkillRequest(value);
}

export function parseCommaSeparatedList(value: string): readonly string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeSkillRequest(value: unknown): SkillInputResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Request body must be an object.",
      status: 400,
    };
  }

  const name = readString(value.name);
  if (!name.ok) return name;

  const description = readString(value.description);
  if (!description.ok) return description;

  const instruction = readString(value.instruction);
  if (!instruction.ok) return instruction;

  const tags = normalizeTags(value.tags);
  if (!tags.ok) return tags;

  const source = normalizeSource(value.source);
  if (!source.ok) return source;

  const status = normalizeStatus(value.status);
  if (!status.ok) return status;

  const createdBy = normalizeActor(value.createdBy);
  if (!createdBy.ok) return createdBy;

  const reason = readString(value.reason);
  if (!reason.ok) return reason;

  return {
    ok: true,
    id: normalizeOptionalString(value.id) ?? undefined,
    name: name.value,
    description: description.value,
    instruction: instruction.value,
    tags: tags.value,
    source: source.value,
    status: status.value,
    createdBy: createdBy.value,
    reason: reason.value,
  };
}

function normalizeTags(
  value: unknown,
):
  | { ok: true; value: readonly string[] }
  | { ok: false; code: string; message: string; status: 400 } {
  if (value === undefined || value === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false,
      code: "invalid_tags",
      message: "tags must be an array of strings.",
      status: 400,
    };
  }

  const tags: string[] = [];
  for (const tag of value) {
    if (typeof tag !== "string") {
      return {
        ok: false,
        code: "invalid_tags",
        message: "tags must be an array of strings.",
        status: 400,
      };
    }
    const normalized = tag.trim();
    if (normalized.length > 0) tags.push(normalized);
  }

  return { ok: true, value: [...new Set(tags)] };
}

function normalizeSource(
  value: unknown,
):
  | { ok: true; value: SkillSource }
  | { ok: false; code: string; message: string; status: 400 } {
  if (value === undefined || value === null) return { ok: true, value: "user" };
  if (typeof value !== "string" || !SKILL_SOURCES.includes(value as SkillSource)) {
    return {
      ok: false,
      code: "invalid_source",
      message: "source must be a valid skill source.",
      status: 400,
    };
  }

  return { ok: true, value: value as SkillSource };
}

function normalizeStatus(
  value: unknown,
):
  | { ok: true; value: SkillStatus }
  | { ok: false; code: string; message: string; status: 400 } {
  if (value === undefined || value === null) return { ok: true, value: "draft" };
  if (typeof value !== "string" || !SKILL_STATUSES.includes(value as SkillStatus)) {
    return {
      ok: false,
      code: "invalid_status",
      message: "status must be a valid skill status.",
      status: 400,
    };
  }

  return { ok: true, value: value as SkillStatus };
}

function normalizeActor(
  value: unknown,
): { ok: true; value: SkillActor } | { ok: false; code: string; message: string; status: 400 } {
  if (value === undefined || value === null) return { ok: true, value: "user" };
  if (
    typeof value !== "string" ||
    !["user", "supervisor", "researcher", "builder", "reviewer"].includes(value)
  ) {
    return {
      ok: false,
      code: "invalid_actor",
      message: "createdBy must be user or a valid agent role.",
      status: 400,
    };
  }

  return { ok: true, value: value as SkillActor };
}

function readString(
  value: unknown,
): { ok: true; value: string } | { ok: false; code: string; message: string; status: 400 } {
  if (typeof value !== "string") {
    return {
      ok: false,
      code: "invalid_string",
      message: "Field must be a string.",
      status: 400,
    };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "invalid_string",
      message: "Field must not be empty.",
      status: 400,
    };
  }

  return { ok: true, value: trimmed };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
