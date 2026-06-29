type EntityId = string;
type ISODateTimeString = string;

export const PLATFORM_EXTENSION_SURFACE_IDS = [
  "cron",
  "voice",
  "profiles",
  "remote-login",
  "gateway-messaging",
  "auto-update",
] as const;

export type PlatformExtensionSurfaceId =
  (typeof PLATFORM_EXTENSION_SURFACE_IDS)[number];

export const PLATFORM_EXTENSION_CATEGORIES = [
  "automation",
  "interaction",
  "identity",
  "messaging",
  "maintenance",
] as const;

export type PlatformExtensionCategory =
  (typeof PLATFORM_EXTENSION_CATEGORIES)[number];

export const PLATFORM_EXTENSION_STATUSES = [
  "planned",
  "blocked",
  "proposed",
] as const;

export type PlatformExtensionStatus =
  (typeof PLATFORM_EXTENSION_STATUSES)[number];

export type PlatformExtensionSurfaceStatus = PlatformExtensionStatus;

export const PLATFORM_EXTENSION_AUDIT_ACTIONS = [
  "register",
  "status_check",
  "connection_test",
] as const;

export type PlatformExtensionAuditAction =
  (typeof PLATFORM_EXTENSION_AUDIT_ACTIONS)[number];

export interface PlatformExtensionSurface {
  readonly id: PlatformExtensionSurfaceId;
  readonly label: string;
  readonly status: PlatformExtensionStatus;
  readonly category: PlatformExtensionCategory;
  readonly boundary: string;
  readonly detail: string;
  readonly nextStep: string;
}

export interface PlatformExtensionAuditRecord {
  readonly id: EntityId;
  readonly action: PlatformExtensionAuditAction;
  readonly summary: string;
  readonly createdAt: ISODateTimeString;
}

export interface PlatformExtensionSnapshot {
  readonly checkedAt: ISODateTimeString;
  readonly entries: readonly PlatformExtensionSurface[];
  readonly auditTrail: readonly PlatformExtensionAuditRecord[];
}

export interface CreatePlatformExtensionSnapshotInput {
  readonly checkedAt: ISODateTimeString;
  readonly auditAction?: Extract<
    PlatformExtensionAuditAction,
    "status_check" | "connection_test"
  >;
}

const PLATFORM_EXTENSION_ENTRIES: readonly PlatformExtensionSurface[] = [
  {
    id: "cron",
    label: "Cron",
    status: "planned",
    category: "automation",
    boundary: "Registry-only placeholder; no scheduling or dispatch.",
    detail:
      "Scheduled execution is not implemented. The panel only documents the candidate surface.",
    nextStep: "Design a dedicated scheduler proposal before adding cron work.",
  },
  {
    id: "voice",
    label: "Voice",
    status: "planned",
    category: "interaction",
    boundary: "Registry-only placeholder; no audio stack.",
    detail:
      "Voice input and output are not implemented. The panel only documents the candidate surface.",
    nextStep: "Approve a separate voice proposal before adding mic or TTS/STT.",
  },
  {
    id: "profiles",
    label: "Profiles",
    status: "planned",
    category: "identity",
    boundary: "Registry-only placeholder; no profile service.",
    detail:
      "Profile management is not implemented. The panel only documents the candidate surface.",
    nextStep: "Define profile storage and migration before exposing profiles.",
  },
  {
    id: "remote-login",
    label: "Remote login",
    status: "blocked",
    category: "identity",
    boundary: "Registry-only placeholder; local single-user only.",
    detail:
      "Remote authentication would widen the trust boundary beyond the current local build.",
    nextStep:
      "Start with a hosted auth and tenant-isolation proposal before any remote login work.",
  },
  {
    id: "gateway-messaging",
    label: "Gateway / messaging",
    status: "blocked",
    category: "messaging",
    boundary: "Registry-only placeholder; no transport bridge.",
    detail:
      "Gateway transport and inbox messaging are not implemented in the current build.",
    nextStep:
      "Draft transport, security, and audit requirements before adding a gateway bridge.",
  },
  {
    id: "auto-update",
    label: "Auto update",
    status: "proposed",
    category: "maintenance",
    boundary: "Registry-only placeholder; no update agent.",
    detail:
      "Automatic update and install flow are not implemented. The panel only documents the candidate surface.",
    nextStep:
      "Create a recoverable update proposal before shipping an updater.",
  },
];

export function createPlatformExtensionSurfaceCatalog(): readonly PlatformExtensionSurface[] {
  return PLATFORM_EXTENSION_ENTRIES;
}

export function createPlatformExtensionSnapshot(
  input: CreatePlatformExtensionSnapshotInput,
): PlatformExtensionSnapshot {
  const auditAction = input.auditAction ?? "status_check";
  return {
    checkedAt: input.checkedAt,
    entries: PLATFORM_EXTENSION_ENTRIES,
    auditTrail: [
      {
        id: "platform-extension-audit-register",
        action: "register",
        summary:
          "Platform extension registry initialized as a read-only snapshot.",
        createdAt: input.checkedAt,
      },
      {
        id: `platform-extension-audit-${auditAction}`,
        action: auditAction,
        summary:
          auditAction === "connection_test"
            ? "DeepSeek connection test refreshed the platform extension registry."
            : "DeepSeek status check refreshed the platform extension registry.",
        createdAt: input.checkedAt,
      },
    ],
  };
}

export interface PlatformExtensionRegistrySnapshot
  extends PlatformExtensionSnapshot {}

export type CreatePlatformExtensionRegistrySnapshotInput =
  CreatePlatformExtensionSnapshotInput;

export const createPlatformExtensionRegistrySnapshot =
  createPlatformExtensionSnapshot;

export function createEmptyPlatformExtensionSnapshot(
  checkedAt: ISODateTimeString,
): PlatformExtensionSnapshot {
  return createPlatformExtensionSnapshot({ checkedAt });
}
