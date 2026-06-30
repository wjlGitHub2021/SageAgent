import {
  DEEPSEEK_MODELS,
  REASONING_EFFORTS,
  type DeepSeekModel,
  type ReasoningEffort,
} from "@sage/shared";

export const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = "deepseek-chat";
export const DEFAULT_DEEPSEEK_REASONING_EFFORT: ReasoningEffort = "high";
export const DEFAULT_DEEPSEEK_THINKING_ENABLED = true;

export const DEEPSEEK_ENV_KEYS = {
  apiKey: "DEEPSEEK_API_KEY",
  baseUrl: "DEEPSEEK_BASE_URL",
  defaultModel: "DEEPSEEK_DEFAULT_MODEL",
  defaultReasoningEffort: "DEEPSEEK_DEFAULT_REASONING_EFFORT",
  thinkingEnabled: "DEEPSEEK_THINKING_ENABLED",
} as const;

export interface DeepSeekProviderConfig {
  readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly defaultModel: DeepSeekModel;
  readonly defaultReasoningEffort: ReasoningEffort;
  readonly thinkingEnabled: boolean;
}

export interface DeepSeekConfigIssue {
  readonly field: keyof typeof DEEPSEEK_ENV_KEYS;
  readonly code: string;
  readonly message: string;
}

export interface DeepSeekEnvironment {
  readonly DEEPSEEK_API_KEY?: string;
  readonly DEEPSEEK_BASE_URL?: string;
  readonly DEEPSEEK_DEFAULT_MODEL?: string;
  readonly DEEPSEEK_DEFAULT_REASONING_EFFORT?: string;
  readonly DEEPSEEK_THINKING_ENABLED?: string;
}

export type DeepSeekConfigResult =
  | {
      readonly ok: true;
      readonly config: DeepSeekProviderConfig;
    }
  | {
      readonly ok: false;
      readonly issues: readonly DeepSeekConfigIssue[];
    };

export function loadDeepSeekProviderConfig(
  env: DeepSeekEnvironment = readProcessEnv(),
): DeepSeekConfigResult {
  const issues: DeepSeekConfigIssue[] = [];
  const apiKey = normalizeApiKey(env.DEEPSEEK_API_KEY);
  const baseUrlResult = normalizeBaseUrl(env.DEEPSEEK_BASE_URL);
  if (!baseUrlResult.ok) issues.push(baseUrlResult.issue);
  const baseUrl = baseUrlResult.ok ? baseUrlResult.value : null;

  const modelResult = normalizeModel(env.DEEPSEEK_DEFAULT_MODEL);
  if (!modelResult.ok) issues.push(modelResult.issue);
  const defaultModel = modelResult.ok ? modelResult.value : null;

  const effortResult = normalizeReasoningEffort(
    env.DEEPSEEK_DEFAULT_REASONING_EFFORT,
  );
  if (!effortResult.ok) issues.push(effortResult.issue);
  const defaultReasoningEffort = effortResult.ok ? effortResult.value : null;

  const thinkingResult = normalizeThinkingEnabled(env.DEEPSEEK_THINKING_ENABLED);
  if (!thinkingResult.ok) issues.push(thinkingResult.issue);
  const thinkingEnabled = thinkingResult.ok ? thinkingResult.value : null;

  if (
    issues.length > 0 ||
    baseUrl === null ||
    defaultModel === null ||
    defaultReasoningEffort === null ||
    thinkingEnabled === null
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    config: {
      apiKey,
      baseUrl,
      defaultModel,
      defaultReasoningEffort,
      thinkingEnabled,
    },
  };
}

export function createDefaultDeepSeekProviderConfig(): DeepSeekProviderConfig {
  return {
    apiKey: null,
    baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
    defaultModel: DEFAULT_DEEPSEEK_MODEL,
    defaultReasoningEffort: DEFAULT_DEEPSEEK_REASONING_EFFORT,
    thinkingEnabled: DEFAULT_DEEPSEEK_THINKING_ENABLED,
  };
}

function normalizeApiKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeBaseUrl(
  value: string | undefined,
):
  | { ok: true; value: string }
  | { ok: false; issue: DeepSeekConfigIssue } {
  if (value === undefined) {
    return { ok: true, value: DEFAULT_DEEPSEEK_BASE_URL };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      issue: {
        field: "baseUrl",
        code: "invalid_base_url",
        message: "DEEPSEEK_BASE_URL must be a valid absolute URL.",
      },
    };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return {
        ok: false,
        issue: {
          field: "baseUrl",
          code: "insecure_base_url",
          message: "DEEPSEEK_BASE_URL must use https.",
        },
      };
    }

    if (url.search || url.hash) {
      return {
        ok: false,
        issue: {
          field: "baseUrl",
          code: "invalid_base_url",
          message: "DEEPSEEK_BASE_URL must not include query or hash.",
        },
      };
    }

    const normalizedPath =
      url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return {
      ok: true,
      value: `${url.origin}${normalizedPath}`,
    };
  } catch {
    return {
      ok: false,
      issue: {
        field: "baseUrl",
        code: "invalid_base_url",
        message: "DEEPSEEK_BASE_URL must be a valid absolute URL.",
      },
    };
  }
}

function normalizeModel(
  value: string | undefined,
):
  | { ok: true; value: DeepSeekModel }
  | { ok: false; issue: DeepSeekConfigIssue } {
  if (value === undefined) return { ok: true, value: DEFAULT_DEEPSEEK_MODEL };

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      issue: {
        field: "defaultModel",
        code: "invalid_default_model",
        message: "DEEPSEEK_DEFAULT_MODEL must not be blank.",
      },
    };
  }

  if (!DEEPSEEK_MODELS.includes(trimmed as DeepSeekModel)) {
    return {
      ok: false,
      issue: {
        field: "defaultModel",
        code: "invalid_default_model",
        message:
          "DEEPSEEK_DEFAULT_MODEL must be deepseek-chat or deepseek-reasoner.",
      },
    };
  }

  return { ok: true, value: trimmed as DeepSeekModel };
}

function normalizeReasoningEffort(
  value: string | undefined,
):
  | { ok: true; value: ReasoningEffort }
  | { ok: false; issue: DeepSeekConfigIssue } {
  if (value === undefined) {
    return { ok: true, value: DEFAULT_DEEPSEEK_REASONING_EFFORT };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      issue: {
        field: "defaultReasoningEffort",
        code: "invalid_default_reasoning_effort",
        message: "DEEPSEEK_DEFAULT_REASONING_EFFORT must not be blank.",
      },
    };
  }

  if (!REASONING_EFFORTS.includes(trimmed as ReasoningEffort)) {
    return {
      ok: false,
      issue: {
        field: "defaultReasoningEffort",
        code: "invalid_default_reasoning_effort",
        message: "DEEPSEEK_DEFAULT_REASONING_EFFORT must be high or max.",
      },
    };
  }

  return { ok: true, value: trimmed as ReasoningEffort };
}

function normalizeThinkingEnabled(
  value: string | undefined,
):
  | { ok: true; value: boolean }
  | { ok: false; issue: DeepSeekConfigIssue } {
  if (value === undefined) {
    return { ok: true, value: DEFAULT_DEEPSEEK_THINKING_ENABLED };
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return {
      ok: false,
      issue: {
        field: "thinkingEnabled",
        code: "invalid_thinking_enabled",
        message: "DEEPSEEK_THINKING_ENABLED must be true or false.",
      },
    };
  }

  if (["true", "1", "yes", "on"].includes(trimmed)) {
    return { ok: true, value: true };
  }

  if (["false", "0", "no", "off"].includes(trimmed)) {
    return { ok: true, value: false };
  }

  return {
    ok: false,
    issue: {
      field: "thinkingEnabled",
      code: "invalid_thinking_enabled",
      message: "DEEPSEEK_THINKING_ENABLED must be true or false.",
    },
  };
}

function readProcessEnv(): DeepSeekEnvironment {
  const env = typeof process !== "undefined" ? process.env : {};
  return {
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: env.DEEPSEEK_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL: env.DEEPSEEK_DEFAULT_MODEL,
    DEEPSEEK_DEFAULT_REASONING_EFFORT: env.DEEPSEEK_DEFAULT_REASONING_EFFORT,
    DEEPSEEK_THINKING_ENABLED: env.DEEPSEEK_THINKING_ENABLED,
  };
}
