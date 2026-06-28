import { NextResponse } from "next/server";
import { normalizeCreateSkillRequest } from "@/lib/skill-api";
import { getSkillRegistry } from "@/lib/skill-registry";

export const runtime = "nodejs";

export async function GET() {
  const registry = getSkillRegistry();
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

  const input = normalizeCreateSkillRequest(body.value);
  if (!input.ok) {
    return jsonError(input.code, input.message, input.status);
  }

  const registry = getSkillRegistry();
  const entry = registry.upsertEntry({
    id: input.id,
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
