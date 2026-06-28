import { describe, expect, it } from "vitest";

import {
  createEntrySurfaceSnapshot,
  createProviderRegistrySnapshot,
} from "@sage/runtime";

describe("provider registry", () => {
  it("wraps DeepSeek status as the default provider descriptor", () => {
    const snapshot = createProviderRegistrySnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
      deepSeek: {
        configStatus: "valid",
        apiKeyReadiness: "configured",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-pro",
        thinkingEnabled: false,
        reasoningEffort: "max",
        issueCodes: [],
      },
    });

    expect(snapshot.defaultProviderId).toBe("deepseek");
    expect(snapshot.providers).toEqual([
      expect.objectContaining({
        id: "deepseek",
        kind: "deepseek",
        status: "available",
        isDefault: true,
        supportsThinking: true,
        defaultSettings: {
          model: "deepseek-v4-pro",
          thinkingEnabled: false,
          reasoningEffort: "max",
        },
      }),
    ]);
    expect(snapshot.fallbackRules).toEqual([
      expect.objectContaining({
        fromProviderId: "deepseek",
        toProviderId: "deepseek",
        mode: "disabled",
      }),
    ]);
  });

  it("keeps missing credentials and invalid config visible without fallback", () => {
    const missingKey = createProviderRegistrySnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
      deepSeek: {
        configStatus: "valid",
        apiKeyReadiness: "missing",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        thinkingEnabled: true,
        reasoningEffort: "high",
        issueCodes: [],
      },
    });
    expect(missingKey.providers[0]?.status).toBe("missing_credentials");

    const invalidConfig = createProviderRegistrySnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
      deepSeek: {
        configStatus: "invalid",
        apiKeyReadiness: "configured",
        baseUrl: null,
        defaultModel: null,
        thinkingEnabled: null,
        reasoningEffort: null,
        issueCodes: ["insecure_base_url"],
      },
    });
    expect(invalidConfig.providers[0]).toMatchObject({
      status: "invalid_config",
      issueCodes: ["insecure_base_url"],
    });
    expect(invalidConfig.fallbackRules[0]?.mode).toBe("disabled");
  });

  it("declares Web as active and Desktop as a planned shared surface", () => {
    const surfaces = createEntrySurfaceSnapshot();

    expect(surfaces.primarySurfaceId).toBe("web");
    expect(surfaces.surfaces).toEqual([
      expect.objectContaining({
        id: "web",
        status: "active",
        sharedStateModel: "run-workbench",
      }),
      expect.objectContaining({
        id: "desktop",
        status: "planned",
        sharedStateModel: "run-workbench",
      }),
    ]);
  });
});
