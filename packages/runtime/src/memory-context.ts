import type { MemoryEntry, MemorySnapshot } from "@sage/shared";

export interface CreateMemoryContextMessageInput {
  readonly snapshot: MemorySnapshot;
  readonly currentThreadId?: string | null;
  readonly currentRunId?: string | null;
  readonly maxEntries?: number;
  readonly maxContentLength?: number;
}

export function createMemoryContextMessage(
  input: CreateMemoryContextMessageInput,
): string | null {
  const entries = prioritizeMemoryEntries(
    input.snapshot.entries,
    input.currentThreadId ?? null,
    input.currentRunId ?? null,
  ).slice(0, input.maxEntries ?? 8);

  if (entries.length === 0) return null;

  const contentLimit = input.maxContentLength ?? 240;
  const lines = [
    "Persisted memory context. Treat these as durable project/user memory, not transient run output.",
  ];

  entries.forEach((entry, index) => {
    lines.push(formatMemoryEntryLine(index + 1, entry, contentLimit));
  });

  return lines.join("\n\n");
}

function prioritizeMemoryEntries(
  entries: readonly MemoryEntry[],
  currentThreadId: string | null,
  currentRunId: string | null,
): readonly MemoryEntry[] {
  return [...entries].sort((left, right) => {
    const leftPriority = getMemoryPriority(left, currentThreadId, currentRunId);
    const rightPriority = getMemoryPriority(right, currentThreadId, currentRunId);
    return (
      leftPriority - rightPriority ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title)
    );
  });
}

function getMemoryPriority(
  entry: MemoryEntry,
  currentThreadId: string | null,
  currentRunId: string | null,
): number {
  if (currentRunId !== null && entry.sourceRunId === currentRunId) return 0;
  if (currentThreadId !== null && entry.sourceThreadId === currentThreadId) {
    return 1;
  }

  switch (entry.scope) {
    case "workspace":
      return 2;
    case "preference":
      return 3;
    case "constraint":
      return 4;
    case "insight":
      return 5;
    case "thread":
      return 6;
    case "run":
      return 7;
    default:
      return 8;
  }
}

function formatMemoryEntryLine(
  index: number,
  entry: MemoryEntry,
  contentLimit: number,
): string {
  const lines = [
    `${index}. [${entry.scope}] ${entry.title}`,
    `Content: ${truncateText(entry.content, contentLimit)}`,
    `Tags: ${entry.tags.length > 0 ? entry.tags.join(", ") : "none"}`,
    `Source: ${formatNullableId("thread", entry.sourceThreadId)} · ${formatNullableId("run", entry.sourceRunId)}`,
    `Updated: ${entry.updatedAt}`,
  ];

  return lines.join("\n");
}

function formatNullableId(label: string, value: string | null): string {
  return value === null ? `${label}=none` : `${label}=${value}`;
}

function truncateText(value: string, limit: number): string {
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}
