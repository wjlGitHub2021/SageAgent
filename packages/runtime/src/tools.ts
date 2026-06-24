import type { AgentRole, ApprovalAction } from "@sage/shared";

export const TOOL_NAMES = [
  "read_project_file",
  "draft_patch",
  "draft_artifact",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolKind = "read" | "draft";

export interface ToolDefinition {
  readonly name: ToolName;
  readonly kind: ToolKind;
  readonly description: string;
  readonly allowedAgents: readonly AgentRole[];
  readonly requiresApproval: boolean;
  readonly approvalAction: ApprovalAction | null;
}

export const READ_DRAFT_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: "read_project_file",
    kind: "read",
    description:
      "Declare intent to read a local project file through the approved read-only context flow.",
    allowedAgents: ["researcher", "builder", "reviewer"],
    requiresApproval: false,
    approvalAction: null,
  },
  {
    name: "draft_patch",
    kind: "draft",
    description:
      "Draft a patch plan or patch content without applying changes to the workspace.",
    allowedAgents: ["builder"],
    requiresApproval: false,
    approvalAction: null,
  },
  {
    name: "draft_artifact",
    kind: "draft",
    description:
      "Draft a plan, summary, document, or other artifact without persisting it.",
    allowedAgents: ["researcher", "builder", "reviewer"],
    requiresApproval: false,
    approvalAction: null,
  },
];

const TOOL_DEFINITIONS_BY_NAME = new Map<ToolName, ToolDefinition>(
  READ_DRAFT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

export function listToolDefinitions(): readonly ToolDefinition[] {
  return READ_DRAFT_TOOL_DEFINITIONS;
}

export function getToolDefinition(
  name: string,
): ToolDefinition | undefined {
  if (!isToolName(name)) {
    return undefined;
  }

  return TOOL_DEFINITIONS_BY_NAME.get(name);
}

export function canAgentUseTool(
  agent: AgentRole,
  toolName: string,
): boolean {
  const definition = getToolDefinition(toolName);
  if (!definition) {
    return false;
  }

  return definition.allowedAgents.includes(agent);
}

export function requiresToolApproval(toolName: string): boolean {
  const definition = getToolDefinition(toolName);
  if (!definition) {
    return true;
  }

  return definition.requiresApproval;
}

function isToolName(name: string): name is ToolName {
  return TOOL_NAMES.includes(name as ToolName);
}
