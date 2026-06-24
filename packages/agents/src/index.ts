import type { AgentRole } from "@sage/shared";

export const AGENT_ALLOWED_ACTIONS = [
  "read_context",
  "draft_plan",
  "draft_artifact",
  "request_handoff",
] as const;

export type AgentAllowedAction = (typeof AGENT_ALLOWED_ACTIONS)[number];

export interface AgentDefinition {
  readonly role: AgentRole;
  readonly displayName: string;
  readonly mission: string;
  readonly allowedActions: readonly AgentAllowedAction[];
  readonly handoffTargets: readonly AgentRole[];
}

export interface SupervisorPlanStep {
  readonly id: string;
  readonly agent: AgentRole;
  readonly title: string;
  readonly intent: string;
  readonly dependsOn: readonly string[];
}

export interface SupervisorPlan {
  readonly goal: string;
  readonly summary: string;
  readonly steps: readonly SupervisorPlanStep[];
}

export interface SupervisorPlanIssue {
  readonly code: "invalid_goal";
  readonly message: string;
}

export type SupervisorPlanResult =
  | {
      readonly ok: true;
      readonly plan: SupervisorPlan;
    }
  | {
      readonly ok: false;
      readonly issue: SupervisorPlanIssue;
    };

export interface ResearcherBriefInput {
  readonly goal: string;
  readonly suggestedPaths?: readonly string[];
  readonly knownConstraints?: readonly string[];
}

export interface ResearcherBrief {
  readonly goal: string;
  readonly summary: string;
  readonly contextTargets: readonly string[];
  readonly constraints: readonly string[];
  readonly handoffNotes: readonly string[];
}

export interface ResearcherBriefIssue {
  readonly code: "invalid_goal";
  readonly message: string;
}

export type ResearcherBriefResult =
  | {
      readonly ok: true;
      readonly brief: ResearcherBrief;
    }
  | {
      readonly ok: false;
      readonly issue: ResearcherBriefIssue;
    };

export interface BuilderDraftInput {
  readonly goal: string;
  readonly contextNotes?: readonly string[];
  readonly constraints?: readonly string[];
}

export interface BuilderPatchPlanItem {
  readonly target: string;
  readonly intent: string;
}

export interface BuilderArtifactDraft {
  readonly title: string;
  readonly kind: "plan" | "patch" | "document" | "summary";
  readonly purpose: string;
}

export interface BuilderDraft {
  readonly goal: string;
  readonly summary: string;
  readonly implementationNotes: readonly string[];
  readonly constraints: readonly string[];
  readonly patchPlan: readonly BuilderPatchPlanItem[];
  readonly artifactDrafts: readonly BuilderArtifactDraft[];
  readonly safetyNotes: readonly string[];
}

export interface BuilderDraftIssue {
  readonly code: "invalid_goal";
  readonly message: string;
}

export type BuilderDraftResult =
  | {
      readonly ok: true;
      readonly draft: BuilderDraft;
    }
  | {
      readonly ok: false;
      readonly issue: BuilderDraftIssue;
    };

export type ReviewDecision = "pass" | "needs_changes";

export interface ReviewerReportInput {
  readonly goal: string;
  readonly draftSummary?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly findings?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingChecks?: readonly string[];
}

export interface ReviewerReport {
  readonly goal: string;
  readonly summary: string;
  readonly decision: ReviewDecision;
  readonly acceptanceCriteria: readonly string[];
  readonly findings: readonly string[];
  readonly risks: readonly string[];
  readonly missingChecks: readonly string[];
  readonly safetyNotes: readonly string[];
}

export interface ReviewerReportIssue {
  readonly code: "invalid_goal";
  readonly message: string;
}

export type ReviewerReportResult =
  | {
      readonly ok: true;
      readonly report: ReviewerReport;
    }
  | {
      readonly ok: false;
      readonly issue: ReviewerReportIssue;
    };

export const supervisorAgent: AgentDefinition = {
  role: "supervisor",
  displayName: "Supervisor",
  mission:
    "Understand the user goal, create an auditable plan, delegate to specialist agents, and synthesize the final answer.",
  allowedActions: ["read_context", "draft_plan", "request_handoff"],
  handoffTargets: ["researcher", "builder", "reviewer"],
};

export const researcherAgent: AgentDefinition = {
  role: "researcher",
  displayName: "Researcher",
  mission:
    "Gather local project context, summarize constraints, and prepare a clear brief for downstream draft work.",
  allowedActions: ["read_context", "draft_artifact"],
  handoffTargets: [],
};

export const builderAgent: AgentDefinition = {
  role: "builder",
  displayName: "Builder",
  mission:
    "Turn approved context into implementation drafts, patch plans, and artifact drafts without applying side effects.",
  allowedActions: ["read_context", "draft_artifact"],
  handoffTargets: [],
};

export const reviewerAgent: AgentDefinition = {
  role: "reviewer",
  displayName: "Reviewer",
  mission:
    "Review draft work for specification fit, safety boundaries, verification gaps, and commercial readiness before final synthesis.",
  allowedActions: ["read_context", "draft_artifact"],
  handoffTargets: [],
};

