import type { DeepSeekModel, ReasoningEffort } from "@sage/shared";

import { requireDeepSeekApiKey, type DeepSeekApiKeyIssue } from "./api-key.js";
import type { DeepSeekProviderConfig } from "./config.js";

export const DEEPSEEK_CHAT_COMPLETIONS_PATH = "/chat/completions";

export type DeepSeekChatRole = "system" | "user" | "assistant";

export interface DeepSeekChatMessage {
  readonly role: DeepSeekChatRole;
  readonly content: string;
}

export interface DeepSeekChatCompletionInput {
  readonly messages: readonly DeepSeekChatMessage[];
  readonly model?: DeepSeekModel;
  readonly thinkingEnabled?: boolean;
  readonly reasoningEffort?: ReasoningEffort;
}

export interface DeepSeekChatCompletionRequestBody {
  readonly model: DeepSeekModel;
  readonly messages: readonly DeepSeekChatMessage[];
  readonly stream: boolean;
  readonly thinking: {
    readonly type: "enabled" | "disabled";
  };
  readonly reasoning_effort: ReasoningEffort;
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

type JsonRecord = Record<string, unknown>;

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
    reasoning_effort:
      input.reasoningEffort ?? config.defaultReasoningEffort,
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

    const content = readString(message.content);
    if (content === null) {
      return invalidResponse("DeepSeek response message content must be a string.");
    }

    choices.push({
      index: readNumber(rawChoice.index) ?? choices.length,
      message: {
        role: "assistant",
        content,
        reasoningContent: readOptionalString(message.reasoning_content),
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

function parseDeepSeekStreamPayload(
  payload: unknown,
): DeepSeekAdapterResult<DeepSeekStreamParseEvent> {
  if (!isRecord(payload)) {
    return invalidStreamLine("DeepSeek stream payload must be an object.");
  }

  const rawChoices = payload.choices;
  if (!Array.isArray(rawChoices) || rawChoices.length === 0) {
    return invalidStreamLine("DeepSeek stream payload choices must be a non-empty array.");
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

function defaultDeepSeekFetch(
  input: string,
  init: Parameters<DeepSeekFetch>[1],
): Promise<DeepSeekFetchResponse> {
  if (typeof fetch === "undefined") {
    return Promise.reject(new Error("fetch is not available."));
  }

  return fetch(input, init);
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

function isDeepSeekChatRole(value: string | null): value is DeepSeekChatRole {
  return value === "system" || value === "user" || value === "assistant";
}
