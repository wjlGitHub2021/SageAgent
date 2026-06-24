import type {
  AgentRole,
  Approval,
  ApprovalAction,
  ApprovalStatus,
  EntityId,
  ISODateTimeString,
} from "@sage/shared";
import { APPROVAL_ACTIONS } from "@sage/shared";

export interface CreateApprovalRequestInput {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly requestedBy: AgentRole;
  readonly reason: string;
  readonly payloadSummary: string;
  readonly action: ApprovalAction;
  readonly createdAt: ISODateTimeString;
}

export type ApprovalFlowIssueCode =
  | "invalid_approval_input"
  | "approval_already_resolved"
  | "invalid_approval_resolution";

export interface ApprovalFlowIssue {
  readonly code: ApprovalFlowIssueCode;
  readonly message: string;
}

export type CreateApprovalRequestResult =
  | {
      readonly ok: true;
      readonly approval: Approval;
    }
  | {
      readonly ok: false;
      readonly issue: ApprovalFlowIssue;
    };

export type ResolveApprovalResult =
  | {
      readonly ok: true;
      readonly approval: Approval;
    }
  | {
      readonly ok: false;
      readonly issue: ApprovalFlowIssue;
    };

export function requiresApprovalForAction(action: string): boolean {
  return APPROVAL_ACTIONS.includes(action as ApprovalAction);
}

export function createApprovalRequest(
  input: CreateApprovalRequestInput,
): CreateApprovalRequestResult {
  const validationIssue = validateApprovalInput(input);
  if (validationIssue) {
    return {
      ok: false,
      issue: validationIssue,
    };
  }

  return {
    ok: true,
    approval: {
      id: input.id.trim(),
      runId: input.runId.trim(),
      requestedBy: input.requestedBy,
      reason: input.reason.trim(),
      payloadSummary: input.payloadSummary.trim(),
      action: input.action,
      status: "pending",
      createdAt: input.createdAt.trim(),
      resolvedAt: null,
    },
  };
}

export function resolveApproval(
  approval: Approval,
  status: ApprovalStatus,
  resolvedAt: ISODateTimeString,
): ResolveApprovalResult {
  if (status === "pending") {
    return {
      ok: false,
      issue: {
        code: "invalid_approval_resolution",
        message: "Approval can only resolve to approved or rejected.",
      },
    };
  }

  if (approval.status !== "pending") {
    return {
      ok: false,
      issue: {
        code: "approval_already_resolved",
        message: "Approval has already been resolved.",
      },
    };
  }

  const normalizedResolvedAt = resolvedAt.trim();
  if (normalizedResolvedAt.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_approval_input",
        message: "Approval resolution timestamp is required.",
      },
    };
  }

  return {
    ok: true,
    approval: {
      ...approval,
      status,
      resolvedAt: normalizedResolvedAt,
    },
  };
}

function validateApprovalInput(
  input: CreateApprovalRequestInput,
): ApprovalFlowIssue | null {
  if (input.id.trim().length === 0) {
    return invalidApprovalInput("Approval id is required.");
  }

  if (input.runId.trim().length === 0) {
    return invalidApprovalInput("Approval runId is required.");
  }

  if (input.reason.trim().length === 0) {
    return invalidApprovalInput("Approval reason is required.");
  }

  if (input.payloadSummary.trim().length === 0) {
    return invalidApprovalInput("Approval payload summary is required.");
  }

  if (input.createdAt.trim().length === 0) {
    return invalidApprovalInput("Approval createdAt timestamp is required.");
  }

  if (!requiresApprovalForAction(input.action)) {
    return invalidApprovalInput("Approval action is not recognized.");
  }

  return null;
}

function invalidApprovalInput(message: string): ApprovalFlowIssue {
  return {
    code: "invalid_approval_input",
    message,
  };
}
