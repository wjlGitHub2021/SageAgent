import { NextResponse } from "next/server";
import {
  createDeepSeekChatCompletion,
  loadDeepSeekProviderConfig,
  type DeepSeekTool,
} from "@sage/deepseek";
import { callMcpTool, listMcpTools, type McpTool } from "@/lib/mcp-client";
import {
  runMcpToolLoop,
  type ToolLoopCaller,
  type ToolLoopProvider,
} from "@/lib/mcp-tool-loop";

export const runtime = "nodejs";

// 整轮上限：握手列工具 + 多轮 model↔tool 往返，给 90s。
const RUN_TIMEOUT_MS = 90_000;

// MCP 设置里的「试运行」：服务端代为完成 MCP 握手列工具 → 把工具下发给 DeepSeek →
// 模型请求工具时回 MCP 执行 → 结果回灌模型，直到拿到最终答复。一次真实跑通工具链。
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const url = readField(body, "url");
  const prompt = readField(body, "prompt");
  if (!url) {
    return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json(
      { ok: false, error: "missing_prompt" },
      { status: 400 },
    );
  }

  // 缺 key / 配置非法时直接回错，不发起任何外呼。
  const configResult = loadDeepSeekProviderConfig();
  if (!configResult.ok) {
    return NextResponse.json({
      ok: false,
      error: `provider_error: invalid_config. ${configResult.issues
        .map((issue) => issue.code)
        .join(", ")}`,
    });
  }

  const signal = AbortSignal.timeout(RUN_TIMEOUT_MS);

  // 列出工具（也作为「该服务器是否可用」的前置校验）。
  const toolsResult = await listMcpTools(url, { signal });
  if (!toolsResult.ok) {
    return NextResponse.json({ ok: false, error: toolsResult.error });
  }
  if (toolsResult.tools.length === 0) {
    return NextResponse.json({ ok: false, error: "no_tools" });
  }

  const tools = toolsResult.tools.map(toDeepSeekTool);

  const provider: ToolLoopProvider = (messages, providerTools) =>
    createDeepSeekChatCompletion(configResult.config, {
      messages,
      tools: providerTools,
    });

  const mcpCaller: ToolLoopCaller = (toolName, args) =>
    callMcpTool(url, toolName, args, { signal });

  const result = await runMcpToolLoop({
    messages: [{ role: "user", content: prompt }],
    tools,
    provider,
    mcpCaller,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error });
  }

  return NextResponse.json({
    ok: true,
    content: result.content,
    iterations: result.iterations,
    toolCalls: result.toolCalls,
    toolNames: toolsResult.tools.map((tool) => tool.name),
  });
}

// MCP inputSchema → OpenAI 兼容 function parameters。缺失/非对象时退回空对象 schema，
// 让模型仍可无参调用，而不是把整次试运行判错。
function toDeepSeekTool(tool: McpTool): DeepSeekTool {
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

function readField(body: unknown, key: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
