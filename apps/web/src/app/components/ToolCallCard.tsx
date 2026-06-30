"use client";

import { useState } from "react";

type Dict = Record<string, string>;

export type ToolCallCardData = {
  id: string;
  tool: string;
  agent: string;
  status: string;
  path: string | null;
  error: string | null;
  durationMs: number | null;
  resultPreview: string | null;
};

function formatDuration(ms: number | null): string | null {
  if (ms === null || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusLabel(status: string, t: Dict): string {
  if (status === "completed") return t.toolStatusCompleted;
  if (status === "failed") return t.toolStatusFailed;
  if (status === "running") return t.toolStatusRunning;
  return status;
}

function ToolCallCard({ call, t }: { call: ToolCallCardData; t: Dict }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(call.resultPreview || call.error);
  const duration = formatDuration(call.durationMs);

  return (
    <div className={`tool-card tool-card--${call.status}`}>
      <button
        type="button"
        className="tool-card-head"
        aria-expanded={hasBody ? open : undefined}
        onClick={() => hasBody && setOpen((value) => !value)}
        disabled={!hasBody}
      >
        <span className="tool-card-dot" aria-hidden="true" />
        <code className="tool-card-name">{call.tool}</code>
        {call.path ? <span className="tool-card-meta">{call.path}</span> : null}
        <span className="tool-card-spacer" />
        {duration ? <span className="tool-card-time">{duration}</span> : null}
        <span className="tool-card-status">{statusLabel(call.status, t)}</span>
        {hasBody ? (
          <span className="tool-card-chevron" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
        ) : null}
      </button>
      {open && hasBody ? (
        <div className="tool-card-body">
          {call.error ? (
            <p className="tool-card-error">
              {t.toolError}: {call.error}
            </p>
          ) : null}
          {call.resultPreview ? (
            <pre className="tool-card-pre">{call.resultPreview}</pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ConversationToolCalls({
  calls,
  t,
}: {
  calls: readonly ToolCallCardData[];
  t: Dict;
}) {
  if (calls.length === 0) return null;
  return (
    <div className="tool-call-stream" aria-label={t.toolCalls}>
      {calls.map((call) => (
        <ToolCallCard key={call.id} call={call} t={t} />
      ))}
    </div>
  );
}
