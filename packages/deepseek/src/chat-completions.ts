import type { DeepSeekModel, ReasoningEffort } from "@sage/shared";

import { requireDeepSeekApiKey, type DeepSeekApiKeyIssue } from "./api-key.js";
import type { DeepSeekProviderConfig } from "./config.js";

export const DEEPSEEK_CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * 默认请求超时（毫秒）。覆盖从发起请求到收到响应头的阶段，避免连接挂起时
 * 整个 run 永久 pending；超时会 abort fetch，由调用方归一化为 network_error。
 */
export const DEEPSEEK_REQUEST_TIMEOUT_MS = 60_000;

export type DeepSeekChatRole = "system" | "user" | "assistant";

export interface DeepSeekChatMessage {
  readonly role: DeepSeekChatRole;
  readonly content: string;
}

// OpenAI 兼容的工具/函数定义（function calling）。
export interface DeepSeekTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description?: string;
    readonly parameters: Record<string, unknown>;
  };
}

// 模型请求调用某工具时回传的结构；arguments 为模型给出的原始 JSON 字符串。
export interface DeepSeekToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface DeepSeekChatCompletionInput {
  readonly messages: readonly DeepSeekChatMessage[];
  readonly model?: DeepSeekModel;
  readonly thinkingEnabled?: boolean;
  readonly reasoningEffort?: ReasoningEffort;
  readonly tools?: readonly DeepSeekTool[];
}

export interface DeepSeekChatCompletionRequestBody {
  readonly model: DeepSeekModel;
  readonly messages: readonly DeepSeekChatMessage[];
  readonly stream: boolean;
  // DeepSeek V4 思考开关与强度：thinking 默认 enabled，reasoning_effort high/max。
  readonly thinking: {
    readonly type: "enabled" | "disabled";
  };
  readonly reasoning_effort: ReasoningEffort;
  readonly tools?: readonly DeepSeekTool[];
}

export interface DeepSeekPreparedChatCompletionRequest {
  readonly url: string;
  readonly init: {
    readonly method: "POST";
    readonly headers: {
      readonly Authorization: string;
      readonly "Content-Type": "application/json";
    };
    readonly body: string;
  };
  readonly body: DeepSeekChatCompletionRequestBody;
}

export interface DeepSeekChatCompletionChoice {
  readonly index: number;
  readonly message: {
    readonly role: "assistant";
    readonly content: string;
    readonly reasoningContent: string | null;
    readonly toolCalls: readonly DeepSeekToolCall[];
  };
  readonly finishReason: string | null;
}

export interface DeepSeekChatCompletionOutput {
  readonly id: string | null;
  readonly model: string | null;
  readonly choices: readonly DeepSeekChatCompletionChoice[];
}

export type DeepSeekStreamParseEvent =
  | {
      readonly type: "delta";
      readonly id: string | null;
      readonly model: string | null;
      readonly index: number;
      readonly role: string | null;
      readonly contentDelta: string;
      readonly reasoningDelta: string | null;
      readonly finishReason: string | null;
    }
  | {
      readonly type: "usage";
      readonly promptTokens: number | null;
      readonly completionTokens: number | null;
      readonly totalTokens: number | null;
    }
  | {
      readonly type: "done";
    };

export type DeepSeekAdapterErrorCode =
  | DeepSeekApiKeyIssue["code"]
  | "invalid_messages"
  | "http_error"
  | "network_error"
  | "invalid_response"
  | "invalid_stream_line";

export interface DeepSeekAdapterIssue {
  readonly code: DeepSeekAdapterErrorCode;
  readonly message: string;
  readonly status?: number;
}

export type DeepSeekAdapterResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly issue: DeepSeekAdapterIssue;
    };

export type DeepSeekFetch = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: DeepSeekPreparedChatCompletionRequest["init"]["headers"];
    readonly body: string;
  },
) => Promise<DeepSeekFetchResponse>;

export interface DeepSeekFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText?: string;
  json(): Promise<unknown>;
}

export type DeepSeekStreamFetch = (
  input: string,
  init: {
    readonly method: "POST";
    readonly headers: DeepSeekPreparedChatCompletionRequest["init"]["headers"];
    readonly body: string;
  },
) => Promise<DeepSeekStreamFetchResponse>;

export interface DeepSeekStreamFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText?: string;
  readonly body: ReadableStream<Uint8Array> | null;
}

