import { MEMORY_SCOPES, type MemoryActor, type MemoryScope } from "@sage/shared";

export type CreateMemoryRequest = {
  readonly id?: unknown;
  readonly scope?: unknown;
  readonly title?: unknown;
  readonly content?: unknown;
  readonly tags?: unknown;
  readonly sourceThreadId?: unknown;
  readonly sourceRunId?: unknown;
  readonly createdBy?: unknown;
  readonly reason?: unknown;
};

export type UpdateMemoryRequest = CreateMemoryRequest;

export type MemoryInputResult =
  | {
      ok: true;
      id: string | undefined;
      scope: MemoryScope;
      title: string;
      content: string;
      tags: readonly string[];
      sourceThreadId: string | null;
      sourceRunId: string | null;
      createdBy: MemoryActor;
      reason: string;
    }
  | { ok: false; code: string; message: string; status: 400 };

export function normalizeCreateMemoryRequest(value: unknown): MemoryInputResult {
  return normalizeMemoryRequest(value);
}

export function normalizeUpdateMemoryRequest(value: unknown): MemoryInputResult {
  return normalizeMemoryRequest(value);
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

function normalizeMemoryRequest(value: unknown): MemoryInputResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Request body must be an object.",
      status: 400,
    };
  }

  const scope = readString(value.scope);
  if (!scope.ok) return scope;
  if (!MEMORY_SCOPES.includes(scope.value as MemoryScope)) {
    return {
      ok: false,
      code: "invalid_scope",
      message: "scope must be a valid memory scope.",
      status: 400,
    };
  }

  const title = readString(value.title);
  if (!title.ok) return title;

  const content = readString(value.content);
  if (!content.ok) return content;

  const tags = normalizeTags(value.tags);
  if (!tags.ok) return tags;

  const createdBy = normalizeActor(value.createdBy);
  if (!createdBy.ok) return createdBy;

  const reason = readString(value.reason);
  if (!reason.ok) return reason;

  return {
    ok: true,
    id: normalizeOptionalString(value.id) ?? undefined,
    scope: scope.value as MemoryScope,
    title: title.value,
    content: content.value,
    tags: tags.value,
    sourceThreadId: normalizeOptionalString(value.sourceThreadId),
    sourceRunId: normalizeOptionalString(value.sourceRunId),
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

function normalizeActor(
  value: unknown,
): { ok: true; value: MemoryActor } | { ok: false; code: string; message: string; status: 400 } {
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

  return { ok: true, value: value as MemoryActor };
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
