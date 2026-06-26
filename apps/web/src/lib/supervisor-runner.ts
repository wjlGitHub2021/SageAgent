import {
  createDeepSeekChatCompletion,
  streamDeepSeekChatCompletion,
  type DeepSeekAdapterIssue,
  type DeepSeekAdapterResult,
  type DeepSeekChatCompletionInput,
  type DeepSeekChatCompletionOutput,
  type DeepSeekProviderConfig,
  type DeepSeekStreamParseEvent,
} from "@sage/deepseek";
import {
  DEFAULT_READ_PROJECT_FILE_MAX_BYTES,
  readProjectFileTool,
  type ReadProjectFileResult,
  type ReadProjectFileToolInput,
  type RuntimeStore,
} from "@sage/runtime";
import {
  createBuilderDraft,
  createResearcherBrief,
  createReviewerReport,
  createSupervisorPlan,
  type BuilderDraft,
  type ResearcherBrief,
  type ReviewerReport,
} from "@sage/agents";
import type {
  EntityId,
  JsonObject,
  Artifact,
  Message,
  MessageRole,
  Step,
  Run,
  RunEvent,
  RunFailedEvent,
  ToolCall,
} from "@sage/shared";

const SUPERVISOR_SYSTEM_PROMPT = [
  "You are Sage Agent Supervisor.",
  "Respond concisely in the user's language.",
  "Phase 2.4 supports audited read-only project file context when provided.",
  "Only claim file access for files included in the read-only context.",
  "Do not claim that you wrote files, ran shell commands, made external side-effect requests, or used tools that are not represented in the context.",
  "If the user asks for an action that needs side effects, explain the approval boundary and provide a safe plan or draft.",
].join(" ");

const READ_PROJECT_FILE_TOOL_NAME = "read_project_file";
const READ_PROJECT_FILE_AGENT = "researcher";
const MAX_CONTEXT_FILE_COUNT = 3;

type Clock = () => string;
type IdFactory = (prefix: string) => EntityId;

export type SupervisorProvider = (
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput,
) => Promise<DeepSeekAdapterResult<DeepSeekChatCompletionOutput>>;

export type SupervisorStreamProvider = (
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput,
) => AsyncIterable<DeepSeekAdapterResult<DeepSeekStreamParseEvent>>;

export type ReadProjectFileRunner = (
  input: ReadProjectFileToolInput,
) => Promise<ReadProjectFileResult>;

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
  readonly workspaceRoot?: string | null;
  readonly readProjectFile?: ReadProjectFileRunner;
  readonly maxFileBytes?: number;
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

export interface StreamSupervisorDeepSeekInput {
  readonly store: RuntimeStore;
  readonly runId: EntityId;
  readonly config: DeepSeekProviderConfig;
  readonly provider?: SupervisorStreamProvider;
  readonly workspaceRoot?: string | null;
  readonly readProjectFile?: ReadProjectFileRunner;
  readonly maxFileBytes?: number;
  readonly now?: Clock;
  readonly createId?: IdFactory;
}