type JsonRecord = Record<string, unknown>;
type DeepSeekStreamReadResult =
  | { readonly done: true; readonly value?: Uint8Array }
  | { readonly done: false; readonly value: Uint8Array };

function prepareDeepSeekChatCompletionRequest(
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput & { readonly stream: boolean },
): DeepSeekAdapterResult<DeepSeekPreparedChatCompletionRequest> {
  const apiKey = requireDeepSeekApiKey(config);
  if (!apiKey.ok) {
    return {
      ok: false,
      issue: apiKey.issue,
    };
  }

  const messagesResult = normalizeMessages(input.messages);
  if (!messagesResult.ok) return messagesResult;

  const body: DeepSeekChatCompletionRequestBody = {
    model: input.model ?? config.defaultModel,
    messages: messagesResult.value,
    stream: input.stream,
    thinking: {
      type: (input.thinkingEnabled ?? config.thinkingEnabled)
        ? "enabled"
        : "disabled",
    },
    reasoning_effort: input.reasoningEffort ?? config.defaultReasoningEffort,
    ...(input.tools && input.tools.length > 0 ? { tools: input.tools } : {}),
  };

  return {
    ok: true,
    value: {
      url: joinDeepSeekUrl(config.baseUrl, DEEPSEEK_CHAT_COMPLETIONS_PATH),
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      body,
    },
  };
}

