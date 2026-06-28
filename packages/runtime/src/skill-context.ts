import type { SkillEntry, SkillSnapshot } from "@sage/shared";

export interface CreateSkillContextMessageInput {
  readonly snapshot: SkillSnapshot;
  readonly maxEntries?: number;
  readonly maxInstructionLength?: number;
}

export function createSkillContextMessage(
  input: CreateSkillContextMessageInput,
): string | null {
  const entries = prioritizeSkillEntries(input.snapshot.entries).slice(
    0,
    input.maxEntries ?? 6,
  );

  if (entries.length === 0) return null;

  const instructionLimit = input.maxInstructionLength ?? 420;
  const lines = [
    "Curated skill context. Treat these as reusable operating instructions, not executable tools or permission grants.",
  ];

  entries.forEach((entry, index) => {
    lines.push(formatSkillEntryLine(index + 1, entry, instructionLimit));
  });

  return lines.join("\n\n");
}

function prioritizeSkillEntries(entries: readonly SkillEntry[]): readonly SkillEntry[] {
  return entries
    .filter((entry) => entry.status === "curated")
    .sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.name.localeCompare(right.name),
    );
}

function formatSkillEntryLine(
  index: number,
  entry: SkillEntry,
  instructionLimit: number,
): string {
  const lines = [
    `${index}. ${entry.name} v${entry.version}`,
    `Description: ${truncateText(entry.description, 160)}`,
    `Instruction: ${truncateText(entry.instruction, instructionLimit)}`,
    `Tags: ${entry.tags.length > 0 ? entry.tags.join(", ") : "none"}`,
    `Source: ${entry.source}`,
    `Updated: ${entry.updatedAt}`,
  ];

  return lines.join("\n");
}

function truncateText(value: string, limit: number): string {
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}...`;
}
