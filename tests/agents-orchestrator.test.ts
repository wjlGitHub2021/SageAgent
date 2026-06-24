import { describe, expect, it } from "vitest";

import {
  createBuilderDraft,
  createReviewerReport,
  createSupervisorPlan,
  researcherAgent,
  supervisorAgent,
} from "@sage/agents";
import { createDelegationFlow, createFinalSummaryGate } from "@sage/runtime";

describe("agents and orchestrator", () => {
  it("defines a supervisor-led handoff model", () => {
    expect(supervisorAgent.handoffTargets).toEqual([
      "researcher",
      "builder",
      "reviewer",
    ]);
    expect(researcherAgent.allowedActions).toContain("read_context");
    expect(researcherAgent.allowedActions).not.toContain("request_handoff");
  });

  it("creates a deterministic supervisor plan with reviewer gate before final synthesis", () => {
    const result = createSupervisorPlan(" Build Sage Agent ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.goal).toBe("Build Sage Agent");
    expect(result.plan.steps.map((step) => step.agent)).toEqual([
      "supervisor",
      "researcher",
      "builder",
      "reviewer",
      "supervisor",
    ]);
    expect(result.plan.steps.at(-1)?.dependsOn).toEqual(["reviewer-pass"]);
  });

  it("rejects invalid goals at agent and orchestration boundaries", () => {
    expect(createSupervisorPlan(" ")).toMatchObject({
      ok: false,
      issue: { code: "invalid_goal" },
    });
    expect(
      createDelegationFlow({
        goal: "",
      }),
    ).toMatchObject({
      ok: false,
      issue: {
        code: "invalid_goal",
        stage: "supervisor",
      },
    });
  });

  it("runs the multi-agent happy path and passes reviewer gate", () => {
    const flowResult = createDelegationFlow({
      goal: "Add a local audit trail",
      suggestedPaths: ["docs/STAGE5_SPEC.md", "apps/web/src/app/page.tsx"],
      knownConstraints: ["No real provider call"],
      acceptanceCriteria: ["Tests pass", "No approval bypass"],
    });

    expect(flowResult.ok).toBe(true);
    if (!flowResult.ok) return;
    expect(flowResult.flow.steps.map((step) => step.agent)).toEqual([
      "supervisor",
      "researcher",
      "builder",
      "reviewer",
    ]);
    expect(flowResult.flow.reviewerDecision).toBe("pass");

    expect(
      createFinalSummaryGate({
        reviewerReport: flowResult.flow.reviewerReport,
      }),
    ).toMatchObject({
      ok: true,
      ready: {
        reviewerDecision: "pass",
      },
    });
  });

  it("keeps builder drafts read-and-draft only and blocks final summary on review findings", () => {
    const builder = createBuilderDraft({
      goal: "Draft implementation",
      contextNotes: ["Use existing runtime store"],
      constraints: ["No shell execution"],
    });
    expect(builder.ok).toBe(true);
    if (!builder.ok) return;
    expect(builder.draft.safetyNotes.join(" ")).toContain(
      "Any proposed file write must become an approval request",
    );

    const report = createReviewerReport({
      goal: "Draft implementation",
      draftSummary: builder.draft.summary,
      findings: ["Missing test coverage"],
      missingChecks: ["rtk pnpm test"],
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.report.decision).toBe("needs_changes");

    expect(
      createFinalSummaryGate({
        reviewerReport: report.report,
      }),
    ).toMatchObject({
      ok: false,
      blocked: {
        code: "reviewer_needs_changes",
        findings: ["Missing test coverage"],
        missingChecks: ["rtk pnpm test"],
      },
    });
  });
});