export async function createDeepSeekChatCompletion(
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput,
  fetcher: DeepSeekFetch = defaultDeepSeekFetch,
): Promise<DeepSeekAdapterResult<DeepSeekChatCompletionOutput>> {
  const request = prepareDeepSeekChatCompletionRequest(config, {
    ...input,
    stream: false,
  });
  if (!request.ok) return request;

  let response: DeepSeekFetchResponse;
  try {
    response = await fetcher(request.value.url, request.value.init);
  } catch {
    return {
      ok: false,
      issue: {
        code: "network_error",
        message: "DeepSeek request failed before receiving a response.",
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      issue: {
        code: "http_error",
        message: createHttpErrorMessage(response.status, response.statusText),
        status: response.status,
      },
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      issue: {
        code: "invalid_response",
        message: "DeepSeek response body was not valid JSON.",
      },
    };
  }

  return parseDeepSeekChatCompletionResponse(payload);
}

export async function* streamDeepSeekChatCompletion(
  config: DeepSeekProviderConfig,
  input: DeepSeekChatCompletionInput,
  fetcher: DeepSeekStreamFetch = defaultDeepSeekStreamFetch,
  signal?: AbortSignal,
): AsyncGenerator<DeepSeekAdapterResult<DeepSeekStreamParseEvent>, void> {
  if (signal?.aborted) return;
  const request = prepareDeepSeekChatCompletionRequest(config, {
    ...input,
    stream: true,
  });
  if (!request.ok) {
    yield request;
    return;
  }

  let response: DeepSeekStreamFetchResponse;
  try {
    response = await fetcher(request.value.url, request.value.init);
  } catch {
    yield {
      ok: false,
      issue: {
        code: "network_error",
        message: "DeepSeek request failed before receiving a response.",
      },
    };
    return;
  }

  if (!response.ok) {
    yield {
      ok: false,
      issue: {
        code: "http_error",
        message: createHttpErrorMessage(response.status, response.statusText),
        status: response.status,
      },
    };
    return;
  }

  if (!response.body) {
    yield {
      ok: false,
      issue: {
        code: "invalid_response",
        message: "DeepSeek streaming response did not include a body.",
      },
    };
    return;
  }

  for await (const result of parseDeepSeekStreamBody(response.body, signal)) {
    yield result;
    if (result.ok && result.value.type === "done") return;
    if (!result.ok) return;
  }
}

export function parseDeepSeekChatCompletionResponse(
  payload: unknown,
): DeepSeekAdapterResult<DeepSeekChatCompletionOutput> {
  if (!isRecord(payload)) {
    return invalidResponse("DeepSeek response must be an object.");
  }

  const rawChoices = payload.choices;
  if (!Array.isArray(rawChoices)) {
    return invalidResponse("DeepSeek response choices must be an array.");
  }

  const choices: DeepSeekChatCompletionChoice[] = [];
  for (const rawChoice of rawChoices) {
    if (!isRecord(rawChoice)) {
      return invalidResponse("DeepSeek response choice must be an object.");
    }

    const message = rawChoice.message;
    if (!isRecord(message)) {
      return invalidResponse("DeepSeek response message must be an object.");
    }

    // content 缺失/为 null（如 finish_reason: "length" 或推理类响应）时回退为空串并
    // 保留 finishReason，而不是把整包响应判为 invalid_response。
    const content = readString(message.content) ?? "";

    choices.push({
      index: readNumber(rawChoice.index) ?? choices.length,
      message: {
        role: "assistant",
        content,
        reasoningContent: readOptionalString(message.reasoning_content),
        toolCalls: readToolCalls(message.tool_calls),
      },
      finishReason: readOptionalString(rawChoice.finish_reason),
    });
  }

  return {
    ok: true,
    value: {
      id: readOptionalString(payload.id),
      model: readOptionalString(payload.model),
      choices,
    },
  };
}

export function parseDeepSeekStreamLine(
  line: string,
): DeepSeekAdapterResult<DeepSeekStreamParseEvent | null> {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) {
    return {
      ok: true,
      value: null,
    };
  }

  const data = trimmed.slice("data:".length).trim();
  if (data === "[DONE]") {
    return {
      ok: true,
      value: {
        type: "done",
      },
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return {
      ok: false,
      issue: {
        code: "invalid_stream_line",
        message: "DeepSeek stream data line was not valid JSON.",
      },
    };
  }

  return parseDeepSeekStreamPayload(payload);
}

export async function* parseDeepSeekStreamBody(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<DeepSeekAdapterResult<DeepSeekStreamParseEvent>, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // 外部取消时 cancel reader：既能让挂起的 read() 立即返回，也会释放底层连接，
  // 避免客户端断开后上游 DeepSeek 流仍长期挂起、持续消耗 token。
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      const readResult = await readStreamChunk(reader);
      if (!readResult.ok) {
        yield readResult;
        return;
      }

      const { done, value } = readResult.value;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const parsed = parseDeepSeekStreamLine(line);
        if (!parsed.ok) {
          yield parsed;
          return;
        }
        if (parsed.value === null) continue;

        yield {
          ok: true,
          value: parsed.value,
        };
        if (parsed.value.type === "done") return;
      }
    }

    buffer += decoder.decode();
    const tailLines = buffer.split(/\r?\n/);
    for (const line of tailLines) {
      const parsed = parseDeepSeekStreamLine(line);
      if (!parsed.ok) {
        yield parsed;
        return;
      }
      if (parsed.value === null) continue;

      yield {
        ok: true,
        value: parsed.value,
      };
      if (parsed.value.type === "done") return;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    // 消费方提前退出（return/break）或正常结束时都 cancel reader，确保底层连接被释放。
    await reader.cancel().catch(() => {});
  }
}

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<DeepSeekAdapterResult<DeepSeekStreamReadResult>> {
  try {
    return {
      ok: true,
      value: await reader.read(),
    };
  } catch {
    return {
      ok: false,
      issue: {
        code: "network_error",
        message: "DeepSeek streaming response failed while reading the body.",
      },
    };
  }
}

function parseDeepSeekStreamPayload(
  payload: unknown,
): DeepSeekAdapterResult<DeepSeekStreamParseEvent | null> {
  if (!isRecord(payload)) {
    return invalidStreamLine("DeepSeek stream payload must be an object.");
  }

  const rawChoices = payload.choices;
  if (!Array.isArray(rawChoices)) {
    return invalidStreamLine("DeepSeek stream payload choices must be an array.");
  }

  // OpenAI 兼容服务（DeepSeek 同协议）常在 [DONE] 前发送 choices:[] + usage 统计帧。
  // 捕获 usage（用于上下文计量）；无 usage 时跳过该帧而不是判为错误中断整个流。
  if (rawChoices.length === 0) {
    const usage = payload.usage;
    if (isRecord(usage)) {
      return {
        ok: true,
        value: {
          type: "usage",
          promptTokens: readNumber(usage.prompt_tokens) ?? null,
          completionTokens: readNumber(usage.completion_tokens) ?? null,
          totalTokens: readNumber(usage.total_tokens) ?? null,
        },
      };
    }
    return { ok: true, value: null };
  }

  const firstChoice = rawChoices[0];
  if (!isRecord(firstChoice)) {
    return invalidStreamLine("DeepSeek stream choice must be an object.");
  }

  const delta = firstChoice.delta;
  if (!isRecord(delta)) {
    return invalidStreamLine("DeepSeek stream delta must be an object.");
  }

  return {
    ok: true,
    value: {
      type: "delta",
      id: readOptionalString(payload.id),
      model: readOptionalString(payload.model),
      index: readNumber(firstChoice.index) ?? 0,
      role: readOptionalString(delta.role),
      contentDelta: readOptionalString(delta.content) ?? "",
      reasoningDelta: readOptionalString(delta.reasoning_content),
      finishReason: readOptionalString(firstChoice.finish_reason),
    },
  };
}

