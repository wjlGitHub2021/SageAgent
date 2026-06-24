import { describe, expect, it } from "vitest";

import {
  canAgentUseTool,
  createApprovalRequest,
  createEmptyRuntimeSnapshot,
  createFinalArtifact,
  createFinalArtifactSummary,
  createFinalSummaryGate,
  createMemoryRuntimeStore,
  createLocalTelemetryLogger,
  requiresApprovalForAction,
  requiresToolApproval,
  resolveApproval,
  sanitizeTelemetryMetadata,
  TELEMETRY_REDACTED_VALUE,
} from "@sage/runtime";
import type { Run, RunEvent, Thread } from "@sage/shared";
import {
  appendSupervisorFailureEvent,
  runSupervisorDeepSeekOnce,
  type SupervisorProvider,
} from "../apps/web/src/lib/supervisor-runner";

const createdAt = "2026-06-24T01:00:00.000Z";

const thread: Thread = {
  id: "thread-test",
  title: "Test thread",
  createdAt,
  updatedAt: createdAt,
};

const run: Run = {
  id: "run-test",
  threadId: thread.id,
  title: "Test run",
  goal: "Verify runtime contracts",
  status: "running",
  activeAgent: "supervisor",
  settings: {
    model: "deepseek-v4-flash",
    thinkingEnabled: true,
    reasoningEffort: "high",
  },
  createdAt,
  updatedAt: createdAt,
  completedAt: null,
};

