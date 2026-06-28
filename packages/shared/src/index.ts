export type EntityId = string;
export type ISODateTimeString = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export const AGENT_ROLES = [
  "supervisor",
  "researcher",
  "builder",
  "reviewer",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const RUN_STATUSES = [
  "queued",
  "planning",
  "running",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "agent", "system"] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const STEP_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const TOOL_CALL_STATUSES = ["running", "completed", "failed"] as const;

export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number];

export const APPROVAL_ACTIONS = [
  "write_file",
  "run_shell",
  "external_request",
  "persist_state",
] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ARTIFACT_KINDS = [
  "plan",
  "patch",
  "document",
  "summary",
  "link",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const RUN_EVENT_TYPES = [
  "run.created",
  "run.status_changed",
  "step.started",
  "step.completed",
  "step.failed",
  "message.delta",
  "message.completed",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "approval.requested",
  "approval.resolved",
  "artifact.created",
  "run.completed",
  "run.failed",
] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;

export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export const REASONING_EFFORTS = ["high", "max"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface DeepSeekSettings {
  readonly model: DeepSeekModel;
  readonly thinkingEnabled: boolean;
  readonly reasoningEffort: ReasoningEffort;
}

export interface Thread {
  readonly id: EntityId;
  readonly title: string;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}

export interface Run {
  readonly id: EntityId;
  readonly threadId: EntityId;
  readonly title: string;
  readonly goal: string;
  readonly status: RunStatus;
  readonly activeAgent: AgentRole | null;
  readonly settings: DeepSeekSettings;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
  readonly completedAt: ISODateTimeString | null;
}

export interface Message {
  readonly id: EntityId;
  readonly threadId: EntityId;
  readonly runId: EntityId;
  readonly role: MessageRole;
  readonly agent: AgentRole | null;
  readonly content: string;
  readonly createdAt: ISODateTimeString;
}

export interface Step {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly agent: AgentRole;
  readonly title: string;
  readonly status: StepStatus;
  readonly input: JsonObject | null;
  readonly output: JsonObject | null;
  readonly startedAt: ISODateTimeString | null;
  readonly completedAt: ISODateTimeString | null;
}

export interface ToolCall {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly stepId: EntityId;
  readonly agent: AgentRole;
  readonly toolName: string;
  readonly args: JsonObject;
  readonly status: ToolCallStatus;
  readonly result: JsonValue | null;
  readonly error: string | null;
  readonly startedAt: ISODateTimeString;
  readonly completedAt: ISODateTimeString | null;
}

export interface Approval {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly requestedBy: AgentRole;
  readonly reason: string;
  readonly payloadSummary: string;
  readonly action: ApprovalAction;
  readonly status: ApprovalStatus;
  readonly createdAt: ISODateTimeString;
  readonly resolvedAt: ISODateTimeString | null;
}

export interface Artifact {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly content: string | null;
  readonly path: string | null;
  readonly createdAt: ISODateTimeString;
}

export interface RunEventBase<Type extends RunEventType, Payload extends object> {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly type: Type;
  readonly sequence: number;
  readonly createdAt: ISODateTimeString;
  readonly payload: Payload;
}

export type RunCreatedEvent = RunEventBase<
  "run.created",
  { readonly run: Run }
>;

export type RunStatusChangedEvent = RunEventBase<
  "run.status_changed",
  {
    readonly previousStatus: RunStatus;
    readonly status: RunStatus;
    readonly activeAgent: AgentRole | null;
  }
>;

export type StepStartedEvent = RunEventBase<
  "step.started",
  { readonly step: Step }
>;

export type StepCompletedEvent = RunEventBase<
  "step.completed",
  { readonly step: Step }
>;

export type StepFailedEvent = RunEventBase<
  "step.failed",
  { readonly step: Step }
>;

export type MessageDeltaEvent = RunEventBase<
  "message.delta",
  {
    readonly messageId: EntityId;
    readonly role: MessageRole;
    readonly agent: AgentRole | null;
    readonly delta: string;
  }
>;

export type MessageCompletedEvent = RunEventBase<
  "message.completed",
  { readonly message: Message }
>;

export type ToolStartedEvent = RunEventBase<
  "tool.started",
  { readonly toolCall: ToolCall }
>;

export type ToolCompletedEvent = RunEventBase<
  "tool.completed",
  { readonly toolCall: ToolCall }
>;

export type ToolFailedEvent = RunEventBase<
  "tool.failed",
  { readonly toolCall: ToolCall }
>;

export type ApprovalRequestedEvent = RunEventBase<
  "approval.requested",
  { readonly approval: Approval }
>;

export type ApprovalResolvedEvent = RunEventBase<
  "approval.resolved",
  { readonly approval: Approval }
>;

export type ArtifactCreatedEvent = RunEventBase<
  "artifact.created",
  { readonly artifact: Artifact }
>;

export type RunCompletedEvent = RunEventBase<
  "run.completed",
  { readonly run: Run }
>;

export type RunFailedEvent = RunEventBase<
  "run.failed",
  {
    readonly run: Run;
    readonly error: string;
  }
>;

export type RunEvent =
  | RunCreatedEvent
  | RunStatusChangedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | StepFailedEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | ArtifactCreatedEvent
  | RunCompletedEvent
  | RunFailedEvent;

export {
  MEMORY_AUDIT_ACTIONS,
  MEMORY_SCOPES,
  createEmptyMemorySnapshot,
  type DeleteMemoryEntryInput,
  type MemoryActor,
  type MemoryAuditAction,
  type MemoryAuditRecord,
  type MemoryEntry,
  type MemoryScope,
  type MemorySnapshot,
  type UpsertMemoryEntryInput,
} from "./memory.js";
