"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AgentRole,
  Approval,
  ApprovalStatus,
  Artifact,
  Run,
  RunEvent,
  Thread,
  ToolCall,
} from "@sage/shared";
import {
  ALLOWED_MODELS,
  ALLOWED_REASONING_EFFORTS,
  DEFAULT_PREFERENCES,
  type Locale,
  type Preferences,
  type ReasoningEffort,
  readStoredPreferences,
  writeStoredPreferences,
} from "@/lib/preferences";

type Message = {
  role: string;
  runId: string;
  messageId?: string;
  eventIds?: readonly string[];
  body: Record<Locale, string>;
};

type ThreadItem = {
  id: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
};

type RunItem = {
  id: string;
  title: Record<Locale, string>;
  status: string;
  time: string;
  goal?: string;
};

type CreateRunResponse = {
  thread: Thread;
  run: Run;
  events: RunEvent[];
};

type SupervisorRunResponse = {
  ok: boolean;
  events: RunEvent[];
  error: {
    code: string;
    message: string;
  } | null;
};

type CreateRunPayload = {
  goal: string;
  title: string;
  threadTitle: string;
  settings: {
    model: Preferences["model"];
    thinkingEnabled: boolean;
    reasoningEffort: ReasoningEffort;
  };
};

const copy = {
  zh: {
    localWorkbench: "本地工作台",
    settings: "设置",
    openSettings: "打开设置",
    closeSettings: "关闭设置",
    settingsTitle: "设置",
    settingsSubtitle: "管理本地工作台的显示、Provider、工作区和安全边界。",
    settingsEntryDetail: "语言、模型与推理偏好",
    generalSettings: "通用",
    providerSettings: "Provider / DeepSeek",
    workspaceSettings: "工作区",
    safetySettings: "安全边界",
    currentConfiguration: "当前配置",
    displayLanguage: "显示语言",
    defaultModel: "默认模型",
    thinkingEnabledSetting: "Thinking 开关",
    generalSettingsDetail: "界面语言会作为非敏感偏好保存在本地浏览器。",
    providerSettingsDetail:
      "模型、thinking 和推理强度会作为非敏感偏好持久化；API key 和连接测试后续接入。",
    workspaceSettingsDetail:
      "当前工作区以本地单用户模式运行，不在本任务接入 router 或数据库。",
    safetySettingsDetail:
      "默认 Read + Draft；写文件、shell 和外部副作用操作必须进入 approval。",
    readDraftMode: "Read + Draft 模式",
    localSingleUser: "本地单用户",
    notConfigured: "暂未配置",
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
    auditTrail: "审计轨迹",
    events: "事件",
    tools: "工具",
    approvals: "审批",
    lastEvent: "最后事件",
    lastUpdated: "最后更新",
    counts: "计数",
    providerError: "Provider Error",
    noProviderError: "当前任务暂无 provider error",
    noProviderErrorDetail:
      "如果 provider 调用失败，失败来源、状态和安全错误说明会显示在这里。",
    simulateProviderError: "模拟错误",
    providerErrorSafeMessage:
      "DeepSeek provider 返回了本地模拟错误；敏感凭据已隐藏。",
    providerErrorNextStep:
      "检查 API key、模型配置或稍后重试；当前 run 已保留审计事件。",
    failureSource: "失败来源",
    deepSeekProvider: "DeepSeek Provider",
    nextStep: "下一步",
    run: "运行",
    running: "运行中",
    cancel: "取消",
    retry: "重试",
    approve: "批准",
    reject: "拒绝",
    action: "操作",
    status: "状态",
    runCreated: "创建 run",
    runStatusChanged: "更新 run 状态",
    messageDelta: "接收消息增量",
    messageCompleted: "生成消息",
    toolStarted: "开始工具调用",
    toolCompleted: "完成工具调用",
    toolFailed: "工具调用失败",
    toolPath: "路径",
    toolError: "错误",
    approvalRequested: "请求审批",
    approvalResolved: "审批已处理",
    artifactCreated: "生成产物",
    runCompleted: "完成 run",
    runFailed: "run 失败",
    noToolCalls: "当前任务暂无工具调用",
    noToolCallsDetail: "当 Researcher、Builder 或 Reviewer 使用工具时，会在这里显示调用记录。",
    noApproval: "当前任务暂无待处理审批",
    noApprovalDetail: "写文件、shell、外部请求等副作用操作会先进入审批流。",
    noArtifacts: "当前任务暂无产物",
    noArtifactsDetail: "计划、patch 草稿、文档或最终总结会在生成后出现在这里。",
    writeFileRequest: "Builder 请求写入文件",
    composerInput: "任务输入",
    composerPlaceholder: "描述你希望 Sage Agent 完成的任务...",
    composerHint:
      "点击运行会创建真实后端 run，并流式调用 DeepSeek Supervisor；未配置 API key 会生成可审计的 provider error。",
    composerEmptyHint: "请输入任务目标后再运行。",
    composerRunningHint: "正在创建后端 run 并流式接收 DeepSeek 输出，请稍候。",
    composerCancelledHint:
      "本次本地等待已取消；如果 provider 请求已经发出，后端可能仍会完成并留下事件。",
    composerFailedHint: "运行失败",
    retryProviderHint: "已追加本地重试反馈；真实 provider 重试将在后续接入。",
    apiThreadSubtitle: "API run",
    headerFallback: "初始化 Sage Agent Product Shell",
    headerDescription:
      "中的 Supervisor 正在协调 Researcher、Builder、Reviewer 完成 Stage 1 本地交互工作台。",
    newDraft: "新任务草稿",
    localDraft: "本地草稿",
    stage1Spec: "Stage 1 实施规格",
    screenshotCheck: "Product Shell 截图检查",
    noAuditEvents: "当前任务暂无审计事件",
  },
  en: {
    localWorkbench: "Local workbench",
    settings: "Settings",
    openSettings: "Open settings",
    closeSettings: "Close settings",
    settingsTitle: "Settings",
    settingsSubtitle:
      "Manage local workbench display, provider, workspace, and safety boundaries.",
    settingsEntryDetail: "Language, model, and reasoning preferences",
    generalSettings: "General",
    providerSettings: "Provider / DeepSeek",
    workspaceSettings: "Workspace",
    safetySettings: "Safety",
    currentConfiguration: "Current configuration",
    displayLanguage: "Display language",
    defaultModel: "Default model",
    thinkingEnabledSetting: "Thinking enabled",
    generalSettingsDetail:
      "Interface language is stored locally as a non-sensitive preference.",
    providerSettingsDetail:
      "Model, thinking, and reasoning effort are persisted as non-sensitive preferences. API key storage and connection tests come later.",
    workspaceSettingsDetail:
      "The workspace runs in local single-user mode. This task does not add routing or a database.",
    safetySettingsDetail:
      "Default Read + Draft mode; file writes, shell, and external side effects require approval.",
    readDraftMode: "Read + Draft mode",
    localSingleUser: "Local single-user",
    notConfigured: "Not configured",
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
    auditTrail: "Audit Trail",
    events: "Events",
    tools: "Tools",
    approvals: "Approvals",
    lastEvent: "Last event",
    lastUpdated: "Last updated",
    counts: "Counts",
    providerError: "Provider Error",
    noProviderError: "No provider error for this run",
    noProviderErrorDetail:
      "Provider failures will show the source, status, and safe error details here.",
    simulateProviderError: "Simulate error",
    providerErrorSafeMessage:
      "DeepSeek provider returned a local simulated error; sensitive credentials are hidden.",
    providerErrorNextStep:
      "Check the API key, model settings, or retry later; this run keeps its audit event.",
    failureSource: "Failure source",
    deepSeekProvider: "DeepSeek Provider",
    nextStep: "Next step",
    run: "Run",
    running: "Running",
    cancel: "Cancel",
    retry: "Retry",
    approve: "Approve",
    reject: "Reject",
    action: "action",
    status: "status",
    runCreated: "Created run",
    runStatusChanged: "Updated run status",
    messageDelta: "Received message delta",
    messageCompleted: "Generated message",
    toolStarted: "Started tool call",
    toolCompleted: "Completed tool call",
    toolFailed: "Tool call failed",
    toolPath: "Path",
    toolError: "Error",
    approvalRequested: "Requested approval",
    approvalResolved: "Approval resolved",
    artifactCreated: "Created artifact",
    runCompleted: "Completed run",
    runFailed: "Run failed",
    noToolCalls: "No tool calls for this run",
    noToolCallsDetail:
      "Tool calls from Researcher, Builder, or Reviewer will appear here.",
    noApproval: "No pending approval for this run",
    noApprovalDetail:
      "File writes, shell commands, and external requests enter approval first.",
    noArtifacts: "No artifacts for this run",
    noArtifactsDetail:
      "Plans, patch drafts, documents, or final summaries will appear here.",
    writeFileRequest: "Builder requests file write",
    composerInput: "Task input",
    composerPlaceholder: "Describe what you want Sage Agent to do...",
    composerHint:
      "Click Run to create a real backend run and stream the DeepSeek Supervisor. Missing API keys create auditable provider errors.",
    composerEmptyHint: "Enter a task goal before running.",
    composerRunningHint:
      "Creating a backend run and streaming DeepSeek output. Please wait.",
    composerCancelledHint:
      "Local waiting was cancelled; if the provider request had already started, the backend may still finish and keep events.",
    composerFailedHint: "Run failed",
    retryProviderHint:
      "Added a local retry note. Real provider retry will be wired later.",
    apiThreadSubtitle: "API run",
    headerFallback: "Initialize Sage Agent Product Shell",
    headerDescription:
      "has Supervisor coordinating Researcher, Builder, and Reviewer for the Stage 1 local interactive workbench.",
    newDraft: "New task draft",
    localDraft: "Local draft",
    stage1Spec: "Stage 1 Implementation Spec",
    screenshotCheck: "Product Shell Screenshot Check",
    noAuditEvents: "No audit events for this run",
  },
} satisfies Record<Locale, Record<string, string>>;