export function createSupervisorPlan(goal: string): SupervisorPlanResult {
  const normalizedGoal = goal.trim();
  if (normalizedGoal.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_goal",
        message: "Supervisor plan requires a non-empty goal.",
      },
    };
  }

  const steps: SupervisorPlanStep[] = [
    {
      id: "supervisor-plan",
      agent: "supervisor",
      title: "Clarify objective and success criteria",
      intent:
        "Frame the task, identify constraints, and decide the initial delegation order.",
      dependsOn: [],
    },
    {
      id: "researcher-context",
      agent: "researcher",
      title: "Gather project context",
      intent:
        "Read relevant local files, specs, and current run state before any draft work.",
      dependsOn: ["supervisor-plan"],
    },
    {
      id: "builder-draft",
      agent: "builder",
      title: "Draft implementation or artifact",
      intent:
        "Produce the smallest useful draft output while staying inside Read + Draft permissions.",
      dependsOn: ["researcher-context"],
    },
    {
      id: "reviewer-pass",
      agent: "reviewer",
      title: "Review quality and safety",
      intent:
        "Check correctness, safety boundaries, missing tests, and commercial quality before final summary.",
      dependsOn: ["builder-draft"],
    },
    {
      id: "supervisor-final",
      agent: "supervisor",
      title: "Synthesize final summary",
      intent:
        "Integrate reviewer feedback and produce an auditable final response for the user.",
      dependsOn: ["reviewer-pass"],
    },
  ];

  return {
    ok: true,
    plan: {
      goal: normalizedGoal,
      summary:
        "Supervisor will coordinate context gathering, draft output, independent review, and final synthesis.",
      steps,
    },
  };
}

export function createResearcherBrief(
  input: ResearcherBriefInput,
): ResearcherBriefResult {
  const normalizedGoal = input.goal.trim();
  if (normalizedGoal.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_goal",
        message: "Researcher brief requires a non-empty goal.",
      },
    };
  }

  const contextTargets = normalizeList(input.suggestedPaths);
  const constraints = normalizeList(input.knownConstraints);

  return {
    ok: true,
    brief: {
      goal: normalizedGoal,
      summary:
        "Researcher should inspect local context, identify constraints, and hand off a concise brief before any draft implementation.",
      contextTargets,
      constraints,
      handoffNotes: [
        "Do not write files, run shell commands, or make external requests from the researcher step.",
        "Return findings as structured context for Supervisor, Builder, and Reviewer.",
        contextTargets.length === 0
          ? "Ask Supervisor for target files or derive them through the approved orchestrator context flow."
          : "Use the listed context targets as the first-pass reading queue.",
      ],
    },
  };
}

export function createBuilderDraft(
  input: BuilderDraftInput,
): BuilderDraftResult {
  const normalizedGoal = input.goal.trim();
  if (normalizedGoal.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_goal",
        message: "Builder draft requires a non-empty goal.",
      },
    };
  }

  const contextNotes = normalizeList(input.contextNotes);
  const constraints = normalizeList(input.constraints);

  return {
    ok: true,
    draft: {
      goal: normalizedGoal,
      summary:
        "Builder should produce a minimal implementation draft and patch plan while staying inside Read + Draft permissions.",
      implementationNotes: [
        ...contextNotes,
        "Keep the draft scoped to the current task and defer unrelated refactors.",
        constraints.length === 0
          ? "Confirm task constraints with Supervisor before proposing side-effecting work."
          : "Apply the listed constraints before drafting any patch plan.",
      ],
      constraints,
      patchPlan: [
        {
          target: "docs",
          intent:
            "Update the relevant task specification, acceptance criteria, and task checklist before implementation.",
        },
        {
          target: "implementation",
          intent:
            "Draft the smallest code or artifact change that satisfies the current task boundary.",
        },
        {
          target: "qa",
          intent:
            "Prepare verification notes for typecheck, lint, build, behavior checks, and independent review.",
        },
      ],
      artifactDrafts: [
        {
          title: "Implementation plan",
          kind: "plan",
          purpose:
            "Explain the intended file changes and expected behavior before any write approval is requested.",
        },
        {
          title: "QA summary",
          kind: "summary",
          purpose:
            "Capture verification commands, review findings, and any bugs that must be tracked.",
        },
      ],
      safetyNotes: [
        "Do not write files, run shell commands, or make external requests from the builder draft step.",
        "Any proposed file write must become an approval request before execution.",
        "Reviewer should inspect the draft before Supervisor produces the final summary.",
      ],
    },
  };
}

export function createReviewerReport(
  input: ReviewerReportInput,
): ReviewerReportResult {
  const normalizedGoal = input.goal.trim();
  if (normalizedGoal.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_goal",
        message: "Reviewer report requires a non-empty goal.",
      },
    };
  }

  const acceptanceCriteria = normalizeList(input.acceptanceCriteria);
  const findings = normalizeList(input.findings);
  const risks = normalizeList(input.risks);
  const missingChecks = normalizeList(input.missingChecks);
  const draftSummary = input.draftSummary?.trim();
  const decision: ReviewDecision =
    findings.length === 0 && missingChecks.length === 0
      ? "pass"
      : "needs_changes";

  return {
    ok: true,
    report: {
      goal: normalizedGoal,
      summary:
        draftSummary && draftSummary.length > 0
          ? draftSummary
          : "Reviewer should evaluate the draft against acceptance criteria, safety boundaries, and verification evidence.",
      decision,
      acceptanceCriteria,
      findings,
      risks,
      missingChecks,
      safetyNotes: [
        "Do not write files, run shell commands, or make external requests from the reviewer step.",
        "Treat missing verification as a review concern even when no functional defect is found.",
        "Supervisor should synthesize the final response only after reviewer decision is understood.",
      ],
    },
  };
}

function normalizeList(items: readonly string[] | undefined): readonly string[] {
  if (!items) {
    return [];
  }

  const normalized = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}
