import {
  createBuilderDraft,
  createResearcherBrief,
  createReviewerReport,
  createSupervisorPlan,
  type BuilderDraft,
  type ResearcherBrief,
  type ReviewDecision,
  type ReviewerReport,
  type SupervisorPlan,
} from "@sage/agents";
import type { AgentRole } from "@sage/shared";

export interface DelegationFlowInput {
  readonly goal: string;
  readonly suggestedPaths?: readonly string[];
  readonly knownConstraints?: readonly string[];
  readonly contextNotes?: readonly string[];
  readonly acceptanceCriteria?: readonly string[];
  readonly reviewFindings?: readonly string[];
  readonly reviewRisks?: readonly string[];
  readonly missingChecks?: readonly string[];
  readonly builderContextNotes?: readonly string[];
}

export interface DelegationStep {
  readonly id: string;
  readonly agent: AgentRole;
  readonly status: "completed";
  readonly summary: string;
}

export interface DelegationFlow {
  readonly goal: string;
  readonly steps: readonly DelegationStep[];
  readonly supervisorPlan: SupervisorPlan;
  readonly researcherBrief: ResearcherBrief;
  readonly builderDraft: BuilderDraft;
  readonly reviewerReport: ReviewerReport;
  readonly reviewerDecision: ReviewDecision;
}

export interface DelegationFlowIssue {
  readonly code: "invalid_goal";
  readonly stage: AgentRole;
  readonly message: string;
}

export type DelegationFlowResult =
  | {
      readonly ok: true;
      readonly flow: DelegationFlow;
    }
  | {
      readonly ok: false;
      readonly issue: DelegationFlowIssue;
    };

export function createDelegationFlow(
  input: DelegationFlowInput,
): DelegationFlowResult {
  const supervisorResult = createSupervisorPlan(input.goal);
  if (!supervisorResult.ok) {
    return {
      ok: false,
      issue: {
        code: supervisorResult.issue.code,
        stage: "supervisor",
        message: supervisorResult.issue.message,
      },
    };
  }

  const researcherResult = createResearcherBrief({
    goal: input.goal,
    suggestedPaths: input.suggestedPaths,
    knownConstraints: input.knownConstraints,
  });
  if (!researcherResult.ok) {
    return {
      ok: false,
      issue: {
        code: researcherResult.issue.code,
        stage: "researcher",
        message: researcherResult.issue.message,
      },
    };
  }

  const builderResult = createBuilderDraft({
    goal: input.goal,
    contextNotes: normalizeList([
      ...(input.builderContextNotes ?? input.contextNotes ?? []),
      researcherResult.brief.summary,
      ...researcherResult.brief.contextTargets,
      ...researcherResult.brief.constraints,
    ]),
    constraints: input.knownConstraints,
  });
  if (!builderResult.ok) {
    return {
      ok: false,
      issue: {
        code: builderResult.issue.code,
        stage: "builder",
        message: builderResult.issue.message,
      },
    };
  }

  const reviewerResult = createReviewerReport({
    goal: input.goal,
    draftSummary: builderResult.draft.summary,
    acceptanceCriteria: input.acceptanceCriteria,
    findings: input.reviewFindings,
    risks: input.reviewRisks,
    missingChecks: input.missingChecks,
  });
  if (!reviewerResult.ok) {
    return {
      ok: false,
      issue: {
        code: reviewerResult.issue.code,
        stage: "reviewer",
        message: reviewerResult.issue.message,
      },
    };
  }

  return {
    ok: true,
    flow: {
      goal: supervisorResult.plan.goal,
      steps: [
        {
          id: "delegation-supervisor",
          agent: "supervisor",
          status: "completed",
          summary: supervisorResult.plan.summary,
        },
        {
          id: "delegation-researcher",
          agent: "researcher",
          status: "completed",
          summary: researcherResult.brief.summary,
        },
        {
          id: "delegation-builder",
          agent: "builder",
          status: "completed",
          summary: builderResult.draft.summary,
        },
        {
          id: "delegation-reviewer",
          agent: "reviewer",
          status: "completed",
          summary: reviewerResult.report.summary,
        },
      ],
      supervisorPlan: supervisorResult.plan,
      researcherBrief: researcherResult.brief,
      builderDraft: builderResult.draft,
      reviewerReport: reviewerResult.report,
      reviewerDecision: reviewerResult.report.decision,
    },
  };
}

function normalizeList(items: readonly string[]): readonly string[] {
  const normalized = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}
