import * as path from "node:path";
import { NextResponse } from "next/server";
import { loadDeepSeekProviderConfig } from "@sage/deepseek";
import { isTerminalRunStatus } from "@sage/runtime";
import { getRuntimeStore, getTelemetryLogger } from "@/lib/runtime-store";
import {
  appendSupervisorFailureEvent,
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

  if (run.status !== "queued" || isTerminalRunStatus(run.status)) {
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

  telemetry.record({
    name: "api.runs.supervisor.started",
    source: "api",
    message: "Supervisor-only DeepSeek run started.",
    runId: run.id,
    threadId: run.threadId,
    metadata: {
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
        eventCount: result.events.length,
        error: result.ok ? null : result.safeMessage,
      },
    });

    return createRunEventStreamResponse(result.events);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let eventCount = 0;
      let finalError: string | null = null;
      let clientCancelled = false;
      try {
        const stream = streamSupervisorDeepSeekEvents({
          store,
          runId: run.id,
          config: configResult.config,
          workspaceRoot: WORKSPACE_ROOT,
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
      telemetry.record({
        name: "api.runs.supervisor.client_cancelled",
        level: "warn",
        source: "api",
        message: "Supervisor stream response was cancelled by the client.",
        runId: run.id,
        threadId: run.threadId,
        metadata: {
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
