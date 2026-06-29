import { NextResponse } from "next/server";
import { getMemoryRegistry } from "@/lib/memory-registry";
import { normalizeCreateMemoryRequest } from "@/lib/memory-api";

export const runtime = "nodejs";

export async function GET() {
  const registry = getMemoryRegistry();
  return NextResponse.json(
    {
      snapshot: registry.getSnapshot(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const input = normalizeCreateMemoryRequest(body.value);
  if (!input.ok) {
    return jsonError(input.code, input.message, input.status);
  }

  const registry = getMemoryRegistry();
  const entry = registry.upsertEntry({
    id: input.id,
    scope: input.scope,
    title: input.title,
    content: input.content,
    tags: input.tags,
    sourceThreadId: input.sourceThreadId,
    sourceRunId: input.sourceRunId,
    // actor 由服务端固定为 user，禁止客户端经 HTTP 入口伪造 agent 身份污染审计轨迹；
    // agent 写入记忆走 runtime 内部路径，不经此路由。与 skills 路由保持一致。
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
      status: 201,
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
