import type {
  DeepSeekSettings,
  EntityId,
  ISODateTimeString,
} from "./index.js";

export const PROVIDER_IDS = ["deepseek"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_KINDS = ["deepseek", "openai-compatible"] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const PROVIDER_STATUSES = [
  "available",
  "degraded",
  "missing_credentials",
  "invalid_config",
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_FALLBACK_MODES = ["disabled", "manual"] as const;

export type ProviderFallbackMode = (typeof PROVIDER_FALLBACK_MODES)[number];

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly label: string;
  readonly kind: ProviderKind;
  readonly status: ProviderStatus;
  readonly isDefault: boolean;
  readonly supportsThinking: boolean;
  readonly supportedModels: readonly DeepSeekSettings["model"][];
  readonly defaultSettings: DeepSeekSettings;
  readonly baseUrl: string | null;
  readonly issueCodes: readonly string[];
  readonly checkedAt: ISODateTimeString;
}

export interface ProviderFallbackRule {
  readonly fromProviderId: ProviderId;
  readonly toProviderId: ProviderId;
  readonly mode: ProviderFallbackMode;
  readonly reason: string;
}

export interface ProviderRegistrySnapshot {
  readonly defaultProviderId: ProviderId;
  readonly providers: readonly ProviderDescriptor[];
  readonly fallbackRules: readonly ProviderFallbackRule[];
  readonly auditTrail: readonly ProviderRegistryAuditRecord[];
}

export interface ProviderRegistryAuditRecord {
  readonly id: EntityId;
  readonly action:
    | "register"
    | "status_check"
    | "connection_test"
    | "fallback_blocked";
  readonly providerId: ProviderId;
  readonly summary: string;
  readonly createdAt: ISODateTimeString;
}

export interface AgentEntrySurface {
  readonly id: "web" | "desktop";
  readonly label: string;
  readonly status: "active" | "planned";
  readonly sharedStateModel: "run-workbench";
  readonly detail: string;
}

export interface EntrySurfaceSnapshot {
  readonly primarySurfaceId: AgentEntrySurface["id"];
  readonly surfaces: readonly AgentEntrySurface[];
}

export function createEmptyProviderRegistrySnapshot(
  checkedAt: ISODateTimeString,
): ProviderRegistrySnapshot {
  return {
    defaultProviderId: "deepseek",
    providers: [],
    fallbackRules: [
      {
        fromProviderId: "deepseek",
        toProviderId: "deepseek",
        mode: "disabled",
        reason:
          "Only DeepSeek is configured in the local single-user build; fallback is auditable but not automatic.",
      },
    ],
    auditTrail: [
      {
        id: "provider-audit-empty",
        action: "register",
        providerId: "deepseek",
        summary: "Provider registry initialized without configured providers.",
        createdAt: checkedAt,
      },
    ],
  };
}

export function createDefaultEntrySurfaceSnapshot(): EntrySurfaceSnapshot {
  return {
    primarySurfaceId: "web",
    surfaces: [
      {
        id: "web",
        label: "Web workbench",
        status: "active",
        sharedStateModel: "run-workbench",
        detail:
          "Current local workbench for runs, timeline, tool calls, approvals, artifacts, memory, skills, and provider state.",
      },
      {
        id: "desktop",
        label: "Desktop shell",
        status: "planned",
        sharedStateModel: "run-workbench",
        detail:
          "Future desktop entry reuses the same provider registry, run state, and inspector model.",
      },
    ],
  };
}

export type PlatformEntrySurfaceSnapshot = EntrySurfaceSnapshot;
