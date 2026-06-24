import type {
  Approval,
  Artifact,
  EntityId,
  Message,
  Run,
  RunEvent,
  RunStatus,
  Step,
  Thread,
  ToolCall,
} from "@sage/shared";
import { createEmptyRuntimeSnapshot, type RuntimeSnapshot } from "./state.js";

type RuntimeEntity =
  | Thread
  | Run
  | Message
  | Step
  | ToolCall
  | Approval
  | Artifact
  | RunEvent;

export interface RuntimeStore {
  getSnapshot(): RuntimeSnapshot;
  getThread(threadId: EntityId): Thread | undefined;
  getRun(runId: EntityId): Run | undefined;
  getRunsByThread(threadId: EntityId): readonly Run[];
  getMessagesByRun(runId: EntityId): readonly Message[];
  getStepsByRun(runId: EntityId): readonly Step[];
  getToolCallsByRun(runId: EntityId): readonly ToolCall[];
  getApprovalsByRun(runId: EntityId): readonly Approval[];
  getArtifactsByRun(runId: EntityId): readonly Artifact[];
  getEventsByRun(runId: EntityId, afterSequence?: number): readonly RunEvent[];
  upsertThread(thread: Thread): void;
  upsertRun(run: Run): void;
  upsertMessage(message: Message): void;
  upsertStep(step: Step): void;
  upsertToolCall(toolCall: ToolCall): void;
  upsertApproval(approval: Approval): void;
  upsertArtifact(artifact: Artifact): void;
  appendEvent(event: RunEvent): void;
}

const TERMINAL_RUN_STATUSES = new Set<RunStatus>([
  "completed",
  "failed",
  "cancelled",
]);

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

export function createMemoryRuntimeStore(
  initialSnapshot: RuntimeSnapshot = createEmptyRuntimeSnapshot(),
): RuntimeStore {
  return new MemoryRuntimeStore(initialSnapshot);
}

class MemoryRuntimeStore implements RuntimeStore {
  private readonly threads = indexById<Thread>();
  private readonly runs = indexById<Run>();
  private readonly messages = indexById<Message>();
  private readonly steps = indexById<Step>();
  private readonly toolCalls = indexById<ToolCall>();
  private readonly approvals = indexById<Approval>();
  private readonly artifacts = indexById<Artifact>();
  private readonly events = indexById<RunEvent>();

  constructor(initialSnapshot: RuntimeSnapshot) {
    for (const thread of initialSnapshot.threads) this.upsertThread(thread);
    for (const run of initialSnapshot.runs) this.upsertRun(run);
    for (const message of initialSnapshot.messages) this.upsertMessage(message);
    for (const step of initialSnapshot.steps) this.upsertStep(step);
    for (const toolCall of initialSnapshot.toolCalls) {
      this.upsertToolCall(toolCall);
    }
    for (const approval of initialSnapshot.approvals) {
      this.upsertApproval(approval);
    }
    for (const artifact of initialSnapshot.artifacts) {
      this.upsertArtifact(artifact);
    }
    for (const event of initialSnapshot.events) this.events.set(event.id, event);
  }

  getSnapshot(): RuntimeSnapshot {
    return {
      threads: sortByCreatedAt([...this.threads.values()]),
      runs: sortByCreatedAt([...this.runs.values()]),
      messages: sortByCreatedAt([...this.messages.values()]),
      steps: sortByNullableStartedAt([...this.steps.values()]),
      toolCalls: sortByNullableStartedAt([...this.toolCalls.values()]),
      approvals: sortByCreatedAt([...this.approvals.values()]),
      artifacts: sortByCreatedAt([...this.artifacts.values()]),
      events: sortBySequence([...this.events.values()]),
    };
  }

  getThread(threadId: EntityId): Thread | undefined {
    return this.threads.get(threadId);
  }

  getRun(runId: EntityId): Run | undefined {
    return this.runs.get(runId);
  }

  getRunsByThread(threadId: EntityId): readonly Run[] {
    return sortByCreatedAt(
      [...this.runs.values()].filter((run) => run.threadId === threadId),
    );
  }

  getMessagesByRun(runId: EntityId): readonly Message[] {
    return sortByCreatedAt(
      [...this.messages.values()].filter((message) => message.runId === runId),
    );
  }

  getStepsByRun(runId: EntityId): readonly Step[] {
    return sortByNullableStartedAt(
      [...this.steps.values()].filter((step) => step.runId === runId),
    );
  }

  getToolCallsByRun(runId: EntityId): readonly ToolCall[] {
    return sortByNullableStartedAt(
      [...this.toolCalls.values()].filter((call) => call.runId === runId),
    );
  }

