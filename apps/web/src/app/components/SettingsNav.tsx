"use client";

import type { ReactNode } from "react";

type Dict = Record<string, string>;

type NavItem = { key: string; labelKey: string };
type NavGroup = { items: readonly NavItem[] };

// 仅列出我们真实拥有功能的分类（参照 Hermes 布局，但不伪造没有的项）。
const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { key: "model", labelKey: "navModel" },
      { key: "appearance", labelKey: "navAppearance" },
      { key: "workspace", labelKey: "navWorkspace" },
      { key: "security", labelKey: "navSecurity" },
      { key: "memory", labelKey: "navMemory" },
    ],
  },
  {
    items: [
      { key: "providers", labelKey: "navProviders" },
      { key: "tools", labelKey: "navTools" },
      { key: "archived", labelKey: "navArchived" },
    ],
  },
  {
    items: [{ key: "about", labelKey: "navAbout" }],
  },
];

function Icon({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const paths: Record<string, ReactNode> = {
    model: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
      </>
    ),
    appearance: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="8.5" cy="10" r="1" />
        <circle cx="15.5" cy="10" r="1" />
        <circle cx="12" cy="15.5" r="1" />
      </>
    ),
    workspace: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
    security: (
      <>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      </>
    ),
    memory: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    providers: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
    tools: (
      <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2z" />
    ),
    archived: (
      <>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
        <path d="M10 12h4" />
      </>
    ),
    about: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function SettingsNav({
  tab,
  onSelect,
  t,
}: {
  tab: string;
  onSelect: (key: string) => void;
  t: Dict;
}) {
  return (
    <nav className="settings-nav" aria-label={t.settingsTitle}>
      {NAV_GROUPS.map((group, index) => (
        <div className="settings-nav-group" key={index}>
          {group.items.map((item) => (
            <button
              aria-current={tab === item.key ? "page" : undefined}
              className={
                tab === item.key
                  ? "settings-nav-item active"
                  : "settings-nav-item"
              }
              key={item.key}
              onClick={() => onSelect(item.key)}
              type="button"
            >
              <Icon name={item.key} />
              <span>{t[item.labelKey]}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
