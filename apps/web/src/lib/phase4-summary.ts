import type { ReviewDecision } from "@sage/agents";
import type { Artifact, EntityId, RunEvent, Step } from "@sage/shared";

type JsonRecord = Record<string, unknown>;

export type Phase4SectionStatus = Step["status"] | "missing";

export interface Phase4SupervisorSnapshot {
  readonly status: Phase4SectionStatus;
  readonly summary: string | null;
  readonly stepTitles: readonly string[];
}

export interface Phase4ResearcherSnapshot {
  readonly status: Phase4SectionStatus;
  readonly summary: string | null;
  readonly contextTargets: readonly string[];
  readonly constraints: readonly string[];
  readonly handoffNotes: readonly string[];
}

export interface Phase4BuilderSnapshot {
  readonly status: Phase4SectionStatus;
  readonly summary: string | null;
  readonly implementationNotes: readonly string[];
  readonly patchTargets: readonly string[];
  readonly artifactDraftTitles: readonly string[];
  readonly safetyNotes: readonly string[];
}

export interface Phase4ReviewerSnapshot {
  readonly status: Phase4SectionStatus;
  readonly summary: string | null;
  readonly decision: ReviewDecision | null;
  readonly acceptanceCriteria: readonly string[];
  readonly findings: readonly string[];
  readonly risks: readonly string[];
  readonly missingChecks: readonly string[];
  readonly safetyNotes: readonly string[];
}

export interface Phase4FinalSummaryGateSnapshot {
  readonly status: "missing" | "ready" | "blocked";
  readonly reviewerDecision: ReviewDecision | null;
  readonly summary: string | null;
  readonly findings: readonly string[];
  readonly risks: readonly string[];
  readonly missingChecks: readonly string[];
}

export interface Phase4ArtifactSummary {
  readonly id: EntityId;
  readonly title: string;
  readonly kind: Artifact["kind"];
  readonly summary: string | null;
}

export interface Phase4RunSummary {
  readonly hasData: boolean;
  readonly supervisor: Phase4SupervisorSnapshot;
  readonly researcher: Phase4ResearcherSnapshot;
  readonly builder: Phase4BuilderSnapshot;
  readonly reviewer: Phase4ReviewerSnapshot;
  readonly finalSummaryGate: Phase4FinalSummaryGateSnapshot;
  readonly artifacts: readonly Phase4ArtifactSummary[];
}

interface ParsedArtifactRecord {
  readonly artifact: Artifact;
  readonly content: JsonRecord | null;
}

interface LatestStepRecord {
  readonly step: Step;
  readonly source: JsonRecord | null;
}

export function getPhase4RunSummary(
  events: readonly RunEvent[],
  runId: EntityId,
): Phase4RunSummary {
  const runEvents = getEventsForRun(events, runId);
  const stepsByAgent = collectLatestStepRecords(runEvents);
  const artifactsByTitle = collectArtifacts(runEvents);
  const phase4Artifacts = [...artifactsByTitle.values()].filter(
    (record) =>
      isPhase4ArtifactTitle(record.artifact.title, "supervisor") ||
      isPhase4ArtifactTitle(record.artifact.title, "researcher") ||
      isPhase4ArtifactTitle(record.artifact.title, "builder") ||
      isPhase4ArtifactTitle(record.artifact.title, "reviewer"),
  );

  const supervisor = buildSupervisorSnapshot(
    stepsByAgent.get("supervisor"),
    artifactsByTitle.get("Supervisor Plan"),
  );
  const researcher = buildResearcherSnapshot(
    stepsByAgent.get("researcher"),
    artifactsByTitle.get("Researcher Brief"),
  );
  const builder = buildBuilderSnapshot(
    stepsByAgent.get("builder"),
    artifactsByTitle.get("Builder Draft"),
  );
  const reviewer = buildReviewerSnapshot(
    stepsByAgent.get("reviewer"),
    artifactsByTitle.get("Reviewer Report"),
  );

  const finalSummaryGate = buildFinalSummaryGateSnapshot(reviewer);
  const artifacts = phase4Artifacts
    .toSorted(
      (left, right) =>
        left.artifact.createdAt.localeCompare(right.artifact.createdAt) ||
        left.artifact.id.localeCompare(right.artifact.id),
    )
    .map(({ artifact, content }) => ({
      id: artifact.id,
      title: artifact.title,
      kind: artifact.kind,
      summary:
        readString(content?.summary) ?? readString(content?.decision) ?? null,
    }));

  const hasData =
    artifacts.length > 0 ||
    supervisor.status !== "missing" ||
    researcher.status !== "missing" ||
    builder.status !== "missing" ||
    reviewer.status !== "missing";

  return {
    hasData,
    supervisor,
    researcher,
    builder,
    reviewer,
    finalSummaryGate,
    artifacts,
  };
}

