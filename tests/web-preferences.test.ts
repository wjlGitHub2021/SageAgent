import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  parseStoredPreferences,
  readStoredPreferences,
  serializePreferences,
  writeStoredPreferences,
  type PreferenceStorage,
  type Preferences,
} from "../apps/web/src/lib/preferences";

describe("web preferences", () => {
  it("parses only the non-sensitive preference schema", () => {
    const preferences: Preferences = {
      locale: "en",
      providerId: "deepseek",
      model: "deepseek-reasoner",
      thinkingEnabled: false,
      reasoningEffort: "max",
    };

    expect(parseStoredPreferences(JSON.stringify(preferences))).toEqual(
      preferences,
    );
    expect(JSON.parse(serializePreferences(preferences))).toEqual(preferences);
  });

  it("upgrades legacy preferences without providerId to the DeepSeek provider", () => {
    expect(
      parseStoredPreferences(
        JSON.stringify({
          locale: "en",
          model: "deepseek-reasoner",
          thinkingEnabled: false,
          reasoningEffort: "max",
        }),
      ),
    ).toEqual({
      locale: "en",
      providerId: "deepseek",
      model: "deepseek-reasoner",
      thinkingEnabled: false,
      reasoningEffort: "max",
    });
  });

  it("falls back for damaged json, illegal values, missing fields, and extra fields", () => {
    expect(parseStoredPreferences("{")).toEqual(DEFAULT_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          locale: "fr",
          providerId: "deepseek",
          model: "deepseek-reasoner",
          thinkingEnabled: false,
          reasoningEffort: "max",
        }),
      ),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          locale: "en",
          providerId: "other-provider",
          model: "deepseek-reasoner",
          thinkingEnabled: false,
          reasoningEffort: "max",
        }),
      ),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          locale: "en",
          providerId: "deepseek",
          model: "deepseek-reasoner",
          thinkingEnabled: false,
        }),
      ),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(
      parseStoredPreferences(
        JSON.stringify({
          locale: "en",
          providerId: "deepseek",
          model: "deepseek-reasoner",
          thinkingEnabled: false,
          reasoningEffort: "max",
          apiKey: "sk-should-not-be-accepted",
        }),
      ),
    ).toEqual(DEFAULT_PREFERENCES);
  });

  it("handles unavailable storage without throwing or leaking extra keys", () => {
    const writes: Array<{ key: string; value: string }> = [];
    const storage: PreferenceStorage = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: (key, value) => {
        writes.push({ key, value });
      },
    };

    const preferences: Preferences = {
      locale: "en",
      providerId: "deepseek",
      model: "deepseek-reasoner",
      thinkingEnabled: false,
      reasoningEffort: "max",
    };

    expect(readStoredPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    writeStoredPreferences(storage, preferences);

    expect(writes).toHaveLength(1);
    expect(writes[0]?.key).toBe(PREFERENCES_STORAGE_KEY);
    expect(JSON.parse(writes[0]?.value ?? "{}")).toEqual(preferences);
  });
});
