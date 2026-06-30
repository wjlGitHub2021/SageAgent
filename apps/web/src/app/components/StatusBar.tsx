type Dict = Record<string, string>;

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function StatusBar({
  t,
  model,
  usedTokens,
  maxTokens,
}: {
  t: Dict;
  model: string;
  usedTokens: number | null;
  maxTokens: number;
}) {
  const pct =
    usedTokens !== null && maxTokens > 0
      ? Math.min(100, Math.round((usedTokens / maxTokens) * 100))
      : 0;

  return (
    <footer className="status-bar" aria-label={t.statusBar}>
      <div className="status-bar-group">
        <span className="status-bar-item">
          <span className="status-bar-dot" aria-hidden="true" />
          {t.statusLocalReady}
        </span>
        <span className="status-bar-item">
          {t.model}: {model}
        </span>
      </div>
      <div className="status-bar-spacer" />
      <span className="status-bar-item status-bar-meter" title={t.contextUsage}>
        <span className="status-bar-meter-text">
          {usedTokens !== null ? formatTokens(usedTokens) : "—"}/
          {formatTokens(maxTokens)}
        </span>
        <span className="status-bar-meter-track" aria-hidden="true">
          <span className="status-bar-meter-fill" style={{ width: `${pct}%` }} />
        </span>
        <span className="status-bar-meter-pct">
          {usedTokens !== null ? `${pct}%` : "—"}
        </span>
      </span>
      <span className="status-bar-version">v0.1.0</span>
    </footer>
  );
}
