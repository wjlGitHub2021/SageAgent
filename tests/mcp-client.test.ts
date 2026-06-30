import { describe, expect, it } from "vitest";
import { callMcpTool, listMcpTools } from "../apps/web/src/lib/mcp-client";

type FakeResponseInit = {
  status?: number;
  contentType?: string;
  body?: string;
  sessionId?: string;
};

function fakeResponse(init: FakeResponseInit): Response {
  const status = init.status ?? 200;
  const headers = new Map<string, string>([
    ["content-type", init.contentType ?? "application/json"],
  ]);
  if (init.sessionId) headers.set("mcp-session-id", init.sessionId);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
    text: async () => init.body ?? "",
    json: async () => JSON.parse(init.body ?? "null"),
  } as unknown as Response;
}

describe("MCP client", () => {
  it("lists tools over JSON transport and forwards the session id", async () => {
    const seenSessionIds: (string | null)[] = [];
    const fetchImpl = async (_url: string, requestInit?: RequestInit) => {
      const headers = (requestInit?.headers ?? {}) as Record<string, string>;
      const message = JSON.parse(String(requestInit?.body));
      if (message.method === "initialize") {
        return fakeResponse({
          sessionId: "sess-1",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: { serverInfo: { name: "test-server" }, capabilities: {} },
          }),
        });
      }
      if (message.method === "notifications/initialized") {
        return fakeResponse({ status: 202, body: "" });
      }
      if (message.method === "tools/list") {
        seenSessionIds.push(headers["mcp-session-id"] ?? null);
        return fakeResponse({
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                { name: "echo", description: "Echo back", inputSchema: {} },
                { name: "add" },
              ],
            },
          }),
        });
      }
      throw new Error(`unexpected method ${message.method}`);
    };

    const result = await listMcpTools("https://mcp.example.com/mcp", {
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.serverName).toBe("test-server");
    expect(result.tools.map((tool) => tool.name)).toEqual(["echo", "add"]);
    expect(result.tools[0]?.description).toBe("Echo back");
    expect(result.tools[1]?.description).toBeNull();
    // tools/list 必须带上 initialize 返回的会话 id。
    expect(seenSessionIds).toEqual(["sess-1"]);
  });

  it("parses SSE (text/event-stream) responses", async () => {
    const fetchImpl = async (_url: string, requestInit?: RequestInit) => {
      const message = JSON.parse(String(requestInit?.body));
      if (message.method === "initialize") {
        return fakeResponse({
          contentType: "text/event-stream",
          body:
            "event: message\n" +
            'data: {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"sse-server"}}}\n\n',
        });
      }
      if (message.method === "notifications/initialized") {
        return fakeResponse({ status: 202, body: "" });
      }
      return fakeResponse({
        contentType: "text/event-stream",
        body:
          "event: message\n" +
          'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"search"}]}}\n\n',
      });
    };

    const result = await listMcpTools("https://mcp.example.com/sse", {
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.serverName).toBe("sse-server");
    expect(result.tools.map((tool) => tool.name)).toEqual(["search"]);
  });

  it("rejects non-http(s) URLs without calling fetch", async () => {
    let called = false;
    const result = await listMcpTools("ftp://nope", {
      fetchImpl: async () => {
        called = true;
        return fakeResponse({ body: "{}" });
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid_url");
    expect(called).toBe(false);
  });

  it("surfaces HTTP errors from the server", async () => {
    const result = await listMcpTools("https://mcp.example.com/mcp", {
      fetchImpl: async () => fakeResponse({ status: 500, body: "boom" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("http_error: 500");
  });

  it("calls a tool and returns its text content", async () => {
    let calledParams: unknown = null;
    const fetchImpl = async (_url: string, requestInit?: RequestInit) => {
      const message = JSON.parse(String(requestInit?.body));
      if (message.method === "initialize") {
        return fakeResponse({
          sessionId: "s",
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
        });
      }
      if (message.method === "notifications/initialized") {
        return fakeResponse({ status: 202, body: "" });
      }
      calledParams = message.params;
      return fakeResponse({
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [{ type: "text", text: "Sunny, 22°C" }],
            isError: false,
          },
        }),
      });
    };

    const result = await callMcpTool(
      "https://mcp.example.com/mcp",
      "get_weather",
      { city: "SF" },
      { fetchImpl },
    );

    expect(calledParams).toEqual({
      name: "get_weather",
      arguments: { city: "SF" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe("Sunny, 22°C");
    expect(result.isError).toBe(false);
  });

  it("surfaces tool call errors", async () => {
    const fetchImpl = async (_url: string, requestInit?: RequestInit) => {
      const message = JSON.parse(String(requestInit?.body));
      if (message.method === "initialize") {
        return fakeResponse({
          sessionId: "s",
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
        });
      }
      if (message.method === "notifications/initialized") {
        return fakeResponse({ status: 202, body: "" });
      }
      return fakeResponse({
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          error: { code: -32602, message: "Unknown tool" },
        }),
      });
    };
    const result = await callMcpTool("https://mcp.example.com/mcp", "nope", {}, {
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Unknown tool");
  });

  it("surfaces JSON-RPC errors from tools/list", async () => {
    const fetchImpl = async (_url: string, requestInit?: RequestInit) => {
      const message = JSON.parse(String(requestInit?.body));
      if (message.method === "initialize") {
        return fakeResponse({
          sessionId: "s",
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
        });
      }
      if (message.method === "notifications/initialized") {
        return fakeResponse({ status: 202, body: "" });
      }
      return fakeResponse({
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          error: { code: -32601, message: "Method not found" },
        }),
      });
    };
    const result = await listMcpTools("https://mcp.example.com/mcp", {
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("mcp_error");
    expect(result.error).toContain("Method not found");
  });
});
