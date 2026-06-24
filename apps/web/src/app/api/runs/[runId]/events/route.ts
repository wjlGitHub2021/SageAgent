import { NextResponse } from "next/server";
import type { RunEvent } from "@sage/shared";
import { getRuntimeStore } from "@/lib/runtime-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    runId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const store = getRuntimeStore();
  const run = store.getRun(runId);

  if (!run) {
    return jsonError("run_not_found", "Run was not found.", 404);
  }

  const after = parseAfterSequence(new URL(request.url).searchParams);
  if (!after.ok) {
    return jsonError(after.code, after.message, 400);
  }

  const events = store.getEventsByRun(runId, after.value);

  return new Response(encodeRunEvents(events), {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}

function parseAfterSequence(
  searchParams: URLSearchParams,
):
  | { ok: true; value: number | undefined }
  | { ok: false; code: string; message: string } {
  const value = searchParams.get("after");
  if (value === null) return { ok: true, value: undefined };

  if (!/^\d+$/.test(value)) {
    return {
      ok: false,
      code: "invalid_after",
      message: "after must be a non-negative integer.",
    };
  }

  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence)) {
    return {
      ok: false,
      code: "invalid_after",
      message: "after must be a safe non-negative integer.",
    };
  }

  return { ok: true, value: sequence };
}

function encodeRunEvents(events: readonly RunEvent[]): string {
  return events.map(encodeRunEvent).join("");
}

function encodeRunEvent(event: RunEvent): string {
  return [
    `id: ${event.sequence}`,
    "event: run-event",
    `data: ${JSON.stringify(event)}`,
    "",
    "",
  ].join("\n");
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
