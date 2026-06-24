import type { DeepSeekProviderConfig } from "./config.js";

export interface DeepSeekApiKeyReadyState {
  readonly configured: boolean;
  readonly redacted: string | null;
}

export interface DeepSeekApiKeyIssue {
  readonly code: "missing_api_key";
  readonly message: string;
}

export type DeepSeekApiKeyResult =
  | {
      readonly ok: true;
      readonly apiKey: string;
    }
  | {
      readonly ok: false;
      readonly issue: DeepSeekApiKeyIssue;
    };

export function getDeepSeekApiKeyReadyState(
  config: DeepSeekProviderConfig,
): DeepSeekApiKeyReadyState {
  const apiKey = normalizeRuntimeApiKey(config.apiKey);

  return {
    configured: apiKey !== null,
    redacted: redactDeepSeekApiKey(apiKey),
  };
}

export function requireDeepSeekApiKey(
  config: DeepSeekProviderConfig,
): DeepSeekApiKeyResult {
  const apiKey = normalizeRuntimeApiKey(config.apiKey);

  if (apiKey === null) {
    return {
      ok: false,
      issue: {
        code: "missing_api_key",
        message: "DEEPSEEK_API_KEY is required before calling DeepSeek.",
      },
    };
  }

  return {
    ok: true,
    apiKey,
  };
}

export function redactDeepSeekApiKey(apiKey: string | null): string | null {
  if (apiKey === null) return null;

  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 12) {
    return `${"*".repeat(trimmed.length)} (${trimmed.length})`;
  }

  return `${trimmed.slice(0, 3)}...${trimmed.slice(-4)} (${trimmed.length})`;
}

function normalizeRuntimeApiKey(apiKey: string | null): string | null {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : null;
}