export async function runSupervisorDeepSeekOnce({
  store,
  runId,
  config,
  provider = createDeepSeekChatCompletion,
  workspaceRoot = null,
  readProjectFile = readProjectFileTool,
  maxFileBytes = DEFAULT_READ_PROJECT_FILE_MAX_BYTES,
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

  const fileContextPass = await appendReadProjectFileContextPass({
    store,
    run,
    workspaceRoot,
    readProjectFile,
    maxFileBytes,
    now,
    createId,
  });

  const multiAgentPass = await runMultiAgentEventPass({
    store,
    run,
    fileContextPass,
    now,
    createId,
  });
  if (!multiAgentPass.ok) {
    return {
      ...multiAgentPass.failure,
      events: [startEvent, ...fileContextPass.events, ...multiAgentPass.events],
    };
  }

  const result = await provider(config, {
    messages: createSupervisorMessages(
      run.goal,
      fileContextPass.contexts,
      multiAgentPass.supervisorContext,
    ),
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
      alreadyAppendedEvents: [
        startEvent,
        ...fileContextPass.events,
        ...multiAgentPass.events,
      ],
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
      alreadyAppendedEvents: [
        startEvent,
        ...fileContextPass.events,
        ...multiAgentPass.events,
      ],
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
    events: [
      startEvent,
      ...fileContextPass.events,
      ...multiAgentPass.events,
      ...events,
    ],
  };
}

export async function* streamSupervisorDeepSeekEvents({
  store,
  runId,
  config,
  provider = streamDeepSeekChatCompletion,
  workspaceRoot = null,
  readProjectFile = readProjectFileTool,
  maxFileBytes = DEFAULT_READ_PROJECT_FILE_MAX_BYTES,
  now = defaultNow,
  createId = defaultCreateId,
}: StreamSupervisorDeepSeekInput): AsyncGenerator<RunEvent, SupervisorRunResult> {
  const run = store.getRun(runId);
  if (!run) {
    return missingRunResult();
  }

  const startEvent = createRunStartedEvent({
    run,
    createdAt: now(),
    sequence: nextRunSequence(store, run.id),
    createId,
  });
  store.appendEvent(startEvent);
  yield startEvent;

  const fileContextPass = await appendReadProjectFileContextPass({
    store,
    run,
    workspaceRoot,
    readProjectFile,
    maxFileBytes,
    now,
    createId,
  });
  for (const event of fileContextPass.events) yield event;

  const multiAgentPass = await runMultiAgentEventPass({
    store,
    run,
    fileContextPass,
    now,
    createId,
  });
  if (!multiAgentPass.ok) {
    for (const event of multiAgentPass.events) yield event;
    return multiAgentPass.failure;
  }
  for (const event of multiAgentPass.events) yield event;

  const messageId = createId("message");
  const chunks: string[] = [];

  for await (const result of provider(config, {
    messages: createSupervisorMessages(
      run.goal,
      fileContextPass.contexts,
      multiAgentPass.supervisorContext,
    ),
    model: run.settings.model,
    thinkingEnabled: run.settings.thinkingEnabled,
    reasoningEffort: run.settings.reasoningEffort,
  })) {
    if (!result.ok) {
      const failure = appendSupervisorFailure({
        store,
        runId: run.id,
        safeMessage: formatSafeProviderIssue(result.issue),
        now,
        createId,
        alreadyAppendedEvents: [
          startEvent,
          ...fileContextPass.events,
          ...multiAgentPass.events,
        ],
      });
      const failedEvent = failure.events.at(-1);
      if (failedEvent) yield failedEvent;
      return {
        ...failure,
        events: store.getEventsByRun(run.id),
      };
    }

    if (result.value.type === "done") break;

    const delta = result.value.contentDelta;
    if (delta.length === 0) continue;

    chunks.push(delta);
    const event: RunEvent = {
      id: createId("event"),
      runId: run.id,
      type: "message.delta",
      sequence: nextRunSequence(store, run.id),
      createdAt: now(),
      payload: {
        messageId,
        role: "agent",
        agent: "supervisor",
        delta,
      },
    };
    store.appendEvent(event);
    yield event;
  }

  const content = chunks.join("");
  if (content.trim().length === 0) {
    const failure = appendSupervisorFailure({
      store,
      runId: run.id,
      safeMessage: formatSafeProviderIssue({
        code: "invalid_response",
        message: "DeepSeek streaming response did not include assistant content.",
      }),
      now,
      createId,
      alreadyAppendedEvents: [
        startEvent,
        ...fileContextPass.events,
        ...multiAgentPass.events,
      ],
    });
    const failedEvent = failure.events.at(-1);
    if (failedEvent) yield failedEvent;
    return {
      ...failure,
      events: store.getEventsByRun(run.id),
    };
  }

  const completedAt = now();
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
  const completedEvents: RunEvent[] = [
    {
      id: createId("event"),
      runId: run.id,
      type: "message.completed",
      sequence: nextRunSequence(store, run.id),
      createdAt: completedAt,
      payload: {
        message,
      },
    },
    {
      id: createId("event"),
      runId: run.id,
      type: "run.completed",
      sequence: nextRunSequence(store, run.id) + 1,
      createdAt: completedAt,
      payload: {
        run: completedRun,
      },
    },
  ];

  for (const event of completedEvents) {
    store.appendEvent(event);
    yield event;
  }

  return {
    ok: true,
    run: completedRun,
    message,
    events: store.getEventsByRun(run.id),
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

type ReadProjectFileContext =
  | {
      readonly ok: true;
      readonly relativePath: string;
      readonly bytes: number;
      readonly content: string;
    }
  | {
      readonly ok: false;
      readonly relativePath: string;
      readonly code: string;
      readonly message: string;
    };

interface ReadProjectFileContextPass {
  readonly events: readonly RunEvent[];
  readonly contexts: readonly ReadProjectFileContext[];
}

async function appendReadProjectFileContextPass({
  store,
  run,
  workspaceRoot,
  readProjectFile,
  maxFileBytes,
  now,
  createId,
}: {
  readonly store: RuntimeStore;
  readonly run: Run;
  readonly workspaceRoot: string | null;
  readonly readProjectFile: ReadProjectFileRunner;
  readonly maxFileBytes: number;
  readonly now: Clock;
  readonly createId: IdFactory;
}): Promise<ReadProjectFileContextPass> {
  const requestedPaths = extractExplicitProjectPaths(run.goal).slice(
    0,
    MAX_CONTEXT_FILE_COUNT,
  );
  if (requestedPaths.length === 0 || workspaceRoot === null) {
    return { events: [], contexts: [] };
  }

  const events: RunEvent[] = [];
  const contexts: ReadProjectFileContext[] = [];
  const contextStep = createStep({
    id: createId("step"),
    runId: run.id,
    agent: READ_PROJECT_FILE_AGENT,
    title: "Read explicit project files",
    status: "running",
    startedAt: now(),
    input: {
      requestedPaths: [...requestedPaths],
      maxFileBytes,
    },
  });
  const contextStepStartedEvent = createStepEvent(
    "step.started",
    contextStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(contextStepStartedEvent);
  events.push(contextStepStartedEvent);

  for (const relativePath of requestedPaths) {
    const startedAt = now();
    const toolCallId = createId("tool");
    const baseToolCall: ToolCall = {
      id: toolCallId,
      runId: run.id,
      stepId: contextStep.id,
      agent: READ_PROJECT_FILE_AGENT,
      toolName: READ_PROJECT_FILE_TOOL_NAME,
      args: {
        relativePath,
        maxBytes: maxFileBytes,
      },
      status: "running",
      result: null,
      error: null,
      startedAt,
      completedAt: null,
    };
    const startedEvent: RunEvent = {
      id: createId("event"),
      runId: run.id,
      type: "tool.started",
      sequence: nextRunSequence(store, run.id),
      createdAt: startedAt,
      payload: {
        toolCall: baseToolCall,
      },
    };
    store.appendEvent(startedEvent);
    events.push(startedEvent);

    const result = await readProjectFile({
      workspaceRoot,
      relativePath,
      maxBytes: maxFileBytes,
    });
    const completedAt = now();

    if (result.ok) {
      contexts.push({
        ok: true,
        relativePath: result.relativePath,
        bytes: result.bytes,
        content: result.content,
      });

      const completedEvent: RunEvent = {
        id: createId("event"),
        runId: run.id,
        type: "tool.completed",
        sequence: nextRunSequence(store, run.id),
        createdAt: completedAt,
        payload: {
          toolCall: {
            ...baseToolCall,
            args: {
              relativePath: result.relativePath,
              maxBytes: maxFileBytes,
            },
            status: "completed",
            result: createReadProjectFileToolResult(result),
            completedAt,
          },
        },
      };
      store.appendEvent(completedEvent);
      events.push(completedEvent);
      continue;
    }

    const safeError = `${result.issue.code}: ${result.issue.message}`;
    contexts.push({
      ok: false,
      relativePath: result.issue.relativePath ?? relativePath,
      code: result.issue.code,
      message: result.issue.message,
    });
    const failedEvent: RunEvent = {
      id: createId("event"),
      runId: run.id,
      type: "tool.failed",
      sequence: nextRunSequence(store, run.id),
      createdAt: completedAt,
      payload: {
        toolCall: {
          ...baseToolCall,
          status: "failed",
          result: {
            relativePath: result.issue.relativePath ?? relativePath,
            code: result.issue.code,
          },
          error: safeError,
          completedAt,
        },
      },
    };
    store.appendEvent(failedEvent);
    events.push(failedEvent);
  }

  const completedStep = createStep({
    ...contextStep,
    status: "completed",
    completedAt: now(),
    output: {
      files: contexts.map((context) =>
        context.ok
          ? {
              relativePath: context.relativePath,
              status: "read_success",
              bytes: context.bytes,
              code: null,
            }
          : {
              relativePath: context.relativePath,
              status: "read_failed",
              bytes: null,
              code: context.code,
            },
      ),
    },
  });
  const contextStepCompletedEvent = createStepEvent(
    "step.completed",
    completedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(contextStepCompletedEvent);
  events.push(contextStepCompletedEvent);

  return { events, contexts };
}

function createReadProjectFileToolResult(
  result: Extract<ReadProjectFileResult, { readonly ok: true }>,
): JsonObject {
  return {
    relativePath: result.relativePath,
    bytes: result.bytes,
    contentPreview: truncateForToolResult(result.content),
  };
}

function createReadProjectFileContextMessage(
  contexts: readonly ReadProjectFileContext[],
): string | null {
  if (contexts.length === 0) return null;

  const blocks = contexts.map((context, index) => {
    if (context.ok) {
      return [
        `File ${index + 1}: ${context.relativePath}`,
        `Status: read_success`,
        `Bytes: ${context.bytes}`,
        `ContentJson: ${JSON.stringify(truncateForToolResult(context.content))}`,
      ].join("\n");
    }

    return [
      `File ${index + 1}: ${context.relativePath}`,
      `Status: read_failed`,
      `Reason: ${context.code}`,
      `Message: ${context.message}`,
    ].join("\n");
  });

  return [
    "Read-only project file context follows.",
    "Use only successful file contents as evidence.",
    "For failed reads, explain the safety boundary without inventing file contents.",
    ...blocks,
  ].join("\n\n");
}

function extractExplicitProjectPaths(goal: string): string[] {
  const paths = new Set<string>();

  collectDelimitedPaths(goal, /`([^`\r\n]+)`/g, paths);
  collectDelimitedPaths(goal, /["'“”‘’]([^"'“”‘’\r\n]+)["'“”‘’]/g, paths);

  for (const token of goal.match(/[^\s，。！？；：、()[\]{}<>]+/gu) ?? []) {
    addPathCandidate(token, paths);
  }

  return [...paths];
}

function collectDelimitedPaths(
  value: string,
  pattern: RegExp,
  paths: Set<string>,
): void {
  for (const match of value.matchAll(pattern)) {
    addPathCandidate(match[1] ?? "", paths);
  }
}

function addPathCandidate(value: string, paths: Set<string>): void {
  const candidate = sanitizeExtractedPath(value);
  if (!looksLikeExplicitProjectPath(candidate)) return;
  paths.add(candidate);
}

function sanitizeExtractedPath(value: string): string {
  return value
    .trim()
    .replace(/^[`"'“”‘’({[]+/, "")
    .replace(/[`"'“”‘’)}\],.;:!?，。！？；：]+$/, "");
}

function looksLikeExplicitProjectPath(value: string): boolean {
  if (value.length === 0 || value.length > 240) return false;
  if (value.includes("://") || value.includes("*") || value.endsWith("/")) {
    return false;
  }
  if (value === ".env" || value.startsWith(".env.")) return true;
  if (value.includes("/")) return true;

  const basename = value.split("/").at(-1) ?? value;
  return /^[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/.test(basename);
}

function truncateForToolResult(content: string): string {
  const limit = 4096;
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}\n[truncated]`;
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
  fileContexts: readonly ReadProjectFileContext[] = [],
  multiAgentContext: string | null = null,
): DeepSeekChatCompletionInput["messages"] {
  const messages: DeepSeekChatCompletionInput["messages"][number][] = [
    {
      role: "system",
      content: SUPERVISOR_SYSTEM_PROMPT,
    },
  ];

  const contextMessage = createReadProjectFileContextMessage(fileContexts);
  if (contextMessage !== null) {
    messages.push({
      role: "system",
      content: contextMessage,
    });
  }

  if (multiAgentContext !== null) {
    messages.push({
      role: "system",
      content: multiAgentContext,
    });
  }

  messages.push(
    {
      role: "user",
      content: goal,
    },
  );

  return messages;
}

type MultiAgentEventPass =
  | {
      readonly ok: true;
      readonly events: readonly RunEvent[];
      readonly supervisorContext: string;
    }
  | {
      readonly ok: false;
      readonly events: readonly RunEvent[];
      readonly supervisorContext: string;
      readonly failure: Extract<SupervisorRunResult, { readonly ok: false }>;
    };

async function runMultiAgentEventPass({
  store,
  run,
  fileContextPass,
  now,
  createId,
}: {
  readonly store: RuntimeStore;
  readonly run: Run;
  readonly fileContextPass: ReadProjectFileContextPass;
  readonly now: Clock;
  readonly createId: IdFactory;
}): Promise<MultiAgentEventPass> {
  const events: RunEvent[] = [];
  const steps = createSupervisorPlan(run.goal);
  if (!steps.ok) {
    return finishMultiAgentRunFailure({
      store,
      run,
      now,
      createId,
      events,
      supervisorContext: "",
      safeMessage: steps.issue.message,
    });
  }

  const supervisorPlanStep = createStep({
    id: createId("step"),
    runId: run.id,
    agent: "supervisor",
    title: "Plan multi-agent run",
    status: "running",
    startedAt: now(),
    input: {
      goal: run.goal,
    },
  });
  const supervisorPlanStartEvent = createStepEvent(
    "step.started",
    supervisorPlanStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(supervisorPlanStartEvent);
  events.push(supervisorPlanStartEvent);

  const supervisorPlanMessage = createMessage({
    id: createId("message"),
    runId: run.id,
    threadId: run.threadId,
    role: "agent",
    agent: "supervisor",
    content: steps.plan.summary,
    createdAt: now(),
  });
  const supervisorPlanMessageEvent = createMessageCompletedEvent(
    supervisorPlanMessage,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(supervisorPlanMessageEvent);
  events.push(supervisorPlanMessageEvent);

  const supervisorPlanArtifact = createArtifact({
    id: createId("artifact"),
    runId: run.id,
    kind: "plan",
    title: "Supervisor Plan",
    content: JSON.stringify(steps.plan, null, 2),
    path: null,
    createdAt: now(),
  });
  const supervisorPlanArtifactEvent = createArtifactEvent(
    supervisorPlanArtifact,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(supervisorPlanArtifactEvent);
  events.push(supervisorPlanArtifactEvent);

  const supervisorPlanCompletedStep = createStep({
    ...supervisorPlanStep,
    status: "completed",
    completedAt: now(),
    output: {
      summary: steps.plan.summary,
      steps: steps.plan.steps.map((step) => ({
        id: step.id,
        agent: step.agent,
        title: step.title,
      })),
    },
  });
  const supervisorPlanCompletedEvent = createStepEvent(
    "step.completed",
    supervisorPlanCompletedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(supervisorPlanCompletedEvent);
  events.push(supervisorPlanCompletedEvent);

  const researcherStep = createStep({
    id: createId("step"),
    runId: run.id,
    agent: "researcher",
    title: "Gather project context",
    status: "running",
    startedAt: now(),
  });
  const researcherStartEvent = createStepEvent(
    "step.started",
    researcherStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(researcherStartEvent);
  events.push(researcherStartEvent);

  const researcherBrief = createResearcherBrief({
    goal: run.goal,
    suggestedPaths: fileContextPass.contexts
      .filter((context) => context.ok)
      .map((context) => context.relativePath),
  });
  if (!researcherBrief.ok) {
    return finishMultiAgentStepFailure({
      store,
      run,
      step: researcherStep,
      now,
      createId,
      events,
      supervisorContext: "",
      safeMessage: researcherBrief.issue.message,
    });
  }

  const researcherMessage = createMessage({
    id: createId("message"),
    runId: run.id,
    threadId: run.threadId,
    role: "agent",
    agent: "researcher",
    content: researcherBrief.brief.summary,
    createdAt: now(),
  });
  const researcherMessageEvent = createMessageCompletedEvent(
    researcherMessage,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(researcherMessageEvent);
  events.push(researcherMessageEvent);

  const researcherArtifact = createArtifact({
    id: createId("artifact"),
    runId: run.id,
    kind: "document",
    title: "Researcher Brief",
    content: JSON.stringify(researcherBrief.brief, null, 2),
    path: null,
    createdAt: now(),
  });
  const researcherArtifactEvent = createArtifactEvent(
    researcherArtifact,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(researcherArtifactEvent);
  events.push(researcherArtifactEvent);

  const researcherCompletedStep = createStep({
    ...researcherStep,
    status: "completed",
    completedAt: now(),
    output: {
      summary: researcherBrief.brief.summary,
      targets: [...researcherBrief.brief.contextTargets],
    },
  });
  const researcherCompletedEvent = createStepEvent(
    "step.completed",
    researcherCompletedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(researcherCompletedEvent);
  events.push(researcherCompletedEvent);

  const builderStep = createStep({
    id: createId("step"),
    runId: run.id,
    agent: "builder",
    title: "Draft implementation",
    status: "running",
    startedAt: now(),
  });
  const builderStartEvent = createStepEvent(
    "step.started",
    builderStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(builderStartEvent);
  events.push(builderStartEvent);

  const builderDraft = createBuilderDraft({
    goal: run.goal,
    contextNotes: [
      researcherBrief.brief.summary,
      ...researcherBrief.brief.contextTargets,
    ],
    constraints: researcherBrief.brief.constraints,
  });
  if (!builderDraft.ok) {
    return finishMultiAgentStepFailure({
      store,
      run,
      step: builderStep,
      now,
      createId,
      events,
      supervisorContext: createMultiAgentSupervisorContext({
        planSummary: steps.plan.summary,
        researcherBrief: researcherBrief.brief,
      }),
      safeMessage: builderDraft.issue.message,
    });
  }

  const builderMessage = createMessage({
    id: createId("message"),
    runId: run.id,
    threadId: run.threadId,
    role: "agent",
    agent: "builder",
    content: builderDraft.draft.summary,
    createdAt: now(),
  });
  const builderMessageEvent = createMessageCompletedEvent(
    builderMessage,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(builderMessageEvent);
  events.push(builderMessageEvent);

  const builderArtifact = createArtifact({
    id: createId("artifact"),
    runId: run.id,
    kind: "plan",
    title: "Builder Draft",
    content: JSON.stringify(builderDraft.draft, null, 2),
    path: null,
    createdAt: now(),
  });
  const builderArtifactEvent = createArtifactEvent(
    builderArtifact,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(builderArtifactEvent);
  events.push(builderArtifactEvent);

  const builderCompletedStep = createStep({
    ...builderStep,
    status: "completed",
    completedAt: now(),
    output: {
      summary: builderDraft.draft.summary,
      patches: builderDraft.draft.patchPlan.map((patch) => ({
        target: patch.target,
        intent: patch.intent,
      })),
    },
  });
  const builderCompletedEvent = createStepEvent(
    "step.completed",
    builderCompletedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(builderCompletedEvent);
  events.push(builderCompletedEvent);

  const reviewerStep = createStep({
    id: createId("step"),
    runId: run.id,
    agent: "reviewer",
    title: "Review quality and safety",
    status: "running",
    startedAt: now(),
  });
  const reviewerStartEvent = createStepEvent(
    "step.started",
    reviewerStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(reviewerStartEvent);
  events.push(reviewerStartEvent);

  const reviewerReport = createReviewerReport({
    goal: run.goal,
    draftSummary: builderDraft.draft.summary,
    acceptanceCriteria: steps.plan.steps.map((step) => step.title),
    findings: [],
    risks: ["Multi-agent run still uses pure-function agent outputs for MVP."],
    missingChecks: [],
  });
  if (!reviewerReport.ok) {
    return finishMultiAgentStepFailure({
      store,
      run,
      step: reviewerStep,
      now,
      createId,
      events,
      supervisorContext: createMultiAgentSupervisorContext({
        planSummary: steps.plan.summary,
        researcherBrief: researcherBrief.brief,
        builderDraft: builderDraft.draft,
      }),
      safeMessage: reviewerReport.issue.message,
    });
  }

  const reviewerMessage = createMessage({
    id: createId("message"),
    runId: run.id,
    threadId: run.threadId,
    role: "agent",
    agent: "reviewer",
    content: reviewerReport.report.summary,
    createdAt: now(),
  });
  const reviewerMessageEvent = createMessageCompletedEvent(
    reviewerMessage,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(reviewerMessageEvent);
  events.push(reviewerMessageEvent);

  const reviewerArtifact = createArtifact({
    id: createId("artifact"),
    runId: run.id,
    kind: "summary",
    title: "Reviewer Report",
    content: JSON.stringify(reviewerReport.report, null, 2),
    path: null,
    createdAt: now(),
  });
  const reviewerArtifactEvent = createArtifactEvent(
    reviewerArtifact,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(reviewerArtifactEvent);
  events.push(reviewerArtifactEvent);

  const reviewerCompletedStep = createStep({
    ...reviewerStep,
    status: reviewerReport.report.decision === "pass" ? "completed" : "failed",
    completedAt: now(),
    output: {
      decision: reviewerReport.report.decision,
      findings: [...reviewerReport.report.findings],
      risks: [...reviewerReport.report.risks],
    },
  });
  const reviewerCompletedEvent = createStepEvent(
    reviewerReport.report.decision === "pass" ? "step.completed" : "step.failed",
    reviewerCompletedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(reviewerCompletedEvent);
  events.push(reviewerCompletedEvent);

  if (reviewerReport.report.decision !== "pass") {
    return finishMultiAgentRunFailure({
      store,
      run,
      now,
      createId,
      events,
      supervisorContext: createMultiAgentSupervisorContext({
        planSummary: steps.plan.summary,
        researcherBrief: researcherBrief.brief,
        builderDraft: builderDraft.draft,
        reviewerReport: reviewerReport.report,
      }),
      safeMessage:
        "Reviewer gate did not pass; Supervisor final synthesis is blocked.",
      activeAgent: "reviewer",
    });
  }

  return {
    ok: true,
    events,
    supervisorContext: createMultiAgentSupervisorContext({
      planSummary: steps.plan.summary,
      researcherBrief: researcherBrief.brief,
      builderDraft: builderDraft.draft,
      reviewerReport: reviewerReport.report,
    }),
  };
}

function createStep({
  id,
  runId,
  agent,
  title,
  status,
  startedAt,
  completedAt = null,
  input = null,
  output = null,
}: {
  readonly id: string;
  readonly runId: EntityId;
  readonly agent: "supervisor" | "researcher" | "builder" | "reviewer";
  readonly title: string;
  readonly status: Step["status"];
  readonly startedAt: string | null;
  readonly completedAt?: string | null;
  readonly input?: JsonObject | null;
  readonly output?: JsonObject | null;
}): Step {
  return {
    id,
    runId,
    agent,
    title,
    status,
    input,
    output,
    startedAt,
    completedAt,
  };
}

function createMessage({
  id,
  runId,
  threadId,
  role,
  agent,
  content,
  createdAt,
}: {
  readonly id: string;
  readonly runId: EntityId;
  readonly threadId: EntityId;
  readonly role: MessageRole;
  readonly agent: Step["agent"] | null;
  readonly content: string;
  readonly createdAt: string;
}): Message {
  return {
    id,
    runId,
    threadId,
    role,
    agent,
    content,
    createdAt,
  };
}

function createArtifact({
  id,
  runId,
  kind,
  title,
  content,
  path,
  createdAt,
}: {
  readonly id: string;
  readonly runId: EntityId;
  readonly kind: Artifact["kind"];
  readonly title: string;
  readonly content: string | null;
  readonly path: string | null;
  readonly createdAt: string;
}): Artifact {
  return {
    id,
    runId,
    kind,
    title,
    content,
    path,
    createdAt,
  };
}

function createMultiAgentSupervisorContext({
  planSummary,
  researcherBrief,
  builderDraft = null,
  reviewerReport = null,
}: {
  readonly planSummary: string;
  readonly researcherBrief: ResearcherBrief;
  readonly builderDraft?: BuilderDraft | null;
  readonly reviewerReport?: ReviewerReport | null;
}): string {
  const payload = {
    planSummary,
    researcher: {
      summary: researcherBrief.summary,
      contextTargets: researcherBrief.contextTargets,
      constraints: researcherBrief.constraints,
      handoffNotes: researcherBrief.handoffNotes,
    },
    builder:
      builderDraft === null
        ? null
        : {
            summary: builderDraft.summary,
            implementationNotes: builderDraft.implementationNotes,
            patchPlan: builderDraft.patchPlan,
            artifactDrafts: builderDraft.artifactDrafts,
            safetyNotes: builderDraft.safetyNotes,
          },
    reviewer:
      reviewerReport === null
        ? null
        : {
            summary: reviewerReport.summary,
            decision: reviewerReport.decision,
            acceptanceCriteria: reviewerReport.acceptanceCriteria,
            findings: reviewerReport.findings,
            risks: reviewerReport.risks,
            missingChecks: reviewerReport.missingChecks,
            safetyNotes: reviewerReport.safetyNotes,
          },
  };

  return [
    "Sage multi-agent audit context for final Supervisor synthesis.",
    "Use this context to summarize Researcher, Builder, and Reviewer work.",
    "Do not claim side effects beyond audited events.",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function createStepEvent(
  type: "step.started" | "step.completed" | "step.failed",
  step: Step,
  createId: IdFactory,
  sequence: number,
): Extract<RunEvent, { readonly type: typeof type }> {
  return {
    id: createId("event"),
    runId: step.runId,
    type,
    sequence,
    createdAt: step.completedAt ?? step.startedAt ?? defaultNow(),
    payload: {
      step,
    },
  } as Extract<RunEvent, { readonly type: typeof type }>;
}

function createMessageCompletedEvent(
  message: Message,
  createId: IdFactory,
  sequence: number,
): Extract<RunEvent, { readonly type: "message.completed" }> {
  return {
    id: createId("event"),
    runId: message.runId,
    type: "message.completed",
    sequence,
    createdAt: message.createdAt,
    payload: {
      message,
    },
  };
}

function createArtifactEvent(
  artifact: Artifact,
  createId: IdFactory,
  sequence: number,
): Extract<RunEvent, { readonly type: "artifact.created" }> {
  return {
    id: createId("event"),
    runId: artifact.runId,
    type: "artifact.created",
    sequence,
    createdAt: artifact.createdAt,
    payload: {
      artifact,
    },
  };
}

function finishMultiAgentStepFailure({
  store,
  run,
  step,
  now,
  createId,
  events,
  supervisorContext,
  safeMessage,
}: {
  readonly store: RuntimeStore;
  readonly run: Run;
  readonly step: Step;
  readonly now: Clock;
  readonly createId: IdFactory;
  readonly events: RunEvent[];
  readonly supervisorContext: string;
  readonly safeMessage: string;
}): MultiAgentEventPass {
  const failedStep = {
    ...step,
    status: "failed" as const,
    completedAt: now(),
  };
  const failedEvent = createStepEvent(
    "step.failed",
    failedStep,
    createId,
    nextRunSequence(store, run.id),
  );
  store.appendEvent(failedEvent);
  events.push(failedEvent);

  return finishMultiAgentRunFailure({
    store,
    run,
    now,
    createId,
    events,
    supervisorContext,
    safeMessage,
    activeAgent: step.agent,
  });
}

function finishMultiAgentRunFailure({
  store,
  run,
  now,
  createId,
  events,
  supervisorContext,
  safeMessage,
  activeAgent = "supervisor",
}: {
  readonly store: RuntimeStore;
  readonly run: Run;
  readonly now: Clock;
  readonly createId: IdFactory;
  readonly events: RunEvent[];
  readonly supervisorContext: string;
  readonly safeMessage: string;
  readonly activeAgent?: Run["activeAgent"];
}): MultiAgentEventPass {
  const failedAt = now();
  const failedRun: Run = {
    ...run,
    status: "failed",
    activeAgent,
    updatedAt: failedAt,
    completedAt: failedAt,
  };
  const failedEvent: RunFailedEvent = {
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
  store.appendEvent(failedEvent);
  events.push(failedEvent);

  return {
    ok: false,
    events,
    supervisorContext,
    failure: {
      ok: false,
      code: "provider_failed",
      safeMessage: failedEvent.payload.error,
      run: failedRun,
      events,
    },
  };
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
