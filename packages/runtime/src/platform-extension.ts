import {
  createEmptyPlatformExtensionSnapshot,
  createPlatformExtensionRegistrySnapshot,
  type CreatePlatformExtensionRegistrySnapshotInput,
  type PlatformExtensionSnapshot,
} from "@sage/shared";

export type CreatePlatformExtensionSnapshotInput =
  CreatePlatformExtensionRegistrySnapshotInput;

export function createPlatformExtensionSnapshot(
  input: CreatePlatformExtensionSnapshotInput,
): PlatformExtensionSnapshot {
  const baseSnapshot = createEmptyPlatformExtensionSnapshot(input.checkedAt);
  const snapshot = createPlatformExtensionRegistrySnapshot(input);

  return {
    ...snapshot,
    entries: baseSnapshot.entries,
  };
}
