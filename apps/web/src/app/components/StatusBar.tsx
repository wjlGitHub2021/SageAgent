type Dict = Record<string, string>;

export function StatusBar({ t, model }: { t: Dict; model: string }) {
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
      <div className="status-bar-group">
        <span className="status-bar-item planned">
          {t.statusGateway} · {t.statusPlanned}
        </span>
        <span className="status-bar-item planned">
          {t.statusSchedule} · {t.statusPlanned}
        </span>
      </div>
      <div className="status-bar-spacer" />
      <span className="status-bar-version">v0.1.0</span>
    </footer>
  );
}
