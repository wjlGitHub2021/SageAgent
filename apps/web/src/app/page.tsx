"use client";

import { useState } from "react";
import type { AgentRole, RunEvent } from "@sage/shared";

type Locale = "zh" | "en";
type ApprovalStatus = "pending" | "approved" | "rejected";

type Message = {
  role: string;
  body: Record<Locale, string>;
};

const copy = {
  zh: {
    localWorkbench: "本地工作台",
    settings: "设置",
    language: "界面语言",
    new: "新建",
    threads: "会话",
    runs: "任务",
    currentRun: "当前任务",
    modelSettings: "模型设置",
    thinking: "推理",
    on: "开",
    off: "关",
    agentTimeline: "Agent 时间线",
    toolCalls: "工具调用",
    approval: "审批",
    artifacts: "产物",
    nextStep: "下一步",
    run: "运行",
    approve: "批准",
    reject: "拒绝",
    action: "操作",
    status: "状态",
    runCreated: "创建 run",
    runStatusChanged: "更新 run 状态",
    messageDelta: "接收消息增量",
    messageCompleted: "生成本地消息",
    toolStarted: "开始工具调用",
    toolCompleted: "完成工具调用",
    toolFailed: "工具调用失败",
    approvalRequested: "请求审批",
    approvalResolved: "审批已处理",
    artifactCreated: "生成产物",
    runCompleted: "完成 run",
    runFailed: "run 失败",
    writeFileRequest: "Builder 请求写入文件",
    composerHint: "点击运行会追加一条本地模拟消息，不触发真实 provider。",
    headerFallback: "初始化 Sage Agent Product Shell",
    headerDescription:
      "中的 Supervisor 正在协调 Researcher、Builder、Reviewer 完成 Stage 1 本地交互工作台。",
    simulatedEvent:
      "已生成一条本地模拟 run event，真实 agent loop 将在 Stage 2 之后接入。",
    newDraft: "新任务草稿",
    localDraft: "本地草稿",
    stage1Spec: "Stage 1 实施规格",
    screenshotCheck: "Product Shell 截图检查",
  },
  en: {
    localWorkbench: "Local workbench",
    settings: "Settings",
    language: "Interface language",
    new: "New",
    threads: "Threads",
    runs: "Runs",
    currentRun: "Current Run",
    modelSettings: "Model settings",
    thinking: "Thinking",
    on: "on",
    off: "off",
    agentTimeline: "Agent Timeline",
    toolCalls: "Tool Calls",
    approval: "Approval",
    artifacts: "Artifacts",
    nextStep: "Next step",
    run: "Run",
    approve: "Approve",
    reject: "Reject",
    action: "action",
    status: "status",
    runCreated: "Created run",
    runStatusChanged: "Updated run status",
    messageDelta: "Received message delta",
    messageCompleted: "Generated local message",
    toolStarted: "Started tool call",
    toolCompleted: "Completed tool call",
    toolFailed: "Tool call failed",
    approvalRequested: "Requested approval",
    approvalResolved: "Approval resolved",
    artifactCreated: "Created artifact",
    runCompleted: "Completed run",
    runFailed: "Run failed",
    writeFileRequest: "Builder requests file write",
    composerHint:
      "Click Run to append a local simulated message without calling a real provider.",
    headerFallback: "Initialize Sage Agent Product Shell",
    headerDescription:
      "has Supervisor coordinating Researcher, Builder, and Reviewer for the Stage 1 local interactive workbench.",
    simulatedEvent:
      "created a local simulated run event. The real agent loop will be wired after Stage 2.",
    newDraft: "New task draft",
    localDraft: "Local draft",
    stage1Spec: "Stage 1 Implementation Spec",
    screenshotCheck: "Product Shell Screenshot Check",
  },
} satisfies Record<Locale, Record<string, string>>;

const initialThreads = [
  {
    id: "thread-1",
    title: { zh: "Sage Agent MVP", en: "Sage Agent MVP" },
    subtitle: { zh: "Product Shell", en: "Product Shell" },
  },
  {
    id: "thread-2",
    title: { zh: "DeepSeek Provider", en: "DeepSeek Provider" },
    subtitle: { zh: "Stage 3 草案", en: "Stage 3 Draft" },
  },
];

const runs = [
  {
    id: "run-1842",
    title: { zh: "初始化三栏工作台", en: "Initialize three-column workbench" },
    status: "running",
    time: "09:42",
  },
  {
    id: "run-1839",
    title: { zh: "锁定 Stage 1 规格", en: "Lock Stage 1 spec" },
    status: "completed",
    time: "08:18",
  },
];

