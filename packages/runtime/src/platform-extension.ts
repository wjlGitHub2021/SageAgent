import {
  createPlatformExtensionSnapshot as createSharedPlatformExtensionSnapshot,
  type CreatePlatformExtensionSnapshotInput,
  type PlatformExtensionSnapshot,
} from "@sage/shared";

export type { CreatePlatformExtensionSnapshotInput };

export function createPlatformExtensionSnapshot(
  input: CreatePlatformExtensionSnapshotInput,
): PlatformExtensionSnapshot {
  return createSharedPlatformExtensionSnapshot(input);
}
