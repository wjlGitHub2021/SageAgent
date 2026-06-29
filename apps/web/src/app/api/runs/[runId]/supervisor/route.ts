import * as path from "node:path";
import { NextResponse } from "next/server";
import { loadDeepSeekProviderConfig } from "@sage/deepseek";
import {
  createMemoryContextMessage,
  createSkillContextMessage,
} from "@sage/runtime";
import { getRuntimeStore, getTelemetryLogger } from "@/lib/runtime-store";
import { getMemoryRegistry } from "@/lib/memory-registry";
import { getSkillRegistry } from "@/lib/skill-registry";
import {
  appendSupervisorFailureEvent,
  claimSupervisorRun,
  streamSupervisorDeepSeekEvents,
} from "@/lib/supervisor-runner";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    runId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const store = getRuntimeStore();
  const telemetry = getTelemetryLogger();
  const run = store.getRun(runId);

  if (!run) {
    telemetry.record({
      name: "api.runs.supervisor.rejected",
      level: "warn",
      source: "api",
      message: "Supervisor run request referenced a missing run.",
      runId,
      metadata: {
        code: "run_not_found",
        status: 404,
      },
    });
    return jsonError("run_not_found", "Run was not found.", 404);
  }

  if (run.status !== "queued") {
    telemetry.record({
      name: "api.runs.supervisor.rejected",
      level: "warn",
      source: "api",
      message: "Supervisor run request referenced a run that is not runnable.",
      runId: run.id,
      threadId: run.threadId,
      metadata: {
        code: "run_not_runnable",
        status: 409,
        runStatus: run.status,
      },
    });
    return jsonError(
      "run_not_runnable",
      "Run has already started or finished.",
      409,
    );
  }

  const providerId = run.settings.providerId ?? "deepseek";
  if (providerId !== "deepseek") {
    const result = appendSupervisorFailureEvent({
      store,
      runId: run.id,
      safeMessage: `provider_error: unsupported_provider. ${providerId}`,
    });
    telemetry.record({
      name: "api.runs.supervisor.failed",
      level: "warn",
      source: "api",
      message: "Supervisor run referenced an unsupported provider.",
      runId: run.id,
      threadId: run.threadId,
      metadata: {
        ok: false,
        providerId,
        eventCount: result.events.length,
        error: result.ok ? null : result.safeMessage,
      },
    });

    return createRunEventStreamResponse(result.events);
  }

  telemetry.record({
    name: "api.runs.supervisor.started",
    source: "api",
    message: "Supervisor provider run started.",
    runId: run.id,
    threadId: run.threadId,
    metadata: {
      providerId,
      model: run.settings.model,
      reasoningEffort: run.settings.reasoningEffort,
      thinkingEnabled: run.settings.thinkingEnabled,
    },
  });

  const configResult = loadDeepSeekProviderConfig();
  if (!configResult.ok) {
    const result = appendSupervisorFailureEvent({
      store,
      runId: run.id,
      safeMessage: `provider_error: invalid_config. ${configResult.issues
        .map((issue) => issue.code)
        .join(", ")}`,
    });
    telemetry.record({
      name: "api.runs.supervisor.failed",
      level: "warn",
      source: "api",
      message: "Supervisor-only DeepSeek run failed before provider call.",
      runId: run.id,
      threadId: run.threadId,
      metadata: {
        ok: false,
        providerId,
        eventCount: result.events.length,
        error: result.ok ? null : result.safeMessage,
      },
    });

    return createRunEventStreamResponse(result.events);
  }

  // 在返回响应前同步 claim run，关闭 guard 检查与状态落库之间的 TOCTOU 窗口：
  // 并发的第二个请求会看到 running 状态并被下面或上方的 guard 拒绝。
  const claim = claimSupervisorRun({ store, runId: run.id });
  if (!claim.ok) {
    telemetry.record({
      name: "api.runs.supervisor.rejected",
      level: "warn",
      source: "api",
      message: "Supervisor run was already claimed by a concurrent request.",
      runId: run.id,
      threadId: run.threadId,
      metadata: {
        code: "run_not_runnable",
        status: 409,
        runStatus: store.getRun(run.id)?.status ?? "unknown",
      },
    });
    return jsonError(
      "run_not_runnable",
      "Run has already started or finished.",
      409,
    );
  }

  const memoryContextMessage = createMemoryContextMessage({
    snapshot: getMemoryRegistry().getSnapshot(),
    currentThreadId: run.threadId,
    currentRunId: run.id,
  });
  const skillContextMessage = createSkillContextMessage({
    snapshot: getSkillRegistry().getSnapshot(),
  });

  const encoder = new TextEncoder();
  // 客户端断开时 abort，用于中止上游 DeepSeek 流并释放连接，避免取消后继续消耗 token。
  const abortController = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let eventCount = 0;
      let finalError: string | null = null;
      let clientCancelled = false;
      try {
        // 启动事件已在 claim 时发出，这里先推给客户端，生成器不再重复发出。
        controller.enqueue(encoder.encode(encodeRunEvent(claim.startEvent)));
        eventCount += 1;
        const stream = streamSupervisorDeepSeekEvents({
          store,
          runId: run.id,
          config: configResult.config,
          workspaceRoot: WORKSPACE_ROOT,
          memoryContextMessage,
          skillContextMessage,
          emitRunStartedEvent: false,
          signal: abortController.signal,
        });
        for await (const event of stream) {
          eventCount += 1;
          if (event.type === "run.failed") {
            finalError = event.payload.error;
          }
          controller.enqueue(encoder.encode(encodeRunEvent(event)));
        }
      } catch (error) {
        if (isClientStreamAbort(error)) {
          clientCancelled = true;
          return;
        }

        const result = appendSupervisorFailureEvent({
          store,
          runId: run.id,
          safeMessage: "provider_error: unknown_stream_error.",
        });
        for (const event of result.events) {
          eventCount += 1;
          if (event.type === "run.failed") finalError = event.payload.error;
          controller.enqueue(encoder.encode(encodeRunEvent(event)));
        }
      } finally {
        telemetry.record({
          name: clientCancelled
            ? "api.runs.supervisor.client_cancelled"
            : finalError
            ? "api.runs.supervisor.failed"
            : "api.runs.supervisor.completed",
          level: clientCancelled || finalError ? "warn" : "info",
          source: "api",
          message: clientCancelled
            ? "Supervisor stream response was cancelled by the client."
            : finalError
            ? "Supervisor streaming DeepSeek run failed."
            : "Supervisor streaming DeepSeek run completed.",
          runId: run.id,
          threadId: run.threadId,
          metadata: {
            ok: !clientCancelled && finalError === null,
            clientCancelled,
            providerId,
            eventCount,
            error: finalError,
          },
        });
        try {
          controller.close();
        } catch {
          // The client may have gone away after the final event was written.
        }
      }
    },
    cancel() {
      // 透传取消到上游：中止 DeepSeek 流读取并释放连接。
      abortController.abort();
      telemetry.record({
        name: "api.runs.supervisor.client_cancelled",
        level: "warn",
        source: "api",
        message: "Supervisor stream response was cancelled by the client.",
        runId: run.id,
        threadId: run.threadId,
        metadata: {
          providerId,
          runStatus: store.getRun(run.id)?.status ?? "unknown",
        },
      });
    },
  });

  return new Response(body, {
    status: 201,
    headers: runEventStreamHeaders(),
  });
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function createRunEventStreamResponse(events: readonly unknown[]): Response {
  return new Response(events.map((event) => encodeRunEvent(event)).join(""), {
    status: 201,
    headers: runEventStreamHeaders(),
  });
}

function encodeRunEvent(event: unknown): string {
  const sequence =
    typeof event === "object" &&
    event !== null &&
    "sequence" in event &&
    typeof event.sequence === "number"
      ? event.sequence
      : 0;

  return [
    `id: ${sequence}`,
    "event: run-event",
    `data: ${JSON.stringify(event)}`,
    "",
    "",
  ].join("\n");
}

function runEventStreamHeaders(): HeadersInit {
  return {
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "content-type": "text/event-stream; charset=utf-8",
    "x-accel-buffering": "no",
  };
}

function isClientStreamAbort(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /abort|cancel|closed|controller/i.test(error.message);
}

const WORKSPACE_ROOT = normalizeWorkspaceRoot(
  process.env.SAGE_WORKSPACE_ROOT ??
    process.env.INIT_CWD ??
    path.resolve(process.cwd(), "..", ".."),
);

function normalizeWorkspaceRoot(value: string): string {
  return path.resolve(value);
}
