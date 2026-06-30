"use client";

import { useEffect, useState } from "react";
import type { McpTool } from "@/lib/mcp-client";

type Dict = Record<string, string>;

const MCP_SERVERS_STORAGE_KEY = "sage.mcpServers";

type McpServer = { id: string; label: string; url: string };
type ProbeState = {
  status: "idle" | "loading" | "ok" | "error";
  tools?: readonly McpTool[];
  serverName?: string | null;
  error?: string;
};

function makeId(seed: string): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }
  return `mcp-${seed}`;
}

export function McpSettings({ t }: { t: Dict }) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [urlDraft, setUrlDraft] = useState("");
  const [probes, setProbes] = useState<Record<string, ProbeState>>({});

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(MCP_SERVERS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) {
          setServers(
            parsed.filter(
              (item): item is McpServer =>
                typeof item === "object" &&
                item !== null &&
                typeof item.id === "string" &&
                typeof item.label === "string" &&
                typeof item.url === "string",
            ),
          );
        }
      } catch {
        // 忽略损坏的本地存储。
      }
      setHasLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      window.localStorage.setItem(
        MCP_SERVERS_STORAGE_KEY,
        JSON.stringify(servers),
      );
    }
  }, [hasLoaded, servers]);

  function addServer() {
    const url = urlDraft.trim();
    if (url.length === 0) return;
    const label = labelDraft.trim() || url;
    setServers((current) => [...current, { id: makeId(url), label, url }]);
    setLabelDraft("");
    setUrlDraft("");
  }

  function removeServer(id: string) {
    setServers((current) => current.filter((server) => server.id !== id));
    setProbes((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function probeServer(server: McpServer) {
    setProbes((current) => ({ ...current, [server.id]: { status: "loading" } }));
    try {
      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: server.url }),
      });
      const data = await response.json();
      if (data?.ok) {
        setProbes((current) => ({
          ...current,
          [server.id]: {
            status: "ok",
            tools: data.tools ?? [],
            serverName: data.serverName ?? null,
          },
        }));
      } else {
        setProbes((current) => ({
          ...current,
          [server.id]: { status: "error", error: data?.error ?? "unknown" },
        }));
      }
    } catch (error) {
      setProbes((current) => ({
        ...current,
        [server.id]: { status: "error", error: String(error) },
      }));
    }
  }

  return (
    <article className="settings-card">
      <div>
        <p>{t.mcpTitle}</p>
        <small>{t.mcpDetail}</small>
      </div>

      <div className="mcp-add">
        <input
          aria-label={t.mcpLabelPlaceholder}
          className="desktop-key-input"
          onChange={(event) => setLabelDraft(event.target.value)}
          placeholder={t.mcpLabelPlaceholder}
          type="text"
          value={labelDraft}
        />
        <input
          aria-label={t.mcpUrlPlaceholder}
          className="desktop-key-input"
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addServer();
          }}
          placeholder={t.mcpUrlPlaceholder}
          type="url"
          value={urlDraft}
        />
        <button
          disabled={urlDraft.trim().length === 0}
          onClick={addServer}
          type="button"
        >
          {t.mcpAdd}
        </button>
      </div>

      {servers.length === 0 ? (
        <small className="settings-card-hint">{t.mcpNoServers}</small>
      ) : (
        <div className="mcp-list">
          {servers.map((server) => {
            const probe = probes[server.id] ?? { status: "idle" };
            return (
              <div className="mcp-server" key={server.id}>
                <div className="mcp-server-head">
                  <div className="mcp-server-text">
                    <span className="mcp-server-label">{server.label}</span>
                    <span className="mcp-server-url">{server.url}</span>
                  </div>
                  <div className="mcp-server-actions">
                    <button
                      className="ghost-button"
                      disabled={probe.status === "loading"}
                      onClick={() => probeServer(server)}
                      type="button"
                    >
                      {probe.status === "loading" ? t.mcpTesting : t.mcpTest}
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => removeServer(server.id)}
                      type="button"
                    >
                      {t.mcpRemove}
                    </button>
                  </div>
                </div>

                {probe.status === "error" ? (
                  <p className="mcp-server-error">
                    {t.mcpConnectFailed}: {probe.error}
                  </p>
                ) : null}

                {probe.status === "ok" ? (
                  probe.tools && probe.tools.length > 0 ? (
                    <div className="mcp-tools">
                      <small className="settings-card-hint">
                        {probe.serverName ? `${probe.serverName} · ` : ""}
                        {probe.tools.length} {t.mcpToolsCount}
                      </small>
                      <ul
                        className="policy-chip-list"
                        aria-label={t.mcpToolsCount}
                      >
                        {probe.tools.map((tool) => (
                          <li key={tool.name} title={tool.description ?? ""}>
                            <code>{tool.name}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mcp-server-error">{t.mcpEmptyTools}</p>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
