import type {
  DeepSeekSettings,
  EntrySurfaceSnapshot,
  ISODateTimeString,
  ProviderDescriptor,
  ProviderId,
  ProviderRegistryAuditRecord,
  ProviderRegistrySnapshot,
  ProviderStatus,
} from "@sage/shared";
import {
  DEEPSEEK_MODELS,
  createDefaultEntrySurfaceSnapshot,
} from "@sage/shared";

export interface CreateProviderRegistrySnapshotInput {
  readonly deepSeek: {
    readonly configStatus: "valid" | "invalid";
    readonly apiKeyReadiness: "configured" | "missing";
    readonly baseUrl: string | null;
    readonly defaultModel: DeepSeekSettings["model"] | null;
    readonly thinkingEnabled: boolean | null;
    readonly reasoningEffort: DeepSeekSettings["reasoningEffort"] | null;
    readonly issueCodes: readonly string[];
  };
  readonly checkedAt: ISODateTimeString;
  readonly auditAction?: Extract<
    ProviderRegistryAuditRecord["action"],
    "status_check" | "connection_test"
  >;
}

export function createProviderRegistrySnapshot({
  deepSeek,
  checkedAt,
  auditAction = "status_check",
}: CreateProviderRegistrySnapshotInput): ProviderRegistrySnapshot {
  const provider = createDeepSeekProviderDescriptor(deepSeek, checkedAt);
  return {
    defaultProviderId: "deepseek",
    providers: [provider],
    fallbackRules: [
      {
        fromProviderId: "deepseek",
        toProviderId: "deepseek",
        mode: "disabled",
        reason:
          "Only DeepSeek is currently registered. Automatic fallback is disabled until another approved provider exists.",
      },
    ],
    auditTrail: [
      createProviderAuditRecord({
        action: "register",
        providerId: "deepseek",
        summary: "DeepSeek registered as the default local provider.",
        createdAt: checkedAt,
      }),
      createProviderAuditRecord({
        action: auditAction,
        providerId: "deepseek",
        summary: summarizeProviderStatus(provider),
        createdAt: checkedAt,
      }),
    ],
  };
}

export function createEntrySurfaceSnapshot(): EntrySurfaceSnapshot {
  return createDefaultEntrySurfaceSnapshot();
}

function createDeepSeekProviderDescriptor(
  deepSeek: CreateProviderRegistrySnapshotInput["deepSeek"],
  checkedAt: ISODateTimeString,
): ProviderDescriptor {
  return {
    id: "deepseek",
    label: "DeepSeek Provider",
    kind: "deepseek",
    status: getDeepSeekProviderStatus(deepSeek),
    isDefault: true,
    supportsThinking: true,
    supportedModels: [...DEEPSEEK_MODELS],
    defaultSettings: {
      model: deepSeek.defaultModel ?? "deepseek-chat",
      thinkingEnabled: deepSeek.thinkingEnabled ?? true,
      reasoningEffort: deepSeek.reasoningEffort ?? "high",
    },
    baseUrl: deepSeek.baseUrl,
    issueCodes: deepSeek.issueCodes,
    checkedAt,
  };
}

function getDeepSeekProviderStatus(
  deepSeek: CreateProviderRegistrySnapshotInput["deepSeek"],
): ProviderStatus {
  if (deepSeek.configStatus === "invalid") return "invalid_config";
  if (deepSeek.apiKeyReadiness === "missing") return "missing_credentials";
  if (deepSeek.issueCodes.length > 0) return "degraded";
  return "available";
}

function createProviderAuditRecord(input: {
  readonly action: ProviderRegistryAuditRecord["action"];
  readonly providerId: ProviderId;
  readonly summary: string;
  readonly createdAt: ISODateTimeString;
}): ProviderRegistryAuditRecord {
  return {
    id: `provider-audit-${input.providerId}-${input.action}`,
    action: input.action,
    providerId: input.providerId,
    summary: input.summary,
    createdAt: input.createdAt,
  };
}

function summarizeProviderStatus(provider: ProviderDescriptor): string {
  const issues =
    provider.issueCodes.length > 0
      ? ` issues=${provider.issueCodes.join(",")}`
      : "";
  return `${provider.label} status=${provider.status}${issues}`;
}
