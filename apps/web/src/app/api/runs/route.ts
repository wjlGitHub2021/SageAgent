import { NextResponse } from "next/server";
import {
  DEEPSEEK_MODELS,
  REASONING_EFFORTS,
  type ProviderSettings,
  type Run,
  type RunCreatedEvent,
  type Thread,
} from "@sage/shared";
import { getRuntimeStore, getTelemetryLogger } from "@/lib/runtime-store";

export const runtime = "nodejs";

type CreateRunRequest = {
  goal?: unknown;
  threadId?: unknown;
  threadTitle?: unknown;
  title?: unknown;
  settings?: unknown;
};

const DEFAULT_SETTINGS: ProviderSettings = {
  providerId: "deepseek",
  model: "deepseek-v4-flash",
  thinkingEnabled: true,
  reasoningEffort: "high",
};

export async function POST(request: Request) {
  const telemetry = getTelemetryLogger();
  const body = await readJsonBody(request);
  if (!body.ok) {
    telemetry.record({
      name: "api.runs.create.rejected",
      level: "warn",
      source: "api",
      message: "Create run request rejected before normalization.",
      metadata: {
        code: "invalid_json",
      },
    });
    return jsonError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const input = normalizeCreateRunRequest(body.value);
  if (!input.ok) {
    telemetry.record({
      name: "api.runs.create.rejected",
      level: "warn",
      source: "api",
      message: "Create run request failed validation.",
      metadata: {
        code: input.code,
        status: input.status,
      },
    });
    return jsonError(input.code, input.message, input.status);
  }

  const store = getRuntimeStore();
  const now = new Date().toISOString();
  const thread =
    input.threadId === null
      ? createThread(input.threadTitle ?? input.title, now)
      : store.getThread(input.threadId);

  if (!thread) {
    telemetry.record({
      name: "api.runs.create.rejected",
      level: "warn",
      source: "api",
      message: "Create run request referenced a missing thread.",
      metadata: {
        code: "thread_not_found",
        status: 404,
      },
    });
    return jsonError("thread_not_found", "Thread was not found.", 404);
  }

  if (input.threadId === null) {
    store.upsertThread(thread);
  }

  const run = createRun({
    thread,
    title: input.title,
    goal: input.goal,
    settings: input.settings,
    createdAt: now,
  });
  const event = createRunCreatedEvent(run, nextRunSequence(store, run.id), now);

  store.appendEvent(event);
  telemetry.record({
    name: "api.runs.create.completed",
    source: "api",
    message: "Run created and initial event appended.",
    runId: run.id,
    threadId: thread.id,
    metadata: {
      eventType: event.type,
      runStatus: run.status,
      providerId: run.settings.providerId ?? "deepseek",
      model: run.settings.model,
      reasoningEffort: run.settings.reasoningEffort,
      thinkingEnabled: run.settings.thinkingEnabled,
      createdThread: input.threadId === null,
    },
  });

  return NextResponse.json(
    {
      thread,
      run,
      events: [event],
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

function normalizeCreateRunRequest(
  value: unknown,
):
  | {
      ok: true;
      goal: string;
      threadId: string | null;
      threadTitle: string | null;
      title: string;
      settings: ProviderSettings;
    }
  | { ok: false; code: string; message: string; status: 400 } {
  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid_body",
      message: "Request body must be an object.",
      status: 400,
    };
  }

  const request = value as CreateRunRequest;
  const goal = readOptionalString(request.goal)?.trim() ?? "";
  if (goal.length === 0) {
    return {
      ok: false,
      code: "goal_required",
      message: "Goal is required.",
      status: 400,
    };
  }

  const threadId = readOptionalStringField(request, "threadId");
  if (!threadId.ok) return threadId;
  if (threadId.value === null && hasOwnField(request, "threadId")) {
    return {
      ok: false,
      code: "invalid_thread_id",
      message: "threadId must be a non-empty string when provided.",
      status: 400,
    };
  }

  const threadTitle = readOptionalStringField(request, "threadTitle");
  if (!threadTitle.ok) return threadTitle;

  const title = readOptionalStringField(request, "title");
  if (!title.ok) return title;

  const settings = normalizeSettings(request.settings);
  if (!settings.ok) return settings;

  return {
    ok: true,
    goal,
    threadId: threadId.value,
    threadTitle: threadTitle.value,
    title: title.value ?? deriveTitle(goal),
    settings: settings.value,
  };
}

function normalizeSettings(
  value: unknown,
):
  | { ok: true; value: ProviderSettings }
  | { ok: false; code: string; message: string; status: 400 } {
  if (value === undefined) return { ok: true, value: DEFAULT_SETTINGS };

  if (!isRecord(value)) {
    return {
      ok: false,
      code: "invalid_settings",
      message: "Settings must be an object.",
      status: 400,
    };
  }

  const model = value.model ?? DEFAULT_SETTINGS.model;
  const reasoningEffort =
    value.reasoningEffort ?? DEFAULT_SETTINGS.reasoningEffort;
  const thinkingEnabled =
    value.thinkingEnabled ?? DEFAULT_SETTINGS.thinkingEnabled;
  const providerId = value.providerId ?? DEFAULT_SETTINGS.providerId;

  if (providerId !== "deepseek") {
    return {
      ok: false,
      code: "invalid_provider",
      message: "providerId must be deepseek.",
      status: 400,
    };
  }

  if (!isDeepSeekModel(model)) {
    return {
      ok: false,
      code: "invalid_model",
      message: "Model must be deepseek-v4-flash or deepseek-v4-pro.",
      status: 400,
    };
  }

  if (!isReasoningEffort(reasoningEffort)) {
    return {
      ok: false,
      code: "invalid_reasoning_effort",
      message: "Reasoning effort must be high or max.",
      status: 400,
    };
  }

  if (typeof thinkingEnabled !== "boolean") {
    return {
      ok: false,
      code: "invalid_thinking_enabled",
      message: "thinkingEnabled must be a boolean.",
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      providerId,
      model,
      thinkingEnabled,
      reasoningEffort,
    },
  };
}

function createThread(title: string, createdAt: string): Thread {
  return {
    id: createId("thread"),
    title,
    createdAt,
    updatedAt: createdAt,
  };
}

function createRun({
  thread,
  title,
  goal,
  settings,
  createdAt,
}: {
  thread: Thread;
  title: string;
  goal: string;
  settings: ProviderSettings;
  createdAt: string;
}): Run {
  return {
    id: createId("run"),
    threadId: thread.id,
    title,
    goal,
    status: "queued",
    activeAgent: null,
    settings,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
  };
}

function createRunCreatedEvent(
  run: Run,
  sequence: number,
  createdAt: string,
): RunCreatedEvent {
  return {
    id: createId("event"),
    runId: run.id,
    type: "run.created",
    sequence,
    createdAt,
    payload: { run },
  };
}

function nextRunSequence(
  store: ReturnType<typeof getRuntimeStore>,
  runId: string,
): number {
  const events = store.getEventsByRun(runId);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

function deriveTitle(goal: string): string {
  return goal.length <= 80 ? goal : `${goal.slice(0, 77)}...`;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readOptionalStringField(
  value: Record<string, unknown>,
  key: "threadId" | "threadTitle" | "title",
):
  | { ok: true; value: string | null }
  | { ok: false; code: string; message: string; status: 400 } {
  const fieldValue = value[key];
  if (fieldValue === undefined || fieldValue === null) {
    return { ok: true, value: null };
  }

  if (typeof fieldValue !== "string") {
    return {
      ok: false,
      code: invalidStringFieldCode(key),
      message: `${key} must be a string.`,
      status: 400,
    };
  }

  return { ok: true, value: fieldValue.trim() || null };
}

function invalidStringFieldCode(
  key: "threadId" | "threadTitle" | "title",
): string {
  if (key === "threadId") return "invalid_thread_id";
  if (key === "threadTitle") return "invalid_thread_title";
  return "invalid_title";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnField(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isDeepSeekModel(value: unknown): value is ProviderSettings["model"] {
  return (
    typeof value === "string" &&
    DEEPSEEK_MODELS.includes(value as ProviderSettings["model"])
  );
}

function isReasoningEffort(
  value: unknown,
): value is ProviderSettings["reasoningEffort"] {
  return (
    typeof value === "string" &&
    REASONING_EFFORTS.includes(value as ProviderSettings["reasoningEffort"])
  );
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
