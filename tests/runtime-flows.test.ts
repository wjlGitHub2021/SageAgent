import { describe, expect, it } from "vitest";

import {
  canAgentUseTool,
  createApprovalRequest,
  createEmptyRuntimeSnapshot,
  createFinalArtifact,
  createFinalArtifactSummary,
  createFinalSummaryGate,
  createMemoryRuntimeStore,
  requiresApprovalForAction,
  requiresToolApproval,
  resolveApproval,
} from "@sage/runtime";
import type { Run, RunEvent, Thread } from "@sage/shared";

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
});
