import { NextResponse } from "next/server";
import {
  AGENT_ROLES,
  type AgentRole,
  type Message,
  type Run,
} from "@sage/shared";
import { getRuntimeStore, getTelemetryLogger } from "@/lib/runtime-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    runId: string;
  }>;
};

type StreamOutputRequest = {
  chunks?: unknown;
  agent?: unknown;
};

type NormalizedStreamOutputRequest = {
  readonly chunks: readonly string[];
  readonly agent: AgentRole;
};

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const store = getRuntimeStore();
  const telemetry = getTelemetryLogger();
  const run = store.getRun(runId);

  if (!run) {
    telemetry.record({
      name: "api.runs.stream_output.rejected",
      level: "warn",
      source: "api",
      message: "Stream output request referenced a missing run.",
      runId,
      metadata: {
        code: "run_not_found",
        status: 404,
      },
    });
    return jsonError("run_not_found", "Run was not found.", 404);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    telemetry.record({
      name: "api.runs.stream_output.rejected",
      level: "warn",
      source: "api",
      message: "Stream output request body was invalid JSON.",
      runId,
      threadId: run.threadId,
      metadata: {
        code: "invalid_json",
        status: 400,
      },
    });
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const input = normalizeStreamOutputRequest(body.value);
  if (!input.ok) {
    telemetry.record({
      name: "api.runs.stream_output.rejected",
      level: "warn",
      source: "api",
      message: "Stream output request failed validation.",
      runId,
      threadId: run.threadId,
      metadata: {
        code: input.code,
        status: 400,
      },
    });
    return jsonError(input.code, input.message, 400);
  }

  const now = new Date().toISOString();
  const messageId = createId("message");
  const events = createStreamOutputEvents({
    run,
    messageId,
    input: input.value,
    now,
    firstSequence: nextRunSequence(store, run.id),
  });

  for (const event of events) {
    store.appendEvent(event);
  }
  telemetry.record({
    name: "api.runs.stream_output.completed",
    source: "api",
    message: "Stream output events appended to the run.",
    runId: run.id,
    threadId: run.threadId,
    metadata: {
      agent: input.value.agent,
      chunkCount: input.value.chunks.length,
      eventCount: events.length,
    },
  });

  return NextResponse.json(
    {
      messageId,
      events,
      message: store
        .getMessagesByRun(run.id)
        .find((message) => message.id === messageId),
      snapshot: store.getSnapshot(),
    },
    { status: 201 },
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

function normalizeStreamOutputRequest(
  value: unknown,
):
  | { ok: true; value: NormalizedStreamOutputRequest }
  | { ok: false; code: string; message: string } {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Request body must be an object.",
    };
  }

  const request = value as StreamOutputRequest;
  const chunks = normalizeChunks(request.chunks);
  if (!chunks.ok) return chunks;

  const agent = normalizeAgent(request.agent);
  if (!agent.ok) return agent;

  return {
    ok: true,
    value: {
      chunks: chunks.value,
      agent: agent.value,
    },
  };
}

function normalizeChunks(
  value: unknown,
):
  | { ok: true; value: readonly string[] }
  | { ok: false; code: string; message: string } {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      code: "invalid_chunks",
      message: "chunks must be a non-empty string array.",
    };
  }

  if (value.length === 0) {
    return {
      ok: false,
      code: "invalid_chunks",
      message: "chunks must include at least one item.",
    };
  }

  const chunks: string[] = [];
  for (const chunk of value) {
    if (typeof chunk !== "string" || chunk.length === 0) {
      return {
        ok: false,
        code: "invalid_chunks",
        message: "Each chunk must be a non-empty string.",
      };
    }

    chunks.push(chunk);
  }

  return { ok: true, value: chunks };
}

function normalizeAgent(
  value: unknown,
):
  | { ok: true; value: AgentRole }
  | { ok: false; code: string; message: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: "supervisor" };
  }

  if (
    typeof value !== "string" ||
    !AGENT_ROLES.includes(value as AgentRole)
  ) {
    return {
      ok: false,
      code: "invalid_agent",
      message: "agent must be supervisor, researcher, builder, or reviewer.",
    };
  }

  return { ok: true, value: value as AgentRole };
}

function createStreamOutputEvents({
  run,
  messageId,
  input,
  now,
  firstSequence,
}: {
  run: Run;
  messageId: string;
  input: NormalizedStreamOutputRequest;
  now: string;
  firstSequence: number;
}) {
  const startedRun: Run = {
    ...run,
    status: "running",
    activeAgent: input.agent,
    updatedAt: now,
  };
  const completedRun: Run = {
    ...startedRun,
    status: "completed",
    activeAgent: null,
    updatedAt: now,
    completedAt: now,
  };
  const events = input.chunks.map((chunk, index) => ({
    id: createId("event"),
    runId: run.id,
    type: "message.delta" as const,
    sequence: firstSequence + 1 + index,
    createdAt: now,
    payload: {
      messageId,
      role: "agent" as const,
      agent: input.agent,
      delta: chunk,
    },
  }));
  const message: Message = {
    id: messageId,
    threadId: run.threadId,
    runId: run.id,
    role: "agent",
    agent: input.agent,
    content: input.chunks.join(""),
    createdAt: now,
  };

  return [
    {
      id: createId("event"),
      runId: run.id,
      type: "run.status_changed" as const,
      sequence: firstSequence,
      createdAt: now,
      payload: {
        previousStatus: run.status,
        status: startedRun.status,
        activeAgent: startedRun.activeAgent,
      },
    },
    ...events,
    {
      id: createId("event"),
      runId: run.id,
      type: "message.completed" as const,
      sequence: firstSequence + input.chunks.length + 1,
      createdAt: now,
      payload: {
        message,
      },
    },
    {
      id: createId("event"),
      runId: run.id,
      type: "run.completed" as const,
      sequence: firstSequence + input.chunks.length + 2,
      createdAt: now,
      payload: {
        run: completedRun,
      },
    },
  ];
}

function nextRunSequence(
  store: ReturnType<typeof getRuntimeStore>,
  runId: string,
): number {
  const events = store.getEventsByRun(runId);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
