import { NextResponse } from "next/server";
import {
  loadDeepSeekProviderConfig,
  type DeepSeekEnvironment,
} from "@sage/deepseek";
import {
  createDeepSeekProviderStatusSummary,
  createProviderRuntimeStatusResponse,
  testDeepSeekProviderConnection,
  type DeepSeekProviderConnectionTestResponse,
  type DeepSeekProviderStatusResponse,
} from "@/lib/deepseek-provider-status";

export const runtime = "nodejs";

export function GET() {
  const env = readDeepSeekEnvironment();
  const configResult = loadDeepSeekProviderConfig(env);
  const status = createDeepSeekProviderStatusSummary(configResult, env);
  const response: DeepSeekProviderStatusResponse = {
    status,
    ...createProviderRuntimeStatusResponse({ status }),
  };

  return NextResponse.json(response, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST() {
  const env = readDeepSeekEnvironment();
  const configResult = loadDeepSeekProviderConfig(env);
  const status = createDeepSeekProviderStatusSummary(configResult, env);
  const result = await testDeepSeekProviderConnection({ configResult });
  const response: DeepSeekProviderConnectionTestResponse = {
    status,
    ...createProviderRuntimeStatusResponse({
      status,
      checkedAt: result.checkedAt,
      auditAction: "connection_test",
    }),
    result,
  };

  return NextResponse.json(response, {
    headers: {
      "cache-control": "no-store",
    },
  });
}

function readDeepSeekEnvironment(): DeepSeekEnvironment {
  return {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL: process.env.DEEPSEEK_DEFAULT_MODEL,
    DEEPSEEK_DEFAULT_REASONING_EFFORT:
      process.env.DEEPSEEK_DEFAULT_REASONING_EFFORT,
    DEEPSEEK_THINKING_ENABLED: process.env.DEEPSEEK_THINKING_ENABLED,
  };
}
