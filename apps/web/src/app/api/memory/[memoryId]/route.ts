import { NextResponse } from "next/server";
import { getMemoryRegistry } from "@/lib/memory-registry";
import { normalizeUpdateMemoryRequest } from "@/lib/memory-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    memoryId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { memoryId } = await context.params;
  const registry = getMemoryRegistry();
  if (!registry.getEntry(memoryId)) {
    return jsonError("memory_not_found", "Memory entry was not found.", 404);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const input = normalizeUpdateMemoryRequest(body.value);
  if (!input.ok) {
    return jsonError(input.code, input.message, input.status);
  }

  const entry = registry.upsertEntry({
    id: memoryId,
    scope: input.scope,
    title: input.title,
    content: input.content,
    tags: input.tags,
    sourceThreadId: input.sourceThreadId,
    sourceRunId: input.sourceRunId,
    // actor 由服务端固定为 user，禁止客户端经 HTTP 入口伪造 agent 身份污染审计轨迹。
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

export async function DELETE(request: Request, context: RouteContext) {
  const { memoryId } = await context.params;
  const registry = getMemoryRegistry();
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
      : "memory deleted";

  const deleted = registry.deleteEntry({
    id: memoryId,
    // 删除 actor 同样固定为 user，禁止客户端伪造 agent 身份。
    actor: "user",
    reason: reason.length > 0 ? reason : "memory deleted",
    createdAt: new Date().toISOString(),
  });

  if (!deleted) {
    return jsonError("memory_not_found", "Memory entry was not found.", 404);
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

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
