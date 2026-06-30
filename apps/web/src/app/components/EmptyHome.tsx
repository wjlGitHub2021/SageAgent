type Dict = Record<string, string>;

export function EmptyHome({ t }: { t: Dict }) {
  return (
    <div className="workspace-home">
      <div className="workspace-home-inner">
        <p className="workspace-home-eyebrow">{t.localWorkbench}</p>
        <h1 className="workspace-home-wordmark">SAGE AGENT</h1>
        <p className="workspace-home-subtitle">{t.homeSubtitle}</p>
      </div>
    </div>
  );
}
