import {
  getDeepSeekApiKeyReadyState,
  loadDeepSeekProviderConfig,
  requireDeepSeekApiKey,
  type DeepSeekConfigResult,
  type DeepSeekEnvironment,
} from "@sage/deepseek";
import {
  createEntrySurfaceSnapshot,
  createProviderRegistrySnapshot,
  createPlatformExtensionSnapshot,
} from "@sage/runtime";
import type {
  DeepSeekModel,
  ProviderRegistryAuditRecord,
  ProviderRegistrySnapshot,
  ReasoningEffort,
  PlatformExtensionSnapshot,
  EntrySurfaceSnapshot,
} from "@sage/shared";

export type DeepSeekProviderConfigStatus = "valid" | "invalid";
export type DeepSeekApiKeyReadiness = "configured" | "missing";
export type DeepSeekConnectionTestCode =
  | "ok"
  | "missing_api_key"
  | "http_error"
  | "network_error"
  | "invalid_response"
  | "invalid_config";

export type DeepSeekProviderStatusSummary = {
  readonly configStatus: DeepSeekProviderConfigStatus;
  readonly apiKeyReadiness: DeepSeekApiKeyReadiness;
  readonly baseUrl: string | null;
  readonly defaultModel: DeepSeekModel | null;
  readonly thinkingEnabled: boolean | null;
  readonly reasoningEffort: ReasoningEffort | null;
  readonly issueCodes: readonly string[];
};

export type DeepSeekConnectionTestResult = {
  readonly ok: boolean;
  readonly code: DeepSeekConnectionTestCode;
  readonly message: string;
  readonly nextStep: string;
  readonly checkedAt: string;
  readonly status?: number;
};

export type DeepSeekProviderStatusResponse = {
  readonly status: DeepSeekProviderStatusSummary;
  readonly providerRegistry: ProviderRegistrySnapshot;
  readonly entrySurfaces: EntrySurfaceSnapshot;
  readonly platformExtensions: PlatformExtensionSnapshot;
};

export type DeepSeekProviderConnectionTestResponse = {
  readonly status: DeepSeekProviderStatusSummary;
  readonly providerRegistry: ProviderRegistrySnapshot;
  readonly entrySurfaces: EntrySurfaceSnapshot;
  readonly platformExtensions: PlatformExtensionSnapshot;
  readonly result: DeepSeekConnectionTestResult;
};

export type DeepSeekConnectionFetch = (
  input: string,
  init: {
    readonly method: "GET";
    readonly headers: {
      readonly Authorization: string;
    };
  },
) => Promise<DeepSeekConnectionFetchResponse>;

export type DeepSeekConnectionFetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};

type TestDeepSeekProviderConnectionInput = {
  readonly env?: DeepSeekEnvironment;
  readonly configResult?: DeepSeekConfigResult;
  readonly fetcher?: DeepSeekConnectionFetch;
  readonly now?: () => string;
};

export function createDeepSeekProviderStatusSummary(
  configResult: DeepSeekConfigResult = loadDeepSeekProviderConfig(),
  env?: DeepSeekEnvironment,
): DeepSeekProviderStatusSummary {
  if (!configResult.ok) {
    return {
      configStatus: "invalid",
      apiKeyReadiness: hasConfiguredApiKey(env) ? "configured" : "missing",
      baseUrl: null,
      defaultModel: null,
      thinkingEnabled: null,
      reasoningEffort: null,
      issueCodes: configResult.issues.map((issue) =>
        sanitizeDeepSeekProviderText(issue.code),
      ),
    };
  }

  const apiKeyReadyState = getDeepSeekApiKeyReadyState(configResult.config);

  return {
    configStatus: "valid",
    apiKeyReadiness: apiKeyReadyState.configured ? "configured" : "missing",
    baseUrl: sanitizeDeepSeekProviderText(configResult.config.baseUrl),
    defaultModel: configResult.config.defaultModel,
    thinkingEnabled: configResult.config.thinkingEnabled,
    reasoningEffort: configResult.config.defaultReasoningEffort,
    issueCodes: [],
  };
}

