import { useState } from "react";

type Dict = Record<string, string>;

export function Composer({
  t,
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  canSubmit,
  model,
  reasoningEffort,
  models,
  reasoningEfforts,
  onSelectModel,
  onSelectEffort,
  statusText,
}: {
  t: Dict;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isBusy: boolean;
  canSubmit: boolean;
  model: string;
  reasoningEffort: string;
  models: readonly string[];
  reasoningEfforts: readonly string[];
  onSelectModel: (model: string) => void;
  onSelectEffort: (effort: string) => void;
  statusText: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <div className="composer-model-wrap">
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="composer-model"
              onClick={() => setMenuOpen((open) => !open)}
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
            {menuOpen ? (
              <>
                <button
                  aria-hidden="true"
                  className="composer-menu-backdrop"
                  onClick={() => setMenuOpen(false)}
                  tabIndex={-1}
                  type="button"
                />
                <div className="composer-menu" role="menu">
                  <p className="composer-menu-label">{t.model}</p>
                  {models.map((option) => (
                    <button
                      aria-checked={option === model}
                      className={
                        option === model
                          ? "composer-menu-item active"
                          : "composer-menu-item"
                      }
                      key={option}
                      onClick={() => {
                        onSelectModel(option);
                        setMenuOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                  <p className="composer-menu-label">{t.reasoningEffort}</p>
                  {reasoningEfforts.map((option) => (
                    <button
                      aria-checked={option === reasoningEffort}
                      className={
                        option === reasoningEffort
                          ? "composer-menu-item active"
                          : "composer-menu-item"
                      }
                      key={option}
                      onClick={() => {
                        onSelectEffort(option);
                        setMenuOpen(false);
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
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
