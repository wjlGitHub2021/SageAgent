import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import {
  canAgentUseTool,
  createApprovalRequest,
  createEmptyRuntimeSnapshot,
  createFinalArtifact,
  createFinalArtifactSummary,
  createFinalSummaryGate,
  createMemoryRuntimeStore,
  createLocalTelemetryLogger,
  createDelegationFlow,
  readProjectFileTool,
  requiresApprovalForAction,
  requiresToolApproval,
  resolveApproval,
  sanitizeTelemetryMetadata,
  TELEMETRY_REDACTED_VALUE,
} from "@sage/runtime";
import type { ReadProjectFileRunner } from "../apps/web/src/lib/supervisor-runner";
import type { Run, RunEvent, Thread } from "@sage/shared";
import {
  appendSupervisorFailureEvent,
  runSupervisorDeepSeekOnce,
  streamSupervisorDeepSeekEvents,
  type SupervisorProvider,
  type SupervisorStreamProvider,
} from "../apps/web/src/lib/supervisor-runner";
import { getPhase4RunSummary } from "../apps/web/src/lib/phase4-summary";

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

const multiAgentEventTypes = [
  "step.started",
  "message.completed",
  "artifact.created",
  "step.completed",
  "step.started",
  "message.completed",
  "artifact.created",
  "step.completed",
  "step.started",
  "message.completed",
  "artifact.created",
  "step.completed",
  "step.started",
  "message.completed",
  "artifact.created",
  "step.completed",
] as const;

const readFileContextEventTypes = [
  "step.started",
  "tool.started",
  "tool.completed",
  "step.completed",
] as const;

function withMultiAgentEvents(
  ...tail: readonly RunEvent["type"][]
): RunEvent["type"][] {
  return ["run.status_changed", ...multiAgentEventTypes, ...tail];
}

