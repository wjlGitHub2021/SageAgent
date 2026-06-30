type Dict = Record<string, string>;

export function Composer({
  t,
  value,
  onChange,
  onSubmit,
  onStop,
  onOpenModel,
  isBusy,
  canSubmit,
  model,
  reasoningEffort,
  statusText,
}: {
  t: Dict;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onOpenModel: () => void;
  isBusy: boolean;
  canSubmit: boolean;
  model: string;
  reasoningEffort: string;
  statusText: string;
}) {
  return (
    <div className="composer-dock">
      <div className="composer-pill">
        <div className="composer-pill-row">
          <button
            className="composer-add"
            disabled
            title={t.composerAdd}
            type="button"
          >
            <span aria-hidden="true">＋</span>
            <span className="sr-only">{t.composerAdd}</span>
          </button>
          <label className="sr-only" htmlFor="sage-composer-input">
            {t.composerInput}
          </label>
          <textarea
            aria-label={t.composerInput}
            className="composer-field"
            disabled={isBusy}
            id="sage-composer-input"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !isBusy &&
                canSubmit
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={t.composerPlaceholder}
            rows={1}
            value={value}
          />
        </div>
        <div className="composer-pill-foot">
          <button
            className="composer-model"
            onClick={onOpenModel}
            title={t.modelSettings}
            type="button"
          >
            <span>{model}</span>
            <span className="composer-model-sep">·</span>
            <span>{reasoningEffort}</span>
            <span aria-hidden="true" className="composer-model-caret">
              ⌄
            </span>
          </button>
          <div className="composer-pill-actions">
            <button
              aria-label={t.voiceInput}
              className="composer-mic"
              disabled
              title={t.voiceInput}
              type="button"
            >
              <span aria-hidden="true">🎤</span>
            </button>
            <button
              aria-label={isBusy ? t.cancel : t.run}
              className="composer-send"
              disabled={isBusy ? false : !canSubmit}
              onClick={isBusy ? onStop : onSubmit}
              title={isBusy ? t.cancel : t.run}
              type="button"
            >
              <span aria-hidden="true">{isBusy ? "■" : "↑"}</span>
            </button>
          </div>
        </div>
      </div>
      <span className="composer-status">{statusText}</span>
    </div>
  );
}
