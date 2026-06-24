import type {
  Artifact,
  ArtifactKind,
  EntityId,
  ISODateTimeString,
} from "@sage/shared";

export interface CreateFinalArtifactInput {
  readonly id: EntityId;
  readonly runId: EntityId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly content: string;
  readonly path?: string | null;
  readonly createdAt: ISODateTimeString;
}

export interface FinalArtifactSummary {
  readonly id: EntityId;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly hasPath: boolean;
  readonly contentLength: number;
}

export interface ArtifactFlowIssue {
  readonly code: "invalid_artifact_input";
  readonly message: string;
}

export type CreateFinalArtifactResult =
  | {
      readonly ok: true;
      readonly artifact: Artifact;
    }
  | {
      readonly ok: false;
      readonly issue: ArtifactFlowIssue;
    };

export function createFinalArtifact(
  input: CreateFinalArtifactInput,
): CreateFinalArtifactResult {
  const validationIssue = validateFinalArtifactInput(input);
  if (validationIssue) {
    return {
      ok: false,
      issue: validationIssue,
    };
  }

  const normalizedPath = input.path?.trim() ?? null;

  return {
    ok: true,
    artifact: {
      id: input.id.trim(),
      runId: input.runId.trim(),
      kind: input.kind,
      title: input.title.trim(),
      content: input.content.trim(),
      path: normalizedPath && normalizedPath.length > 0 ? normalizedPath : null,
      createdAt: input.createdAt.trim(),
    },
  };
}

export function createFinalArtifactSummary(
  artifact: Artifact,
): FinalArtifactSummary {
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    hasPath: artifact.path !== null && artifact.path.trim().length > 0,
    contentLength: artifact.content?.length ?? 0,
  };
}

function validateFinalArtifactInput(
  input: CreateFinalArtifactInput,
): ArtifactFlowIssue | null {
  if (input.id.trim().length === 0) {
    return invalidArtifactInput("Artifact id is required.");
  }

  if (input.runId.trim().length === 0) {
    return invalidArtifactInput("Artifact runId is required.");
  }

  if (input.title.trim().length === 0) {
    return invalidArtifactInput("Artifact title is required.");
  }

  if (input.content.trim().length === 0) {
    return invalidArtifactInput("Artifact content is required.");
  }

  if (input.createdAt.trim().length === 0) {
    return invalidArtifactInput("Artifact createdAt timestamp is required.");
  }

  return null;
}

function invalidArtifactInput(message: string): ArtifactFlowIssue {
  return {
    code: "invalid_artifact_input",
    message,
  };
}