function normalizeMessages(
  messages: readonly DeepSeekChatMessage[],
): DeepSeekAdapterResult<readonly DeepSeekChatMessage[]> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      ok: false,
      issue: {
        code: "invalid_messages",
        message: "DeepSeek chat completion requires at least one message.",
      },
    };
  }

  const normalized: DeepSeekChatMessage[] = [];

  for (const message of messages) {
    if (!isRecord(message)) {
      return {
        ok: false,
        issue: {
          code: "invalid_messages",
          message: "DeepSeek message must be an object.",
        },
      };
    }

    const role = readOptionalString(message.role);
    const content = readOptionalString(message.content);

    if (!isDeepSeekChatRole(role)) {
      return {
        ok: false,
        issue: {
          code: "invalid_messages",
          message: "DeepSeek message role must be system, user, or assistant.",
        },
      };
    }

    if (content === null || content.trim().length === 0) {
      return {
        ok: false,
        issue: {
          code: "invalid_messages",
          message: "DeepSeek message content must not be blank.",
        },
      };
    }

    normalized.push({
      role,
      content,
    });
  }

  return {
    ok: true,
    value: normalized,
  };
}

/**
 * 用超时驱动的 AbortSignal 包裹一次请求：超时未拿到响应头即 abort，
 * 拿到响应（或失败）后立即清除计时器，不影响后续 body 流式读取。
 */
export function fetchWithTimeout<R>(
  run: (signal: AbortSignal) => Promise<R>,
  timeoutMs: number = DEEPSEEK_REQUEST_TIMEOUT_MS,
): Promise<R> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return run(controller.signal).finally(() => clearTimeout(timer));
}

function defaultDeepSeekFetch(
  input: string,
  init: Parameters<DeepSeekFetch>[1],
): Promise<DeepSeekFetchResponse> {
  if (typeof fetch === "undefined") {
    return Promise.reject(new Error("fetch is not available."));
  }

  return fetchWithTimeout((signal) => fetch(input, { ...init, signal }));
}

function defaultDeepSeekStreamFetch(
  input: string,
  init: Parameters<DeepSeekStreamFetch>[1],
): Promise<DeepSeekStreamFetchResponse> {
  if (typeof fetch === "undefined") {
    return Promise.reject(new Error("fetch is not available."));
  }

  return fetchWithTimeout((signal) => fetch(input, { ...init, signal }));
}

function joinDeepSeekUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function invalidResponse(
  message: string,
): DeepSeekAdapterResult<DeepSeekChatCompletionOutput> {
  return {
    ok: false,
    issue: {
      code: "invalid_response",
      message,
    },
  };
}

function invalidStreamLine(
  message: string,
): DeepSeekAdapterResult<DeepSeekStreamParseEvent> {
  return {
    ok: false,
    issue: {
      code: "invalid_stream_line",
      message,
    },
  };
}

function createHttpErrorMessage(status: number, statusText: string | undefined) {
  const suffix = statusText ? ` ${statusText}` : "";
  return `DeepSeek request failed with HTTP ${status}${suffix}.`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readToolCalls(raw: unknown): DeepSeekToolCall[] {
  if (!Array.isArray(raw)) return [];
  const calls: DeepSeekToolCall[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const fn = item.function;
    const id = readOptionalString(item.id);
    if (!id || !isRecord(fn)) continue;
    const name = readOptionalString(fn.name);
    if (!name) continue;
    calls.push({
      id,
      name,
      arguments:
        typeof fn.arguments === "string"
          ? fn.arguments
          : JSON.stringify(fn.arguments ?? {}),
    });
  }
  return calls;
}

function isDeepSeekChatRole(value: string | null): value is DeepSeekChatRole {
  return value === "system" || value === "user" || value === "assistant";
}
