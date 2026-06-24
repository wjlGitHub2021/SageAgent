import type {
  Approval,
  Artifact,
  Message,
  Run,
  RunEvent,
  Step,
  Thread,
  ToolCall,
} from "@sage/shared";

export interface RuntimeSnapshot {
  readonly threads: readonly Thread[];
  readonly runs: readonly Run[];
  readonly messages: readonly Message[];
  readonly steps: readonly Step[];
  readonly toolCalls: readonly ToolCall[];
  readonly approvals: readonly Approval[];
  readonly artifacts: readonly Artifact[];
  readonly events: readonly RunEvent[];
}

export function createEmptyRuntimeSnapshot(): RuntimeSnapshot {
  return {
    threads: [],
    runs: [],
    messages: [],
    steps: [],
    toolCalls: [],
    approvals: [],
    artifacts: [],
    events: [],
  };
}