function buildSupervisorSnapshot(
  stepRecord: LatestStepRecord | undefined,
  artifactRecord: ParsedArtifactRecord | undefined,
): Phase4SupervisorSnapshot {
  const source = selectPhase4Source(
    stepRecord,
    artifactRecord,
    "supervisor",
  );
  return {
    status: source ? stepRecord?.step.status ?? "missing" : "missing",
    summary: readString(source?.summary),
    stepTitles: readRecordArray(source?.steps)
      .map((item) => readString(item.title))
      .filter((title): title is string => title !== null),
  };
}

function buildResearcherSnapshot(
  stepRecord: LatestStepRecord | undefined,
  artifactRecord: ParsedArtifactRecord | undefined,
): Phase4ResearcherSnapshot {
  const source = selectPhase4Source(
    stepRecord,
    artifactRecord,
    "researcher",
  );
  return {
    status: source ? stepRecord?.step.status ?? "missing" : "missing",
    summary: readString(source?.summary),
    contextTargets: readStringArrayFromKeys(source, [
      "contextTargets",
      "targets",
    ]),
    constraints: readStringArrayFromKeys(source, ["constraints"]),
    handoffNotes: readStringArrayFromKeys(source, ["handoffNotes"]),
  };
}

function buildBuilderSnapshot(
  stepRecord: LatestStepRecord | undefined,
  artifactRecord: ParsedArtifactRecord | undefined,
): Phase4BuilderSnapshot {
  const source = selectPhase4Source(stepRecord, artifactRecord, "builder");
  return {
    status: source ? stepRecord?.step.status ?? "missing" : "missing",
    summary: readString(source?.summary),
    implementationNotes: readStringArrayFromKeys(source, [
      "implementationNotes",
    ]),
    patchTargets: readRecordArrayFromKeys(source, ["patchPlan", "patches"])
      .map((item) => readString(item.target))
      .filter((target): target is string => target !== null),
    artifactDraftTitles: readRecordArrayFromKeys(source, ["artifactDrafts"])
      .map((item) => readString(item.title))
      .filter((title): title is string => title !== null),
    safetyNotes: readStringArrayFromKeys(source, ["safetyNotes"]),
  };
}

function buildReviewerSnapshot(
  stepRecord: LatestStepRecord | undefined,
  artifactRecord: ParsedArtifactRecord | undefined,
): Phase4ReviewerSnapshot {
  const source = selectPhase4Source(stepRecord, artifactRecord, "reviewer");
  return {
    status: source ? stepRecord?.step.status ?? "missing" : "missing",
    summary: readString(source?.summary),
    decision: readReviewDecision(source?.decision),
    acceptanceCriteria: readStringArrayFromKeys(source, [
      "acceptanceCriteria",
    ]),
    findings: readStringArrayFromKeys(source, ["findings"]),
    risks: readStringArrayFromKeys(source, ["risks"]),
    missingChecks: readStringArrayFromKeys(source, ["missingChecks"]),
    safetyNotes: readStringArrayFromKeys(source, ["safetyNotes"]),
  };
}

function buildFinalSummaryGateSnapshot(
  reviewer: Phase4ReviewerSnapshot,
): Phase4FinalSummaryGateSnapshot {
  if (reviewer.status === "missing") {
    return {
      status: "missing",
      reviewerDecision: null,
      summary: null,
      findings: [],
      risks: [],
      missingChecks: [],
    };
  }

  if (reviewer.decision !== "pass") {
    return {
      status: "blocked",
      reviewerDecision: reviewer.decision,
      summary: reviewer.summary,
      findings: reviewer.findings,
      risks: reviewer.risks,
      missingChecks: reviewer.missingChecks,
    };
  }

  return {
    status: "ready",
    reviewerDecision: "pass",
    summary: reviewer.summary,
    findings: reviewer.findings,
    risks: reviewer.risks,
    missingChecks: reviewer.missingChecks,
  };
}

