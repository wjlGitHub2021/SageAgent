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

function normalizeList(items: readonly string[] | undefined): readonly string[] {
  if (!items) {
    return [];
  }

  const normalized = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}
