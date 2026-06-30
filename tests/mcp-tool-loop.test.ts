import { describe, expect, it } from "vitest";

import type {
  DeepSeekAdapterResult,
  DeepSeekChatCompletionOutput,
  DeepSeekChatMessage,
  DeepSeekToolCall,
} from "@sage/deepseek";

import {
  runMcpToolLoop,
  type ToolLoopCaller,
  type ToolLoopProvider,
} from "../apps/web/src/lib/mcp-tool-loop";
import type { McpCallResult } from "../apps/web/src/lib/mcp-client";

function completion(message: {
  content?: string;
  reasoningContent?: string | null;
  toolCalls?: DeepSeekToolCall[];
}): DeepSeekAdapterResult<DeepSeekChatCompletionOutput> {
  const toolCalls = message.toolCalls ?? [];
  return {
    ok: true,
    value: {
      id: "x",
      model: "deepseek-v4-flash",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: message.content ?? "",
            reasoningContent: message.reasoningContent ?? null,
            toolCalls,
          },
          finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
        },
      ],
    },
  };
}

// 按脚本依次返回响应，并记录每轮收到的 messages 快照（深拷贝）。
function scriptedProvider(
  responses: readonly DeepSeekAdapterResult<DeepSeekChatCompletionOutput>[],
): {
  provider: ToolLoopProvider;
  receivedMessages: DeepSeekChatMessage[][];
} {
  const receivedMessages: DeepSeekChatMessage[][] = [];
  let index = 0;
  const provider: ToolLoopProvider = async (messages) => {
    receivedMessages.push(messages.map((m) => ({ ...m })));
    const response = responses[index] ?? responses[responses.length - 1];
    index += 1;
    return response;
  };
  return { provider, receivedMessages };
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: { type: "object", properties: { city: { type: "string" } } },
    },
  },
];

describe("MCP tool loop", () => {
  it("runs model→tool→model→answer and threads the tool result back", async () => {
    const { provider, receivedMessages } = scriptedProvider([
      completion({
        reasoningContent: "Let me check the weather tool.",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: '{"city":"SF"}' },
        ],
      }),
      completion({ content: "It's sunny and 22C in SF." }),
    ]);

    const callerArgs: Array<{ name: string; args: unknown }> = [];
    const mcpCaller: ToolLoopCaller = async (name, args) => {
      callerArgs.push({ name, args });
      return { ok: true, content: "Sunny, 22C", isError: false };
    };

    const result = await runMcpToolLoop({
      messages: [{ role: "user", content: "weather in SF?" }],
      tools,
      provider,
      mcpCaller,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe("It's sunny and 22C in SF.");
    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toBe(1);

    // 参数被解析为对象后传给 mcpCaller。
    expect(callerArgs).toEqual([{ name: "get_weather", args: { city: "SF" } }]);

    // 第二轮请求里，assistant 工具轮带回 reasoning_content，tool 轮带 tool_call_id。
    const secondCall = receivedMessages[1];
    expect(secondCall).toHaveLength(3);
    expect(secondCall[1]).toMatchObject({
      role: "assistant",
      reasoningContent: "Let me check the weather tool.",
    });
    expect(secondCall[1]?.toolCalls?.[0]?.id).toBe("call_1");
    expect(secondCall[2]).toEqual({
      role: "tool",
      toolCallId: "call_1",
      content: "Sunny, 22C",
    });
  });

  it("feeds tool execution failures back to the model instead of throwing", async () => {
    const { provider } = scriptedProvider([
      completion({
        toolCalls: [{ id: "c1", name: "get_weather", arguments: "{}" }],
      }),
      completion({ content: "抱歉，天气服务暂时不可用。" }),
    ]);

    let lastToolContent = "";
    const mcpCaller: ToolLoopCaller = async () => {
      const failure: McpCallResult = { ok: false, error: "http_error: 500" };
      return failure;
    };
    // 捕获回传给模型的 tool 内容。
    const wrapped: ToolLoopProvider = async (messages, t) => {
      const toolMsg = [...messages].reverse().find((m) => m.role === "tool");
      if (toolMsg) lastToolContent = toolMsg.content;
      return provider(messages, t);
    };

    const result = await runMcpToolLoop({
      messages: [{ role: "user", content: "weather?" }],
      tools,
      provider: wrapped,
      mcpCaller,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe("抱歉，天气服务暂时不可用。");
    expect(lastToolContent).toBe("工具执行失败：http_error: 500");
  });

  it("does not call the tool when arguments are not valid JSON", async () => {
    const { provider, receivedMessages } = scriptedProvider([
      completion({
        toolCalls: [{ id: "c1", name: "get_weather", arguments: "not-json" }],
      }),
      completion({ content: "已修正。" }),
    ]);

    let callerInvoked = 0;
    const mcpCaller: ToolLoopCaller = async () => {
      callerInvoked += 1;
      return { ok: true, content: "x", isError: false };
    };

    const result = await runMcpToolLoop({
      messages: [{ role: "user", content: "go" }],
      tools,
      provider,
      mcpCaller,
    });

    expect(result.ok).toBe(true);
    expect(callerInvoked).toBe(0);
    const toolMsg = receivedMessages[1]?.[2];
    expect(toolMsg?.role).toBe("tool");
    expect(toolMsg?.content).toContain("工具参数不是合法 JSON");
  });

  it("stops with an error once max iterations is exceeded", async () => {
    // 模型每轮都请求工具，永不收尾。
    const { provider } = scriptedProvider([
      completion({
        toolCalls: [{ id: "c", name: "get_weather", arguments: "{}" }],
      }),
    ]);
    const mcpCaller: ToolLoopCaller = async () => ({
      ok: true,
      content: "ok",
      isError: false,
    });

    const result = await runMcpToolLoop({
      messages: [{ role: "user", content: "loop" }],
      tools,
      provider,
      mcpCaller,
      maxIterations: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("max_iterations_exceeded");
    // 2 轮各 1 次工具：user + 2×(assistant + tool) = 5 条。
    expect(result.messages).toHaveLength(5);
  });

  it("propagates provider failures", async () => {
    const provider: ToolLoopProvider = async () => ({
      ok: false,
      issue: { code: "http_error", message: "boom", status: 500 },
    });
    const mcpCaller: ToolLoopCaller = async () => ({
      ok: true,
      content: "ok",
      isError: false,
    });

    const result = await runMcpToolLoop({
      messages: [{ role: "user", content: "x" }],
      tools,
      provider,
      mcpCaller,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("http_error: boom");
  });
});
