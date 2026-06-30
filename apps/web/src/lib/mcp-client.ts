// 最小 MCP 客户端（Streamable HTTP 传输）：initialize → notifications/initialized → tools/list。
// 仅做"连接并列出工具"，不在 run 内调用工具（阶段 2 再做）。响应可能是 JSON 或 SSE，都解析。

const MCP_PROTOCOL_VERSION = "2025-06-18";

export type McpTool = {
  readonly name: string;
  readonly description: string | null;
  readonly inputSchema: unknown;
};

export type McpToolsResult =
  | {
      readonly ok: true;
      readonly serverName: string | null;
      readonly tools: readonly McpTool[];
    }
  | { readonly ok: false; readonly error: string };

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type RpcOutcome =
  | { ok: true; result: unknown; sessionId: string | null }
  | { ok: false; error: string };

export async function listMcpTools(
  rawUrl: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<McpToolsResult> {
  const fetchImpl = options.fetchImpl ?? (fetch as FetchLike);
  const url = normalizeMcpUrl(rawUrl);
  if (!url) {
    return { ok: false, error: "invalid_url: 仅支持 http(s) 的 MCP 端点。" };
  }

  try {
    const init = await mcpRpc(
      fetchImpl,
      url,
      null,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "sage-agent", version: "0.1.0" },
        },
      },
      options.signal,
    );
    if (!init.ok) return init;

    await mcpNotify(
      fetchImpl,
      url,
      init.sessionId,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      options.signal,
    );

    const list = await mcpRpc(
      fetchImpl,
      url,
      init.sessionId,
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      options.signal,
    );
    if (!list.ok) return list;

    return {
      ok: true,
      serverName: readServerName(init.result),
      tools: readTools(list.result),
    };
  } catch (error) {
    return { ok: false, error: `request_failed: ${errorMessage(error)}` };
  }
}

async function mcpRpc(
  fetchImpl: FetchLike,
  url: string,
  sessionId: string | null,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<RpcOutcome> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  const nextSession = res.headers.get("mcp-session-id") ?? sessionId;
  if (!res.ok) {
    return { ok: false, error: `http_error: ${res.status}` };
  }
  const message = await readRpcMessage(res);
  if (!isPlainRecord(message)) {
    return { ok: false, error: "invalid_response: 未收到 JSON-RPC 响应。" };
  }
  if (message.error) {
    return { ok: false, error: `mcp_error: ${rpcErrorMessage(message.error)}` };
  }
  return { ok: true, result: message.result, sessionId: nextSession };
}

async function mcpNotify(
  fetchImpl: FetchLike,
  url: string,
  sessionId: string | null,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<void> {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    // 通知无需结果，读掉响应体以释放连接。
    await res.text().catch(() => "");
  } catch {
    // 通知是 best-effort，失败不影响列工具。
  }
}

async function readRpcMessage(res: Response): Promise<unknown> {
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const text = await res.text();
  if (contentType.includes("text/event-stream")) {
    return parseSseForJsonRpc(text);
  }
  try {
    return JSON.parse(text);
  } catch {
    return parseSseForJsonRpc(text);
  }
}

function parseSseForJsonRpc(text: string): unknown {
  const dataPayloads = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  for (const payload of dataPayloads) {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (isPlainRecord(parsed) && ("result" in parsed || "error" in parsed)) {
        return parsed;
      }
    } catch {
      // 跳过非 JSON 的 SSE 行。
    }
  }
  return null;
}

function normalizeMcpUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function readServerName(result: unknown): string | null {
  if (isPlainRecord(result) && isPlainRecord(result.serverInfo)) {
    const name = result.serverInfo.name;
    if (typeof name === "string" && name.trim().length > 0) return name;
  }
  return null;
}

function readTools(result: unknown): McpTool[] {
  if (!isPlainRecord(result) || !Array.isArray(result.tools)) return [];
  const tools: McpTool[] = [];
  for (const raw of result.tools) {
    if (!isPlainRecord(raw) || typeof raw.name !== "string") continue;
    tools.push({
      name: raw.name,
      description:
        typeof raw.description === "string" ? raw.description : null,
      inputSchema: raw.inputSchema ?? null,
    });
  }
  return tools;
}

function rpcErrorMessage(error: unknown): string {
  if (isPlainRecord(error)) {
    const message =
      typeof error.message === "string" ? error.message : "unknown";
    const code = typeof error.code === "number" ? ` (${error.code})` : "";
    return `${message}${code}`;
  }
  return "unknown";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
