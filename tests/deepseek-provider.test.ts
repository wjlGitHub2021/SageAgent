import { describe, expect, it } from "vitest";

import {
  createDeepSeekChatCompletion,
  loadDeepSeekProviderConfig,
  parseDeepSeekChatCompletionResponse,
  parseDeepSeekStreamLine,
  redactDeepSeekApiKey,
  requireDeepSeekApiKey,
} from "@sage/deepseek";

describe("DeepSeek provider", () => {
  it("loads safe defaults without requiring an API key", () => {
    const result = loadDeepSeekProviderConfig({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config).toMatchObject({
      apiKey: null,
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-v4-flash",
      defaultReasoningEffort: "high",
      thinkingEnabled: true,
    });
  });

  it("rejects unsupported models, reasoning effort, and insecure base URLs", () => {
    const result = loadDeepSeekProviderConfig({
      DEEPSEEK_BASE_URL: "http://api.deepseek.com",
      DEEPSEEK_DEFAULT_MODEL: "deepseek-chat",
      DEEPSEEK_DEFAULT_REASONING_EFFORT: "medium",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "insecure_base_url",
      "invalid_default_model",
      "invalid_default_reasoning_effort",
    ]);
  });

  it("redacts and requires API keys without leaking full credentials", () => {
    expect(redactDeepSeekApiKey("  short  ")).toBe("***** (5)");
    expect(redactDeepSeekApiKey("sk-1234567890abcdef")).toBe(
      "sk-...cdef (19)",
    );

    const missing = requireDeepSeekApiKey({
      apiKey: " ",
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-v4-flash",
      defaultReasoningEffort: "high",
      thinkingEnabled: true,
    });
    expect(missing.ok).toBe(false);
  });

  it("prepares OpenAI-compatible chat requests through an injected fetcher", async () => {
    const result = await createDeepSeekChatCompletion(
      {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com/v1/",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      {
        messages: [{ role: "user", content: "Hello" }],
        model: "deepseek-v4-pro",
        thinkingEnabled: false,
        reasoningEffort: "max",
      },
      async (url, init) => {
        expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer sk-test");
        expect(JSON.parse(init.body)).toMatchObject({
          model: "deepseek-v4-pro",
          stream: false,
          thinking: { type: "disabled" },
          reasoning_effort: "max",
          messages: [{ role: "user", content: "Hello" }],
        });

        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: "chatcmpl-test",
              model: "deepseek-v4-pro",
              choices: [
                {
                  index: 0,
                  message: {
                    content: "Hi",
                    reasoning_content: "Reasoned",
                  },
                  finish_reason: "stop",
                },
              ],
            };
          },
        };
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.choices[0]?.message).toMatchObject({
      role: "assistant",
      content: "Hi",
      reasoningContent: "Reasoned",
    });
  });

  it("parses responses and streaming data defensively", () => {
    expect(parseDeepSeekChatCompletionResponse({ choices: [] })).toEqual({
      ok: true,
      value: {
        id: null,
        model: null,
        choices: [],
      },
    });

    const delta = parseDeepSeekStreamLine(
      'data: {"id":"1","model":"deepseek-v4-flash","choices":[{"index":0,"delta":{"role":"assistant","content":"A","reasoning_content":"R"},"finish_reason":null}]}',
    );
    expect(delta).toEqual({
      ok: true,
      value: {
        type: "delta",
        id: "1",
        model: "deepseek-v4-flash",
        index: 0,
        role: "assistant",
        contentDelta: "A",
        reasoningDelta: "R",
        finishReason: null,
      },
    });

    expect(parseDeepSeekStreamLine("data: [DONE]")).toEqual({
      ok: true,
      value: { type: "done" },
    });
    expect(parseDeepSeekStreamLine("data: not-json")).toMatchObject({
      ok: false,
      issue: { code: "invalid_stream_line" },
    });
  });
});