function collectLatestStepRecords(
  events: readonly RunEvent[],
): Map<string, LatestStepRecord> {
  const latest = new Map<string, LatestStepRecord>();

  for (const event of events) {
    if (!isStepEvent(event)) continue;

    latest.set(event.payload.step.agent, {
      step: event.payload.step,
      source: isPlainRecord(event.payload.step.output)
        ? event.payload.step.output
        : null,
    });
  }

  return latest;
}

function collectArtifacts(
  events: readonly RunEvent[],
): Map<string, ParsedArtifactRecord> {
  const latest = new Map<string, ParsedArtifactRecord>();

  for (const event of events) {
    if (event.type !== "artifact.created") continue;

    latest.set(event.payload.artifact.title, {
      artifact: event.payload.artifact,
      content: parseJsonRecord(event.payload.artifact.content),
    });
  }

  return latest;
}

function selectPhase4Source(
  stepRecord: LatestStepRecord | undefined,
  artifactRecord: ParsedArtifactRecord | undefined,
  agent: "supervisor" | "researcher" | "builder" | "reviewer",
): JsonRecord | null {
  if (artifactRecord && isPhase4ArtifactTitle(artifactRecord.artifact.title, agent)) {
    return artifactRecord.content;
  }

  if (
    stepRecord &&
    isPhase4StepTitle(stepRecord.step.title, agent) &&
    stepRecord.source
  ) {
    return stepRecord.source;
  }

  return null;
}

function getEventsForRun(
  events: readonly RunEvent[],
  runId: EntityId,
): RunEvent[] {
  return events
    .filter((event) => event.runId === runId)
    .toSorted(
      (left, right) =>
        left.sequence - right.sequence ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
}

function isStepEvent(
  event: RunEvent,
): event is Extract<
  RunEvent,
  { type: "step.started" | "step.completed" | "step.failed" }
> {
  return (
    event.type === "step.started" ||
    event.type === "step.completed" ||
    event.type === "step.failed"
  );
}

function parseJsonRecord(value: string | null): JsonRecord | null {
  if (value === null) return null;

  try {
    const parsed = JSON.parse(value);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArrayFromKeys(
  record: JsonRecord | null,
  keys: readonly string[],
): readonly string[] {
  for (const key of keys) {
    const values = readStringArray(record?.[key]);
    if (values.length > 0) return values;
  }

  return [];
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];

  return normalizeStrings(
    value.map((item) => readString(item)).filter((item): item is string => item !== null),
  );
}

function readRecordArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isPlainRecord);
}

function readRecordArrayFromKeys(
  record: JsonRecord | null,
  keys: readonly string[],
): JsonRecord[] {
  for (const key of keys) {
    const values = readRecordArray(record?.[key]);
    if (values.length > 0) return values;
  }

  return [];
}

function readReviewDecision(value: unknown): ReviewDecision | null {
  return value === "pass" || value === "needs_changes" ? value : null;
}

function normalizeStrings(items: readonly string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPhase4ArtifactTitle(
  title: string,
  agent: "supervisor" | "researcher" | "builder" | "reviewer",
): boolean {
  switch (agent) {
    case "supervisor":
      return title === "Supervisor Plan";
    case "researcher":
      return title === "Researcher Brief";
    case "builder":
      return title === "Builder Draft";
    case "reviewer":
      return title === "Reviewer Report";
  }
}

function isPhase4StepTitle(
  title: string,
  agent: "supervisor" | "researcher" | "builder" | "reviewer",
): boolean {
  switch (agent) {
    case "supervisor":
      return title === "Plan multi-agent run";
    case "researcher":
      return title === "Gather project context";
    case "builder":
      return title === "Draft implementation";
    case "reviewer":
      return title === "Review quality and safety";
  }
}