const initialThreads: ThreadItem[] = [
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

const initialRuns: RunItem[] = [
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
    runId: "run-1842",
    body: {
      zh: "创建 Sage Agent 的 Codex-like product shell，并展示多 agent 的运行状态。",
      en: "Create a Codex-like product shell for Sage Agent and show multi-agent run state.",
    },
  },
  {
    role: "Supervisor",
    runId: "run-1842",
    body: {
      zh: "已将任务拆分为 UI shell、seed data、controls、inspector 四个部分，当前由 Builder 生成静态工作台。",
      en: "The task is split into UI shell, seed data, controls, and inspector. Builder is generating the static workbench.",
    },
  },
  {
    role: "Builder",
    runId: "run-1842",
    body: {
      zh: "正在实现三栏布局：左侧 threads/runs，中间 run conversation，右侧 timeline/tool calls/approval/artifacts。",
      en: "Implementing the three-column layout: threads/runs on the left, run conversation in the center, timeline/tool calls/approval/artifacts on the right.",
    },
  },
  {
    role: "Reviewer",
    runId: "run-1842",
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
  path: string | null;
  error: string | null;
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

type ProviderErrorState = {
  readonly failedAgent: string;
  readonly status: string;
  readonly message: string;
};

type AuditSummary = {
  readonly eventCount: number;
  readonly lastEventType: string | null;
  readonly lastEventAt: string | null;
  readonly toolCallCount: number;
  readonly approvalCount: number;
  readonly artifactCount: number;
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

function StateBlock({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className={`state-block ${tone}`}>
      <p>{title}</p>
      <small>{detail}</small>
    </div>
  );
}

function getComposerStatusText({
  t,
  isRunBusy,
  composerError,
  lastComposerState,
  hasInput,
}: {
  t: (typeof copy)[Locale];
  isRunBusy: boolean;
  composerError: string | null;
  lastComposerState: "idle" | "cancelled";
  hasInput: boolean;
}) {
  if (isRunBusy) return t.composerRunningHint;
  if (composerError) return `${t.composerFailedHint}: ${composerError}`;
  if (lastComposerState === "cancelled") return t.composerCancelledHint;
  if (!hasInput) return t.composerEmptyHint;
  return t.composerHint;
}

export default function Home() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] =
    useState(false);
  const locale = preferences.locale;
  const model = preferences.model;
  const thinkingEnabled = preferences.thinkingEnabled;
  const reasoningEffort = preferences.reasoningEffort;
  const t = copy[locale];
  const [threadItems, setThreadItems] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(initialThreads[0].id);
  const [runItems, setRunItems] = useState(initialRuns);
  const [activeRunId, setActiveRunId] = useState(initialRuns[0].id);
  const [composerInput, setComposerInput] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(baseMessages);
  const [runEvents, setRunEvents] = useState<RunEvent[]>(seedRunEvents);
  const [isRunBusy, setIsRunBusy] = useState(false);
  const [lastComposerState, setLastComposerState] = useState<
    "idle" | "cancelled"
  >("idle");
  const runRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPreferences(readStoredPreferences(window.localStorage));
      setHasLoadedStoredPreferences(true);
    });
  }, []);

  useEffect(() => {
    if (hasLoadedStoredPreferences) {
      writeStoredPreferences(window.localStorage, preferences);
    }
  }, [hasLoadedStoredPreferences, preferences]);

  function updatePreferences(nextPreferences: Partial<Preferences>) {
    setPreferences((current) => ({
      ...current,
      ...nextPreferences,
    }));
  }

  const activeThread = threadItems.find((thread) => thread.id === activeThreadId);
  const activeRun = runItems.find((run) => run.id === activeRunId);
  const timelineRows = getTimelineRows(runEvents, activeRunId);
  const activeToolCalls = getToolCallRows(runEvents, activeRunId);
  const activeApproval = getActiveApproval(runEvents, activeRunId);
  const activeArtifacts = getArtifactRows(runEvents, activeRunId);
  const activeProviderError = getProviderError(runEvents, activeRunId);
  const activeAuditSummary = getAuditSummary(runEvents, activeRunId);
  const activeMessages = messages.filter((message) => message.runId === activeRunId);
  const trimmedComposerInput = composerInput.trim();
  const composerStatusText = getComposerStatusText({
    t,
    isRunBusy,
    composerError,
    lastComposerState,
    hasInput: trimmedComposerInput.length > 0,
  });

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

  async function handleRunClick() {
    const goal = composerInput.trim();
    if (isRunBusy || goal.length === 0) {
      return;
    }

    const controller = new AbortController();
    runRequestRef.current = controller;
    setIsRunBusy(true);
    setLastComposerState("idle");
    setComposerError(null);

    try {
      const created = await createApiRun(
        {
          goal,
          title: deriveTitle(goal),
          threadTitle: deriveTitle(goal),
          settings: {
            model,
            thinkingEnabled,
            reasoningEffort,
          },
        },
        controller.signal,
      );

      setThreadItems((current) => appendThreadItem(current, created.thread));
      setRunItems((current) => appendRunItem(current, created.run));
      setActiveThreadId(created.thread.id);
      setActiveRunId(created.run.id);
      setRunEvents((current) =>
        mergeRunEvents(current, created.events),
      );
      setMessages((current) => [
        ...current,
        {
          role: "User",
          runId: created.run.id,
          body: {
            zh: goal,
            en: goal,
          },
        },
      ]);

      const supervisor = await streamApiSupervisorRun(
        created.run.id,
        controller.signal,
        (event) => {
          setRunEvents((current) => mergeRunEvents(current, [event]));
          setRunItems((current) => updateRunItemFromEvents(current, [event]));
          setMessages((current) =>
            applyRunEventToMessages(current, event, created.run.id),
          );
        },
      );

      if (!supervisor.ok) {
        setComposerError(supervisor.error?.message ?? "provider_failed");
      } else {
        setComposerInput("");
      }
    } catch (error) {
      if (isAbortError(error)) {
        setLastComposerState("cancelled");
        return;
      }

      setComposerError(toSafeErrorMessage(error));
    } finally {
      setIsRunBusy(false);
      if (runRequestRef.current === controller) {
        runRequestRef.current = null;
      }
    }
  }

  function handleCancelRun() {
    runRequestRef.current?.abort();
    runRequestRef.current = null;

    setIsRunBusy(false);
    setLastComposerState("cancelled");
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

  function handleProviderError() {
    const failedAt = new Date().toISOString();
    const failedRun: Run = {
      id: activeRunId,
      threadId: activeThreadId,
      title: activeRun?.title.en ?? "Local provider run",
      goal: activeRun?.title.en ?? "Local provider run",
      status: "failed",
      activeAgent: "supervisor",
      settings: {
        model,
        thinkingEnabled,
        reasoningEffort,
      },
      createdAt: failedAt,
      updatedAt: failedAt,
      completedAt: failedAt,
    };

    setRunEvents((current) => [
      ...current,
      {
        id: `event-provider-error-${Date.now()}`,
        runId: activeRunId,
        type: "run.failed",
        sequence: nextEventSequence(current, activeRunId),
        createdAt: failedAt,
        payload: {
          run: failedRun,
          error: copy.en.providerErrorSafeMessage,
        },
      },
    ]);
  }

  function handleProviderRetry() {
    setMessages((current) => [
      ...current,
      {
        role: "Supervisor",
        runId: activeRunId,
        body: {
          zh: copy.zh.retryProviderHint,
          en: copy.en.retryProviderHint,
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

          <section className="settings-strip" aria-label={t.settings}>
            <button
              aria-label={t.openSettings}
              className="settings-entry"
              onClick={() => setIsSettingsOpen(true)}
              type="button"
            >
              <div className="settings-copy">
                <span>{t.settings}</span>
                <p>{t.settingsEntryDetail}</p>
              </div>
              <span className="settings-entry-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="sr-only">{t.openSettings}</span>
            </button>
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
              {runItems.map((run) => (
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
              <p>{activeRun?.goal ?? `${activeThread?.title[locale]} ${t.headerDescription}`}</p>
            </div>

            <div className="model-controls" aria-label={t.modelSettings}>
              <span className="config-chip">
                {t.model}: {model}
              </span>
              <span className="config-chip">
                {t.thinking}: {thinkingEnabled ? t.enabled : t.disabled}
              </span>
              <span className="config-chip">
                {t.reasoningEffort}: {reasoningEffort}
              </span>
            </div>
          </header>

          <div className="conversation">
            {activeMessages.map((message, index) => (
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
            <div className="composer-main">
              <p>{t.nextStep}</p>
              <label className="sr-only" htmlFor="sage-composer-input">
                {t.composerInput}
              </label>
              <textarea
                aria-label={t.composerInput}
                className="composer-input"
                disabled={isRunBusy}
                id="sage-composer-input"
                onChange={(event) => {
                  setComposerInput(event.target.value);
                  if (composerError) setComposerError(null);
                  if (lastComposerState === "cancelled") {
                    setLastComposerState("idle");
                  }
                }}
                placeholder={t.composerPlaceholder}
                rows={3}
                value={composerInput}
              />
              <span>{composerStatusText}</span>
            </div>
            <div className="composer-actions">
              <button className="secondary-button" onClick={handleProviderError}>
                {t.simulateProviderError}
              </button>
              <button
                className="secondary-button"
                disabled={!isRunBusy}
                onClick={handleCancelRun}
              >
                {t.cancel}
              </button>
              <button
                disabled={isRunBusy || trimmedComposerInput.length === 0}
                onClick={handleRunClick}
              >
                {isRunBusy ? t.running : t.run}
              </button>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <Panel title={t.auditTrail}>
            <div className="audit-summary">
              <dl className="audit-primary">
                <div>
                  <dt>{t.lastEvent}</dt>
                  <dd title={activeAuditSummary.lastEventType ?? t.noAuditEvents}>
                    {activeAuditSummary.lastEventType ?? t.noAuditEvents}
                  </dd>
                </div>
                <div>
                  <dt>{t.lastUpdated}</dt>
                  <dd>
                    <time dateTime={activeAuditSummary.lastEventAt ?? undefined}>
                      {activeAuditSummary.lastEventAt
                        ? formatAuditTime(activeAuditSummary.lastEventAt)
                        : "-"}
                    </time>
                  </dd>
                </div>
              </dl>
              <dl className="audit-counts" aria-label={t.counts}>
                <div>
                  <dt>{t.events}</dt>
                  <dd>{activeAuditSummary.eventCount}</dd>
                </div>
                <div>
                  <dt>{t.tools}</dt>
                  <dd>{activeAuditSummary.toolCallCount}</dd>
                </div>
                <div>
                  <dt>{t.approvals}</dt>
                  <dd>{activeAuditSummary.approvalCount}</dd>
                </div>
                <div>
                  <dt>{t.artifacts}</dt>
                  <dd>{activeAuditSummary.artifactCount}</dd>
                </div>
              </dl>
            </div>
          </Panel>

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
                <StateBlock title={t.noToolCalls} detail={t.noToolCallsDetail} />
              ) : (
                activeToolCalls.map((call) => (
                  <div className="tool-row" key={call.id}>
                    <div>
                      <code>{call.tool}</code>
                      {call.path ? (
                        <small>
                          {t.toolPath}: {call.path}
                        </small>
                      ) : null}
                      {call.error ? (
                        <small>
                          {t.toolError}: {call.error}
                        </small>
                      ) : null}
                    </div>
                    <span>
                      {call.agent} · {call.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title={t.providerError}>
            {activeProviderError ? (
              <div className="provider-error-box">
                <p>{t.providerError}</p>
                <small>
                  {t.failureSource}: {activeProviderError.failedAgent} ·{" "}
                  {t.status}: {activeProviderError.status}
                </small>
                <small>{activeProviderError.message}</small>
                <small>{t.providerErrorNextStep}</small>
                <div className="provider-error-actions">
                  <button onClick={handleProviderRetry}>{t.retry}</button>
                </div>
              </div>
            ) : (
              <div className="stack">
                <StateBlock title={t.noProviderError} detail={t.noProviderErrorDetail} />
              </div>
            )}
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
                <StateBlock title={t.noApproval} detail={t.noApprovalDetail} />
              </div>
            )}
          </Panel>

          <Panel title={t.artifacts}>
            <div className="stack">
              {activeArtifacts.length === 0 ? (
                <StateBlock title={t.noArtifacts} detail={t.noArtifactsDetail} />
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
      {isSettingsOpen ? (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsSettingsOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="settings-dialog-title"
            aria-modal="true"
            className="settings-dialog"
            role="dialog"
          >
            <header className="settings-dialog-header">
              <div>
                <p className="section-label">{t.currentConfiguration}</p>
                <h2 id="settings-dialog-title">{t.settingsTitle}</h2>
                <p>{t.settingsSubtitle}</p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setIsSettingsOpen(false)}
                type="button"
              >
                {t.closeSettings}
              </button>
            </header>

            <div className="settings-dialog-grid">
              <article className="settings-card">
                <div>
                  <p>{t.generalSettings}</p>
                  <small>{t.generalSettingsDetail}</small>
                </div>
                <div className="settings-card-control">
                  <span>{t.displayLanguage}</span>
                  <div className="segmented language-switch" aria-label={t.language}>
                    <button
                      aria-pressed={locale === "zh"}
                      className={locale === "zh" ? "selected" : ""}
                      onClick={() => updatePreferences({ locale: "zh" })}
                    >
                      中文
                    </button>
                    <button
                      aria-pressed={locale === "en"}
                      className={locale === "en" ? "selected" : ""}
                      onClick={() => updatePreferences({ locale: "en" })}
                    >
                      English
                    </button>
                  </div>
                </div>
              </article>

              <article className="settings-card">
                <div>
                  <p>{t.providerSettings}</p>
                  <small>{t.providerSettingsDetail}</small>
                </div>
                <div className="settings-control-stack">
                  <div className="settings-card-control">
                    <span>{t.defaultModel}</span>
                    <div className="segmented model-selector" aria-label={t.model}>
                      {ALLOWED_MODELS.map((modelOption) => (
                        <button
                          aria-pressed={model === modelOption}
                          className={model === modelOption ? "selected" : ""}
                          key={modelOption}
                          onClick={() => updatePreferences({ model: modelOption })}
                        >
                          {modelOption}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <span>{t.thinkingEnabledSetting}</span>
                    <div className="segmented thinking-toggle" aria-label={t.thinking}>
                      <button
                        aria-pressed={thinkingEnabled}
                        className={thinkingEnabled ? "selected" : ""}
                        onClick={() => updatePreferences({ thinkingEnabled: true })}
                      >
                        {t.enabled}
                      </button>
                      <button
                        aria-pressed={!thinkingEnabled}
                        className={thinkingEnabled ? "" : "selected"}
                        onClick={() => updatePreferences({ thinkingEnabled: false })}
                      >
                        {t.disabled}
                      </button>
                    </div>
                  </div>
                  <div className="settings-card-control">
                    <span>{t.reasoningEffort}</span>
                    <div
                      className="segmented reasoning-selector"
                      aria-label={t.reasoningEffort}
                    >
                      {ALLOWED_REASONING_EFFORTS.map((effortOption) => (
                        <button
                          aria-pressed={reasoningEffort === effortOption}
                          className={reasoningEffort === effortOption ? "selected" : ""}
                          key={effortOption}
                          onClick={() =>
                            updatePreferences({ reasoningEffort: effortOption })
                          }
                        >
                          {effortOption}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="settings-card">
                <div>
                  <p>{t.workspaceSettings}</p>
                  <small>{t.workspaceSettingsDetail}</small>
                </div>
                <dl className="settings-summary">
                  <div>
                    <dt>{t.status}</dt>
                    <dd>{t.localSingleUser}</dd>
                  </div>
                  <div>
                    <dt>{t.currentRun}</dt>
                    <dd>{activeRun?.id ?? t.notConfigured}</dd>
                  </div>
                </dl>
              </article>

              <article className="settings-card">
                <div>
                  <p>{t.safetySettings}</p>
                  <small>{t.safetySettingsDetail}</small>
                </div>
                <dl className="settings-summary">
                  <div>
                    <dt>{t.status}</dt>
                    <dd>{t.readDraftMode}</dd>
                  </div>
                  <div>
                    <dt>{t.approvals}</dt>
                    <dd>{activeAuditSummary.approvalCount}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>
        </div>
      ) : null}
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

async function createApiRun(
  payload: CreateRunPayload,
  signal: AbortSignal,
): Promise<CreateRunResponse> {
  const response = await fetch("/api/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  return parseJsonResponse<CreateRunResponse>(response, "create_run_failed");
}

async function streamApiSupervisorRun(
  runId: string,
  signal: AbortSignal,
  onEvent: (event: RunEvent) => void,
): Promise<SupervisorRunResponse> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/supervisor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal,
  });

  if (!response.ok) {
    throw new Error(`supervisor_run_failed_${response.status}`);
  }

  const events = await readRunEventsSse(response, onEvent);
  const failedEvent = events.findLast(
    (event): event is Extract<RunEvent, { type: "run.failed" }> =>
      event.type === "run.failed",
  );

  return {
    ok: failedEvent === undefined,
    events,
    error: failedEvent
      ? {
          code: "provider_failed",
          message: failedEvent.payload.error,
        }
      : null,
  };
}

async function readRunEventsSse(
  response: Response,
  onEvent: (event: RunEvent) => void,
): Promise<RunEvent[]> {
  if (!response.body) {
    const events = parseRunEventsSse(await response.text());
    for (const event of events) onEvent(event);
    return events;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: RunEvent[] = [];
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n+/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const event = parseRunEventSseBlock(block);
        if (!event) continue;

        events.push(event);
        onEvent(event);
      }
    }

    buffer += decoder.decode();
    const event = parseRunEventSseBlock(buffer);
    if (event) {
      events.push(event);
      onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

async function parseJsonResponse<ResponseBody>(
  response: Response,
  fallbackCode: string,
): Promise<ResponseBody> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackCode);
  }

  if (!response.ok) {
    throw new Error(readApiErrorCode(payload) ?? `${fallbackCode}_${response.status}`);
  }

  return payload as ResponseBody;
}

function readApiErrorCode(payload: unknown): string | null {
  if (!isPlainRecord(payload)) return null;
  const error = payload.error;
  if (!isPlainRecord(error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function parseRunEventsSse(payload: string): RunEvent[] {
  const events: RunEvent[] = [];
  const blocks = payload.split(/\n\n+/);

  for (const block of blocks) {
    const event = parseRunEventSseBlock(block);
    if (event) events.push(event);
  }

  return events;
}

function parseRunEventSseBlock(block: string): RunEvent | null {
  const dataLine = block
    .split("\n")
    .find((line) => line.startsWith("data: "));
  if (!dataLine) return null;

  try {
    return JSON.parse(dataLine.slice("data: ".length)) as RunEvent;
  } catch {
    // Ignore malformed SSE blocks; the API contract is validated server-side.
    return null;
  }
}

function appendThreadItem(
  current: readonly ThreadItem[],
  thread: Thread,
): ThreadItem[] {
  const item: ThreadItem = {
    id: thread.id,
    title: {
      zh: thread.title,
      en: thread.title,
    },
    subtitle: {
      zh: copy.zh.apiThreadSubtitle,
      en: copy.en.apiThreadSubtitle,
    },
  };

  return [item, ...current.filter((threadItem) => threadItem.id !== thread.id)];
}

function appendRunItem(current: readonly RunItem[], run: Run): RunItem[] {
  const item: RunItem = {
    id: run.id,
    title: {
      zh: run.title,
      en: run.title,
    },
    status: run.status,
    time: formatRunListTime(run.createdAt),
    goal: run.goal,
  };

  return [item, ...current.filter((runItem) => runItem.id !== run.id)];
}

function updateRunItemFromEvents(
  current: readonly RunItem[],
  events: readonly RunEvent[],
): RunItem[] {
  return current.map((item) => {
    const runUpdate = findLastRunUpdate(events, item.id);
    if (!runUpdate) return item;

    return {
      ...item,
      status: runUpdate.status,
    };
  });
}

function findLastRunUpdate(
  events: readonly RunEvent[],
  runId: string,
): { status: string } | null {
  const event = events
    .filter((candidate) => candidate.runId === runId)
    .findLast(
      (
        candidate,
      ): candidate is Extract<
        RunEvent,
        { type: "run.status_changed" | "run.completed" | "run.failed" }
      > =>
        candidate.type === "run.status_changed" ||
        candidate.type === "run.completed" ||
        candidate.type === "run.failed",
    );

  if (!event) return null;
  if (event.type === "run.status_changed") {
    return { status: event.payload.status };
  }

  return { status: event.payload.run.status };
}

function mergeRunEvents(
  current: readonly RunEvent[],
  incoming: readonly RunEvent[],
): RunEvent[] {
  const events = new Map<string, RunEvent>();
  for (const event of current) events.set(event.id, event);
  for (const event of incoming) events.set(event.id, event);
  return [...events.values()].toSorted(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.runId.localeCompare(right.runId) ||
      left.sequence - right.sequence ||
      left.id.localeCompare(right.id),
  );
}

function applyRunEventToMessages(
  current: readonly Message[],
  event: RunEvent,
  runId: string,
): Message[] {
  if (event.runId !== runId) return [...current];

  if (event.type === "message.delta") {
    return applyMessageDelta(current, event, runId);
  }

  if (event.type === "message.completed") {
    return applyMessageCompleted(current, event, runId);
  }

  return [...current];
}

function applyMessageDelta(
  current: readonly Message[],
  event: Extract<RunEvent, { type: "message.delta" }>,
  runId: string,
): Message[] {
  const role = event.payload.agent
    ? agentLabels[event.payload.agent]
    : "System";
  const existingIndex = current.findIndex(
    (message) =>
      message.runId === runId && message.messageId === event.payload.messageId,
  );

  if (existingIndex === -1) {
    return [
      ...current,
      {
        role,
        runId,
        messageId: event.payload.messageId,
        eventIds: [event.id],
        body: {
          zh: event.payload.delta,
          en: event.payload.delta,
        },
      },
    ];
  }

  return current.map((message, index) =>
    index === existingIndex
      ? message.eventIds?.includes(event.id)
        ? message
        : {
            ...message,
            eventIds: [...(message.eventIds ?? []), event.id],
            body: {
              zh: `${message.body.zh}${event.payload.delta}`,
              en: `${message.body.en}${event.payload.delta}`,
            },
          }
      : message,
  );
}

function applyMessageCompleted(
  current: readonly Message[],
  event: Extract<RunEvent, { type: "message.completed" }>,
  runId: string,
): Message[] {
  const role = event.payload.message.agent
    ? agentLabels[event.payload.message.agent]
    : "System";
  const content = event.payload.message.content;
  const existingIndex = current.findIndex(
    (message) =>
      message.runId === runId && message.messageId === event.payload.message.id,
  );

  if (existingIndex === -1) {
    return [
      ...current,
      {
        role,
        runId,
        messageId: event.payload.message.id,
        eventIds: [event.id],
        body: {
          zh: content,
          en: content,
        },
      },
    ];
  }

  return current.map((message, index) =>
    index === existingIndex
      ? {
          ...message,
          role,
          eventIds: message.eventIds?.includes(event.id)
            ? message.eventIds
            : [...(message.eventIds ?? []), event.id],
          body: {
            zh: content,
            en: content,
          },
        }
      : message,
  );
}

function deriveTitle(goal: string): string {
  return goal.length <= 80 ? goal : `${goal.slice(0, 77)}...`;
}

function formatRunListTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "request_failed";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      path: readToolPath(call),
      error: call.error,
    }));
}

function readToolPath(call: ToolCall): string | null {
  const pathFromArgs = call.args.relativePath;
  if (typeof pathFromArgs === "string") return pathFromArgs;

  if (isPlainRecord(call.result)) {
    const pathFromResult = call.result.relativePath;
    if (typeof pathFromResult === "string") return pathFromResult;
  }

  return null;
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

function getProviderError(
  events: readonly RunEvent[],
  activeRunId: string,
): ProviderErrorState | null {
  const failedEvent = getEventsForRun(events, activeRunId)
    .filter(
      (event): event is Extract<RunEvent, { type: "run.failed" }> =>
        event.type === "run.failed",
    )
    .at(-1);

  if (!failedEvent) return null;

  return {
    failedAgent: failedEvent.payload.run.activeAgent
      ? agentLabels[failedEvent.payload.run.activeAgent]
      : "System",
    status: failedEvent.payload.run.status,
    message: failedEvent.payload.error,
  };
}

function getAuditSummary(
  events: readonly RunEvent[],
  activeRunId: string,
): AuditSummary {
  const runEventsForAudit = getEventsForRun(events, activeRunId);
  const lastEvent = runEventsForAudit.at(-1) ?? null;

  return {
    eventCount: runEventsForAudit.length,
    lastEventType: lastEvent?.type ?? null,
    lastEventAt: lastEvent?.createdAt ?? null,
    toolCallCount: getToolCallRows(events, activeRunId).length,
    approvalCount: countUniquePayloads(
      runEventsForAudit,
      (event) =>
        isApprovalEvent(event) ? event.payload.approval.id : null,
    ),
    artifactCount: getArtifactRows(events, activeRunId).length,
  };
}

function countUniquePayloads(
  events: readonly RunEvent[],
  getId: (event: RunEvent) => string | null,
): number {
  const ids = new Set<string>();

  for (const event of events) {
    const id = getId(event);
    if (id) {
      ids.add(id);
    }
  }

  return ids.size;
}

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes} UTC`;
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