export function createProviderRuntimeStatusResponse(input: {
  readonly status: DeepSeekProviderStatusSummary;
  readonly checkedAt?: string;
  readonly auditAction?: Extract<
    ProviderRegistryAuditRecord["action"],
    "status_check" | "connection_test"
  >;
}): Omit<DeepSeekProviderStatusResponse, "status"> {
  const checkedAt = input.checkedAt ?? defaultNow();
  const platformExtensions = createPlatformExtensionSnapshot({
    checkedAt,
    auditAction: input.auditAction,
  });
  return {
    providerRegistry: createProviderRegistrySnapshot({
      deepSeek: input.status,
      checkedAt,
      auditAction: input.auditAction,
    }),
    entrySurfaces: createEntrySurfaceSnapshot(),
    platformExtensions,
  };
}

export async function testDeepSeekProviderConnection({
  env,
  configResult = loadDeepSeekProviderConfig(env),
  fetcher = defaultDeepSeekConnectionFetch,
  now = defaultNow,
}: TestDeepSeekProviderConnectionInput = {}): Promise<DeepSeekConnectionTestResult> {
  const checkedAt = now();

  if (!configResult.ok) {
    return {
      ok: false,
      code: "invalid_config",
      message: "DeepSeek provider configuration is invalid.",
      nextStep: `Fix DeepSeek environment settings: ${configResult.issues
        .map((issue) => sanitizeDeepSeekProviderText(issue.code))
        .join(", ")}.`,
      checkedAt,
    };
  }

  const apiKey = requireDeepSeekApiKey(configResult.config);
  if (!apiKey.ok) {
    return {
      ok: false,
      code: apiKey.issue.code,
      message: "DeepSeek API key is not configured.",
      nextStep: "Set DEEPSEEK_API_KEY in the server environment and restart.",
      checkedAt,
    };
  }

  let response: DeepSeekConnectionFetchResponse;
  try {
    response = await fetcher(
      joinDeepSeekUrl(configResult.config.baseUrl, "/models"),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.apiKey}`,
        },
      },
    );
  } catch {
    return {
      ok: false,
      code: "network_error",
      message: "DeepSeek could not be reached.",
      nextStep: "Check network access, base URL, and local proxy settings.",
      checkedAt,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: "http_error",
      message: `DeepSeek returned HTTP ${response.status}.`,
      nextStep: "Check the API key, account access, and provider base URL.",
      checkedAt,
      status: response.status,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return invalidResponseResult(checkedAt);
  }

  if (!isValidModelsResponse(payload)) {
    return invalidResponseResult(checkedAt);
  }

  return {
    ok: true,
    code: "ok",
    message: "DeepSeek connection test succeeded.",
    nextStep: "No action needed.",
    checkedAt,
  };
}

export function sanitizeDeepSeekProviderText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";

  return trimmed
    .replace(
      /(Bearer\s+)[^\s]+|([A-Za-z0-9_-]*(?:api[-_]?key|authorization|token|secret|password)[A-Za-z0-9_-]*\s*[:=]\s*)[^\s,;]+/gi,
      (
        _match,
        bearerPrefix: string | undefined,
        keyPrefix: string | undefined,
      ) => `${bearerPrefix ?? keyPrefix ?? ""}[redacted]`,
    )
    .replace(/\bsk-[A-Za-z0-9][A-Za-z0-9_-]{6,}\b/g, "[redacted]");
}

function invalidResponseResult(checkedAt: string): DeepSeekConnectionTestResult {
  return {
    ok: false,
    code: "invalid_response",
    message: "DeepSeek returned an invalid models response.",
    nextStep: "Retry later or verify that the base URL points to DeepSeek.",
    checkedAt,
  };
}

function defaultDeepSeekConnectionFetch(
  input: string,
  init: Parameters<DeepSeekConnectionFetch>[1],
): Promise<DeepSeekConnectionFetchResponse> {
  if (typeof fetch === "undefined") {
    return Promise.reject(new Error("fetch is not available."));
  }

  return fetch(input, init);
}

function joinDeepSeekUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function isValidModelsResponse(value: unknown): boolean {
  return isPlainRecord(value) && Array.isArray(value.data);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultNow(): string {
  return new Date().toISOString();
}

function hasConfiguredApiKey(env: DeepSeekEnvironment | undefined): boolean {
  if (env === undefined) return false;
  return (
    typeof env.DEEPSEEK_API_KEY === "string" &&
    env.DEEPSEEK_API_KEY.trim().length > 0
  );
}
