"use client";

import { useState } from "react";

const initialThreads = [
  {
    id: "thread-1",
    title: "Sage Agent MVP",
    subtitle: "Product Shell",
  },
  {
    id: "thread-2",
    title: "DeepSeek Provider",
    subtitle: "Stage 3 草案",
  },
];

const runs = [
  {
    id: "run-1842",
    title: "初始化三栏工作台",
    status: "running",
    time: "09:42",
  },
  {
    id: "run-1839",
    title: "锁定 Stage 1 规格",
    status: "completed",
    time: "08:18",
  },
];

const baseMessages = [
  {
    role: "User",
    body: "创建 Sage Agent 的 Codex-like product shell，并展示多 agent 的运行状态。",
  },
  {
    role: "Supervisor",
    body: "已将任务拆分为 UI shell、seed data、controls、inspector 四个部分，当前由 Builder 生成静态工作台。",
  },
  {
    role: "Builder",
    body: "正在实现三栏布局：左侧 threads/runs，中间 run conversation，右侧 timeline/tool calls/approval/artifacts。",
  },
  {
    role: "Reviewer",
    body: "等待实现完成后检查移动端溢出、状态可见性、approval 是否足够醒目。",
  },
];

const steps = [
  { agent: "Supervisor", title: "拆解 Stage 1 product shell", status: "completed" },
  { agent: "Researcher", title: "整理 Codex-like 信息架构", status: "completed" },
  { agent: "Builder", title: "生成静态工作台 UI", status: "running" },
  { agent: "Reviewer", title: "QA 审查与风险标注", status: "pending" },
];

const toolCalls = [
  { tool: "read_project_docs", agent: "Researcher", status: "completed" },
  { tool: "draft_ui_shell", agent: "Builder", status: "running" },
];

const artifacts = [
  { title: "Stage 1 实施规格", kind: "document" },
  { title: "Product Shell 截图检查", kind: "summary" },
];

type Message = {
  role: string;
  body: string;
};

type ApprovalStatus = "pending" | "approved" | "rejected";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed" || status === "approved"
      ? "bg-emerald-500"
      : status === "running"
        ? "bg-sky-500"
        : status === "pending"
          ? "bg-zinc-400"
          : "bg-amber-500";

  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const [threadItems, setThreadItems] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0].id);
  const [activeRunId, setActiveRunId] = useState(runs[0].id);
  const [model, setModel] = useState("deepseek-v4-flash");
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "max">("high");
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("pending");
  const [messages, setMessages] = useState<Message[]>(baseMessages);

  const activeThread = threadItems.find((thread) => thread.id === activeThreadId);
  const activeRun = runs.find((run) => run.id === activeRunId);

  function handleNewThread() {
    const nextIndex = threadItems.length + 1;
    const nextThread = {
      id: `thread-${nextIndex}`,
      title: `新任务草稿 ${nextIndex}`,
      subtitle: "Local draft",
    };

    setThreadItems((current) => [...current, nextThread]);
    setActiveThreadId(nextThread.id);
  }

  function handleRunClick() {
    setMessages((current) => [
      ...current,
      {
        role: "Supervisor",
        body: `已用 ${model} / ${reasoningEffort} 生成一条本地模拟 run event，真实 agent loop 将在 Stage 2 之后接入。`,
      },
    ]);
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--text-main)]">
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">S</div>
            <div>
              <p className="brand-name">Sage Agent</p>
              <p className="brand-subtitle">Local workbench</p>
            </div>
          </div>

          <Panel
            title="Threads"
            action={
              <button className="ghost-button" onClick={handleNewThread}>
                New
              </button>
            }
          >
            <div className="stack">
              {threadItems.map((thread) => (
                <button
                  className={
                    thread.id === activeThreadId
                      ? "thread-item active"
                      : "thread-item"
                  }
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                >
                  <span>{thread.title}</span>
                  <small>{thread.subtitle}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Runs">
            <div className="stack">
              {runs.map((run) => (
                <button
                  className={run.id === activeRunId ? "run-row active" : "run-row"}
                  key={run.id}
                  onClick={() => setActiveRunId(run.id)}
                >
                  <StatusDot status={run.status} />
                  <div>
                    <p>{run.title}</p>
                    <small>
                      {run.id} · {run.time}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="workspace">
          <header className="workspace-header">
            <div>
              <p className="section-label">Current Run</p>
              <h1>{activeRun?.title ?? "初始化 Sage Agent Product Shell"}</h1>
              <p>
                {activeThread?.title} 中的 Supervisor 正在协调
                Researcher、Builder、Reviewer 完成 Stage 1 本地交互工作台。
              </p>
            </div>

            <div className="model-controls" aria-label="模型设置">
              <button
                className="select-button"
                onClick={() =>
                  setModel((current) =>
                    current === "deepseek-v4-flash"
                      ? "deepseek-v4-pro"
                      : "deepseek-v4-flash",
                  )
                }
              >
                {model}
              </button>
              <button
                className={
                  thinkingEnabled ? "toggle-button active" : "toggle-button"
                }
                onClick={() => setThinkingEnabled((current) => !current)}
              >
                Thinking {thinkingEnabled ? "on" : "off"}
              </button>
              <div className="segmented" aria-label="reasoning effort">
                <button
                  className={reasoningEffort === "high" ? "selected" : ""}
                  onClick={() => setReasoningEffort("high")}
                >
                  high
                </button>
                <button
                  className={reasoningEffort === "max" ? "selected" : ""}
                  onClick={() => setReasoningEffort("max")}
                >
                  max
                </button>
              </div>
            </div>
          </header>

          <div className="conversation">
            {messages.map((message, index) => (
              <article className="message" key={`${message.role}-${index}`}>
                <div className="message-avatar">{message.role.slice(0, 1)}</div>
                <div>
                  <p className="message-role">{message.role}</p>
                  <p className="message-body">{message.body}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="composer">
            <div>
              <p>下一步</p>
              <span>点击 Run 会追加一条本地模拟消息，不触发真实 provider。</span>
            </div>
            <button onClick={handleRunClick}>Run</button>
          </div>
        </section>

        <aside className="inspector">
          <Panel title="Agent Timeline">
            <div className="timeline">
              {steps.map((step) => (
                <div className="timeline-row" key={`${step.agent}-${step.title}`}>
                  <StatusDot status={step.status} />
                  <div>
                    <p>{step.agent}</p>
                    <small>{step.title}</small>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Tool Calls">
            <div className="stack">
              {toolCalls.map((call) => (
                <div className="tool-row" key={call.tool}>
                  <code>{call.tool}</code>
                  <span>{call.agent}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Approval">
            <div className={`approval-box ${approvalStatus}`}>
              <p>Builder 请求写入文件</p>
              <small>
                action: <code>write_file</code> · status: {approvalStatus}
              </small>
              <div className="approval-actions">
                <button
                  disabled={approvalStatus !== "pending"}
                  onClick={() => setApprovalStatus("approved")}
                >
                  Approve
                </button>
                <button
                  disabled={approvalStatus !== "pending"}
                  onClick={() => setApprovalStatus("rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="Artifacts">
            <div className="stack">
              {artifacts.map((artifact) => (
                <div className="artifact-row" key={artifact.title}>
                  <span>{artifact.title}</span>
                  <small>{artifact.kind}</small>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