const baseMessages: Message[] = [
  {
    role: "User",
    body: {
      zh: "创建 Sage Agent 的 Codex-like product shell，并展示多 agent 的运行状态。",
      en: "Create a Codex-like product shell for Sage Agent and show multi-agent run state.",
    },
  },
  {
    role: "Supervisor",
    body: {
      zh: "已将任务拆分为 UI shell、seed data、controls、inspector 四个部分，当前由 Builder 生成静态工作台。",
      en: "The task is split into UI shell, seed data, controls, and inspector. Builder is generating the static workbench.",
    },
  },
  {
    role: "Builder",
    body: {
      zh: "正在实现三栏布局：左侧 threads/runs，中间 run conversation，右侧 timeline/tool calls/approval/artifacts。",
      en: "Implementing the three-column layout: threads/runs on the left, run conversation in the center, timeline/tool calls/approval/artifacts on the right.",
    },
  },
  {
    role: "Reviewer",
    body: {
      zh: "等待实现完成后检查移动端溢出、状态可见性、approval 是否足够醒目。",
      en: "Waiting to review mobile overflow, state visibility, and whether approval is prominent enough.",
    },
  },
];

const stepTitleCopy: Record<string, Record<Locale, string>> = {
  "step-1842-supervisor": {
    zh: "拆解 Stage 1 product shell",
    en: "Break down Stage 1 product shell",
  },
  "step-1842-researcher": {
    zh: "整理 Codex-like 信息架构",
    en: "Map Codex-like information architecture",
  },
  "step-1842-builder": {
    zh: "生成静态工作台 UI",
    en: "Build static workbench UI",
  },
  "step-1839-supervisor": {
    zh: "锁定 Stage 1 规格",
    en: "Lock Stage 1 spec",
  },
  "step-1839-reviewer": {
    zh: "完成规格一致性检查",
    en: "Complete spec consistency review",
  },
};

const seedRunEvents: RunEvent[] = [
  {
    id: "event-1842-1",
    runId: "run-1842",
    type: "step.completed",
    sequence: 1,
    createdAt: "2026-06-24T01:42:00.000Z",
    payload: {
      step: {
        id: "step-1842-supervisor",
        runId: "run-1842",
        agent: "supervisor",
        title: "Break down Stage 1 product shell",
        status: "completed",
        input: null,
        output: null,
        startedAt: "2026-06-24T01:42:00.000Z",
        completedAt: "2026-06-24T01:43:00.000Z",
      },
    },
  },
  {
    id: "event-1842-2",
    runId: "run-1842",
    type: "step.completed",
    sequence: 2,
    createdAt: "2026-06-24T01:43:00.000Z",
    payload: {
      step: {
        id: "step-1842-researcher",
        runId: "run-1842",
        agent: "researcher",
        title: "Map Codex-like information architecture",
        status: "completed",
        input: null,
        output: null,
        startedAt: "2026-06-24T01:43:00.000Z",
        completedAt: "2026-06-24T01:44:00.000Z",
      },
    },
  },
  {
    id: "event-1842-3",
    runId: "run-1842",
    type: "step.started",
    sequence: 3,
    createdAt: "2026-06-24T01:44:00.000Z",
    payload: {
      step: {
        id: "step-1842-builder",
        runId: "run-1842",
        agent: "builder",
        title: "Build static workbench UI",
        status: "running",
        input: null,
        output: null,
        startedAt: "2026-06-24T01:44:00.000Z",
        completedAt: null,
      },
    },
  },
  {
    id: "event-1839-1",
    runId: "run-1839",
    type: "step.completed",
    sequence: 1,
    createdAt: "2026-06-24T00:18:00.000Z",
    payload: {
      step: {
        id: "step-1839-supervisor",
        runId: "run-1839",
        agent: "supervisor",
        title: "Lock Stage 1 spec",
        status: "completed",
        input: null,
        output: null,
        startedAt: "2026-06-24T00:18:00.000Z",
        completedAt: "2026-06-24T00:21:00.000Z",
      },
    },
  },
  {
    id: "event-1839-2",
    runId: "run-1839",
    type: "step.completed",
    sequence: 2,
    createdAt: "2026-06-24T00:21:00.000Z",
    payload: {
      step: {
        id: "step-1839-reviewer",
        runId: "run-1839",
        agent: "reviewer",
        title: "Complete spec consistency review",
        status: "completed",
        input: null,
        output: null,
        startedAt: "2026-06-24T00:21:00.000Z",
        completedAt: "2026-06-24T00:22:00.000Z",
      },
    },
  },
];

const toolCalls = [
  { tool: "read_project_docs", agent: "Researcher", status: "completed" },
  { tool: "draft_ui_shell", agent: "Builder", status: "running" },
];

