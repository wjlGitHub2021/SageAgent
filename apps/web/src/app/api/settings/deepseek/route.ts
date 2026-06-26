import { NextResponse } from "next/server";
import {
  loadDeepSeekProviderConfig,
  type DeepSeekEnvironment,
} from "@sage/deepseek";
import {
  createDeepSeekProviderStatusSummary,
  testDeepSeekProviderConnection,
  type DeepSeekProviderConnectionTestResponse,
  type DeepSeekProviderStatusResponse,
} from "@/lib/deepseek-provider-status";

export const runtime = "nodejs";

export function GET() {
  const env = readDeepSeekEnvironment();
  const configResult = loadDeepSeekProviderConfig(env);
  const response: DeepSeekProviderStatusResponse = {
    status: createDeepSeekProviderStatusSummary(configResult, env),
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
  const response: DeepSeekProviderConnectionTestResponse = {
    status: createDeepSeekProviderStatusSummary(configResult, env),
    result: await testDeepSeekProviderConnection({ configResult }),
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
