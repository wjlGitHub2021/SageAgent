"use client";

import { useState } from "react";

type Dict = Record<string, string>;

export function ThinkingBlock({
  reasoning,
  t,
}: {
  reasoning: string;
  t: Dict;
}) {
  const [open, setOpen] = useState(false);
  const text = reasoning.trim();
  if (text.length === 0) return null;

  return (
    <div className={`thinking-block${open ? " thinking-block--open" : ""}`}>
      <button
        type="button"
        className="thinking-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="thinking-icon" aria-hidden="true">
          ✦
        </span>
        <span className="thinking-label">{t.thinkingLabel}</span>
        <span className="thinking-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <div className="thinking-body">{text}</div> : null}
    </div>
  );
}