  getApprovalsByRun(runId: EntityId): readonly Approval[] {
    return sortByCreatedAt(
      [...this.approvals.values()].filter(
        (approval) => approval.runId === runId,
      ),
    );
  }

  getArtifactsByRun(runId: EntityId): readonly Artifact[] {
    return sortByCreatedAt(
      [...this.artifacts.values()].filter(
        (artifact) => artifact.runId === runId,
      ),
    );
  }

  getEventsByRun(runId: EntityId, afterSequence?: number): readonly RunEvent[] {
    return sortBySequence(
      [...this.events.values()].filter(
        (event) =>
          event.runId === runId &&
          (afterSequence === undefined || event.sequence > afterSequence),
      ),
    );
  }

  upsertThread(thread: Thread): void {
    this.threads.set(thread.id, thread);
  }

  upsertRun(run: Run): void {
    this.runs.set(run.id, run);
  }

  upsertMessage(message: Message): void {
    this.messages.set(message.id, message);
  }

  upsertStep(step: Step): void {
    this.steps.set(step.id, step);
  }

  upsertToolCall(toolCall: ToolCall): void {
    this.toolCalls.set(toolCall.id, toolCall);
  }

  upsertApproval(approval: Approval): void {
    this.approvals.set(approval.id, approval);
  }

  upsertArtifact(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
  }

  appendEvent(event: RunEvent): void {
    if (this.events.has(event.id)) return;

    this.events.set(event.id, event);
    this.applyEvent(event);
  }

  private applyEvent(event: RunEvent): void {
    switch (event.type) {
      case "run.created":
        this.upsertRun(event.payload.run);
        break;
      case "run.status_changed":
        this.applyRunStatusChanged(event);
        break;
      case "step.started":
      case "step.completed":
      case "step.failed":
        this.upsertStep(event.payload.step);
        break;
      case "message.delta":
        this.applyMessageDelta(event);
        break;
      case "message.completed":
        this.upsertMessage(event.payload.message);
        break;
      case "tool.started":
      case "tool.completed":
      case "tool.failed":
        this.upsertToolCall(event.payload.toolCall);
        break;
      case "approval.requested":
      case "approval.resolved":
        this.upsertApproval(event.payload.approval);
        break;
      case "artifact.created":
        this.upsertArtifact(event.payload.artifact);
        break;
      case "run.completed":
      case "run.failed":
        this.upsertRun(event.payload.run);
        break;
    }
  }

  private applyRunStatusChanged(
    event: Extract<RunEvent, { readonly type: "run.status_changed" }>,
  ): void {
    const currentRun = this.runs.get(event.runId);
    if (!currentRun) return;

    this.upsertRun({
      ...currentRun,
      activeAgent: event.payload.activeAgent,
      status: event.payload.status,
      updatedAt: event.createdAt,
      completedAt: isTerminalRunStatus(event.payload.status)
        ? (currentRun.completedAt ?? event.createdAt)
        : currentRun.completedAt,
    });
  }

  private applyMessageDelta(
    event: Extract<RunEvent, { readonly type: "message.delta" }>,
  ): void {
    const currentMessage = this.messages.get(event.payload.messageId);

    if (currentMessage) {
      this.upsertMessage({
        ...currentMessage,
        content: `${currentMessage.content}${event.payload.delta}`,
      });
      return;
    }

    const currentRun = this.runs.get(event.runId);
    if (!currentRun) return;

    this.upsertMessage({
      id: event.payload.messageId,
      threadId: currentRun.threadId,
      runId: event.runId,
      role: event.payload.role,
      agent: event.payload.agent,
      content: event.payload.delta,
      createdAt: event.createdAt,
    });
  }
}

function indexById<Entity extends RuntimeEntity>(): Map<EntityId, Entity> {
  return new Map<EntityId, Entity>();
}

function sortByCreatedAt<Entity extends { readonly id: string; readonly createdAt: string }>(
  entities: Entity[],
): Entity[] {
  return entities.sort((left, right) =>
    compareStrings(left.createdAt, right.createdAt) ||
    compareStrings(left.id, right.id),
  );
}

function sortByNullableStartedAt<
  Entity extends { readonly id: string; readonly startedAt: string | null },
>(
  entities: Entity[],
): Entity[] {
  return entities.sort((left, right) =>
    compareStrings(left.startedAt ?? "", right.startedAt ?? "") ||
    compareStrings(left.id, right.id),
  );
}

function sortBySequence(events: RunEvent[]): RunEvent[] {
  return events.sort(
    (left, right) =>
      left.sequence - right.sequence ||
      compareStrings(left.createdAt, right.createdAt) ||
      compareStrings(left.id, right.id),
  );
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
