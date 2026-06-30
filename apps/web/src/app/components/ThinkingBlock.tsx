"use client";

import { useState } from "react";

type Dict = Record<string, string>;

export function ThinkingBlock({
  reasoning,
  streaming = false,
  t,
}: {
  reasoning: string;
  streaming?: boolean;
  t: Dict;
}) {
  // null = 未手动干预，跟随 streaming：流式时自动展开，完成后自动收起。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const text = reasoning.trim();
  if (text.length === 0) return null;
  const open = manualOpen ?? streaming;

  return (
    <div
      className={`thinking-block${open ? " thinking-block--open" : ""}${
        streaming ? " thinking-block--streaming" : ""
      }`}
    >
      <button
        type="button"
        className="thinking-head"
        aria-expanded={open}
        onClick={() => setManualOpen(!open)}
      >
        <span className="thinking-icon" aria-hidden="true">
          ✦
        </span>
        <span className="thinking-label">
          {streaming ? t.thinkingInProgress : t.thinkingLabel}
        </span>
        <span className="thinking-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <div className="thinking-body">{text}</div> : null}
    </div>
  );
}
