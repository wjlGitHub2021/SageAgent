// 工具执行循环引擎：把 DeepSeek 非流式 chat completion 与 MCP tools/call 串起来。
// 循环 model→tool→model→answer，直到模型不再请求工具或达到上限。provider（DeepSeek
// 调用）与 mcpCaller（MCP 工具执行）均可注入，便于单测与服务端接线。
//
// V4 约束：带 tool_calls 的 assistant 轮，后续请求必须回传 reasoning_content，否则 400。
// 因此每次把 assistant 工具轮入栈时都带上 reasoningContent，由 normalizeMessages 序列化。

import type {
  DeepSeekAdapterResult,
  DeepSeekChatCompletionOutput,
  DeepSeekChatMessage,
  DeepSeekTool,
  DeepSeekToolCall,
} from "@sage/deepseek";

import type { McpCallResult, McpTool } from "./mcp-client.js";

// 默认最多 8 轮 model↔tool 往返，避免模型反复请求工具导致死循环。
export const DEFAULT_MAX_TOOL_ITERATIONS = 8;

// DeepSeek 提供方：注入一次带 tools 的非流式 chat completion 调用。
export type ToolLoopProvider = (
  messages: readonly DeepSeekChatMessage[],
  tools: readonly DeepSeekTool[],
) => Promise<DeepSeekAdapterResult<DeepSeekChatCompletionOutput>>;

// MCP 工具执行器：按工具名 + 解析后的参数执行，返回 callMcpTool 的结果形态。
export type ToolLoopCaller = (
  toolName: string,
  args: unknown,
) => Promise<McpCallResult>;

// 单次工具调用的观测事件，供上层（如 supervisor）实时把工具调用呈现给 UI。
export interface ToolLoopToolEvent {
  readonly name: string;
  // 模型给出的原始参数 JSON 字符串。
  readonly arguments: string;
  // 工具是否成功执行（参数解析失败 / 调用失败 / 工具自报错误均为 false）。
  readonly ok: boolean;
  // 回传给模型的结果文本（失败时为错误说明）。
  readonly content: string;
}

export interface ToolLoopInput {
  readonly messages: readonly DeepSeekChatMessage[];
  readonly tools: readonly DeepSeekTool[];
  readonly provider: ToolLoopProvider;
  readonly mcpCaller: ToolLoopCaller;
  readonly maxIterations?: number;
  // 每次工具调用执行后回调（同步）；用于观测/呈现，不影响循环控制流。
  readonly onToolCall?: (event: ToolLoopToolEvent) => void;
}

// MCP inputSchema → OpenAI 兼容 function parameters。缺失/非对象时退回空对象 schema，
// 让模型仍可无参调用，而不是把整次调用判错。供 /api/mcp/run 与 supervisor 工具分支复用。
export function mcpToolToDeepSeekTool(tool: McpTool): DeepSeekTool {
  const parameters =
    typeof tool.inputSchema === "object" && tool.inputSchema !== null
      ? (tool.inputSchema as Record<string, unknown>)
      : { type: "object", properties: {} };
  return {
    type: "function",
    function: {
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      parameters,
    },
  };
}

export type ToolLoopResult =
  | {
      readonly ok: true;
      readonly content: string;
      // 完整对话轨迹（含 assistant 工具轮与 tool 结果轮），便于上层展示/续接。
      readonly messages: readonly DeepSeekChatMessage[];
      readonly iterations: number;
      readonly toolCalls: number;
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly messages: readonly DeepSeekChatMessage[];
    };

export async function runMcpToolLoop(
  input: ToolLoopInput,
): Promise<ToolLoopResult> {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  const transcript: DeepSeekChatMessage[] = [...input.messages];
  let toolCallCount = 0;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const completion = await input.provider(transcript, input.tools);
    if (!completion.ok) {
      return {
        ok: false,
        error: `${completion.issue.code}: ${completion.issue.message}`,
        messages: transcript,
      };
    }

    const choice = completion.value.choices[0];
    if (!choice) {
      return {
        ok: false,
        error: "invalid_response: DeepSeek 未返回任何 choice。",
        messages: transcript,
      };
    }

    const { content, reasoningContent, toolCalls } = choice.message;

    // 无工具调用：得到最终答复，入栈后返回。
    if (toolCalls.length === 0) {
      transcript.push({ role: "assistant", content });
      return {
        ok: true,
        content,
        messages: transcript,
        iterations: iteration,
        toolCalls: toolCallCount,
      };
    }

    // 有工具调用：先把 assistant 工具轮（含 reasoning_content）入栈，再逐个执行
    // 并追加 tool 结果轮，然后回到下一轮把结果交给模型。
    transcript.push({
      role: "assistant",
      content,
      reasoningContent,
      toolCalls,
    });

    for (const call of toolCalls) {
      toolCallCount += 1;
      const outcome = await executeToolCall(input.mcpCaller, call);
      input.onToolCall?.({
        name: call.name,
        arguments: call.arguments,
        ok: outcome.ok,
        content: outcome.content,
      });
      transcript.push({
        role: "tool",
        toolCallId: call.id,
        content: outcome.content,
      });
    }
  }

  return {
    ok: false,
    error: `max_iterations_exceeded: 超过 ${maxIterations} 轮仍未得到最终答复。`,
    messages: transcript,
  };
}

// 执行单个工具调用，并把结果（含失败/错误）归一化为可回传给模型的文本。
// 失败不抛出，而是把错误文本作为 tool 结果回传，让模型据此恢复或说明；
// ok 标识本次是否真正成功（供 onToolCall 观测）。
async function executeToolCall(
  mcpCaller: ToolLoopCaller,
  call: DeepSeekToolCall,
): Promise<{ ok: boolean; content: string }> {
  const parsed = parseToolArguments(call.arguments);
  if (!parsed.ok) {
    return { ok: false, content: `工具参数不是合法 JSON：${parsed.error}` };
  }

  const result = await mcpCaller(call.name, parsed.value);
  if (!result.ok) {
    return { ok: false, content: `工具执行失败：${result.error}` };
  }
  return result.isError
    ? { ok: false, content: `工具返回错误：${result.content}` }
    : { ok: true, content: result.content };
}

function parseToolArguments(
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = raw.trim();
  // 无参数工具常回传空串，按空对象处理。
  if (trimmed.length === 0) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
