import type { ReviewDecision, ReviewerReport } from "@sage/agents";

export interface FinalSummaryGateInput {
  readonly goal?: string;
  readonly reviewerReport: ReviewerReport | null;
}

export interface FinalSummaryReady {
  readonly goal: string;
  readonly reviewerDecision: "pass";
  readonly summary: string;
  readonly risks: readonly string[];
}

export interface FinalSummaryBlocked {
  readonly code: "missing_reviewer_report" | "reviewer_needs_changes";
  readonly reviewerDecision: ReviewDecision | null;
  readonly message: string;
  readonly findings: readonly string[];
  readonly missingChecks: readonly string[];
}

export type FinalSummaryGateResult =
  | {
      readonly ok: true;
      readonly ready: FinalSummaryReady;
    }
  | {
      readonly ok: false;
      readonly blocked: FinalSummaryBlocked;
    };

export function createFinalSummaryGate(
  input: FinalSummaryGateInput,
): FinalSummaryGateResult {
  if (!input.reviewerReport) {
    return {
      ok: false,
      blocked: {
        code: "missing_reviewer_report",
        reviewerDecision: null,
        message: "Final summary requires a reviewer report.",
        findings: [],
        missingChecks: [],
      },
    };
  }

  const goal = input.goal?.trim() || input.reviewerReport.goal;

  if (input.reviewerReport.decision !== "pass") {
    return {
      ok: false,
      blocked: {
        code: "reviewer_needs_changes",
        reviewerDecision: input.reviewerReport.decision,
        message:
          "Final summary is blocked until reviewer findings and missing checks are resolved.",
        findings: input.reviewerReport.findings,
        missingChecks: input.reviewerReport.missingChecks,
      },
    };
  }

  return {
    ok: true,
    ready: {
      goal,
      reviewerDecision: "pass",
      summary: input.reviewerReport.summary,
      risks: input.reviewerReport.risks,
    },
  };
}