describe("runtime flows", () => {
  it("applies run events into the memory store and filters by sequence", () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run },
    });

    const firstDelta: RunEvent = {
      id: "event-message-delta-1",
      runId: run.id,
      type: "message.delta",
      sequence: 2,
      createdAt: "2026-06-24T01:00:01.000Z",
      payload: {
        messageId: "message-test",
        role: "agent",
        agent: "supervisor",
        delta: "Hello",
      },
    };
    const secondDelta: RunEvent = {
      ...firstDelta,
      id: "event-message-delta-2",
      sequence: 3,
      createdAt: "2026-06-24T01:00:02.000Z",
      payload: {
        ...firstDelta.payload,
        delta: " world",
      },
    };

    store.appendEvent(firstDelta);
    store.appendEvent(secondDelta);
    store.appendEvent({
      id: "event-run-completed",
      runId: run.id,
      type: "run.status_changed",
      sequence: 4,
      createdAt: "2026-06-24T01:00:03.000Z",
      payload: {
        previousStatus: "running",
        status: "completed",
        activeAgent: null,
      },
    });

    expect(store.getRun(run.id)).toMatchObject({
      status: "completed",
      activeAgent: null,
      completedAt: "2026-06-24T01:00:03.000Z",
    });
    expect(store.getMessagesByRun(run.id)[0]?.content).toBe("Hello world");
    expect(store.getEventsByRun(run.id, 2).map((event) => event.id)).toEqual([
      "event-message-delta-2",
      "event-run-completed",
    ]);
  });

  it("applies run completed events with a full run snapshot", () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-completion",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    store.appendEvent({
      id: "event-run-started-for-completion",
      runId: run.id,
      type: "run.status_changed",
      sequence: 2,
      createdAt: "2026-06-24T01:00:01.000Z",
      payload: {
        previousStatus: "queued",
        status: "running",
        activeAgent: "supervisor",
      },
    });

    store.appendEvent({
      id: "event-run-completed-with-snapshot",
      runId: run.id,
      type: "run.completed",
      sequence: 3,
      createdAt: "2026-06-24T01:00:02.000Z",
      payload: {
        run: {
          ...run,
          status: "completed",
          activeAgent: null,
          updatedAt: "2026-06-24T01:00:02.000Z",
          completedAt: "2026-06-24T01:00:02.000Z",
        },
      },
    });

    expect(store.getRun(run.id)).toMatchObject({
      status: "completed",
      activeAgent: null,
      completedAt: "2026-06-24T01:00:02.000Z",
    });
  });

  it("keeps approval flow explicit for side-effect actions", () => {
    expect(requiresApprovalForAction("write_file")).toBe(true);
    expect(requiresApprovalForAction("run_shell")).toBe(true);
    expect(requiresApprovalForAction("read_project_file")).toBe(false);

    const request = createApprovalRequest({
      id: " approval-1 ",
      runId: run.id,
      requestedBy: "builder",
      reason: " Write a file ",
      payloadSummary: " write_file: README.md ",
      action: "write_file",
      createdAt,
    });

    expect(request.ok).toBe(true);
    if (!request.ok) return;
    expect(request.approval).toMatchObject({
      id: "approval-1",
      status: "pending",
      resolvedAt: null,
    });

    expect(resolveApproval(request.approval, "pending", createdAt)).toMatchObject({
      ok: false,
      issue: { code: "invalid_approval_resolution" },
    });

    const resolved = resolveApproval(
      request.approval,
      "approved",
      "2026-06-24T01:00:04.000Z",
    );
    expect(resolved).toMatchObject({
      ok: true,
      approval: {
        status: "approved",
        resolvedAt: "2026-06-24T01:00:04.000Z",
      },
    });
  });

  it("keeps Read + Draft tools inside the no-approval boundary", () => {
    expect(canAgentUseTool("researcher", "read_project_file")).toBe(true);
    expect(canAgentUseTool("reviewer", "draft_patch")).toBe(false);
    expect(requiresToolApproval("draft_patch")).toBe(false);
    expect(requiresToolApproval("unknown_tool")).toBe(true);
  });

  it("validates artifacts and blocks final summary until reviewer passes", () => {
    const artifactResult = createFinalArtifact({
      id: " artifact-1 ",
      runId: run.id,
      kind: "summary",
      title: " QA summary ",
      content: " Finished checks ",
      path: " docs/QA.md ",
      createdAt,
    });

    expect(artifactResult.ok).toBe(true);
    if (!artifactResult.ok) return;
    expect(createFinalArtifactSummary(artifactResult.artifact)).toEqual({
      id: "artifact-1",
      kind: "summary",
      title: "QA summary",
      hasPath: true,
      contentLength: "Finished checks".length,
    });

    expect(
      createFinalSummaryGate({
        goal: run.goal,
        reviewerReport: null,
      }),
    ).toMatchObject({
      ok: false,
      blocked: { code: "missing_reviewer_report" },
    });

    expect(
      createFinalSummaryGate({
        reviewerReport: {
          goal: run.goal,
          summary: "Needs another check",
          decision: "needs_changes",
          acceptanceCriteria: [],
          findings: ["Missing test"],
          risks: [],
          missingChecks: ["unit test"],
          safetyNotes: [],
        },
      }),
    ).toMatchObject({
      ok: false,
      blocked: {
        code: "reviewer_needs_changes",
        reviewerDecision: "needs_changes",
      },
    });

    const ready = createFinalSummaryGate({
      reviewerReport: {
        goal: run.goal,
        summary: "Ready",
        decision: "pass",
        acceptanceCriteria: ["All checks pass"],
        findings: [],
        risks: ["Manual QA still needed later"],
        missingChecks: [],
        safetyNotes: [],
      },
    });
    expect(ready).toMatchObject({
      ok: true,
      ready: {
        goal: run.goal,
        reviewerDecision: "pass",
        summary: "Ready",
      },
    });
  });

  it("records local telemetry with ordering, filtering, trimming, and redaction", () => {
    const logger = createLocalTelemetryLogger({ maxEvents: 2 });

    const firstEvent = logger.record({
      id: " telemetry-1 ",
      name: " api.request.started ",
      source: "api",
      message: " Request started ",
      runId: " run-a ",
      metadata: {
        status: 202,
        apiKey: "sk-secret",
        nested: {
          authorization: "Bearer token",
          safe: "visible",
        },
      },
      createdAt: "2026-06-24T01:00:05.000Z",
    });
    expect(firstEvent.metadata).toMatchObject({
      apiKey: TELEMETRY_REDACTED_VALUE,
      nested: {
        authorization: TELEMETRY_REDACTED_VALUE,
        safe: "visible",
      },
    });
    logger.record({
      name: "api.request.completed",
      source: "api",
      message: "Request completed",
      runId: "run-a",
      metadata: {
        eventCount: 1,
      },
      createdAt: "2026-06-24T01:00:06.000Z",
    });
    logger.record({
      name: "provider.request.failed",
      level: "error",
      source: "provider",
      message: "Provider request failed",
      runId: "run-b",
      metadata: {
        token: "private",
      },
      createdAt: "2026-06-24T01:00:07.000Z",
    });

    expect(logger.getEvents().map((event) => event.name)).toEqual([
      "api.request.completed",
      "provider.request.failed",
    ]);
    expect(logger.getEvents({ source: "api" })).toHaveLength(1);
    expect(logger.getEvents({ level: "error" })[0]).toMatchObject({
      name: "provider.request.failed",
      metadata: {
        token: TELEMETRY_REDACTED_VALUE,
      },
    });

    const [storedEvent] = logger.getEvents({ source: "provider" });
    if (storedEvent) {
      (storedEvent.metadata as Record<string, unknown>).token = "mutated";
    }
    expect(logger.getEvents({ source: "provider" })[0]?.metadata).toMatchObject({
      token: TELEMETRY_REDACTED_VALUE,
    });
  });

  it("sanitizes telemetry metadata recursively", () => {
    expect(
      sanitizeTelemetryMetadata({
        safe: "value",
        apiKey: "sk-secret",
        authorization: "Bearer abc",
        credential: "private",
        password: "secret",
        secret: "secret",
        list: [{ token: "abc" }, "ok"],
      }),
    ).toEqual({
      safe: "value",
      apiKey: TELEMETRY_REDACTED_VALUE,
      authorization: TELEMETRY_REDACTED_VALUE,
      credential: TELEMETRY_REDACTED_VALUE,
      password: TELEMETRY_REDACTED_VALUE,
      secret: TELEMETRY_REDACTED_VALUE,
      list: [{ token: TELEMETRY_REDACTED_VALUE }, "ok"],
    });
  });

  it("runs Supervisor-only DeepSeek once and appends standard run events", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    const clock = createClock([
      "2026-06-24T01:00:01.000Z",
      "2026-06-24T01:00:02.000Z",
    ]);
    const ids = createIdFactory();
    let providerInput: Parameters<SupervisorProvider>[1] | null = null;
    const provider: SupervisorProvider = async (_config, input) => {
      providerInput = input;
      return {
        ok: true,
        value: {
          id: "chatcmpl-test",
          model: "deepseek-v4-flash",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "这是 Supervisor 的真实回复。",
                reasoningContent: null,
              },
              finishReason: "stop",
            },
          ],
        },
      };
    };

    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-supervisor",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const result = await runSupervisorDeepSeekOnce({
      store,
      runId: run.id,
      config: {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider,
      now: clock,
      createId: ids,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(providerInput).toMatchObject({
      model: run.settings.model,
      thinkingEnabled: run.settings.thinkingEnabled,
      reasoningEffort: run.settings.reasoningEffort,
      messages: [
        { role: "system" },
        { role: "user", content: run.goal },
      ],
    });
    expect(result.events.map((event) => event.type)).toEqual([
      "run.status_changed",
      "message.delta",
      "message.completed",
      "run.completed",
    ]);
    expect(result.events.map((event) => event.sequence)).toEqual([
      2, 3, 4, 5,
    ]);

    const delta = result.events.find(
      (event): event is Extract<RunEvent, { type: "message.delta" }> =>
        event.type === "message.delta",
    );
    const completed = result.events.find(
      (event): event is Extract<RunEvent, { type: "message.completed" }> =>
        event.type === "message.completed",
    );
    expect(delta?.payload.messageId).toBe(completed?.payload.message.id);
    expect(completed?.payload.message.content).toBe(delta?.payload.delta);
    expect(store.getRun(run.id)).toMatchObject({
      status: "completed",
      activeAgent: null,
      completedAt: "2026-06-24T01:00:02.000Z",
    });
    expect(store.getMessagesByRun(run.id)[0]?.content).toBe(
      "这是 Supervisor 的真实回复。",
    );
  });

  it("turns provider failures into safe run.failed events", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-failure",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const result = await runSupervisorDeepSeekOnce({
      store,
      runId: run.id,
      config: {
        apiKey: "sk-secret-should-not-leak",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider: async () => ({
        ok: false,
        issue: {
          code: "missing_api_key",
          message: "DEEPSEEK_API_KEY is required before calling DeepSeek.",
        },
      }),
      now: createClock([
        "2026-06-24T01:00:05.000Z",
        "2026-06-24T01:00:06.000Z",
      ]),
      createId: createIdFactory(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.events.map((event) => event.type)).toEqual([
      "run.status_changed",
      "run.failed",
    ]);
    expect(result.safeMessage).toContain("missing_api_key");
    expect(result.safeMessage).not.toContain("sk-secret-should-not-leak");
    expect(store.getRun(run.id)).toMatchObject({
      status: "failed",
      activeAgent: "supervisor",
      completedAt: "2026-06-24T01:00:06.000Z",
    });
  });

  it("treats empty DeepSeek output as provider failure", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-empty-output",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const result = await runSupervisorDeepSeekOnce({
      store,
      runId: run.id,
      config: {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider: async () => ({
        ok: true,
        value: {
          id: null,
          model: null,
          choices: [],
        },
      }),
      now: createClock([
        "2026-06-24T01:00:07.000Z",
        "2026-06-24T01:00:08.000Z",
      ]),
      createId: createIdFactory(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.safeMessage).toContain("invalid_response");
    expect(
      store
        .getEventsByRun(run.id)
        .find((event) => event.type === "run.failed"),
    ).toBeDefined();
  });

  it("appends config failures without calling a provider", () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-config-failure",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const result = appendSupervisorFailureEvent({
      store,
      runId: run.id,
      safeMessage:
        "provider_error: invalid_config. Authorization Bearer sk-secret-token and sk-naked-secret-token",
      now: createClock([
        "2026-06-24T01:00:09.000Z",
        "2026-06-24T01:00:10.000Z",
      ]),
      createId: createIdFactory(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.events.map((event) => event.type)).toEqual([
      "run.status_changed",
      "run.failed",
    ]);
    expect(result.safeMessage).not.toContain("sk-secret-token");
    expect(result.safeMessage).not.toContain("sk-naked-secret-token");
    expect(result.safeMessage).toContain("[redacted]");
  });
});

function createClock(values: string[]): () => string {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? createdAt;
}

function createIdFactory(): (prefix: string) => string {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-test-${index}`;
  };
}
