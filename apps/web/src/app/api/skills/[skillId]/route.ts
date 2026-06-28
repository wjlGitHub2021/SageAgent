import { NextResponse } from "next/server";
import { SKILL_STATUSES, type SkillStatus } from "@sage/shared";
import { normalizeUpdateSkillRequest } from "@/lib/skill-api";
import { getSkillRegistry } from "@/lib/skill-registry";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    skillId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { skillId } = await context.params;
  const registry = getSkillRegistry();
  if (!registry.getEntry(skillId)) {
    return jsonError("skill_not_found", "Skill entry was not found.", 404);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const input = normalizeUpdateSkillRequest(body.value);
  if (!input.ok) {
    return jsonError(input.code, input.message, input.status);
  }

  const entry = registry.upsertEntry({
    id: skillId,
    name: input.name,
    description: input.description,
    instruction: input.instruction,
    tags: input.tags,
    source: input.source,
    status: "draft",
    createdBy: "user",
    reason: input.reason,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      entry,
      snapshot: registry.getSnapshot(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { skillId } = await context.params;
  const registry = getSkillRegistry();
  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const statusInput = normalizeStatusPatch(body.value);
  if (!statusInput.ok) {
    return jsonError(statusInput.code, statusInput.message, statusInput.status);
  }

  const entry = registry.setStatus({
    id: skillId,
    status: statusInput.value.status,
    actor: "user",
    reason: statusInput.value.reason,
    createdAt: new Date().toISOString(),
  });

  if (!entry) {
    return jsonError("skill_not_found", "Skill entry was not found.", 404);
  }

  return NextResponse.json(
    {
      entry,
      snapshot: registry.getSnapshot(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { skillId } = await context.params;
  const registry = getSkillRegistry();
  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const bodyRecord =
    typeof body.value === "object" && body.value !== null
      ? (body.value as Record<string, unknown>)
      : null;
  const reason =
    bodyRecord && typeof bodyRecord.reason === "string"
      ? bodyRecord.reason.trim()
      : "skill deleted";
  const deleted = registry.deleteEntry({
    id: skillId,
    actor: "user",
    reason: reason.length > 0 ? reason : "skill deleted",
    createdAt: new Date().toISOString(),
  });

  if (!deleted) {
    return jsonError("skill_not_found", "Skill entry was not found.", 404);
  }

  return NextResponse.json(
    {
      deleted: true,
      snapshot: registry.getSnapshot(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}

function normalizeStatusPatch(
  value: unknown,
):
  | {
      ok: true;
      value: {
        status: Extract<SkillStatus, "curated" | "disabled">;
        reason: string;
      };
    }
  | { ok: false; code: string; message: string; status: 400 } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Request body must be an object.",
      status: 400,
    };
  }

  const record = value as Record<string, unknown>;
  const status = record.status;
  if (
    typeof status !== "string" ||
    !SKILL_STATUSES.includes(status as SkillStatus) ||
    status === "draft"
  ) {
    return {
      ok: false,
      code: "invalid_status",
      message: "status must be curated or disabled.",
      status: 400,
    };
  }

  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (reason.length === 0) {
    return {
      ok: false,
      code: "invalid_reason",
      message: "reason must not be empty.",
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      status: status as Extract<SkillStatus, "curated" | "disabled">,
      reason,
    },
  };
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
