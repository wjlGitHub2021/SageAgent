import { describe, expect, it } from "vitest";

import type { Run, RunEvent, Thread } from "@sage/shared";
import { getRuntimeStore } from "../apps/web/src/lib/runtime-store";
import { POST as createRun } from "../apps/web/src/app/api/runs/route";
import { POST as runSupervisor } from "../apps/web/src/app/api/runs/[runId]/supervisor/route";
import { POST as streamOutput } from "../apps/web/src/app/api/runs/[runId]/stream-output/route";

describe("run routes", () => {
  it("stores providerId on newly created runs", async () => {
    const response = await createRun(jsonRequest({
      goal: "Verify provider registry settings",
      title: "Provider registry run",
      threadTitle: "Provider registry thread",
      settings: {
        model: "deepseek-v4-flash",
        thinkingEnabled: true,
        reasoningEffort: "high",
      },
    }));
    const body = (await response.json()) as { readonly run: Run };

    expect(response.status).toBe(201);
    expect(body.run.settings).toMatchObject({
      providerId: "deepseek",
      model: "deepseek-v4-flash",
      thinkingEnabled: true,
      reasoningEffort: "high",
    });
  });

  it("rejects unsupported provider ids before creating a run", async () => {
    const response = await createRun(jsonRequest({
      goal: "Reject unsupported provider",
      settings: {
        providerId: "other-provider",
        model: "deepseek-v4-flash",
        thinkingEnabled: true,
        reasoningEffort: "high",
      },
    }));
    const body = (await response.json()) as {
      readonly error: { readonly code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_provider");
  });

  it("fails supervisor runs with unsupported providers instead of falling back silently", async () => {
    const store = getRuntimeStore();
    const createdAt = "2026-06-28T10:00:00.000Z";
    const thread: Thread = {
      id: "thread-unsupported-provider",
      title: "Unsupported provider",
      createdAt,
      updatedAt: createdAt,
    };
    const run: Run = {
      id: "run-unsupported-provider",
      threadId: thread.id,
      title: "Unsupported provider",
      goal: "Verify unsupported provider dispatch",
      status: "queued",
      activeAgent: null,
      settings: {
        providerId: "future-provider",
        model: "deepseek-v4-flash",
        thinkingEnabled: true,
        reasoningEffort: "high",
      },
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
    };

    store.upsertThread(thread);
    store.upsertRun(run);

    const response = await runSupervisor(
      new Request(
        "http://localhost/api/runs/run-unsupported-provider/supervisor",
        {
          method: "POST",
        },
      ),
      {
        params: Promise.resolve({ runId: run.id }),
      },
    );
    const events = parseSseEvents(await response.text());

    expect(response.status).toBe(201);
    expect(events.at(-1)).toMatchObject({
      type: "run.failed",
      payload: {
        error: "provider_error: unsupported_provider. future-provider",
      },
    });
    expect(store.getRun(run.id)).toMatchObject({
      status: "failed",
      activeAgent: "supervisor",
    });
  });
  it("rejects stream output for runs that are not queued", async () => {
    const store = getRuntimeStore();
    const createdAt = "2026-06-29T10:00:00.000Z";
    const run: Run = {
      id: "run-stream-output-guard",
      threadId: "thread-stream-output-guard",
      title: "Stream output guard",
      goal: "Verify stream output guard",
      status: "completed",
      activeAgent: null,
      settings: {
        providerId: "deepseek",
        model: "deepseek-v4-flash",
        thinkingEnabled: true,
        reasoningEffort: "high",
      },
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
    };
    store.upsertRun(run);

    const response = await streamOutput(
      new Request(
        "http://localhost/api/runs/run-stream-output-guard/stream-output",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunks: ["x"], agent: "supervisor" }),
        },
      ),
      { params: Promise.resolve({ runId: run.id }) },
    );
    const body = (await response.json()) as {
      readonly error: { readonly code: string };
    };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("run_not_queued");
    // 运行状态未被改写
    expect(store.getRun(run.id)).toMatchObject({ status: "completed" });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function parseSseEvents(text: string): RunEvent[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)) as RunEvent);
}
