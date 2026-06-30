import { describe, expect, it } from "vitest";

import {
  createDeepSeekChatCompletion,
  fetchWithTimeout,
  loadDeepSeekProviderConfig,
  parseDeepSeekChatCompletionResponse,
  parseDeepSeekStreamBody,
  parseDeepSeekStreamLine,
  redactDeepSeekApiKey,
  requireDeepSeekApiKey,
  streamDeepSeekChatCompletion,
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
      DEEPSEEK_DEFAULT_MODEL: "unsupported-model",
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

  it("sends tools and parses tool_calls from the response", async () => {
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_weather",
          description: "Get weather for a city",
          parameters: {
            type: "object",
            properties: { city: { type: "string" } },
            required: ["city"],
          },
        },
      },
    ];

    const result = await createDeepSeekChatCompletion(
      {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      {
        messages: [{ role: "user", content: "weather in SF?" }],
        model: "deepseek-v4-flash",
        tools,
      },
      async (_url, init) => {
        expect(JSON.parse(init.body).tools).toEqual(tools);
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: "x",
              model: "deepseek-v4-flash",
              choices: [
                {
                  index: 0,
                  message: {
                    content: "",
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "get_weather",
                          arguments: '{"city":"SF"}',
                        },
                      },
                    ],
                  },
                  finish_reason: "tool_calls",
                },
              ],
            };
          },
        };
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.choices[0]?.message.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"SF"}' },
    ]);
    expect(result.value.choices[0]?.finishReason).toBe("tool_calls");
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

  it("prepares streaming chat requests and parses data-only SSE", async () => {
    const result = streamDeepSeekChatCompletion(
      {
        apiKey: "sk-test",
        baseUrl: "https://api.deepseek.com",
        defaultModel: "deepseek-v4-flash",
        defaultReasoningEffort: "high",
        thinkingEnabled: true,
      },
      {
        messages: [{ role: "user", content: "Hello" }],
        model: "deepseek-v4-pro",
        thinkingEnabled: true,
        reasoningEffort: "max",
      },
      async (url, init) => {
        expect(url).toBe("https://api.deepseek.com/chat/completions");
        expect(init.headers.Authorization).toBe("Bearer sk-test");
        expect(JSON.parse(init.body)).toMatchObject({
          model: "deepseek-v4-pro",
          stream: true,
          thinking: { type: "enabled" },
          reasoning_effort: "max",
        });

        return {
          ok: true,
          status: 200,
          body: createTextStream([
            'data: {"id":"1","model":"deepseek-v4-pro","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel","reasoning_content":"R1"},"finish_reason":null}]}\n',
            '\ndata: {"id":"1","model":"deepseek-v4-pro","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}\n\n',
            "data: [DONE]\n\n",
          ]),
        };
      },
    );

    const events = [];
    for await (const event of result) events.push(event);

    expect(events).toEqual([
      {
        ok: true,
        value: {
          type: "delta",
          id: "1",
          model: "deepseek-v4-pro",
          index: 0,
          role: "assistant",
          contentDelta: "Hel",
          reasoningDelta: "R1",
          finishReason: null,
        },
      },
      {
        ok: true,
        value: {
          type: "delta",
          id: "1",
          model: "deepseek-v4-pro",
          index: 0,
          role: null,
          contentDelta: "lo",
          reasoningDelta: null,
          finishReason: null,
        },
      },
      {
        ok: true,
        value: { type: "done" },
      },
    ]);
  });

  it("surfaces streaming HTTP, network, body, and parse failures", async () => {
    const config = {
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
      defaultModel: "deepseek-v4-flash" as const,
      defaultReasoningEffort: "high" as const,
      thinkingEnabled: true,
    };
    const input = {
      messages: [{ role: "user" as const, content: "Hello" }],
    };

    const httpEvents = [];
    for await (const event of streamDeepSeekChatCompletion(
      config,
      input,
      async () => ({ ok: false, status: 429, statusText: "Too Many", body: null }),
    )) {
      httpEvents.push(event);
    }
    expect(httpEvents[0]).toMatchObject({
      ok: false,
      issue: { code: "http_error", status: 429 },
    });

    const networkEvents = [];
    for await (const event of streamDeepSeekChatCompletion(config, input, async () => {
      throw new Error("network");
    })) {
      networkEvents.push(event);
    }
    expect(networkEvents[0]).toMatchObject({
      ok: false,
      issue: { code: "network_error" },
    });

    const bodyEvents = [];
    for await (const event of streamDeepSeekChatCompletion(
      config,
      input,
      async () => ({ ok: true, status: 200, body: null }),
    )) {
      bodyEvents.push(event);
    }
    expect(bodyEvents[0]).toMatchObject({
      ok: false,
      issue: { code: "invalid_response" },
    });

    const parseEvents = [];
    for await (const event of parseDeepSeekStreamBody(
      createTextStream(["data: not-json\n\n"]),
    )) {
      parseEvents.push(event);
    }
    expect(parseEvents[0]).toMatchObject({
      ok: false,
      issue: { code: "invalid_stream_line" },
    });

    const readFailureEvents = [];
    for await (const event of parseDeepSeekStreamBody(createFailingStream())) {
      readFailureEvents.push(event);
    }
    expect(readFailureEvents[0]).toMatchObject({
      ok: false,
      issue: { code: "network_error" },
    });
  });
});

