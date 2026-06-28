import type { EntityId, ISODateTimeString } from "./index.js";

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
  "boundary_update",
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

export interface CreatePlatformExtensionRegistrySnapshotInput {
  readonly checkedAt: ISODateTimeString;
  readonly auditAction?: Extract<
    PlatformExtensionAuditAction,
    "status_check" | "connection_test" | "boundary_update"
  >;
}

export interface PlatformExtensionRegistrySnapshot {
  readonly checkedAt: ISODateTimeString;
  readonly entries: readonly PlatformExtensionSurface[];
  readonly auditTrail: readonly PlatformExtensionAuditRecord[];
}

export type PlatformExtensionSnapshot = PlatformExtensionRegistrySnapshot;

export const PLATFORM_EXTENSION_ENTRIES: readonly PlatformExtensionSurface[] = [
  {
    id: "cron",
    label: "Cron",
    status: "planned",
    category: "automation",
    boundary: "Registry-only placeholder; no scheduling or dispatch.",
    detail:
      "Scheduled tasks are not executed in the current build. The panel only documents the future surface.",
    nextStep: "Ship a separate automation proposal before any scheduler is added.",
  },
  {
    id: "voice",
    label: "Voice",
    status: "planned",
    category: "interaction",
    boundary: "Registry-only placeholder; no audio stack.",
    detail:
      "Voice input and output are not implemented yet. This registry keeps the future entry visible.",
    nextStep: "Approve a dedicated voice proposal before audio tooling is added.",
  },
  {
    id: "profiles",
    label: "Profiles",
    status: "planned",
    category: "identity",
    boundary: "Registry-only placeholder; no profile service.",
    detail:
      "Profile selection and profile storage are not available in the current single-user build.",
    nextStep: "Define a profile model and migration path in a separate proposal.",
  },
  {
    id: "remote-login",
    label: "Remote login",
    status: "blocked",
    category: "identity",
    boundary: "Registry-only placeholder; local single-user only.",
    detail:
      "Remote sign-in would expand the trust boundary beyond the current local product scope.",
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
      "Gateway transport would add external surfaces and message delivery concerns that are out of scope now.",
    nextStep:
      "Draft a gateway and messaging proposal with security and audit requirements first.",
  },
  {
    id: "auto-update",
    label: "Auto update",
    status: "proposed",
    category: "maintenance",
    boundary: "Registry-only placeholder; no update agent.",
    detail:
      "Self-update and channel management are not implemented yet and need a recoverable installation plan.",
    nextStep:
      "Create a dedicated update and migration proposal before adding an updater.",
  },
] as const;

export function createPlatformExtensionSurfaceCatalog(): readonly PlatformExtensionSurface[] {
  return PLATFORM_EXTENSION_ENTRIES;
}

export function createPlatformExtensionRegistrySnapshot(
  input: CreatePlatformExtensionRegistrySnapshotInput,
): PlatformExtensionRegistrySnapshot {
  const auditAction = input.auditAction ?? "status_check";
  return {
    checkedAt: input.checkedAt,
    entries: PLATFORM_EXTENSION_ENTRIES,
    auditTrail: [
      {
        id: "platform-extension-audit-register",
        action: "register",
        summary: "Platform extension registry initialized with candidate surfaces.",
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

export function createEmptyPlatformExtensionSnapshot(
  checkedAt: ISODateTimeString,
): PlatformExtensionRegistrySnapshot {
  return createPlatformExtensionRegistrySnapshot({ checkedAt });
}
