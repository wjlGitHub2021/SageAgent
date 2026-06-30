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
  models,
  onSelectModel,
  sendKey,
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
  models: readonly string[];
  onSelectModel: (model: string) => void;
  sendKey: "enter" | "modEnter";
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
              if (event.key !== "Enter" || isBusy || !canSubmit) return;
              // enter：Enter 发送、Shift+Enter 换行；modEnter：Cmd/Ctrl+Enter 发送、Enter 换行。
              const shouldSend =
                sendKey === "modEnter"
                  ? event.metaKey || event.ctrlKey
                  : !event.shiftKey;
              if (shouldSend) {
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