describe("DeepSeek parsing edge cases", () => {
  it("captures usage tail frames with empty choices instead of skipping or erroring", async () => {
    const stream = createTextStream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
      'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n',
      "data: [DONE]\n",
    ]);

    const results: Awaited<
      ReturnType<typeof parseDeepSeekStreamLine>
    >[] = [];
    for await (const result of parseDeepSeekStreamBody(stream)) {
      results.push(result);
    }

    expect(results.every((result) => result.ok)).toBe(true);
    const values = results.flatMap((result) =>
      result.ok ? [result.value] : [],
    );
    expect(values).toHaveLength(3);
    expect(values.some((value) => value?.type === "delta")).toBe(true);
    expect(values.some((value) => value?.type === "done")).toBe(true);
    expect(values.find((value) => value?.type === "usage")).toMatchObject({
      type: "usage",
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
    });
  });

  it("still skips empty-choices tail frames that carry no usage", async () => {
    const stream = createTextStream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
      'data: {"choices":[]}\n',
      "data: [DONE]\n",
    ]);

    const results: Awaited<
      ReturnType<typeof parseDeepSeekStreamLine>
    >[] = [];
    for await (const result of parseDeepSeekStreamBody(stream)) {
      results.push(result);
    }

    const values = results.flatMap((result) =>
      result.ok ? [result.value] : [],
    );
    expect(values).toHaveLength(2);
    expect(values.some((value) => value?.type === "usage")).toBe(false);
  });

  it("falls back to empty content instead of rejecting null message content", () => {
    const result = parseDeepSeekChatCompletionResponse({
      id: "x",
      model: "deepseek-v4-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: null },
          finish_reason: "length",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.choices[0]?.message.content).toBe("");
    expect(result.value.choices[0]?.finishReason).toBe("length");
  });
});

describe("DeepSeek stream cancellation", () => {
  it("cancels the reader and stops reading when the signal aborts", async () => {
    let cancelled = false;
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"hi"}}]}\n',
          ),
        );
        // 故意不 close，保持流打开，模拟上游持续挂起。
      },
      cancel() {
        cancelled = true;
      },
    });

    const events: unknown[] = [];
    for await (const event of parseDeepSeekStreamBody(body, controller.signal)) {
      events.push(event);
      controller.abort();
    }

    expect(events).toHaveLength(1);
    expect(cancelled).toBe(true);
  });

  it("yields nothing when the signal is already aborted before fetching", async () => {
    const config = loadDeepSeekProviderConfig({ DEEPSEEK_API_KEY: "sk-test" });
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    const controller = new AbortController();
    controller.abort();
    const fetcher = () => {
      throw new Error("fetch should not be called when already aborted");
    };

    const events: unknown[] = [];
    for await (const event of streamDeepSeekChatCompletion(
      config.config,
      { messages: [{ role: "user", content: "hi" }] },
      fetcher as never,
      controller.signal,
    )) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });
});

describe("fetchWithTimeout", () => {
  it("aborts the request when the timeout elapses before a response", async () => {
    const run = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new Error("aborted by timeout")),
        );
      });

    await expect(fetchWithTimeout(run, 5)).rejects.toThrow("aborted by timeout");
  });

  it("returns the value and does not abort when the request resolves in time", async () => {
    let aborted = false;
    const run = (signal: AbortSignal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return Promise.resolve("ok");
    };

    await expect(fetchWithTimeout(run, 1000)).resolves.toBe("ok");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(aborted).toBe(false);
  });

  it("maps a timeout abort to a network_error from the chat completion adapter", async () => {
    const config = loadDeepSeekProviderConfig({ DEEPSEEK_API_KEY: "sk-test" });
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    const hangingFetcher = (_input: string, _init: unknown) =>
      fetchWithTimeout<never>(
        (signal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () =>
              reject(new Error("timed out")),
            );
          }),
        5,
      );

    const result = await createDeepSeekChatCompletion(
      config.config,
      { messages: [{ role: "user", content: "hi" }] },
      hangingFetcher as never,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.code).toBe("network_error");
  });
});

function createTextStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function createFailingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    pull() {
      throw new Error("stream read failed");
    },
  });
}