function findSupervisorCompletedMessage(
  events: readonly RunEvent[],
): Extract<RunEvent, { type: "message.completed" }> | undefined {
  return events.findLast(
    (event): event is Extract<RunEvent, { type: "message.completed" }> =>
      event.type === "message.completed" &&
      event.payload.message.agent === "supervisor",
  );
}

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

  it("keeps terminal status events idempotent for local cancel feedback", () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-cancel",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run },
    });

    const cancelledAt = "2026-06-24T01:00:04.000Z";
    const cancelEvent: RunEvent = {
      id: "event-run-cancelled",
      runId: run.id,
      type: "run.status_changed",
      sequence: 2,
      createdAt: cancelledAt,
      payload: {
        previousStatus: "running",
        status: "cancelled",
        activeAgent: "supervisor",
      },
    };

    store.appendEvent(cancelEvent);
    store.appendEvent({
      ...cancelEvent,
      id: "event-run-reopened-after-cancel",
      sequence: 3,
      createdAt: "2026-06-24T01:00:05.000Z",
      payload: {
        previousStatus: "cancelled",
        status: "running",
        activeAgent: "supervisor",
      },
    });

    expect(store.getRun(run.id)).toMatchObject({
      status: "cancelled",
      activeAgent: "supervisor",
      completedAt: cancelledAt,
    });
    expect(store.getEventsByRun(run.id).map((event) => event.id)).toEqual([
      "event-run-created-for-cancel",
      "event-run-cancelled",
      "event-run-reopened-after-cancel",
    ]);
    expect(store.getEventsByRun(run.id, 2).map((event) => event.id)).toEqual([
      "event-run-reopened-after-cancel",
    ]);
    expect(store.getEventsByRun(run.id, 1).map((event) => event.id)).toEqual([
      "event-run-cancelled",
      "event-run-reopened-after-cancel",
    ]);
  });

  it("keeps approval flow explicit for side-effect actions", () => {
    expect(requiresApprovalForAction("write_file")).toBe(true);
    expect(requiresApprovalForAction("run_shell")).toBe(true);
    expect(requiresApprovalForAction("external_request")).toBe(true);
    expect(requiresApprovalForAction("persist_state")).toBe(true);
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
    expect(canAgentUseTool("supervisor", "read_project_file")).toBe(false);
    expect(canAgentUseTool("reviewer", "draft_patch")).toBe(false);
    expect(requiresToolApproval("draft_patch")).toBe(false);
    expect(requiresToolApproval("unknown_tool")).toBe(true);
  });

  it("reads allowed project text files through the read-only tool", async () => {
    const result = await readProjectFileTool({
      workspaceRoot: process.cwd(),
      relativePath: "README.md",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.relativePath).toBe("README.md");
    expect(result.content).toContain("Sage Agent");
    expect(result.bytes).toBeGreaterThan(0);
  });

  it("rejects path traversal and absolute workspace escapes", async () => {
    await expect(
      readProjectFileTool({
        workspaceRoot: process.cwd(),
        relativePath: "../DailySage/README.md",
      }),
    ).resolves.toMatchObject({
      ok: false,
      issue: { code: "path_outside_workspace" },
    });

    await expect(
      readProjectFileTool({
        workspaceRoot: process.cwd(),
        relativePath: "/etc/passwd",
      }),
    ).resolves.toMatchObject({
      ok: false,
      issue: { code: "absolute_path_not_allowed" },
    });
  });

  it("rejects sensitive and generated paths without requiring approval", async () => {
    await expect(
      readProjectFileTool({
        workspaceRoot: process.cwd(),
        relativePath: ".env",
      }),
    ).resolves.toMatchObject({
      ok: false,
      issue: { code: "blocked_path" },
    });

    await expect(
      readProjectFileTool({
        workspaceRoot: process.cwd(),
        relativePath: ".ENV.local",
      }),
    ).resolves.toMatchObject({
      ok: false,
      issue: { code: "blocked_path" },
    });

    await expect(
      readProjectFileTool({
        workspaceRoot: process.cwd(),
        relativePath: "node_modules/.pnpm",
      }),
    ).resolves.toMatchObject({
      ok: false,
      issue: { code: "blocked_path" },
    });

    for (const credentialPath of [
      ".npmrc",
      ".netrc",
      ".git-credentials",
      "secrets/id_rsa",
      "certs/server.pem",
      "keys/private.KEY",
    ]) {
      await expect(
        readProjectFileTool({
          workspaceRoot: process.cwd(),
          relativePath: credentialPath,
        }),
      ).resolves.toMatchObject({
        ok: false,
        issue: { code: "blocked_path" },
      });
    }

    expect(requiresToolApproval("read_project_file")).toBe(false);
  });

  it("rejects symlinks that resolve to blocked project paths", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sage-read-tool-"));
    try {
      await fs.writeFile(path.join(workspaceRoot, ".env"), "SECRET=private");
      await fs.symlink(path.join(workspaceRoot, ".env"), path.join(workspaceRoot, "safe-link.txt"));

      await expect(
        readProjectFileTool({
          workspaceRoot,
          relativePath: "safe-link.txt",
        }),
      ).resolves.toMatchObject({
        ok: false,
        issue: { code: "blocked_path" },
      });
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects directories, oversized files, and binary files", async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sage-read-tool-"));
    try {
      await fs.mkdir(path.join(workspaceRoot, "docs"));
      await fs.writeFile(path.join(workspaceRoot, "large.txt"), "x".repeat(32));
      await fs.writeFile(path.join(workspaceRoot, "binary.dat"), Buffer.from([1, 2, 0, 3]));

      await expect(
        readProjectFileTool({
          workspaceRoot,
          relativePath: "docs",
        }),
      ).resolves.toMatchObject({
        ok: false,
        issue: { code: "not_file" },
      });

      await expect(
        readProjectFileTool({
          workspaceRoot,
          relativePath: "large.txt",
          maxBytes: 16,
        }),
      ).resolves.toMatchObject({
        ok: false,
        issue: { code: "file_too_large" },
      });

      await expect(
        readProjectFileTool({
          workspaceRoot,
          relativePath: "binary.dat",
        }),
      ).resolves.toMatchObject({
        ok: false,
        issue: { code: "binary_file" },
      });
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
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

  it("derives the phase 4 summary from runtime events and helper output", () => {
    const flow = createDelegationFlow({
      goal: "Implement phase 4 summary UI",
      suggestedPaths: ["apps/web/src/app/page.tsx"],
      knownConstraints: ["Do not bypass runtime events"],
      acceptanceCriteria: ["Show reviewer gate", "Show artifact summaries"],
    });

    expect(flow.ok).toBe(true);
    if (!flow.ok) return;

    const events: RunEvent[] = [
      {
        id: "event-phase4-plan-artifact",
        runId: run.id,
        type: "artifact.created",
        sequence: 1,
        createdAt: "2026-06-24T01:00:01.000Z",
        payload: {
          artifact: {
            id: "artifact-phase4-plan",
            runId: run.id,
            kind: "plan",
            title: "Supervisor Plan",
            content: JSON.stringify(flow.flow.supervisorPlan, null, 2),
            path: null,
            createdAt: "2026-06-24T01:00:01.000Z",
          },
        },
      },
      {
        id: "event-phase4-plan-step",
        runId: run.id,
        type: "step.completed",
        sequence: 2,
        createdAt: "2026-06-24T01:00:02.000Z",
        payload: {
          step: {
            id: "step-phase4-supervisor",
            runId: run.id,
            agent: "supervisor",
            title: "Plan multi-agent run",
            status: "completed",
            input: null,
            output: flow.flow.supervisorPlan as never,
            startedAt: "2026-06-24T01:00:00.000Z",
            completedAt: "2026-06-24T01:00:02.000Z",
          },
        },
      },
      {
        id: "event-phase4-researcher-step",
        runId: run.id,
        type: "step.completed",
        sequence: 3,
        createdAt: "2026-06-24T01:00:03.000Z",
        payload: {
          step: {
            id: "step-phase4-researcher",
            runId: run.id,
            agent: "researcher",
            title: "Gather project context",
            status: "completed",
            input: null,
            output: flow.flow.researcherBrief as never,
            startedAt: "2026-06-24T01:00:02.000Z",
            completedAt: "2026-06-24T01:00:03.000Z",
          },
        },
      },
      {
        id: "event-phase4-researcher-artifact",
        runId: run.id,
        type: "artifact.created",
        sequence: 4,
        createdAt: "2026-06-24T01:00:03.000Z",
        payload: {
          artifact: {
            id: "artifact-phase4-researcher",
            runId: run.id,
            kind: "document",
            title: "Researcher Brief",
            content: JSON.stringify(flow.flow.researcherBrief, null, 2),
            path: null,
            createdAt: "2026-06-24T01:00:03.000Z",
          },
        },
      },
      {
        id: "event-phase4-builder-step",
        runId: run.id,
        type: "step.completed",
        sequence: 5,
        createdAt: "2026-06-24T01:00:04.000Z",
        payload: {
          step: {
            id: "step-phase4-builder",
            runId: run.id,
            agent: "builder",
            title: "Draft implementation",
            status: "completed",
            input: null,
            output: flow.flow.builderDraft as never,
            startedAt: "2026-06-24T01:00:03.000Z",
            completedAt: "2026-06-24T01:00:04.000Z",
          },
        },
      },
      {
        id: "event-phase4-reviewer-step",
        runId: run.id,
        type: "step.completed",
        sequence: 6,
        createdAt: "2026-06-24T01:00:05.000Z",
        payload: {
          step: {
            id: "step-phase4-reviewer",
            runId: run.id,
            agent: "reviewer",
            title: "Review quality and safety",
            status: "completed",
            input: null,
            output: flow.flow.reviewerReport as never,
            startedAt: "2026-06-24T01:00:04.000Z",
            completedAt: "2026-06-24T01:00:05.000Z",
          },
        },
      },
      {
        id: "event-phase4-reviewer-artifact",
        runId: run.id,
        type: "artifact.created",
        sequence: 7,
        createdAt: "2026-06-24T01:00:05.000Z",
        payload: {
          artifact: {
            id: "artifact-phase4-reviewer",
            runId: run.id,
            kind: "summary",
            title: "Reviewer Report",
            content: JSON.stringify(flow.flow.reviewerReport, null, 2),
            path: null,
            createdAt: "2026-06-24T01:00:05.000Z",
          },
        },
      },
    ];

    const summary = getPhase4RunSummary(events, run.id);
    expect(summary.hasData).toBe(true);
    expect(summary.supervisor.status).toBe("completed");
    expect(summary.supervisor.summary).toBe(flow.flow.supervisorPlan.summary);
    expect(summary.researcher.contextTargets).toContain("apps/web/src/app/page.tsx");
    expect(summary.builder.patchTargets).toEqual([
      "docs",
      "implementation",
      "qa",
    ]);
    expect(summary.reviewer.decision).toBe(flow.flow.reviewerDecision);
    expect(summary.finalSummaryGate.status).toBe("ready");
    expect(summary.artifacts.map((artifact) => artifact.title)).toEqual([
      "Supervisor Plan",
      "Researcher Brief",
      "Reviewer Report",
    ]);
  });

  it("ignores unrelated legacy seed artifacts when deriving phase 4 status", () => {
    const summary = getPhase4RunSummary(
      [
        {
          id: "event-legacy-artifact",
          runId: run.id,
          type: "artifact.created",
          sequence: 1,
          createdAt: createdAt,
          payload: {
            artifact: {
              id: "artifact-legacy",
              runId: run.id,
              kind: "document",
              title: "Stage 1 Implementation Spec",
              content: JSON.stringify({ summary: "Legacy seed" }),
              path: "docs/STAGE1_SPEC.md",
              createdAt,
            },
          },
        },
      ],
      run.id,
    );

    expect(summary.hasData).toBe(false);
    expect(summary.supervisor.status).toBe("missing");
    expect(summary.artifacts).toEqual([]);
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
        { role: "system" },
        { role: "user", content: run.goal },
      ],
    });
    expect(providerInput?.messages[1]?.content).toContain(
      "Sage multi-agent audit context",
    );
    expect(providerInput?.messages[1]?.content).toContain('"researcher"');
    expect(providerInput?.messages[1]?.content).toContain('"builder"');
    expect(providerInput?.messages[1]?.content).toContain('"reviewer"');
    expect(result.events.map((event) => event.type)).toEqual([
      ...withMultiAgentEvents(
        "message.delta",
        "message.completed",
        "run.completed",
      ),
    ]);
    expect(result.events.map((event) => event.sequence)).toEqual(
      Array.from({ length: result.events.length }, (_, index) => index + 2),
    );

    const delta = result.events.find(
      (event): event is Extract<RunEvent, { type: "message.delta" }> =>
        event.type === "message.delta",
    );
    const completed = findSupervisorCompletedMessage(result.events);
    expect(delta?.payload.messageId).toBe(completed?.payload.message.id);
    expect(completed?.payload.message.content).toBe(delta?.payload.delta);
    expect(store.getRun(run.id)).toMatchObject({
      status: "completed",
      activeAgent: null,
      completedAt: "2026-06-24T01:00:02.000Z",
    });
    expect(
      store.getMessagesByRun(run.id).find((message) => message.agent === "supervisor")
        ?.content,
    ).toBe("这是 Supervisor 的真实回复。");
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
      ...withMultiAgentEvents("run.failed"),
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

  it("streams Supervisor DeepSeek deltas into run events", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-streaming",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const provider: SupervisorStreamProvider = async function* () {
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-stream",
          model: "deepseek-v4-flash",
          index: 0,
          role: "assistant",
          contentDelta: "你",
          reasoningDelta: "先思考",
          finishReason: null,
        },
      };
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-stream",
          model: "deepseek-v4-flash",
          index: 0,
          role: null,
          contentDelta: "",
          reasoningDelta: "再补充",
          finishReason: null,
        },
      };
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-stream",
          model: "deepseek-v4-flash",
          index: 0,
          role: null,
          contentDelta: "好",
          reasoningDelta: null,
          finishReason: null,
        },
      };
      yield { ok: true, value: { type: "done" } };
    };

    const stream = streamSupervisorDeepSeekEvents({
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
      now: createClock([
        "2026-06-24T01:01:01.000Z",
        "2026-06-24T01:01:02.000Z",
        "2026-06-24T01:01:03.000Z",
        "2026-06-24T01:01:04.000Z",
      ]),
      createId: createIdFactory(),
    });

    const events = [];
    for await (const event of stream) events.push(event);

    expect(events.map((event) => event.type)).toEqual([
      ...withMultiAgentEvents(
        "message.delta",
        "message.delta",
        "message.completed",
        "run.completed",
      ),
    ]);
    const deltas = events.filter(
      (event): event is Extract<RunEvent, { type: "message.delta" }> =>
        event.type === "message.delta",
    );
    expect(deltas.map((event) => event.payload.delta)).toEqual(["你", "好"]);
    expect(new Set(deltas.map((event) => event.payload.messageId)).size).toBe(1);
    const completed = findSupervisorCompletedMessage(events);
    expect(completed?.payload.message.content).toBe("你好");
    // 推理过程被捕获并拼接——第二帧 content 为空但 reasoning 不能丢。
    expect(completed?.payload.message.reasoning).toBe("先思考再补充");
    expect(store.getRun(run.id)).toMatchObject({
      status: "completed",
      activeAgent: null,
    });
  });

  it("fails the run when multi-agent planning cannot start", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    const invalidRun: Run = {
      ...run,
      goal: " ",
    };
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-invalid-multi-agent",
      runId: invalidRun.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...invalidRun, status: "queued", activeAgent: null } },
    });

    let providerWasCalled = false;
    const provider: SupervisorStreamProvider = async function* () {
      providerWasCalled = true;
      yield { ok: true, value: { type: "done" } };
    };

    const events = [];
    for await (const event of streamSupervisorDeepSeekEvents({
      store,
      runId: invalidRun.id,
      config: {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider,
      now: createClock([
        "2026-06-24T01:05:01.000Z",
        "2026-06-24T01:05:02.000Z",
      ]),
      createId: createIdFactory(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "run.status_changed",
      "run.failed",
    ]);
    expect(providerWasCalled).toBe(false);
    expect(store.getRun(invalidRun.id)).toMatchObject({
      status: "failed",
      activeAgent: "supervisor",
      completedAt: "2026-06-24T01:05:02.000Z",
    });
  });

  it("fails the run when streaming completes without assistant content", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-empty-stream",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const provider: SupervisorStreamProvider = async function* () {
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-empty-stream",
          model: "deepseek-v4-flash",
          index: 0,
          role: "assistant",
          contentDelta: "",
          reasoningDelta: "reasoning only",
          finishReason: null,
        },
      };
      yield { ok: true, value: { type: "done" } };
    };

    const events = [];
    for await (const event of streamSupervisorDeepSeekEvents({
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
      now: createClock([
        "2026-06-24T01:06:01.000Z",
        "2026-06-24T01:06:02.000Z",
      ]),
      createId: createIdFactory(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      ...withMultiAgentEvents("run.failed"),
    ]);
    const failed = events.find(
      (event): event is Extract<RunEvent, { type: "run.failed" }> =>
        event.type === "run.failed",
    );
    expect(failed?.payload.error).toContain("invalid_response");
    expect(store.getRun(run.id)).toMatchObject({
      status: "failed",
      activeAgent: "supervisor",
    });
  });

  it("streams read-only file tool events before Supervisor model output", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    const fileRun: Run = {
      ...run,
      goal: "请读取 `docs/SPEC.md` 并总结重点",
    };
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-file-context",
      runId: fileRun.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...fileRun, status: "queued", activeAgent: null } },
    });

    let providerInput: Parameters<SupervisorStreamProvider>[1] | null = null;
    const provider: SupervisorStreamProvider = async function* (_config, input) {
      providerInput = input;
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-file",
          model: "deepseek-v4-flash",
          index: 0,
          role: "assistant",
          contentDelta: "已读取规格。",
          reasoningDelta: null,
          finishReason: null,
        },
      };
      yield { ok: true, value: { type: "done" } };
    };
    const readProjectFile: ReadProjectFileRunner = async (input) => ({
      ok: true,
      relativePath: input.relativePath,
      bytes: 18,
      content: "SPEC file content.",
    });

    const events = [];
    for await (const event of streamSupervisorDeepSeekEvents({
      store,
      runId: fileRun.id,
      config: {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider,
      workspaceRoot: process.cwd(),
      readProjectFile,
      now: createClock([
        "2026-06-24T01:03:01.000Z",
        "2026-06-24T01:03:02.000Z",
        "2026-06-24T01:03:03.000Z",
        "2026-06-24T01:03:04.000Z",
        "2026-06-24T01:03:05.000Z",
      ]),
      createId: createIdFactory(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "run.status_changed",
      ...readFileContextEventTypes,
      ...multiAgentEventTypes,
      "message.delta",
      "message.completed",
      "run.completed",
    ]);
    const toolCompleted = events.find(
      (event): event is Extract<RunEvent, { type: "tool.completed" }> =>
        event.type === "tool.completed",
    );
    expect(toolCompleted?.payload.toolCall).toMatchObject({
      agent: "researcher",
      toolName: "read_project_file",
      status: "completed",
      args: {
        relativePath: "docs/SPEC.md",
      },
    });
    expect(
      store
        .getStepsByRun(fileRun.id)
        .some((step) => step.id === toolCompleted?.payload.toolCall.stepId),
    ).toBe(true);
    expect(providerInput?.messages[1]?.content).toContain("docs/SPEC.md");
    expect(providerInput?.messages[1]?.content).toContain("SPEC file content.");
    expect(store.getToolCallsByRun(fileRun.id)[0]?.status).toBe("completed");
    // 模型未回传推理时，完成消息不应挂上空的 reasoning 字段。
    expect(
      findSupervisorCompletedMessage(events)?.payload.message.reasoning,
    ).toBeUndefined();
  });

  it("records read-only file tool failures without blocking Supervisor output", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    const fileRun: Run = {
      ...run,
      goal: "请读取 `.env` 看看配置",
    };
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-file-failure",
      runId: fileRun.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...fileRun, status: "queued", activeAgent: null } },
    });

    let providerInput: Parameters<SupervisorStreamProvider>[1] | null = null;
    const provider: SupervisorStreamProvider = async function* (_config, input) {
      providerInput = input;
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-file-failure",
          model: "deepseek-v4-flash",
          index: 0,
          role: "assistant",
          contentDelta: "不能读取敏感配置文件。",
          reasoningDelta: null,
          finishReason: null,
        },
      };
      yield { ok: true, value: { type: "done" } };
    };
    const readProjectFile: ReadProjectFileRunner = async () => ({
      ok: false,
      issue: {
        code: "blocked_path",
        message: "Path is blocked by the Sage read-only file policy.",
        relativePath: ".env",
      },
    });

    const events = [];
    for await (const event of streamSupervisorDeepSeekEvents({
      store,
      runId: fileRun.id,
      config: {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      provider,
      workspaceRoot: process.cwd(),
      readProjectFile,
      now: createClock([
        "2026-06-24T01:04:01.000Z",
        "2026-06-24T01:04:02.000Z",
        "2026-06-24T01:04:03.000Z",
        "2026-06-24T01:04:04.000Z",
        "2026-06-24T01:04:05.000Z",
      ]),
      createId: createIdFactory(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "run.status_changed",
      "step.started",
      "tool.started",
      "tool.failed",
      "step.completed",
      ...multiAgentEventTypes,
      "message.delta",
      "message.completed",
      "run.completed",
    ]);
    const toolFailed = events.find(
      (event): event is Extract<RunEvent, { type: "tool.failed" }> =>
        event.type === "tool.failed",
    );
    expect(toolFailed?.payload.toolCall).toMatchObject({
      agent: "researcher",
      toolName: "read_project_file",
      status: "failed",
      error:
        "blocked_path: Path is blocked by the Sage read-only file policy.",
    });
    expect(
      store
        .getStepsByRun(fileRun.id)
        .some((step) => step.id === toolFailed?.payload.toolCall.stepId),
    ).toBe(true);
    expect(providerInput?.messages[1]?.content).toContain("read_failed");
    expect(providerInput?.messages[1]?.content).toContain("blocked_path");
    expect(store.getApprovalsByRun(fileRun.id)).toEqual([]);
  });

  it("keeps partial streaming deltas when provider fails mid-stream", async () => {
    const store = createMemoryRuntimeStore(createEmptyRuntimeSnapshot());
    store.upsertThread(thread);
    store.appendEvent({
      id: "event-run-created-for-streaming-failure",
      runId: run.id,
      type: "run.created",
      sequence: 1,
      createdAt,
      payload: { run: { ...run, status: "queued", activeAgent: null } },
    });

    const provider: SupervisorStreamProvider = async function* () {
      yield {
        ok: true,
        value: {
          type: "delta",
          id: "chatcmpl-stream",
          model: "deepseek-v4-flash",
          index: 0,
          role: "assistant",
          contentDelta: "partial",
          reasoningDelta: null,
          finishReason: null,
        },
      };
      yield {
        ok: false,
        issue: {
          code: "invalid_stream_line",
          message: "bad line with sk-secret-token",
        },
      };
    };

    const events = [];
    for await (const event of streamSupervisorDeepSeekEvents({
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
      now: createClock([
        "2026-06-24T01:02:01.000Z",
        "2026-06-24T01:02:02.000Z",
        "2026-06-24T01:02:03.000Z",
      ]),
      createId: createIdFactory(),
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      "run.status_changed",
      ...multiAgentEventTypes,
      "message.delta",
      "run.failed",
    ]);
    expect(
      events.some(
        (event) =>
          event.type === "message.completed" &&
          event.payload.message.agent === "supervisor" &&
          event.payload.message.content === "partial",
      ),
    ).toBe(false);
    const failed = events.find(
      (event): event is Extract<RunEvent, { type: "run.failed" }> =>
        event.type === "run.failed",
    );
    expect(failed?.payload.error).toContain("invalid_stream_line");
    expect(failed?.payload.error).not.toContain("sk-secret-token");
    expect(
      store
        .getMessagesByRun(run.id)
        .some(
          (message) =>
            message.agent === "supervisor" && message.content === "partial",
        ),
    ).toBe(true);
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
