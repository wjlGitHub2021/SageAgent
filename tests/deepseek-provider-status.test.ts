import { describe, expect, it } from "vitest";

import {
  createProviderRuntimeStatusResponse,
  createDeepSeekProviderStatusSummary,
  sanitizeDeepSeekProviderText,
  testDeepSeekProviderConnection,
  type DeepSeekConnectionFetch,
} from "../apps/web/src/lib/deepseek-provider-status";

describe("DeepSeek provider status", () => {
  it("creates a safe status summary without leaking the full API key", () => {
    const summary = createDeepSeekProviderStatusSummary({
      ok: true,
      config: {
        apiKey: "sk-secret-token-123456789",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-reasoner",
        defaultReasoningEffort: "max",
        thinkingEnabled: false,
      },
    });

    expect(summary).toEqual({
      configStatus: "valid",
      apiKeyReadiness: "configured",
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-reasoner",
      thinkingEnabled: false,
      reasoningEffort: "max",
      issueCodes: [],
    });
    expect(JSON.stringify(summary)).not.toContain("sk-secret-token");
  });

  it("creates provider registry and platform extension snapshots from DeepSeek status", () => {
    const status = createDeepSeekProviderStatusSummary({
      ok: true,
      config: {
        apiKey: "sk-secret-token-123456789",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-chat",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
    });
    const response = createProviderRuntimeStatusResponse({
      status,
      checkedAt: "2026-06-28T10:00:00.000Z",
    });

    expect(response.providerRegistry).toMatchObject({
      defaultProviderId: "deepseek",
      providers: [
        {
          id: "deepseek",
          status: "available",
          isDefault: true,
          baseUrl: "https://api.deepseek.com",
        },
      ],
      fallbackRules: [
        {
          mode: "disabled",
          fromProviderId: "deepseek",
          toProviderId: "deepseek",
        },
      ],
    });
    expect(response.providerRegistry.auditTrail).toContainEqual(
      expect.objectContaining({
        action: "status_check",
        providerId: "deepseek",
      }),
    );
    expect(response.entrySurfaces.surfaces.map((surface) => surface.id)).toEqual([
      "web",
      "desktop",
    ]);
    expect(response.platformExtensions.entries.map((entry) => entry.id)).toEqual([
      "cron",
      "voice",
      "profiles",
      "remote-login",
      "gateway-messaging",
      "auto-update",
    ]);
    expect(response.platformExtensions.auditTrail).toContainEqual(
      expect.objectContaining({
        action: "status_check",
      }),
    );
    expect(JSON.stringify(response)).not.toContain("sk-secret-token");
  });

  it("marks connection test registry snapshots with a connection_test audit action", () => {
    const status = createDeepSeekProviderStatusSummary({
      ok: true,
      config: {
        apiKey: "sk-secret-token-123456789",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-chat",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
    });
    const response = createProviderRuntimeStatusResponse({
      status,
      checkedAt: "2026-06-28T10:00:00.000Z",
      auditAction: "connection_test",
    });

    expect(response.providerRegistry.auditTrail).toContainEqual(
      expect.objectContaining({
        action: "connection_test",
        providerId: "deepseek",
      }),
    );
    expect(response.platformExtensions.auditTrail).toContainEqual(
      expect.objectContaining({
        action: "connection_test",
      }),
    );
    expect(JSON.stringify(response)).not.toContain("sk-secret-token");
  });

  it("reports invalid config with issue codes only", () => {
    const summary = createDeepSeekProviderStatusSummary({
      ok: false,
      issues: [
        {
          field: "baseUrl",
          code: "insecure_base_url",
          message: "Authorization Bearer sk-secret-token should not leak",
        },
      ],
    });

    expect(summary).toEqual({
      configStatus: "invalid",
      apiKeyReadiness: "missing",
      baseUrl: null,
      defaultModel: null,
      thinkingEnabled: null,
      reasoningEffort: null,
      issueCodes: ["insecure_base_url"],
    });
    expect(JSON.stringify(summary)).not.toContain("sk-secret-token");
  });

  it("keeps API key readiness trustworthy when other config fields are invalid", () => {
    const summary = createDeepSeekProviderStatusSummary(
      {
        ok: false,
        issues: [
          {
            field: "baseUrl",
            code: "insecure_base_url",
            message: "DEEPSEEK_BASE_URL must use https.",
          },
        ],
      },
      { DEEPSEEK_API_KEY: "sk-secret-token" },
    );

    expect(summary).toMatchObject({
      configStatus: "invalid",
      apiKeyReadiness: "configured",
      issueCodes: ["insecure_base_url"],
    });
    expect(JSON.stringify(summary)).not.toContain("sk-secret-token");
  });

  it("does not call DeepSeek when the API key is missing", async () => {
    let called = false;
    const result = await testDeepSeekProviderConnection({
      env: {},
      fetcher: async () => {
        called = true;
        throw new Error("should not call");
      },
      now: () => "2026-06-27T00:00:00.000Z",
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({
      ok: false,
      code: "missing_api_key",
      checkedAt: "2026-06-27T00:00:00.000Z",
    });
  });

  it("uses a safe server-side Authorization header for a successful models request", async () => {
    const fetcher: DeepSeekConnectionFetch = async (url, init) => {
      expect(url).toBe("https://api.deepseek.com/models");
      expect(init.method).toBe("GET");
      expect(init.headers.Authorization).toBe("Bearer sk-secret-token");

      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [] };
        },
      };
    };

    const result = await testDeepSeekProviderConnection({
      env: { DEEPSEEK_API_KEY: "sk-secret-token" },
      fetcher,
      now: () => "2026-06-27T00:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      code: "ok",
      message: "DeepSeek connection test succeeded.",
      nextStep: "No action needed.",
      checkedAt: "2026-06-27T00:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("sk-secret-token");
  });

  it("returns safe structured failures for http, network, invalid response, and invalid config", async () => {
    const httpResult = await testDeepSeekProviderConnection({
      env: { DEEPSEEK_API_KEY: "sk-secret-token" },
      fetcher: async () => ({
        ok: false,
        status: 401,
        async json() {
          return {
            error: "Authorization Bearer sk-secret-token",
          };
        },
      }),
    });
    expect(httpResult).toMatchObject({
      ok: false,
      code: "http_error",
      status: 401,
    });
    expect(JSON.stringify(httpResult)).not.toContain("sk-secret-token");

    const networkResult = await testDeepSeekProviderConnection({
      env: { DEEPSEEK_API_KEY: "sk-secret-token" },
      fetcher: async () => {
        throw new Error("Authorization Bearer sk-secret-token");
      },
    });
    expect(networkResult).toMatchObject({
      ok: false,
      code: "network_error",
    });
    expect(JSON.stringify(networkResult)).not.toContain("sk-secret-token");

    const invalidResponseResult = await testDeepSeekProviderConnection({
      env: { DEEPSEEK_API_KEY: "sk-secret-token" },
      fetcher: async () => ({
        ok: true,
        status: 200,
        async json() {
          return { object: "list" };
        },
      }),
    });
    expect(invalidResponseResult).toMatchObject({
      ok: false,
      code: "invalid_response",
    });

    const invalidConfigResult = await testDeepSeekProviderConnection({
      env: {
        DEEPSEEK_API_KEY: "sk-secret-token",
        DEEPSEEK_BASE_URL: "http://api.deepseek.com",
      },
      fetcher: async () => {
        throw new Error("should not call");
      },
    });
    expect(invalidConfigResult).toMatchObject({
      ok: false,
      code: "invalid_config",
    });
    expect(JSON.stringify(invalidConfigResult)).not.toContain("sk-secret-token");
  });

  it("sanitizes credential-like text defensively", () => {
    expect(
      sanitizeDeepSeekProviderText(
        "Authorization Bearer sk-secret-token and password=abc123",
      ),
    ).toBe("Authorization Bearer [redacted] and password=[redacted]");
  });
});
