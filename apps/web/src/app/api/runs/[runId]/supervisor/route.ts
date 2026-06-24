import { NextResponse } from "next/server";
import { loadDeepSeekProviderConfig } from "@sage/deepseek";
import { isTerminalRunStatus } from "@sage/runtime";
import { getRuntimeStore, getTelemetryLogger } from "@/lib/runtime-store";
import {
  appendSupervisorFailureEvent,
  runSupervisorDeepSeekOnce,
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
  const result = configResult.ok
    ? await runSupervisorDeepSeekOnce({
        store,
        runId: run.id,
        config: configResult.config,
      })
    : appendSupervisorFailureEvent({
        store,
        runId: run.id,
        safeMessage: `provider_error: invalid_config. ${configResult.issues
          .map((issue) => issue.code)
          .join(", ")}`,
      });

  telemetry.record({
    name: result.ok
      ? "api.runs.supervisor.completed"
      : "api.runs.supervisor.failed",
    level: result.ok ? "info" : "warn",
    source: "api",
    message: result.ok
      ? "Supervisor-only DeepSeek run completed."
      : "Supervisor-only DeepSeek run failed with a safe provider error.",
    runId: run.id,
    threadId: run.threadId,
    metadata: {
      ok: result.ok,
      eventCount: result.events.length,
      error: result.ok ? null : result.safeMessage,
    },
  });

  return NextResponse.json(
    {
      ok: result.ok,
      events: result.events,
      message: result.ok ? result.message : null,
      error: result.ok
        ? null
        : {
            code: result.code,
            message: result.safeMessage,
          },
      snapshot: store.getSnapshot(),
    },
    { status: 201 },
  );
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}
