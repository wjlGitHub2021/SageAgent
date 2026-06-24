"use client";

import { useState } from "react";
import type {
  AgentRole,
  Approval,
  ApprovalStatus,
  Artifact,
  DeepSeekModel,
  RunEvent,
  ToolCall,
} from "@sage/shared";
import { DEEPSEEK_MODELS } from "@sage/shared";

type Locale = "zh" | "en";

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
    model: "模型",
    thinking: "推理",
    enabled: "开启",
    disabled: "关闭",
    reasoningEffort: "推理强度",
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
    noToolCalls: "当前任务暂无工具调用",
    noApproval: "当前任务暂无待处理审批",
    noArtifacts: "当前任务暂无产物",
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
    model: "Model",
    thinking: "Thinking",
    enabled: "Enabled",
    disabled: "Disabled",
    reasoningEffort: "Reasoning effort",
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
    noToolCalls: "No tool calls for this run",
    noApproval: "No pending approval for this run",
    noArtifacts: "No artifacts for this run",
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

const artifactTitleCopy: Record<string, Record<Locale, string>> = {
  "artifact-1842-stage1-spec": {
    zh: "Stage 1 实施规格",
    en: "Stage 1 Implementation Spec",
  },
  "artifact-1842-screenshot": {
    zh: "Product Shell 截图检查",
    en: "Product Shell Screenshot Check",
  },
  "artifact-1839-stage1-spec": {
    zh: "Stage 1 实施规格",
    en: "Stage 1 Implementation Spec",
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
    id: "event-1842-4",
    runId: "run-1842",
    type: "tool.completed",
    sequence: 4,
    createdAt: "2026-06-24T01:45:00.000Z",
    payload: {
      toolCall: {
        id: "tool-1842-read-docs",
        runId: "run-1842",
        stepId: "step-1842-researcher",
        agent: "researcher",
        toolName: "read_project_docs",
        args: {},
        status: "completed",
        result: { summary: "Stage docs loaded" },
        error: null,
        startedAt: "2026-06-24T01:43:10.000Z",
        completedAt: "2026-06-24T01:45:00.000Z",
      },
    },
  },
  {
    id: "event-1842-5",
    runId: "run-1842",
    type: "tool.started",
    sequence: 5,
    createdAt: "2026-06-24T01:46:00.000Z",
    payload: {
      toolCall: {
        id: "tool-1842-draft-ui",
        runId: "run-1842",
        stepId: "step-1842-builder",
        agent: "builder",
        toolName: "draft_ui_shell",
        args: {},
        status: "running",
        result: null,
        error: null,
        startedAt: "2026-06-24T01:46:00.000Z",
        completedAt: null,
      },
    },
  },
  {
    id: "event-1842-6",
    runId: "run-1842",
    type: "approval.requested",
    sequence: 6,
    createdAt: "2026-06-24T01:47:00.000Z",
    payload: {
      approval: {
        id: "approval-1842-write-file",
        runId: "run-1842",
        requestedBy: "builder",
        reason: "Draft UI changes need write approval.",
        payloadSummary: "write_file: apps/web/src/app/page.tsx",
        action: "write_file",
        status: "pending",
        createdAt: "2026-06-24T01:47:00.000Z",
        resolvedAt: null,
      },
    },
  },
  {
    id: "event-1842-7",
    runId: "run-1842",
    type: "artifact.created",
    sequence: 7,
    createdAt: "2026-06-24T01:48:00.000Z",
    payload: {
      artifact: {
        id: "artifact-1842-stage1-spec",
        runId: "run-1842",
        kind: "document",
        title: "Stage 1 Implementation Spec",
        content: null,
        path: "docs/STAGE1_SPEC.md",
        createdAt: "2026-06-24T01:48:00.000Z",
      },
    },
  },
  {
    id: "event-1842-8",
    runId: "run-1842",
    type: "artifact.created",
    sequence: 8,
    createdAt: "2026-06-24T01:49:00.000Z",
    payload: {
      artifact: {
        id: "artifact-1842-screenshot",
        runId: "run-1842",
        kind: "summary",
        title: "Product Shell Screenshot Check",
        content: null,
        path: null,
        createdAt: "2026-06-24T01:49:00.000Z",
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
  {
    id: "event-1839-3",
    runId: "run-1839",
    type: "tool.completed",
    sequence: 3,
    createdAt: "2026-06-24T00:22:00.000Z",
    payload: {
      toolCall: {
        id: "tool-1839-read-docs",
        runId: "run-1839",
        stepId: "step-1839-supervisor",
        agent: "researcher",
        toolName: "read_project_docs",
        args: {},
        status: "completed",
        result: { summary: "Stage 1 docs reviewed" },
        error: null,
        startedAt: "2026-06-24T00:18:30.000Z",
        completedAt: "2026-06-24T00:22:00.000Z",
      },
    },
  },
  {
    id: "event-1839-4",
    runId: "run-1839",
    type: "artifact.created",
    sequence: 4,
    createdAt: "2026-06-24T00:23:00.000Z",
    payload: {
      artifact: {
        id: "artifact-1839-stage1-spec",
        runId: "run-1839",
        kind: "document",
        title: "Stage 1 Implementation Spec",
        content: null,
        path: "docs/STAGE1_SPEC.md",
        createdAt: "2026-06-24T00:23:00.000Z",
      },
    },
  },
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

type ToolCallRow = {
  id: string;
  tool: string;
  agent: string;
  status: string;
};

type ApprovalPanelState = {
  approval: Approval;
  title: Record<Locale, string>;
};

type ArtifactRow = {
  id: string;
  title: Record<Locale, string>;
  kind: string;
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed" || status === "approved"
      ? "bg-emerald-500"
      : status === "running"
        ? "bg-sky-500"
        : status === "rejected" || status === "failed"
          ? "bg-red-500"
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
  const [model, setModel] = useState<DeepSeekModel>("deepseek-v4-flash");
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [reasoningEffort, setReasoningEffort] = useState<"high" | "max">("high");
  const [messages, setMessages] = useState<Message[]>(baseMessages);
  const [runEvents, setRunEvents] = useState<RunEvent[]>(seedRunEvents);

  const activeThread = threadItems.find((thread) => thread.id === activeThreadId);
  const activeRun = runs.find((run) => run.id === activeRunId);
  const timelineRows = getTimelineRows(runEvents, activeRunId);
  const activeToolCalls = getToolCallRows(runEvents, activeRunId);
  const activeApproval = getActiveApproval(runEvents, activeRunId);
  const activeArtifacts = getArtifactRows(runEvents, activeRunId);

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
      zh: `已用 ${model} / thinking ${thinkingEnabled ? "enabled" : "disabled"} / ${reasoningEffort} ${copy.zh.simulatedEvent}`,
      en: `${model} / thinking ${thinkingEnabled ? "enabled" : "disabled"} / ${reasoningEffort} ${copy.en.simulatedEvent}`,
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

  function handleApprovalResolution(status: ApprovalStatus) {
    const resolvedAt = new Date().toISOString();

    setRunEvents((current) => {
      const currentApproval = getActiveApproval(current, activeRunId);
      if (!currentApproval || currentApproval.approval.status !== "pending") {
        return current;
      }

      return [
        ...current,
        {
          id: `event-approval-${Date.now()}`,
          runId: activeRunId,
          type: "approval.resolved",
          sequence: nextEventSequence(current, activeRunId),
          createdAt: resolvedAt,
          payload: {
            approval: {
              ...currentApproval.approval,
              status,
              resolvedAt,
            },
          },
        },
      ];
    });
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

          <section className="settings-strip" aria-label={t.settings}>
            <div className="settings-copy">
              <span>{t.settings}</span>
              <p>{t.language}</p>
            </div>
            <div className="segmented language-switch" aria-label={t.language}>
              <button
                aria-pressed={locale === "zh"}
                className={locale === "zh" ? "selected" : ""}
                onClick={() => setLocale("zh")}
              >
                中文
              </button>
              <button
                aria-pressed={locale === "en"}
                className={locale === "en" ? "selected" : ""}
                onClick={() => setLocale("en")}
              >
                English
              </button>
            </div>
          </section>

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
              <div
                className="segmented model-selector"
                role="group"
                aria-label={t.model}
              >
                {DEEPSEEK_MODELS.map((modelOption) => (
                  <button
                    aria-pressed={model === modelOption}
                    className={model === modelOption ? "selected" : ""}
                    key={modelOption}
                    onClick={() => setModel(modelOption)}
                  >
                    {modelOption}
                  </button>
                ))}
              </div>
              <div
                className="segmented thinking-toggle"
                role="group"
                aria-label={t.thinking}
              >
                <button
                  aria-pressed={thinkingEnabled}
                  className={thinkingEnabled ? "selected" : ""}
                  onClick={() => setThinkingEnabled(true)}
                >
                  {t.enabled}
                </button>
                <button
                  aria-pressed={!thinkingEnabled}
                  className={thinkingEnabled ? "" : "selected"}
                  onClick={() => setThinkingEnabled(false)}
                >
                  {t.disabled}
                </button>
              </div>
              <div
                className="segmented reasoning-selector"
                role="group"
                aria-label={t.reasoningEffort}
              >
                <button
                  aria-pressed={reasoningEffort === "high"}
                  className={reasoningEffort === "high" ? "selected" : ""}
                  onClick={() => setReasoningEffort("high")}
                >
                  high
                </button>
                <button
                  aria-pressed={reasoningEffort === "max"}
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
              {activeToolCalls.length === 0 ? (
                <div className="empty-row">{t.noToolCalls}</div>
              ) : (
                activeToolCalls.map((call) => (
                  <div className="tool-row" key={call.id}>
                    <code>{call.tool}</code>
                    <span>
                      {call.agent} · {call.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title={t.approval}>
            {activeApproval ? (
              <div className={`approval-box ${activeApproval.approval.status}`}>
                <p>{activeApproval.title[locale]}</p>
                <small>
                  {t.action}: <code>{activeApproval.approval.action}</code> ·{" "}
                  {t.status}: {activeApproval.approval.status}
                </small>
                <small>{activeApproval.approval.payloadSummary}</small>
                <div className="approval-actions">
                  <button
                    disabled={activeApproval.approval.status !== "pending"}
                    onClick={() => handleApprovalResolution("approved")}
                  >
                    {t.approve}
                  </button>
                  <button
                    disabled={activeApproval.approval.status !== "pending"}
                    onClick={() => handleApprovalResolution("rejected")}
                  >
                    {t.reject}
                  </button>
                </div>
              </div>
            ) : (
              <div className="stack">
                <div className="empty-row">{t.noApproval}</div>
              </div>
            )}
          </Panel>

          <Panel title={t.artifacts}>
            <div className="stack">
              {activeArtifacts.length === 0 ? (
                <div className="empty-row">{t.noArtifacts}</div>
              ) : (
                activeArtifacts.map((artifact) => (
                  <div className="artifact-row" key={artifact.id}>
                  <span>{artifact.title[locale]}</span>
                  <small>{artifact.kind}</small>
                </div>
                ))
              )}
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
  return getEventsForRun(events, activeRunId).map(toTimelineRow);
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

function getToolCallRows(
  events: readonly RunEvent[],
  activeRunId: string,
): ToolCallRow[] {
  const toolCalls = new Map<string, ToolCall>();

  for (const event of getEventsForRun(events, activeRunId)) {
    if (isToolEvent(event)) {
      toolCalls.set(event.payload.toolCall.id, event.payload.toolCall);
    }
  }

  return [...toolCalls.values()]
    .toSorted(
      (left, right) =>
        left.startedAt.localeCompare(right.startedAt) ||
        left.id.localeCompare(right.id),
    )
    .map((call) => ({
      id: call.id,
      tool: call.toolName,
      agent: agentLabels[call.agent],
      status: call.status,
    }));
}

function getActiveApproval(
  events: readonly RunEvent[],
  activeRunId: string,
): ApprovalPanelState | null {
  const approvals = new Map<string, Approval>();
  const approvalOrder: string[] = [];

  for (const event of getEventsForRun(events, activeRunId)) {
    if (isApprovalEvent(event)) {
      if (!approvals.has(event.payload.approval.id)) {
        approvalOrder.push(event.payload.approval.id);
      }
      approvals.set(event.payload.approval.id, event.payload.approval);
    }
  }

  const orderedApprovals = approvalOrder
    .map((approvalId) => approvals.get(approvalId))
    .filter((approval): approval is Approval => approval !== undefined);
  const activeApproval =
    orderedApprovals.findLast((approval) => approval.status === "pending") ??
    orderedApprovals.at(-1) ??
    null;

  if (!activeApproval) return null;

  return {
    approval: activeApproval,
    title:
      activeApproval.action === "write_file"
        ? {
            zh: copy.zh.writeFileRequest,
            en: copy.en.writeFileRequest,
          }
        : {
            zh: activeApproval.reason,
            en: activeApproval.reason,
          },
  };
}

function getArtifactRows(
  events: readonly RunEvent[],
  activeRunId: string,
): ArtifactRow[] {
  return getEventsForRun(events, activeRunId)
    .filter(
      (event): event is Extract<RunEvent, { type: "artifact.created" }> =>
        event.type === "artifact.created",
    )
    .map((event) => toArtifactRow(event.payload.artifact));
}

function toArtifactRow(artifact: Artifact): ArtifactRow {
  return {
    id: artifact.id,
    title: artifactTitleCopy[artifact.id] ?? {
      zh: artifact.title,
      en: artifact.title,
    },
    kind: artifact.kind,
  };
}

function getEventsForRun(
  events: readonly RunEvent[],
  activeRunId: string,
): RunEvent[] {
  return events
    .filter((event) => event.runId === activeRunId)
    .toSorted(
      (left, right) =>
        left.sequence - right.sequence ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
}

function isToolEvent(
  event: RunEvent,
): event is Extract<
  RunEvent,
  { type: "tool.started" | "tool.completed" | "tool.failed" }
> {
  return (
    event.type === "tool.started" ||
    event.type === "tool.completed" ||
    event.type === "tool.failed"
  );
}

function isApprovalEvent(
  event: RunEvent,
): event is Extract<
  RunEvent,
  { type: "approval.requested" | "approval.resolved" }
> {
  return event.type === "approval.requested" || event.type === "approval.resolved";
}