const agentLabels = {
  supervisor: "Supervisor",
  researcher: "Researcher",
  builder: "Builder",
  reviewer: "Reviewer",
} satisfies Record<AgentRole, string>;

type TimelineRow = {
  id: string;
  agent: string;
  title: Record<Locale, string>;
  status: string;
};

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
  const [locale, setLocale] = useState<Locale>("zh");
  const t = copy[locale];
  const [threadItems, setThreadItems] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0].id);
  const [activeRunId, setActiveRunId] = useState(runs[0].id);
  const [model, setModel] = useState("deepseek-v4-flash");
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "max">("high");
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("pending");
  const [messages, setMessages] = useState<Message[]>(baseMessages);
  const [runEvents, setRunEvents] = useState<RunEvent[]>(seedRunEvents);

  const activeThread = threadItems.find((thread) => thread.id === activeThreadId);
  const activeRun = runs.find((run) => run.id === activeRunId);
  const timelineRows = getTimelineRows(runEvents, activeRunId);
  const artifacts = [
    { title: t.stage1Spec, kind: "document" },
    { title: t.screenshotCheck, kind: "summary" },
  ];

  function handleNewThread() {
    const nextIndex = threadItems.length + 1;
    const nextThread = {
      id: `thread-${nextIndex}`,
      title: {
        zh: `${copy.zh.newDraft} ${nextIndex}`,
        en: `${copy.en.newDraft} ${nextIndex}`,
      },
      subtitle: {
        zh: copy.zh.localDraft,
        en: copy.en.localDraft,
      },
    };

    setThreadItems((current) => [...current, nextThread]);
    setActiveThreadId(nextThread.id);
  }

  function handleRunClick() {
    const createdAt = new Date().toISOString();
    const messageId = `message-local-${Date.now()}`;
    const messageBody = {
      zh: `已用 ${model} / ${reasoningEffort} ${copy.zh.simulatedEvent}`,
      en: `${model} / ${reasoningEffort} ${copy.en.simulatedEvent}`,
    };

    setMessages((current) => [
      ...current,
      {
        role: "Supervisor",
        body: messageBody,
      },
    ]);
    setRunEvents((current) => [
      ...current,
      {
        id: `event-local-${Date.now()}`,
        runId: activeRunId,
        type: "message.completed",
        sequence: nextEventSequence(current, activeRunId),
        createdAt,
        payload: {
          message: {
            id: messageId,
            threadId: activeThreadId,
            runId: activeRunId,
            role: "agent",
            agent: "supervisor",
            content: messageBody.en,
            createdAt,
          },
        },
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
              <p className="brand-subtitle">{t.localWorkbench}</p>
            </div>
          </div>

          <Panel title={t.settings}>
            <div className="settings-body">
              <p>{t.language}</p>
              <div className="segmented language-switch" aria-label={t.language}>
                <button
                  className={locale === "zh" ? "selected" : ""}
                  onClick={() => setLocale("zh")}
                >
                  中文
                </button>
                <button
                  className={locale === "en" ? "selected" : ""}
                  onClick={() => setLocale("en")}
                >
                  English
                </button>
              </div>
            </div>
          </Panel>

          <Panel
            title={t.threads}
            action={
              <button className="ghost-button" onClick={handleNewThread}>
                {t.new}
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
                  <span>{thread.title[locale]}</span>
                  <small>{thread.subtitle[locale]}</small>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={t.runs}>
            <div className="stack">
              {runs.map((run) => (
                <button
                  className={run.id === activeRunId ? "run-row active" : "run-row"}
                  key={run.id}
                  onClick={() => setActiveRunId(run.id)}
                >
                  <StatusDot status={run.status} />
                  <div>
                    <p>{run.title[locale]}</p>
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
              <p className="section-label">{t.currentRun}</p>
              <h1>{activeRun?.title[locale] ?? t.headerFallback}</h1>
              <p>
                {activeThread?.title[locale]} {t.headerDescription}
              </p>
            </div>

            <div className="model-controls" aria-label={t.modelSettings}>
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
                {t.thinking} {thinkingEnabled ? t.on : t.off}
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
                  <p className="message-body">{message.body[locale]}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="composer">
            <div>
              <p>{t.nextStep}</p>
              <span>{t.composerHint}</span>
            </div>
            <button onClick={handleRunClick}>{t.run}</button>
          </div>
        </section>

        <aside className="inspector">
          <Panel title={t.agentTimeline}>
            <div className="timeline">
              {timelineRows.map((row) => (
                <div className="timeline-row" key={row.id}>
                  <StatusDot status={row.status} />
                  <div>
                    <p>{row.agent}</p>
                    <small>{row.title[locale]}</small>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t.toolCalls}>
            <div className="stack">
              {toolCalls.map((call) => (
                <div className="tool-row" key={call.tool}>
                  <code>{call.tool}</code>
                  <span>{call.agent}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t.approval}>
            <div className={`approval-box ${approvalStatus}`}>
              <p>{t.writeFileRequest}</p>
              <small>
                {t.action}: <code>write_file</code> · {t.status}:{" "}
                {approvalStatus}
              </small>
              <div className="approval-actions">
                <button
                  disabled={approvalStatus !== "pending"}
                  onClick={() => setApprovalStatus("approved")}
                >
                  {t.approve}
                </button>
                <button
                  disabled={approvalStatus !== "pending"}
                  onClick={() => setApprovalStatus("rejected")}
                >
                  {t.reject}
                </button>
              </div>
            </div>
          </Panel>

          <Panel title={t.artifacts}>
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

function getTimelineRows(
  events: readonly RunEvent[],
  activeRunId: string,
): TimelineRow[] {
  return events
    .filter((event) => event.runId === activeRunId)
    .toSorted(
      (left, right) =>
        left.sequence - right.sequence ||
        left.createdAt.localeCompare(right.createdAt),
    )
    .map(toTimelineRow);
}

function toTimelineRow(event: RunEvent): TimelineRow {
  switch (event.type) {
    case "run.created":
      return systemTimelineRow(event, "Supervisor", "runCreated", "completed");
    case "run.status_changed":
      return systemTimelineRow(
        event,
        event.payload.activeAgent
          ? agentLabels[event.payload.activeAgent]
          : "Supervisor",
        "runStatusChanged",
        event.payload.status,
      );
    case "step.started":
    case "step.completed":
    case "step.failed":
      return {
        id: event.id,
        agent: agentLabels[event.payload.step.agent],
        title: stepTitleCopy[event.payload.step.id] ?? {
          zh: event.payload.step.title,
          en: event.payload.step.title,
        },
        status: event.payload.step.status,
      };
    case "message.delta":
      return {
        id: event.id,
        agent: event.payload.agent ? agentLabels[event.payload.agent] : "System",
        title: {
          zh: copy.zh.messageDelta,
          en: copy.en.messageDelta,
        },
        status: "running",
      };
    case "message.completed":
      return {
        id: event.id,
        agent: event.payload.message.agent
          ? agentLabels[event.payload.message.agent]
          : "System",
        title: {
          zh: copy.zh.messageCompleted,
          en: copy.en.messageCompleted,
        },
        status: "completed",
      };
    case "tool.started":
      return toolTimelineRow(event, "toolStarted", "running");
    case "tool.completed":
      return toolTimelineRow(event, "toolCompleted", event.payload.toolCall.status);
    case "tool.failed":
      return toolTimelineRow(event, "toolFailed", event.payload.toolCall.status);
    case "approval.requested":
      return {
        id: event.id,
        agent: agentLabels[event.payload.approval.requestedBy],
        title: {
          zh: copy.zh.approvalRequested,
          en: copy.en.approvalRequested,
        },
        status: event.payload.approval.status,
      };
    case "approval.resolved":
      return {
        id: event.id,
        agent: agentLabels[event.payload.approval.requestedBy],
        title: {
          zh: copy.zh.approvalResolved,
          en: copy.en.approvalResolved,
        },
        status: event.payload.approval.status,
      };
    case "artifact.created":
      return systemTimelineRow(event, "Builder", "artifactCreated", "completed");
    case "run.completed":
      return systemTimelineRow(event, "Supervisor", "runCompleted", "completed");
    case "run.failed":
      return systemTimelineRow(event, "Supervisor", "runFailed", "failed");
  }
}

function systemTimelineRow(
  event: RunEvent,
  agent: string,
  titleKey: keyof typeof copy.zh,
  status: string,
): TimelineRow {
  return {
    id: event.id,
    agent,
    title: {
      zh: copy.zh[titleKey],
      en: copy.en[titleKey],
    },
    status,
  };
}

function toolTimelineRow(
  event: Extract<RunEvent, { type: "tool.started" | "tool.completed" | "tool.failed" }>,
  titleKey: keyof typeof copy.zh,
  status: string,
): TimelineRow {
  return {
    id: event.id,
    agent: agentLabels[event.payload.toolCall.agent],
    title: {
      zh: `${copy.zh[titleKey]}: ${event.payload.toolCall.toolName}`,
      en: `${copy.en[titleKey]}: ${event.payload.toolCall.toolName}`,
    },
    status,
  };
}

function nextEventSequence(events: readonly RunEvent[], runId: string): number {
  return (
    events
      .filter((event) => event.runId === runId)
      .reduce((max, event) => Math.max(max, event.sequence), 0) + 1
  );
}
