import {
  createDeepSeekChatCompletion,
  type DeepSeekAdapterIssue,
  type DeepSeekAdapterResult,
  type DeepSeekChatCompletionInput,
  type DeepSeekChatCompletionOutput,
  type DeepSeekProviderConfig,
} from "@sage/deepseek";
import type { RuntimeStore } from "@sage/runtime";
import type {
  EntityId,
  Message,
  Run,
  RunEvent,
  RunFailedEvent,
} from "@sage/shared";

const SUPERVISOR_SYSTEM_PROMPT = [
  "You are Sage Agent Supervisor.",
  "Respond concisely in the user's language.",
  "Phase 2.2 supports model-only responses.",
  "Do not claim that you read files, wrote files, ran shell commands, or used tools.",
  "If the user asks for an action that needs project file access or side effects, explain the limitation and provide a safe plan or draft.",
].join(" ");

type Clock = () => string;
type IdFactory = (prefix: string) => EntityId;

export type SupervisorProvider = (
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput,
) => Promise<DeepSeekAdapterResult<DeepSeekChatCompletionOutput>>;

export type SupervisorRunResult =
  | {
      readonly ok: true;
      readonly run: Run;
      readonly message: Message;
      readonly events: readonly RunEvent[];
    }
  | {
      readonly ok: false;
      readonly code: "run_not_found" | "provider_failed";
      readonly safeMessage: string;
      readonly run: Run | null;
      readonly events: readonly RunEvent[];
    };

export interface RunSupervisorDeepSeekInput {
  readonly store: RuntimeStore;
  readonly runId: EntityId;
  readonly config: DeepSeekProviderConfig;
  readonly provider?: SupervisorProvider;
  readonly now?: Clock;
  readonly createId?: IdFactory;
}

export interface AppendSupervisorFailureInput {
  readonly store: RuntimeStore;
  readonly runId: EntityId;
  readonly safeMessage: string;
  readonly now?: Clock;
  readonly createId?: IdFactory;
}

export async function runSupervisorDeepSeekOnce({
  store,
  runId,
  config,
  provider = createDeepSeekChatCompletion,
  now = defaultNow,
  createId = defaultCreateId,
}: RunSupervisorDeepSeekInput): Promise<SupervisorRunResult> {
  const run = store.getRun(runId);
  if (!run) {
    return missingRunResult();
  }

  const startedAt = now();
  const startEvent = createRunStartedEvent({
    run,
    createdAt: startedAt,
    sequence: nextRunSequence(store, run.id),
    createId,
  });
  store.appendEvent(startEvent);

  const result = await provider(config, {
    messages: createSupervisorMessages(run.goal),
    model: run.settings.model,
    thinkingEnabled: run.settings.thinkingEnabled,
    reasoningEffort: run.settings.reasoningEffort,
  });

  if (!result.ok) {
    return appendSupervisorFailure({
      store,
      runId: run.id,
      safeMessage: formatSafeProviderIssue(result.issue),
      now,
      createId,
      alreadyAppendedEvents: [startEvent],
    });
  }

  const content = readAssistantContent(result.value);
  if (content === null) {
    return appendSupervisorFailure({
      store,
      runId: run.id,
      safeMessage: formatSafeProviderIssue({
        code: "invalid_response",
        message: "DeepSeek response did not include assistant content.",
      }),
      now,
      createId,
      alreadyAppendedEvents: [startEvent],
    });
  }

  const completedAt = now();
  const messageId = createId("message");
  const message: Message = {
    id: messageId,
    threadId: run.threadId,
    runId: run.id,
    role: "agent",
    agent: "supervisor",
    content,
    createdAt: completedAt,
  };
  const completedRun: Run = {
    ...run,
    status: "completed",
    activeAgent: null,
    updatedAt: completedAt,
    completedAt,
  };
  const firstSequence = nextRunSequence(store, run.id);
  const events: RunEvent[] = [
    {
      id: createId("event"),
      runId: run.id,
      type: "message.delta",
      sequence: firstSequence,
      createdAt: completedAt,
      payload: {
        messageId,
        role: "agent",
        agent: "supervisor",
        delta: content,
      },
    },
    {
      id: createId("event"),
      runId: run.id,
      type: "message.completed",
      sequence: firstSequence + 1,
      createdAt: completedAt,
      payload: {
        message,
      },
    },
    {
      id: createId("event"),
      runId: run.id,
      type: "run.completed",
      sequence: firstSequence + 2,
      createdAt: completedAt,
      payload: {
        run: completedRun,
      },
    },
  ];

  for (const event of events) store.appendEvent(event);

  return {
    ok: true,
    run: completedRun,
    message,
    events: [startEvent, ...events],
  };
}

