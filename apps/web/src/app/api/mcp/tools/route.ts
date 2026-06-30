import { NextResponse } from "next/server";
import { listMcpTools } from "@/lib/mcp-client";

export const runtime = "nodejs";

// 服务端代为完成 MCP 握手并列出工具：避免浏览器跨域，且为阶段 2 的 run 内调用打基础。
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

  const url =
    typeof body === "object" && body !== null
      ? (body as { url?: unknown }).url
      : undefined;
  if (typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "missing_url" },
      { status: 400 },
    );
  }

  const result = await listMcpTools(url.trim(), {
    signal: AbortSignal.timeout(12000),
  });
  // 始终 200，错误放在 envelope 里，前端可内联展示。
  return NextResponse.json(result);
}
