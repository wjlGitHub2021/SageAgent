import type { DeepSeekModel, ProviderId } from "@sage/shared";

export type Locale = "zh" | "en";
export type ReasoningEffort = "high" | "max";

export type Preferences = {
  readonly locale: Locale;
  readonly providerId: ProviderId;
  readonly model: DeepSeekModel;
  readonly thinkingEnabled: boolean;
  readonly reasoningEffort: ReasoningEffort;
};

export type PreferenceStorage = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

export const PREFERENCES_STORAGE_KEY = "sage.preferences.v1";

export const DEFAULT_PREFERENCES: Preferences = {
  locale: "zh",
  providerId: "deepseek",
  model: "deepseek-chat",
  thinkingEnabled: true,
  reasoningEffort: "high",
};

export const ALLOWED_MODELS = [
  "deepseek-chat",
  "deepseek-reasoner",
] as const satisfies readonly DeepSeekModel[];

export const ALLOWED_REASONING_EFFORTS = ["high", "max"] as const;

const ALLOWED_LOCALES = ["zh", "en"] as const;
const ALLOWED_PROVIDER_IDS = ["deepseek"] as const satisfies readonly ProviderId[];
const PREFERENCE_SCHEMA_KEYS = [
  "locale",
  "providerId",
  "model",
  "thinkingEnabled",
  "reasoningEffort",
] as const;
const LEGACY_PREFERENCE_SCHEMA_KEYS = [
  "locale",
  "model",
  "thinkingEnabled",
  "reasoningEffort",
] as const;

export function parseStoredPreferences(value: string | null): Preferences {
  if (!value) return DEFAULT_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isPlainRecord(parsed)) return DEFAULT_PREFERENCES;

    const parsedKeys = Object.keys(parsed);
    const hasCurrentSchema = matchesSchemaKeys(parsedKeys, PREFERENCE_SCHEMA_KEYS);
    const hasLegacySchema = matchesSchemaKeys(
      parsedKeys,
      LEGACY_PREFERENCE_SCHEMA_KEYS,
    );
    if (!hasCurrentSchema && !hasLegacySchema) return DEFAULT_PREFERENCES;

    const providerId = hasCurrentSchema ? parsed.providerId : "deepseek";
    if (
      !isAllowedValue(parsed.locale, ALLOWED_LOCALES) ||
      !isAllowedValue(providerId, ALLOWED_PROVIDER_IDS) ||
      !isAllowedValue(parsed.model, ALLOWED_MODELS) ||
      typeof parsed.thinkingEnabled !== "boolean" ||
      !isAllowedValue(parsed.reasoningEffort, ALLOWED_REASONING_EFFORTS)
    ) {
      return DEFAULT_PREFERENCES;
    }

    return {
      locale: parsed.locale,
      providerId,
      model: parsed.model,
      thinkingEnabled: parsed.thinkingEnabled,
      reasoningEffort: parsed.reasoningEffort,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function readStoredPreferences(
  storage: PreferenceStorage | null | undefined,
): Preferences {
  if (!storage) return DEFAULT_PREFERENCES;

  try {
    return parseStoredPreferences(storage.getItem(PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function serializePreferences(preferences: Preferences): string {
  return JSON.stringify({
    locale: preferences.locale,
    providerId: preferences.providerId,
    model: preferences.model,
    thinkingEnabled: preferences.thinkingEnabled,
    reasoningEffort: preferences.reasoningEffort,
  });
}

export function writeStoredPreferences(
  storage: PreferenceStorage | null | undefined,
  preferences: Preferences,
): void {
  if (!storage) return;

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, serializePreferences(preferences));
  } catch {
  }
}

function isAllowedValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function matchesSchemaKeys<T extends readonly string[]>(
  keys: readonly string[],
  schema: T,
): boolean {
  return (
    keys.length === schema.length &&
    keys.every((key) => schema.includes(key))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