export function appendSupervisorFailureEvent({
  store,
  runId,
  safeMessage,
  now = defaultNow,
  createId = defaultCreateId,
}: AppendSupervisorFailureInput): SupervisorRunResult {
  const run = store.getRun(runId);
  if (!run) {
    return missingRunResult();
  }

  const startEvent =
    run.status === "running" && run.activeAgent === "supervisor"
      ? null
      : createRunStartedEvent({
          run,
          createdAt: now(),
          sequence: nextRunSequence(store, run.id),
          createId,
        });
  if (startEvent) store.appendEvent(startEvent);

  return appendSupervisorFailure({
    store,
    runId: run.id,
    safeMessage,
    now,
    createId,
    alreadyAppendedEvents: startEvent ? [startEvent] : [],
  });
}

function appendSupervisorFailure({
  store,
  runId,
  safeMessage,
  now,
  createId,
  alreadyAppendedEvents,
}: {
  readonly store: RuntimeStore;
  readonly runId: EntityId;
  readonly safeMessage: string;
  readonly now: Clock;
  readonly createId: IdFactory;
  readonly alreadyAppendedEvents: readonly RunEvent[];
}): SupervisorRunResult {
  const run = store.getRun(runId);
  if (!run) {
    return {
      ...missingRunResult(),
      events: alreadyAppendedEvents,
    };
  }

  const failedAt = now();
  const failedRun: Run = {
    ...run,
    status: "failed",
    activeAgent: "supervisor",
    updatedAt: failedAt,
    completedAt: failedAt,
  };
  const event: RunFailedEvent = {
    id: createId("event"),
    runId: run.id,
    type: "run.failed",
    sequence: nextRunSequence(store, run.id),
    createdAt: failedAt,
    payload: {
      run: failedRun,
      error: sanitizeSafeMessage(safeMessage),
    },
  };

  store.appendEvent(event);

  return {
    ok: false,
    code: "provider_failed",
    safeMessage: event.payload.error,
    run: failedRun,
    events: [...alreadyAppendedEvents, event],
  };
}

function createRunStartedEvent({
  run,
  createdAt,
  sequence,
  createId,
}: {
  readonly run: Run;
  readonly createdAt: string;
  readonly sequence: number;
  readonly createId: IdFactory;
}): Extract<RunEvent, { readonly type: "run.status_changed" }> {
  return {
    id: createId("event"),
    runId: run.id,
    type: "run.status_changed",
    sequence,
    createdAt,
    payload: {
      previousStatus: run.status,
      status: "running",
      activeAgent: "supervisor",
    },
  };
}

function createSupervisorMessages(
  goal: string,
): DeepSeekChatCompletionInput["messages"] {
  return [
    {
      role: "system",
      content: SUPERVISOR_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: goal,
    },
  ];
}

function readAssistantContent(
  output: DeepSeekChatCompletionOutput,
): string | null {
  const content = output.choices[0]?.message.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return null;
  }

  return content;
}

function formatSafeProviderIssue(issue: DeepSeekAdapterIssue): string {
  switch (issue.code) {
    case "missing_api_key":
      return "provider_error: missing_api_key. Set DEEPSEEK_API_KEY in .env and restart the dev server.";
    case "http_error":
      return `provider_error: http_error${issue.status ? `_${issue.status}` : ""}. DeepSeek returned an HTTP error.`;
    case "network_error":
      return "provider_error: network_error. DeepSeek could not be reached.";
    case "invalid_messages":
      return "provider_error: invalid_messages. The Supervisor prompt was rejected before request.";
    case "invalid_response":
      return "provider_error: invalid_response. DeepSeek returned an unusable response.";
    case "invalid_stream_line":
      return "provider_error: invalid_stream_line. DeepSeek returned an invalid stream line.";
  }
}

function sanitizeSafeMessage(message: string): string {
  const trimmed = message.trim() || "provider_error: unknown_error.";
  return trimmed
    .replace(
      /(Bearer\s+)[^\s]+|([A-Za-z0-9_-]*(?:api[-_]?key|authorization|token|secret|password)[A-Za-z0-9_-]*\s*[:=]\s*)[^\s,;]+/gi,
      (
        _match,
        bearerPrefix: string | undefined,
        keyPrefix: string | undefined,
      ) => `${bearerPrefix ?? keyPrefix ?? ""}[redacted]`,
    )
    .replace(/\bsk-[A-Za-z0-9][A-Za-z0-9_-]{6,}\b/g, "[redacted]");
}

function nextRunSequence(store: RuntimeStore, runId: EntityId): number {
  const events = store.getEventsByRun(runId);
  return (events.at(-1)?.sequence ?? 0) + 1;
}

function missingRunResult(): Extract<SupervisorRunResult, { ok: false }> {
  return {
    ok: false,
    code: "run_not_found",
    safeMessage: "Run was not found.",
    run: null,
    events: [],
  };
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultCreateId(prefix: string): EntityId {
  return `${prefix}-${crypto.randomUUID()}`;
}
