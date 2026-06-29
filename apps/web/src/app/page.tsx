"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentRole,
  Approval,
  ApprovalStatus,
  Artifact,
  EntrySurfaceSnapshot,
  MemoryEntry,
  MemorySnapshot,
  MemoryScope,
  Run,
  RunEvent,
  SkillEntry,
  SkillAuditAction,
  SkillSnapshot,
  SkillSource,
  SkillStatus,
  Thread,
  ToolCall,
  ProviderRegistrySnapshot,
  PlatformExtensionSnapshot,
} from "@sage/shared";
import { MEMORY_SCOPES, SKILL_SOURCES } from "@sage/shared";
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
import { getPhase4RunSummary } from "@/lib/phase4-summary";
import type {
  DeepSeekConnectionTestCode,
  DeepSeekConnectionTestResult,
  DeepSeekProviderConnectionTestResponse,
  DeepSeekProviderStatusResponse,
  DeepSeekProviderStatusSummary,
} from "@/lib/deepseek-provider-status";

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
  threadId: string;
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
    providerId: "deepseek";
    model: Preferences["model"];
    thinkingEnabled: boolean;
    reasoningEffort: ReasoningEffort;
  };
};

type MemorySnapshotResponse = {
  snapshot: MemorySnapshot;
};

type SkillSnapshotResponse = {
  snapshot: SkillSnapshot;
};

type MemoryFormState = {
  scope: MemoryScope;
  title: string;
  content: string;
  tags: string;
  sourceThreadId: string;
  sourceRunId: string;
  reason: string;
};

const DEFAULT_MEMORY_FORM: MemoryFormState = {
  scope: "workspace",
  title: "",
  content: "",
  tags: "",
  sourceThreadId: "",
  sourceRunId: "",
  reason: "initial memory capture",
};

const memoryScopeOptions: readonly MemoryScope[] = [
  ...MEMORY_SCOPES,
];

type SkillFormState = {
  name: string;
  description: string;
  instruction: string;
  tags: string;
  source: SkillSource;
  reason: string;
};

const DEFAULT_SKILL_FORM: SkillFormState = {
  name: "",
  description: "",
  instruction: "",
  tags: "",
  source: "user",
  reason: "initial skill capture",
};

const skillSourceOptions: readonly SkillSource[] = [
  ...SKILL_SOURCES,
];

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
    providerSettings: "Providers / 入口",
    workspaceSettings: "工作区",
    safetySettings: "安全边界",
    currentConfiguration: "当前配置",
    displayLanguage: "显示语言",
    defaultModel: "默认模型",
    thinkingEnabledSetting: "Thinking 开关",
    generalSettingsDetail: "界面语言会作为非敏感偏好保存在本地浏览器。",
    providerSettingsDetail:
      "当前默认 Provider 是 DeepSeek；模型、thinking 和推理强度作为非敏感偏好持久化，API key 只从后端安全状态读取。",
    providerRegistry: "Provider registry",
    providerRegistryDetail:
      "V2.4 先把 provider、状态和 fallback 统一成共享对象；自动 fallback 需要第二个已审批 provider 后再开启。",
    providerDefault: "默认 Provider",
    providerFallback: "Fallback",
    providerFallbackDisabled: "自动 fallback 未开启",
    providerAvailable: "可用",
    providerDegraded: "降级",
    providerMissingCredentials: "缺少凭据",
    providerInvalidConfig: "配置无效",
    entrySurfaces: "入口",
    entrySurfacesDetail:
      "Web 是当前入口；Desktop 先登记为 planned，并复用同一 run/provider/state 模型。",
    entrySurfaceActive: "已启用",
    entrySurfacePlanned: "计划中",
    platformExtensions: "平台扩展登记",
    platformExtensionsDetail:
      "这里只登记 V2.5 候选扩展，不在当前版本实现真实 cron、voice、gateway 或自动更新能力。",
    extensionCurrentState: "当前状态",
    extensionCandidateSurfaces: "候选扩展面",
    extensionNotImplemented: "仍不实现",
    extensionScopeNote: "边界说明",
    extensionCandidateReason:
      "先保留入口和审计位置，等单独提案、审批和安全边界齐备后再进入实现。",
    extensionCandidateCron: "Cron / 定时触发",
    extensionCandidateVoice: "Voice / 语音输入输出",
    extensionCandidateGateway: "Gateway / messaging",
    extensionCandidateUpdate: "Update / 自动更新",
    extensionNotBuiltTitle: "这些能力当前仍不做",
    extensionNotBuiltDetail:
      "cron、voice、gateway 和自动更新都不在本版本实现；UI 只展示候选登记和边界，避免把路线图误读成已交付功能。",
    extensionPlanned: "计划中",
    extensionBlocked: "已阻断",
    extensionProposed: "待提案",
    extensionAutomation: "自动化",
    extensionInteraction: "交互",
    extensionIdentity: "身份",
    extensionMessaging: "消息",
    extensionMaintenance: "维护",
    providerConfigStatus: "配置状态",
    providerStatusLoading: "正在读取 DeepSeek 配置状态...",
    providerStatusFailed: "无法读取 DeepSeek 配置状态。",
    refreshProviderStatus: "刷新状态",
    testProviderConnection: "测试连接",
    testingProviderConnection: "测试中",
    apiKeyReadiness: "API key",
    apiKeyConfigured: "已配置",
    apiKeyMissing: "未配置",
    baseUrl: "Base URL",
    providerDefaultModel: "Provider 默认模型",
    providerThinking: "Provider Thinking",
    providerReasoningEffort: "Provider 推理强度",
    providerConfigValid: "有效",
    providerConfigInvalid: "无效",
    providerIssues: "配置问题",
    noProviderIssues: "暂无配置问题",
    recentConnectionTest: "最近连接测试",
    connectionNotTested: "尚未测试连接",
    connectionTestOk: "连接测试成功",
    connectionTestMissingApiKey: "缺少 API key",
    connectionTestHttpError: "DeepSeek 返回 HTTP 错误",
    connectionTestNetworkError: "无法连接 DeepSeek",
    connectionTestInvalidResponse: "DeepSeek 返回无效响应",
    connectionTestInvalidConfig: "DeepSeek 配置无效",
    connectionTestNextStepOk: "无需操作。",
    connectionTestNextStepMissingApiKey:
      "在服务端环境配置 DEEPSEEK_API_KEY 并重启 dev server。",
    connectionTestNextStepHttpError:
      "检查 API key、账号权限和 Provider Base URL。",
    connectionTestNextStepNetworkError:
      "检查网络访问、Base URL 和本地代理设置。",
    connectionTestNextStepInvalidResponse:
      "稍后重试，或确认 Base URL 指向 DeepSeek 兼容接口。",
    connectionTestNextStepInvalidConfig:
      "修复 DeepSeek 环境变量配置后再测试。",
    workspaceSettingsDetail:
      "展示本地 workspace 的只读运行边界和 read_project_file 工具权限。",
    safetySettingsDetail:
      "默认 Read + Draft；写文件、shell 和外部副作用操作必须进入 approval。",
    workspaceRoot: "当前 workspace root",
    workspaceRootSource: "monorepo root / SAGE_WORKSPACE_ROOT",
    workspaceRootDetail:
      "后端优先使用 SAGE_WORKSPACE_ROOT；未设置时从 monorepo root 推导。Settings 只展示边界说明，不暴露或编辑本机绝对路径。",
    workspaceRootReadOnly:
      "修改 workspace root 仍通过 SAGE_WORKSPACE_ROOT；此界面暂不提供编辑入口。",
    readProjectFileTool: "read_project_file",
    readProjectFileAllowed: "允许读取",
    readProjectFileAllowedDetail:
      "只读普通项目文本文件；路径必须是 workspace root 内的相对路径，默认最多 64 KiB。",
    readProjectFileDenied: "拒绝读取",
    readProjectFileDeniedDetail:
      "目录、二进制、过大文件、绝对路径、路径越界，以及 blocked policy 命中的路径都会被拒绝且不返回敏感内容。",
    blockedPathPolicy: "Blocked path policy",
    blockedPathPolicyDetail:
      "以下路径即使位于 workspace root 内也会被拒绝，覆盖环境文件、仓库元数据、依赖、构建产物和测试缓存。",
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
    phase4Summary: "Phase 4 真实状态",
    memoryVault: "记忆底座",
    memoryVaultDetail: "本地跨会话记忆、审计和上下文注入。",
    memoryEntries: "记忆条目",
    memoryAuditTrail: "记忆审计",
    memoryCreate: "新建记忆",
    memoryEdit: "编辑记忆",
    memoryDelete: "删除记忆",
    memoryCreateOrUpdate: "保存记忆",
    memoryEmpty: "当前没有记忆条目",
    memoryEmptyDetail: "创建项目约束、用户偏好或可复用结论后会保存在这里。",
    memoryLoading: "正在读取记忆底座...",
    memorySave: "保存记忆",
    memoryScope: "范围",
    memoryTitle: "标题",
    memoryContent: "内容",
    memoryTags: "标签",
    memorySourceThread: "来源 thread",
    memorySourceRun: "来源 run",
    memoryReason: "原因",
    memorySaved: "已保存",
    memoryDeleted: "已删除",
    memoryAction: "操作",
    memoryCreatedBy: "创建者",
    memoryUpdatedAt: "更新时间",
    memoryAuditSummary: "审计摘要",
    skillVault: "技能库",
    skillVaultDetail: "本地技能、人工 curation、审计和上下文注入。",
    skillEntries: "技能条目",
    skillAuditTrail: "技能审计",
    skillCreate: "新建技能",
    skillEdit: "编辑技能",
    skillDelete: "删除技能",
    skillEnable: "启用",
    skillDisable: "停用",
    skillCreateOrUpdate: "保存技能",
    skillEmpty: "当前没有技能条目",
    skillEmptyDetail: "沉淀可复用操作说明后会保存在这里，启用后进入 supervisor 上下文。",
    skillLoading: "正在读取技能库...",
    skillName: "名称",
    skillDescription: "说明",
    skillInstruction: "指令",
    skillTags: "标签",
    skillSource: "来源",
    skillStatus: "状态",
    skillVersion: "版本",
    skillReason: "原因",
    skillSourceUser: "用户",
    skillSourceAgent: "Agent 经验",
    skillSourceTemplate: "项目模板",
    skillStatusDraft: "草稿",
    skillStatusCurated: "已启用",
    skillStatusDisabled: "已停用",
    skillActionCreate: "创建",
    skillActionUpdate: "更新",
    skillActionDelete: "删除",
    skillActionEnable: "启用",
    skillActionDisable: "停用",
    skillDraftAfterSave: "保存后会进入 draft，需要通过启用按钮人工 curated。",
    skillSaved: "已保存",
    skillDeleted: "已删除",
    skillEnabled: "已启用",
    skillDisabled: "已停用",
    skillAuditSummary: "审计摘要",
    phase4SummaryDetail:
      "直接读取 runtime events、artifact summaries 和 final summary gate。",
    runtimeDerived: "runtime 派生",
    runtimeDerivedDetail: "当前视图从事件和 helper 输出汇总，不依赖静态说明。",
    supervisorPlan: "Supervisor plan",
    researcherBrief: "Researcher brief",
    builderDraft: "Builder draft",
    reviewerReport: "Reviewer report",
    finalSummaryGate: "Final summary gate",
    artifactSummaries: "Artifacts",
    phase4Missing: "未生成",
    phase4Ready: "可进入 final summary",
    phase4Blocked: "阻断 final summary",
    phase4SummaryReady: "Reviewer pass，final summary 可继续。",
    phase4SummaryBlocked: "Reviewer 仍有阻断项。",
    phase4SummaryMissing: "当前 run 尚未产生 phase 4 事件。",
    stepCount: "步骤",
    contextTargets: "上下文",
    patchTargets: "patch 目标",
    artifactDrafts: "artifact 草稿",
    acceptanceCriteria: "验收",
    findings: "发现",
    risks: "风险",
    missingChecks: "缺失检查",
    decision: "决策",
    events: "事件",
    tools: "工具",
    approvals: "审批",
    lastEvent: "最后事件",
    lastUpdated: "最后更新",
    rawEventType: "原始类型",
    counts: "计数",
    statusQueued: "排队中",
    statusPlanning: "规划中",
    statusRunning: "运行中",
    statusWaitingForApproval: "待审批",
    statusCompleted: "已完成",
    statusFailed: "失败",
    statusCancelled: "已取消",
    providerError: "Provider Error",
    noProviderError: "当前任务暂无 provider error",
    noProviderErrorDetail:
      "如果 provider 调用失败，失败来源、状态和安全错误说明会显示在这里。",
    noProviderErrorEyebrow: "Provider",
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
    noToolCallsEyebrow: "Tool calls",
    noApproval: "当前任务暂无待处理审批",
    noApprovalDetail: "写文件、shell、外部请求等副作用操作会先进入审批流。",
    noApprovalEyebrow: "Approvals",
    noArtifacts: "当前任务暂无产物",
    noArtifactsDetail: "计划、patch 草稿、文档或最终总结会在生成后出现在这里。",
    noArtifactsEyebrow: "Artifacts",
    composerBusyEyebrow: "Run",
    composerBusyTitle: "正在创建后端 run",
    composerBusyDetail: "当前任务正在被 Supervisor 流式处理，请稍候。",
    writeFileRequest: "Builder 请求写入文件",
    composerInput: "任务输入",
    composerPlaceholder: "描述你希望 Sage Agent 完成的任务...",
    composerHint:
      "点击运行会创建真实后端 run，并通过当前 provider registry 调用 DeepSeek Supervisor；未配置 API key 会生成可审计的 provider error。",
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
    providerSettings: "Providers / Entries",
    workspaceSettings: "Workspace",
    safetySettings: "Safety",
    currentConfiguration: "Current configuration",
    displayLanguage: "Display language",
    defaultModel: "Default model",
    thinkingEnabledSetting: "Thinking enabled",
    generalSettingsDetail:
      "Interface language is stored locally as a non-sensitive preference.",
    providerSettingsDetail:
      "DeepSeek is the current default provider. Model, thinking, and reasoning effort are persisted as non-sensitive preferences. API key status is read from the backend only.",
    providerRegistry: "Provider registry",
    providerRegistryDetail:
      "V2.4 normalizes providers, status, and fallback into shared objects. Automatic fallback waits for a second approved provider.",
    providerDefault: "Default provider",
    providerFallback: "Fallback",
    providerFallbackDisabled: "Automatic fallback is disabled",
    providerAvailable: "Available",
    providerDegraded: "Degraded",
    providerMissingCredentials: "Missing credentials",
    providerInvalidConfig: "Invalid config",
    entrySurfaces: "Entry surfaces",
    entrySurfacesDetail:
      "Web is active. Desktop is registered as planned and will reuse the same run/provider/state model.",
    entrySurfaceActive: "Active",
    entrySurfacePlanned: "Planned",
    platformExtensions: "Platform extension registry",
    platformExtensionsDetail:
      "This only registers V2.5 candidate extensions; real cron, voice, gateway, and auto-update work is not implemented in the current version.",
    extensionCurrentState: "Current state",
    extensionCandidateSurfaces: "Candidate extension surfaces",
    extensionNotImplemented: "Not implemented yet",
    extensionScopeNote: "Boundary note",
    extensionCandidateReason:
      "We keep the entry and audit slots reserved until a separate proposal, approval, and safety boundary are ready.",
    extensionCandidateCron: "Cron / scheduled triggers",
    extensionCandidateVoice: "Voice / input-output",
    extensionCandidateGateway: "Gateway / messaging",
    extensionCandidateUpdate: "Update / auto-update",
    extensionNotBuiltTitle: "What still does not ship",
    extensionNotBuiltDetail:
      "Cron, voice, gateway, and auto-update are outside the current release; this UI only shows the candidate registry and boundaries so the roadmap is not mistaken for shipped functionality.",
    extensionPlanned: "Planned",
    extensionBlocked: "Blocked",
    extensionProposed: "Proposed",
    extensionAutomation: "Automation",
    extensionInteraction: "Interaction",
    extensionIdentity: "Identity",
    extensionMessaging: "Messaging",
    extensionMaintenance: "Maintenance",
    providerConfigStatus: "Config status",
    providerStatusLoading: "Reading DeepSeek configuration status...",
    providerStatusFailed: "Could not read DeepSeek configuration status.",
    refreshProviderStatus: "Refresh status",
    testProviderConnection: "Test connection",
    testingProviderConnection: "Testing",
    apiKeyReadiness: "API key",
    apiKeyConfigured: "Configured",
    apiKeyMissing: "Not configured",
    baseUrl: "Base URL",
    providerDefaultModel: "Provider default model",
    providerThinking: "Provider Thinking",
    providerReasoningEffort: "Provider reasoning effort",
    providerConfigValid: "Valid",
    providerConfigInvalid: "Invalid",
    providerIssues: "Config issues",
    noProviderIssues: "No config issues",
    recentConnectionTest: "Recent connection test",
    connectionNotTested: "Connection has not been tested",
    connectionTestOk: "Connection test succeeded",
    connectionTestMissingApiKey: "Missing API key",
    connectionTestHttpError: "DeepSeek returned an HTTP error",
    connectionTestNetworkError: "Could not reach DeepSeek",
    connectionTestInvalidResponse: "DeepSeek returned an invalid response",
    connectionTestInvalidConfig: "DeepSeek configuration is invalid",
    connectionTestNextStepOk: "No action needed.",
    connectionTestNextStepMissingApiKey:
      "Set DEEPSEEK_API_KEY in the server environment and restart the dev server.",
    connectionTestNextStepHttpError:
      "Check the API key, account access, and provider base URL.",
    connectionTestNextStepNetworkError:
      "Check network access, base URL, and local proxy settings.",
    connectionTestNextStepInvalidResponse:
      "Retry later or verify that the base URL points to a DeepSeek-compatible API.",
    connectionTestNextStepInvalidConfig:
      "Fix DeepSeek environment variables before testing again.",
    workspaceSettingsDetail:
      "Shows the local workspace read boundary and read_project_file tool permissions.",
    safetySettingsDetail:
      "Default Read + Draft mode; file writes, shell, and external side effects require approval.",
    workspaceRoot: "Current workspace root",
    workspaceRootSource: "monorepo root / SAGE_WORKSPACE_ROOT",
    workspaceRootDetail:
      "The backend uses SAGE_WORKSPACE_ROOT first; otherwise it infers the monorepo root. Settings explains the boundary without exposing or editing a local absolute path.",
    workspaceRootReadOnly:
      "Workspace root changes still go through SAGE_WORKSPACE_ROOT; this UI does not provide an editor.",
    readProjectFileTool: "read_project_file",
    readProjectFileAllowed: "Allowed reads",
    readProjectFileAllowedDetail:
      "Read-only access to ordinary project text files; paths must be workspace-relative and stay inside the workspace root, with a default 64 KiB limit.",
    readProjectFileDenied: "Rejected reads",
    readProjectFileDeniedDetail:
      "Directories, binary files, oversized files, absolute paths, path escapes, and blocked policy matches are rejected without returning sensitive content.",
    blockedPathPolicy: "Blocked path policy",
    blockedPathPolicyDetail:
      "These paths are rejected even inside the workspace root, covering env files, repository metadata, dependencies, build outputs, and test caches.",
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
    phase4Summary: "Phase 4 live state",
    memoryVault: "Memory vault",
    memoryVaultDetail: "Local cross-session memory, audit trail, and context injection.",
    memoryEntries: "Memory entries",
    memoryAuditTrail: "Memory audit trail",
    memoryCreate: "New memory",
    memoryEdit: "Edit memory",
    memoryDelete: "Delete memory",
    memoryCreateOrUpdate: "Save memory",
    memoryEmpty: "No memory entries yet",
    memoryEmptyDetail: "Project constraints, user preferences, and reusable conclusions will appear here.",
    memoryLoading: "Loading memory vault...",
    memorySave: "Save memory",
    memoryScope: "Scope",
    memoryTitle: "Title",
    memoryContent: "Content",
    memoryTags: "Tags",
    memorySourceThread: "Source thread",
    memorySourceRun: "Source run",
    memoryReason: "Reason",
    memorySaved: "Saved",
    memoryDeleted: "Deleted",
    memoryAction: "Action",
    memoryCreatedBy: "Created by",
    memoryUpdatedAt: "Updated at",
    memoryAuditSummary: "Audit summary",
    skillVault: "Skill vault",
    skillVaultDetail: "Local skills, manual curation, audit trail, and context injection.",
    skillEntries: "Skill entries",
    skillAuditTrail: "Skill audit trail",
    skillCreate: "New skill",
    skillEdit: "Edit skill",
    skillDelete: "Delete skill",
    skillEnable: "Enable",
    skillDisable: "Disable",
    skillCreateOrUpdate: "Save skill",
    skillEmpty: "No skill entries yet",
    skillEmptyDetail: "Reusable operating instructions will appear here and enter supervisor context when enabled.",
    skillLoading: "Loading skill vault...",
    skillName: "Name",
    skillDescription: "Description",
    skillInstruction: "Instruction",
    skillTags: "Tags",
    skillSource: "Source",
    skillStatus: "Status",
    skillVersion: "Version",
    skillReason: "Reason",
    skillSourceUser: "User",
    skillSourceAgent: "Agent experience",
    skillSourceTemplate: "Project template",
    skillStatusDraft: "Draft",
    skillStatusCurated: "Enabled",
    skillStatusDisabled: "Disabled",
    skillActionCreate: "Create",
    skillActionUpdate: "Update",
    skillActionDelete: "Delete",
    skillActionEnable: "Enable",
    skillActionDisable: "Disable",
    skillDraftAfterSave: "Saving moves the skill to draft; enable it manually after review.",
    skillSaved: "Saved",
    skillDeleted: "Deleted",
    skillEnabled: "Enabled",
    skillDisabled: "Disabled",
    skillAuditSummary: "Audit summary",
    phase4SummaryDetail:
      "Derived directly from runtime events, artifact summaries, and the final summary gate.",
    runtimeDerived: "runtime-derived",
    runtimeDerivedDetail:
      "This view is assembled from events and helper output, not static copy.",
    supervisorPlan: "Supervisor plan",
    researcherBrief: "Researcher brief",
    builderDraft: "Builder draft",
    reviewerReport: "Reviewer report",
    finalSummaryGate: "Final summary gate",
    artifactSummaries: "Artifacts",
    phase4Missing: "Not generated",
    phase4Ready: "Ready for final summary",
    phase4Blocked: "Blocking final summary",
    phase4SummaryReady: "Reviewer passed, final summary can continue.",
    phase4SummaryBlocked: "Reviewer still has blocking items.",
    phase4SummaryMissing: "This run has not produced phase 4 events yet.",
    stepCount: "Steps",
    contextTargets: "Context",
    patchTargets: "Patch targets",
    artifactDrafts: "Artifact drafts",
    acceptanceCriteria: "Acceptance",
    findings: "Findings",
    risks: "Risks",
    missingChecks: "Missing checks",
    decision: "Decision",
    events: "Events",
    tools: "Tools",
    approvals: "Approvals",
    lastEvent: "Last event",
    lastUpdated: "Last updated",
    rawEventType: "Raw type",
    counts: "Counts",
    statusQueued: "Queued",
    statusPlanning: "Planning",
    statusRunning: "Running",
    statusWaitingForApproval: "Waiting approval",
    statusCompleted: "Completed",
    statusFailed: "Failed",
    statusCancelled: "Cancelled",
    providerError: "Provider Error",
    noProviderError: "No provider error for this run",
    noProviderErrorDetail:
      "Provider failures will show the source, status, and safe error details here.",
    noProviderErrorEyebrow: "Provider",
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
    noToolCallsEyebrow: "Tool calls",
    noApproval: "No pending approval for this run",
    noApprovalDetail:
      "File writes, shell commands, and external requests enter approval first.",
    noApprovalEyebrow: "Approvals",
    noArtifacts: "No artifacts for this run",
    noArtifactsDetail:
      "Plans, patch drafts, documents, or final summaries will appear here.",
    noArtifactsEyebrow: "Artifacts",
    composerBusyEyebrow: "Run",
    composerBusyTitle: "Creating backend run",
    composerBusyDetail: "Supervisor is processing the task in streaming mode. Please wait.",
    writeFileRequest: "Builder requests file write",
    composerInput: "Task input",
    composerPlaceholder: "Describe what you want Sage Agent to do...",
    composerHint:
      "Click Run to create a real backend run and stream the DeepSeek Supervisor through the current provider registry. Missing API keys create auditable provider errors.",
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

const READ_PROJECT_FILE_BLOCKED_PATHS = [
  ".env",
  ".env.*",
  ".git/",
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "coverage/",
  "tmp/",
  "playwright-report/",
  "test-results/",
] as const;

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
    threadId: "thread-1",
    title: { zh: "初始化三栏工作台", en: "Initialize three-column workbench" },
    status: "running",
    time: "09:42",
  },
  {
    id: "run-1839",
    threadId: "thread-2",
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

type CopyText = (typeof copy)[Locale];

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
  readonly lastEventTitle: Record<Locale, string> | null;
  readonly lastEventAt: string | null;
  readonly toolCallCount: number;
  readonly approvalCount: number;
  readonly artifactCount: number;
};

function createEmptyAuditSummary(): AuditSummary {
  return {
    eventCount: 0,
    lastEventType: null,
    lastEventTitle: null,
    lastEventAt: null,
    toolCallCount: 0,
    approvalCount: 0,
    artifactCount: 0,
  };
}

function createEmptyPhase4RunSummary(): ReturnType<typeof getPhase4RunSummary> {
  return {
    hasData: false,
    supervisor: {
      status: "missing",
      summary: null,
      stepTitles: [],
    },
    researcher: {
      status: "missing",
      summary: null,
      contextTargets: [],
      constraints: [],
      handoffNotes: [],
    },
    builder: {
      status: "missing",
      summary: null,
      implementationNotes: [],
      patchTargets: [],
      artifactDraftTitles: [],
      safetyNotes: [],
    },
    reviewer: {
      status: "missing",
      summary: null,
      decision: null,
      acceptanceCriteria: [],
      findings: [],
      risks: [],
      missingChecks: [],
      safetyNotes: [],
    },
    finalSummaryGate: {
      status: "missing",
      reviewerDecision: null,
      summary: null,
      findings: [],
      risks: [],
      missingChecks: [],
    },
    artifacts: [],
  };
}

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

function formatRunStatusLabel(
  status: string,
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "queued":
      return t.statusQueued;
    case "planning":
      return t.statusPlanning;
    case "running":
      return t.statusRunning;
    case "waiting_for_approval":
      return t.statusWaitingForApproval;
    case "completed":
      return t.statusCompleted;
    case "failed":
      return t.statusFailed;
    case "cancelled":
      return t.statusCancelled;
    default:
      return status;
  }
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
  eyebrow,
  title,
  detail,
  tone = "neutral",
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className={`state-block ${tone}`}>
      {eyebrow ? <span className="state-block-eyebrow">{eyebrow}</span> : null}
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

function getConnectionTestLabel(
  code: DeepSeekConnectionTestCode,
  t: (typeof copy)[Locale],
): string {
  switch (code) {
    case "ok":
      return t.connectionTestOk;
    case "missing_api_key":
      return t.connectionTestMissingApiKey;
    case "http_error":
      return t.connectionTestHttpError;
    case "network_error":
      return t.connectionTestNetworkError;
    case "invalid_response":
      return t.connectionTestInvalidResponse;
    case "invalid_config":
      return t.connectionTestInvalidConfig;
  }
}

function getConnectionTestNextStep(
  code: DeepSeekConnectionTestCode,
  t: (typeof copy)[Locale],
): string {
  switch (code) {
    case "ok":
      return t.connectionTestNextStepOk;
    case "missing_api_key":
      return t.connectionTestNextStepMissingApiKey;
    case "http_error":
      return t.connectionTestNextStepHttpError;
    case "network_error":
      return t.connectionTestNextStepNetworkError;
    case "invalid_response":
      return t.connectionTestNextStepInvalidResponse;
    case "invalid_config":
      return t.connectionTestNextStepInvalidConfig;
  }
}

function getProviderStatusLabel(
  status: ProviderRegistrySnapshot["providers"][number]["status"],
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "available":
      return t.providerAvailable;
    case "degraded":
      return t.providerDegraded;
    case "missing_credentials":
      return t.providerMissingCredentials;
    case "invalid_config":
      return t.providerInvalidConfig;
  }
}

function getEntrySurfaceStatusLabel(
  status: EntrySurfaceSnapshot["surfaces"][number]["status"],
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "active":
      return t.entrySurfaceActive;
    case "planned":
      return t.entrySurfacePlanned;
  }
}

function getPlatformExtensionStatusLabel(
  status: PlatformExtensionSnapshot["entries"][number]["status"],
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "planned":
      return t.extensionPlanned;
    case "blocked":
      return t.extensionBlocked;
    case "proposed":
      return t.extensionProposed;
  }
}

function getPlatformExtensionCategoryLabel(
  category: PlatformExtensionSnapshot["entries"][number]["category"],
  t: (typeof copy)[Locale],
): string {
  switch (category) {
    case "automation":
      return t.extensionAutomation;
    case "interaction":
      return t.extensionInteraction;
    case "identity":
      return t.extensionIdentity;
    case "messaging":
      return t.extensionMessaging;
    case "maintenance":
      return t.extensionMaintenance;
  }
}

function getBlockedPathPolicyDetail(t: (typeof copy)[Locale]): string {
  return `${t.blockedPathPolicyDetail} ${READ_PROJECT_FILE_BLOCKED_PATHS.join(", ")}`;
}

export default function Home() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hasLoadedStoredPreferences, setHasLoadedStoredPreferences] =
    useState(false);
  const locale = preferences.locale;
  const providerId = preferences.providerId;
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
  const [hasSelectedRun, setHasSelectedRun] = useState(false);
  const [providerStatus, setProviderStatus] =
    useState<DeepSeekProviderStatusSummary | null>(null);
  const [providerRegistry, setProviderRegistry] =
    useState<ProviderRegistrySnapshot | null>(null);
  const [entrySurfaces, setEntrySurfaces] =
    useState<EntrySurfaceSnapshot | null>(null);
  const [platformExtensions, setPlatformExtensions] =
    useState<PlatformExtensionSnapshot | null>(null);
  const [providerStatusError, setProviderStatusError] = useState<string | null>(
    null,
  );
  const [isProviderStatusLoading, setIsProviderStatusLoading] = useState(false);
  const [lastProviderTestResult, setLastProviderTestResult] =
    useState<DeepSeekConnectionTestResult | null>(null);
  const [isProviderTesting, setIsProviderTesting] = useState(false);
  const [messages, setMessages] = useState<Message[]>(baseMessages);
  const [runEvents, setRunEvents] = useState<RunEvent[]>(seedRunEvents);
  const [memorySnapshot, setMemorySnapshot] = useState<MemorySnapshot>({
    entries: [],
    auditTrail: [],
  });
  const [skillSnapshot, setSkillSnapshot] = useState<SkillSnapshot>({
    entries: [],
    auditTrail: [],
  });
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [isSkillLoading, setIsSkillLoading] = useState(false);
  const [isMemoryEditorOpen, setIsMemoryEditorOpen] = useState(false);
  const [isSkillEditorOpen, setIsSkillEditorOpen] = useState(false);
  const [memoryEditorMode, setMemoryEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [skillEditorMode, setSkillEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [memoryForm, setMemoryForm] =
    useState<MemoryFormState>(DEFAULT_MEMORY_FORM);
  const [skillForm, setSkillForm] =
    useState<SkillFormState>(DEFAULT_SKILL_FORM);
  const [activeMemoryId, setActiveMemoryId] = useState<string | null>(null);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [memoryFeedback, setMemoryFeedback] = useState<string | null>(null);
  const [skillFeedback, setSkillFeedback] = useState<string | null>(null);
  const [isRunBusy, setIsRunBusy] = useState(false);
  const [lastComposerState, setLastComposerState] = useState<
    "idle" | "cancelled"
  >("idle");
  const runRequestRef = useRef<AbortController | null>(null);
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const memoryDialogRef = useRef<HTMLElement | null>(null);
  const skillDialogRef = useRef<HTMLElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const memoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const skillTriggerRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (!isSettingsOpen) return;

    const focusTarget = settingsDialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
    );

    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSettings();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(settingsDialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isMemoryEditorOpen) return;

    const focusTarget = memoryDialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
    );

    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMemoryEditor();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(memoryDialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMemoryEditorOpen]);

  useEffect(() => {
    if (!isSkillEditorOpen) return;

    const focusTarget = skillDialogRef.current?.querySelector<HTMLElement>(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
    );

    focusTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSkillEditor();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(skillDialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;

      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSkillEditorOpen]);

  const loadProviderStatus = useCallback(async (signal?: AbortSignal) => {
    setIsProviderStatusLoading(true);
    setProviderStatusError(null);

    try {
      const response = await fetchDeepSeekProviderStatus(signal);
      setProviderStatus(response.status);
      setProviderRegistry(response.providerRegistry);
      setEntrySurfaces(response.entrySurfaces);
      setPlatformExtensions(response.platformExtensions);
    } catch (error) {
      if (!isAbortError(error)) {
        setProviderStatusError(toSafeErrorMessage(error));
      }
    } finally {
      if (!signal?.aborted) {
        setIsProviderStatusLoading(false);
      }
    }
  }, []);

  const loadMemorySnapshot = useCallback(async () => {
    setIsMemoryLoading(true);
    try {
      const response = await fetchMemorySnapshot();
      setMemorySnapshot(response.snapshot);
    } catch (error) {
      setMemoryFeedback(toSafeErrorMessage(error));
    } finally {
      setIsMemoryLoading(false);
    }
  }, []);

  const loadSkillSnapshot = useCallback(async () => {
    setIsSkillLoading(true);
    try {
      const response = await fetchSkillSnapshot();
      setSkillSnapshot(response.snapshot);
    } catch (error) {
      setSkillFeedback(toSafeErrorMessage(error));
    } finally {
      setIsSkillLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await loadMemorySnapshot();
        await loadSkillSnapshot();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadMemorySnapshot, loadSkillSnapshot]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadProviderStatus(controller.signal);
      }
    });

    return () => {
      controller.abort();
    };
  }, [isSettingsOpen, loadProviderStatus]);

  function updatePreferences(nextPreferences: Partial<Preferences>) {
    setPreferences((current) => ({
      ...current,
      ...nextPreferences,
    }));
  }

  function openSettings() {
    settingsTriggerRef.current = document.activeElement as HTMLButtonElement | null;
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    queueMicrotask(() => {
      settingsTriggerRef.current?.focus();
    });
  }

  function openMemoryEditor(entry?: MemoryEntry) {
    memoryTriggerRef.current = document.activeElement as HTMLButtonElement | null;
    if (entry) {
      setMemoryEditorMode("edit");
      setActiveMemoryId(entry.id);
      setMemoryForm({
        scope: entry.scope,
        title: entry.title,
        content: entry.content,
        tags: entry.tags.join(", "),
        sourceThreadId: entry.sourceThreadId ?? "",
        sourceRunId: entry.sourceRunId ?? "",
        reason: "",
      });
    } else {
      setMemoryEditorMode("create");
      setActiveMemoryId(null);
      setMemoryForm(DEFAULT_MEMORY_FORM);
    }
    setMemoryFeedback(null);
    setIsMemoryEditorOpen(true);
  }

  function closeMemoryEditor() {
    setIsMemoryEditorOpen(false);
    queueMicrotask(() => {
      memoryTriggerRef.current?.focus();
    });
  }

  async function submitMemoryEntry() {
    const payload = normalizeMemoryForm(memoryForm);
    if (!payload.ok) {
      setMemoryFeedback(payload.message);
      return;
    }

    try {
      const response = await fetch(
        memoryEditorMode === "create"
          ? "/api/memory"
          : `/api/memory/${encodeURIComponent(activeMemoryId ?? "")}`,
        {
          method: memoryEditorMode === "create" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload.value),
        },
      );

      if (!response.ok) {
        throw new Error(`memory_request_failed_${response.status}`);
      }

      const result = (await response.json()) as {
        snapshot?: MemorySnapshot;
      };
      if (result.snapshot) {
        setMemorySnapshot(result.snapshot);
      } else {
        await loadMemorySnapshot();
      }
      closeMemoryEditor();
      setMemoryFeedback(copy[locale].memorySaved);
    } catch (error) {
      setMemoryFeedback(toSafeErrorMessage(error));
    }
  }

  async function deleteMemoryEntry(memoryId: string) {
    try {
      const response = await fetch(`/api/memory/${encodeURIComponent(memoryId)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: `${copy[locale].memoryDeleted}: ${memoryId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`memory_delete_failed_${response.status}`);
      }

      const result = (await response.json()) as {
        snapshot?: MemorySnapshot;
      };
      if (result.snapshot) {
        setMemorySnapshot(result.snapshot);
      } else {
        await loadMemorySnapshot();
      }
      setMemoryFeedback(copy[locale].memoryDeleted);
    } catch (error) {
      setMemoryFeedback(toSafeErrorMessage(error));
    }
  }

  function openSkillEditor(entry?: SkillEntry) {
    skillTriggerRef.current = document.activeElement as HTMLButtonElement | null;
    if (entry) {
      setSkillEditorMode("edit");
      setActiveSkillId(entry.id);
      setSkillForm({
        name: entry.name,
        description: entry.description,
        instruction: entry.instruction,
        tags: entry.tags.join(", "),
        source: entry.source,
        reason: "",
      });
    } else {
      setSkillEditorMode("create");
      setActiveSkillId(null);
      setSkillForm(DEFAULT_SKILL_FORM);
    }
    setSkillFeedback(null);
    setIsSkillEditorOpen(true);
  }

  function closeSkillEditor() {
    setIsSkillEditorOpen(false);
    queueMicrotask(() => {
      skillTriggerRef.current?.focus();
    });
  }

  async function submitSkillEntry() {
    const payload = normalizeSkillForm(skillForm);
    if (!payload.ok) {
      setSkillFeedback(payload.message);
      return;
    }

    try {
      const response = await fetch(
        skillEditorMode === "create"
          ? "/api/skills"
          : `/api/skills/${encodeURIComponent(activeSkillId ?? "")}`,
        {
          method: skillEditorMode === "create" ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload.value),
        },
      );

      if (!response.ok) {
        throw new Error(`skill_request_failed_${response.status}`);
      }

      const result = (await response.json()) as {
        snapshot?: SkillSnapshot;
      };
      if (result.snapshot) {
        setSkillSnapshot(result.snapshot);
      } else {
        await loadSkillSnapshot();
      }
      closeSkillEditor();
      setSkillFeedback(copy[locale].skillSaved);
    } catch (error) {
      setSkillFeedback(toSafeErrorMessage(error));
    }
  }

  async function setSkillEntryStatus(skillId: string, status: Extract<SkillStatus, "curated" | "disabled">) {
    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          reason:
            status === "curated"
              ? `${copy[locale].skillEnabled}: ${skillId}`
              : `${copy[locale].skillDisabled}: ${skillId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`skill_status_failed_${response.status}`);
      }

      const result = (await response.json()) as {
        snapshot?: SkillSnapshot;
      };
      if (result.snapshot) {
        setSkillSnapshot(result.snapshot);
      } else {
        await loadSkillSnapshot();
      }
      setSkillFeedback(
        status === "curated" ? copy[locale].skillEnabled : copy[locale].skillDisabled,
      );
    } catch (error) {
      setSkillFeedback(toSafeErrorMessage(error));
    }
  }

  async function deleteSkillEntry(skillId: string) {
    try {
      const response = await fetch(`/api/skills/${encodeURIComponent(skillId)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: `${copy[locale].skillDeleted}: ${skillId}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`skill_delete_failed_${response.status}`);
      }

      const result = (await response.json()) as {
        snapshot?: SkillSnapshot;
      };
      if (result.snapshot) {
        setSkillSnapshot(result.snapshot);
      } else {
        await loadSkillSnapshot();
      }
      setSkillFeedback(copy[locale].skillDeleted);
    } catch (error) {
      setSkillFeedback(toSafeErrorMessage(error));
    }
  }

  async function handleProviderConnectionTest() {
    if (isProviderTesting) return;

    setIsProviderTesting(true);
    setProviderStatusError(null);

    try {
      const response = await testDeepSeekProviderConnectionApi();
      setProviderStatus(response.status);
      setProviderRegistry(response.providerRegistry);
      setEntrySurfaces(response.entrySurfaces);
      setPlatformExtensions(response.platformExtensions);
      setLastProviderTestResult(response.result);
    } catch (error) {
      setProviderStatusError(toSafeErrorMessage(error));
    } finally {
      setIsProviderTesting(false);
    }
  }

  const activeThread = threadItems.find((thread) => thread.id === activeThreadId);
  const activeRun = runItems.find((run) => run.id === activeRunId);
  const selectedRun = hasSelectedRun ? activeRun : null;
  const selectedRunId = hasSelectedRun ? activeRunId : null;
  const timelineRows = selectedRunId ? getTimelineRows(runEvents, selectedRunId) : [];
  const activeToolCalls = selectedRunId
    ? getToolCallRows(runEvents, selectedRunId)
    : [];
  const activeApproval = selectedRunId
    ? getActiveApproval(runEvents, selectedRunId)
    : null;
  const activeArtifacts = selectedRunId
    ? getArtifactRows(runEvents, selectedRunId)
    : [];
  const activeProviderError = selectedRunId
    ? getProviderError(runEvents, selectedRunId, locale)
    : null;
  const activeAuditSummary = selectedRunId
    ? getAuditSummary(runEvents, selectedRunId)
    : createEmptyAuditSummary();
  const activePhase4Summary = selectedRunId
    ? getPhase4RunSummary(runEvents, selectedRunId)
    : createEmptyPhase4RunSummary();
  const activeMessages = selectedRunId
    ? messages.filter((message) => message.runId === selectedRunId)
    : [];
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
    setHasSelectedRun(false);
  }

  function handleThreadSelect(threadId: string) {
    const nextRun = runItems.find((run) => run.threadId === threadId);
    setActiveThreadId(threadId);

    if (nextRun) {
      setActiveRunId(nextRun.id);
      setHasSelectedRun(true);
      return;
    }

    setHasSelectedRun(false);
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
            providerId,
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
      setHasSelectedRun(true);
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
    if (!selectedRunId) return;

    runRequestRef.current?.abort();
    runRequestRef.current = null;

    setIsRunBusy(false);
    setLastComposerState("cancelled");
    const cancelEvent = appendLocalFeedbackEvent("run.status_changed", {
      previousStatus: "running",
      status: "cancelled",
      activeAgent: "supervisor",
    });
    setRunItems((current) => updateRunItemFromEvents(current, [cancelEvent]));
    appendLocalFeedbackMessage({
      zh: copy.zh.composerCancelledHint,
      en: copy.en.composerCancelledHint,
    });
  }

  function handleApprovalResolution(status: ApprovalStatus) {
    if (!selectedRunId) return;

    const resolvedAt = new Date().toISOString();

    setRunEvents((current) => {
      const currentApproval = getActiveApproval(current, selectedRunId);
      if (!currentApproval || currentApproval.approval.status !== "pending") {
        return current;
      }

      return [
        ...current,
        {
          id: `event-approval-${Date.now()}`,
          runId: selectedRunId,
          type: "approval.resolved",
          sequence: nextEventSequence(current, selectedRunId),
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
    if (!selectedRunId || !selectedRun) return;

    const failedAt = new Date().toISOString();
    const failedRun: Run = {
      id: selectedRunId,
      threadId: activeThreadId,
      title: selectedRun.title.en,
      goal: selectedRun.goal ?? selectedRun.title.en,
      status: "failed",
      activeAgent: "supervisor",
      settings: {
        providerId,
        model,
        thinkingEnabled,
        reasoningEffort,
      },
      createdAt: failedAt,
      updatedAt: failedAt,
      completedAt: failedAt,
    };

    const errorMessage = {
      zh: copy.zh.providerErrorSafeMessage,
      en: copy.en.providerErrorSafeMessage,
    };
    const nextSequence = nextEventSequence(runEvents, selectedRunId);

    const event: RunEvent = {
      id: `event-provider-error-${selectedRunId}-${nextSequence}`,
      runId: selectedRunId,
      type: "run.failed",
      sequence: nextSequence,
      createdAt: failedAt,
      payload: {
        run: failedRun,
        error: errorMessage[locale],
      },
    };

    setRunEvents((current) => [...current, event]);
    setRunItems((current) => updateRunItemFromEvents(current, [event]));
  }

  function handleProviderRetry() {
    if (!selectedRunId) return;

    appendLocalFeedbackEvent("message.completed", {
      message: createLocalFeedbackRunMessage(copy[locale].retryProviderHint),
    });
    appendLocalFeedbackMessage({
      zh: copy.zh.retryProviderHint,
      en: copy.en.retryProviderHint,
    });
  }

  function appendLocalFeedbackEvent(
    type: "run.status_changed",
    payload: Extract<RunEvent, { type: "run.status_changed" }>["payload"],
  ): Extract<RunEvent, { type: "run.status_changed" }>;
  function appendLocalFeedbackEvent(
    type: "message.completed",
    payload: Extract<RunEvent, { type: "message.completed" }>["payload"],
  ): Extract<RunEvent, { type: "message.completed" }>;
  function appendLocalFeedbackEvent(
    type: "run.status_changed" | "message.completed",
    payload:
      | Extract<RunEvent, { type: "run.status_changed" }>["payload"]
      | Extract<RunEvent, { type: "message.completed" }>["payload"],
  ): RunEvent {
    const createdAt = new Date().toISOString();
    const event = {
      id: `event-local-feedback-${Date.now()}`,
      runId: selectedRunId ?? activeRunId,
      type,
      sequence: nextEventSequence(runEvents, selectedRunId ?? activeRunId),
      createdAt,
      payload,
    } as RunEvent;

    setRunEvents((current) => [...current, event]);
    return event;
  }

  function appendLocalFeedbackMessage(body: Message["body"]) {
    setMessages((current) => [
      ...current,
      {
        role: "Supervisor",
        runId: selectedRunId ?? activeRunId,
        body,
      },
    ]);
  }

  function createLocalFeedbackRunMessage(content: string): Extract<
    RunEvent,
    { type: "message.completed" }
  >["payload"]["message"] {
    return {
      id: `message-feedback-${Date.now()}`,
      threadId: activeThreadId,
      runId: selectedRunId ?? activeRunId,
      role: "agent",
      agent: "supervisor",
      content,
      createdAt: new Date().toISOString(),
    };
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--text-main)]">
      <div className="app-shell">
        <aside className="sidebar">
          <section className="sidebar-hero" aria-label={t.localWorkbench}>
            <div className="brand-row">
              <div className="brand-mark">S</div>
              <div>
                <p className="brand-name">Sage Agent</p>
                <p className="brand-subtitle">{t.localWorkbench}</p>
              </div>
            </div>
            <div className="sidebar-hero-copy">
              <div className="sidebar-hero-heading">
                <span>{t.currentRun}</span>
                <strong>{selectedRun?.title[locale] ?? t.headerFallback}</strong>
              </div>
              <p>{selectedRun?.goal ?? t.headerDescription}</p>
            </div>
            <div className="sidebar-hero-meta" aria-label={t.currentConfiguration}>
              <span>
                {threadItems.length} {t.threads}
              </span>
              <span>
                {runItems.length} {t.runs}
              </span>
              <span>{t.readDraftMode}</span>
            </div>
          </section>

          <section className="settings-strip" aria-label={t.settings}>
            <button
              aria-label={t.openSettings}
              className="settings-entry"
              onClick={openSettings}
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
                  onClick={() => handleThreadSelect(thread.id)}
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
                  className={
                    hasSelectedRun && run.id === activeRunId
                      ? "run-row active"
                      : "run-row"
                  }
                  key={run.id}
                  onClick={() => {
                    setActiveRunId(run.id);
                    setActiveThreadId(run.threadId);
                    setHasSelectedRun(true);
                  }}
                >
                  <StatusDot status={run.status} />
                  <div>
                    <p>{run.title[locale]}</p>
                    <small className="run-row-meta">
                      <span>{formatRunStatusLabel(run.status, t)}</span>
                      <span>{run.time}</span>
                      <code>{run.id}</code>
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <section className="workspace">
          <header className="workspace-header">
            <div className="workspace-header-copy">
              <p className="section-label">
                {activeThread?.title[locale] ?? t.currentRun}
              </p>
              <h1>{selectedRun?.title[locale] ?? t.headerFallback}</h1>
              <p>{selectedRun?.goal ?? t.headerDescription}</p>
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

          <section className="workspace-launchpad" aria-label={t.currentConfiguration}>
            <div className="launchpad-card">
              <span>{t.currentRun}</span>
              <strong>{selectedRun?.id ?? t.headerFallback}</strong>
              <small>{selectedRun?.goal ?? t.headerDescription}</small>
            </div>
            <div className="launchpad-card">
              <span>{t.threads}</span>
              <strong>{activeThread?.title[locale] ?? t.notConfigured}</strong>
              <small>{activeThread?.subtitle[locale] ?? t.notConfigured}</small>
            </div>
            <div className="launchpad-card">
              <span>{t.modelSettings}</span>
              <strong>{model}</strong>
              <small>
                {thinkingEnabled ? t.enabled : t.disabled} · {reasoningEffort}
              </small>
            </div>
          </section>

          <div className="conversation">
            {selectedRun ? (
              activeMessages.map((message, index) => (
                <article className="message" key={`${message.role}-${index}`}>
                  <div className="message-avatar">{message.role.slice(0, 1)}</div>
                  <div>
                    <p className="message-role">{message.role}</p>
                    <p className="message-body">{message.body[locale]}</p>
                  </div>
                </article>
              ))
            ) : (
              <StateBlock
                eyebrow={t.localWorkbench}
                title={t.headerFallback}
                detail={t.headerDescription}
              />
            )}
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
              <button
                className="secondary-button"
                disabled={!selectedRun}
                onClick={handleProviderError}
              >
                {t.simulateProviderError}
              </button>
              <button
                className="secondary-button"
                disabled={!selectedRun || !isRunBusy}
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
                    <span>
                      {activeAuditSummary.lastEventTitle?.[locale] ??
                        t.noAuditEvents}
                    </span>
                    {activeAuditSummary.lastEventType ? (
                      <small>
                        {t.rawEventType}: {activeAuditSummary.lastEventType}
                      </small>
                    ) : null}
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

          <Panel title={t.phase4Summary}>
            {activePhase4Summary.hasData ? (
              <div className="stack phase4-summary-stack">
                <StateBlock
                  title={t.runtimeDerived}
                  detail={t.runtimeDerivedDetail}
                />
                <StateBlock
                  title={`${t.supervisorPlan} · ${formatPhase4Status(
                    activePhase4Summary.supervisor.status,
                    t,
                  )}`}
                  detail={formatPhase4SummaryDetail([
                    activePhase4Summary.supervisor.summary,
                    formatPhase4KeyValue(
                      t.stepCount,
                      summarizeList(activePhase4Summary.supervisor.stepTitles),
                    ),
                  ])}
                />
                <StateBlock
                  title={`${t.researcherBrief} · ${formatPhase4Status(
                    activePhase4Summary.researcher.status,
                    t,
                  )}`}
                  detail={formatPhase4SummaryDetail([
                    activePhase4Summary.researcher.summary,
                    formatPhase4KeyValue(
                      t.contextTargets,
                      summarizeList(activePhase4Summary.researcher.contextTargets),
                    ),
                    formatPhase4KeyValue(
                      t.risks,
                      summarizeList(activePhase4Summary.researcher.constraints),
                    ),
                  ])}
                />
                <StateBlock
                  title={`${t.builderDraft} · ${formatPhase4Status(
                    activePhase4Summary.builder.status,
                    t,
                  )}`}
                  detail={formatPhase4SummaryDetail([
                    activePhase4Summary.builder.summary,
                    formatPhase4KeyValue(
                      t.patchTargets,
                      summarizeList(activePhase4Summary.builder.patchTargets),
                    ),
                    formatPhase4KeyValue(
                      t.artifactDrafts,
                      summarizeList(activePhase4Summary.builder.artifactDraftTitles),
                    ),
                  ])}
                />
                <StateBlock
                  title={`${t.reviewerReport} · ${formatPhase4Status(
                    activePhase4Summary.reviewer.status,
                    t,
                  )}`}
                  detail={formatPhase4SummaryDetail([
                    activePhase4Summary.reviewer.summary,
                    formatPhase4KeyValue(
                      t.decision,
                      activePhase4Summary.reviewer.decision ?? t.phase4Missing,
                    ),
                    formatPhase4KeyValue(
                      t.findings,
                      summarizeList(activePhase4Summary.reviewer.findings),
                    ),
                    formatPhase4KeyValue(
                      t.missingChecks,
                      summarizeList(activePhase4Summary.reviewer.missingChecks),
                    ),
                  ])}
                />
                <StateBlock
                  title={`${t.finalSummaryGate} · ${formatPhase4GateStatus(
                    activePhase4Summary.finalSummaryGate.status,
                    t,
                  )}`}
                  detail={formatPhase4SummaryDetail([
                    activePhase4Summary.finalSummaryGate.summary,
                    activePhase4Summary.finalSummaryGate.status === "blocked"
                      ? t.phase4SummaryBlocked
                      : activePhase4Summary.finalSummaryGate.status === "ready"
                        ? t.phase4SummaryReady
                        : t.phase4SummaryMissing,
                    formatPhase4KeyValue(
                      t.findings,
                      summarizeList(activePhase4Summary.finalSummaryGate.findings),
                    ),
                    formatPhase4KeyValue(
                      t.risks,
                      summarizeList(activePhase4Summary.finalSummaryGate.risks),
                    ),
                    formatPhase4KeyValue(
                      t.missingChecks,
                      summarizeList(
                        activePhase4Summary.finalSummaryGate.missingChecks,
                      ),
                    ),
                  ])}
                  tone={
                    activePhase4Summary.finalSummaryGate.status === "blocked"
                      ? "danger"
                      : "neutral"
                  }
                />
                <div className="phase4-artifact-list">
                  <p>{t.artifactSummaries}</p>
                  {activePhase4Summary.artifacts.length > 0 ? (
                    activePhase4Summary.artifacts.map((artifact) => (
                      <div className="phase4-artifact-row" key={artifact.id}>
                        <div>
                          <span>{artifact.title}</span>
                          <small>{artifact.kind}</small>
                        </div>
                        <small>
                          {artifact.summary ?? t.phase4Missing}
                        </small>
                      </div>
                    ))
                  ) : (
                    <StateBlock
                      title={t.phase4SummaryMissing}
                      detail={t.artifactSummaries}
                    />
                  )}
                </div>
              </div>
            ) : (
              <StateBlock
                title={t.phase4SummaryMissing}
                detail={t.phase4SummaryDetail}
              />
            )}
          </Panel>

          <Panel
            title={t.memoryVault}
            action={
              <button className="ghost-button" onClick={() => openMemoryEditor()}>
                {t.memoryCreate}
              </button>
            }
          >
            <div className="stack">
              <StateBlock
                eyebrow={t.memoryVault}
                title={t.memoryVault}
                detail={t.memoryVaultDetail}
              />
              {memoryFeedback ? (
                <StateBlock title={t.memoryAuditSummary} detail={memoryFeedback} />
              ) : null}
              {isMemoryLoading ? (
                <StateBlock
                  eyebrow={t.memoryEntries}
                  title={t.memoryLoading}
                  detail={t.memoryVaultDetail}
                />
              ) : null}
              {memorySnapshot.entries.length === 0 ? (
                <StateBlock
                  eyebrow={t.memoryEntries}
                  title={t.memoryEmpty}
                  detail={t.memoryEmptyDetail}
                />
              ) : (
                memorySnapshot.entries.map((entry) => (
                  <div className="memory-row" key={entry.id}>
                    <div>
                      <p>{entry.title}</p>
                      <small>
                        {entry.scope} · {entry.tags.join(", ") || "no tags"}
                      </small>
                      <small>
                        {t.memoryUpdatedAt}: {formatAuditTime(entry.updatedAt)}
                      </small>
                    </div>
                    <div className="memory-row-actions">
                      <button
                        className="ghost-button"
                        onClick={() => openMemoryEditor(entry)}
                        type="button"
                      >
                        {t.memoryEdit}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => void deleteMemoryEntry(entry.id)}
                        type="button"
                      >
                        {t.memoryDelete}
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div className="memory-audit-list">
                <p>{t.memoryAuditTrail}</p>
                {memorySnapshot.auditTrail.length === 0 ? (
                  <StateBlock
                    title={t.memoryAuditTrail}
                    detail={t.memoryEmptyDetail}
                  />
                ) : (
                  memorySnapshot.auditTrail.slice(-5).map((record) => (
                    <div className="memory-audit-row" key={record.id}>
                      <div>
                        <p>
                          {record.action} · {record.title}
                        </p>
                        <small>
                          {t.memoryCreatedBy}: {record.actor} · {formatAuditTime(record.createdAt)}
                        </small>
                      </div>
                      <small>{record.summary}</small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title={t.skillVault}
            action={
              <button className="ghost-button" onClick={() => openSkillEditor()}>
                {t.skillCreate}
              </button>
            }
          >
            <div className="stack">
              <StateBlock
                eyebrow={t.skillVault}
                title={t.skillVault}
                detail={t.skillVaultDetail}
              />
              {skillFeedback ? (
                <StateBlock title={t.skillAuditSummary} detail={skillFeedback} />
              ) : null}
              {isSkillLoading ? (
                <StateBlock
                  eyebrow={t.skillEntries}
                  title={t.skillLoading}
                  detail={t.skillVaultDetail}
                />
              ) : null}
              {skillSnapshot.entries.length === 0 ? (
                <StateBlock
                  eyebrow={t.skillEntries}
                  title={t.skillEmpty}
                  detail={t.skillEmptyDetail}
                />
              ) : (
                skillSnapshot.entries.map((entry) => (
                  <div className="skill-row" key={entry.id}>
                    <div>
                      <p>{entry.name}</p>
                      <small>
                        {formatSkillStatus(entry.status, t)} · {formatSkillSource(entry.source, t)} · v{entry.version}
                      </small>
                      <small>{entry.description}</small>
                    </div>
                    <div className="skill-row-actions">
                      <button
                        className="ghost-button"
                        onClick={() => openSkillEditor(entry)}
                        type="button"
                      >
                        {t.skillEdit}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() =>
                          void setSkillEntryStatus(
                            entry.id,
                            entry.status === "curated" ? "disabled" : "curated",
                          )
                        }
                        type="button"
                      >
                        {entry.status === "curated" ? t.skillDisable : t.skillEnable}
                      </button>
                      <button
                        className="ghost-button"
                        onClick={() => void deleteSkillEntry(entry.id)}
                        type="button"
                      >
                        {t.skillDelete}
                      </button>
                    </div>
                  </div>
                ))
              )}
              <div className="skill-audit-list">
                <p>{t.skillAuditTrail}</p>
                {skillSnapshot.auditTrail.length === 0 ? (
                  <StateBlock
                    title={t.skillAuditTrail}
                    detail={t.skillEmptyDetail}
                  />
                ) : (
                  skillSnapshot.auditTrail.slice(-5).map((record) => (
                    <div className="skill-audit-row" key={record.id}>
                      <div>
                        <p>
                          {formatSkillAuditAction(record.action, t)} · {record.name}
                        </p>
                        <small>
                          {t.skillStatus}: {formatSkillStatus(record.status, t)} · {t.skillVersion}: {record.version}
                        </small>
                      </div>
                      <small>
                        {formatSkillStatus(record.status, t)}: {record.name} v{record.version}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel title={t.toolCalls}>
            <div className="stack">
              {isRunBusy ? (
                <StateBlock
                  eyebrow={t.composerBusyEyebrow}
                  title={t.composerBusyTitle}
                  detail={t.composerBusyDetail}
                />
              ) : null}
              {activeToolCalls.length === 0 ? (
                <StateBlock
                  eyebrow={t.noToolCallsEyebrow}
                  title={t.noToolCalls}
                  detail={t.noToolCallsDetail}
                />
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
                <StateBlock
                  eyebrow={t.noProviderErrorEyebrow}
                  title={t.noProviderError}
                  detail={t.noProviderErrorDetail}
                />
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
                <StateBlock
                  eyebrow={t.noApprovalEyebrow}
                  title={t.noApproval}
                  detail={t.noApprovalDetail}
                />
              </div>
            )}
          </Panel>

          <Panel title={t.artifacts}>
            <div className="stack">
              {activeArtifacts.length === 0 ? (
                <StateBlock
                  eyebrow={t.noArtifactsEyebrow}
                  title={t.noArtifacts}
                  detail={t.noArtifactsDetail}
                />
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
      {isMemoryEditorOpen ? (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMemoryEditor();
            }
          }}
        >
          <section
            aria-labelledby="memory-dialog-title"
            aria-modal="true"
            className="settings-dialog memory-dialog"
            role="dialog"
            ref={memoryDialogRef}
          >
            <header className="settings-dialog-header">
              <div>
                <p className="section-label">{t.memoryVault}</p>
                <h2 id="memory-dialog-title">
                  {memoryEditorMode === "create" ? t.memoryCreate : t.memoryEdit}
                </h2>
                <p>{t.memoryVaultDetail}</p>
              </div>
              <button
                className="ghost-button"
                onClick={closeMemoryEditor}
                type="button"
              >
                {t.closeSettings}
              </button>
            </header>

            <div className="settings-dialog-grid memory-dialog-grid">
              <div className="settings-dialog-column">
                <article className="settings-card">
                  <div>
                    <p>{t.memoryTitle}</p>
                    <small>{t.memoryReason}</small>
                  </div>
                  <div className="settings-control-stack">
                    <div className="settings-card-control">
                      <span>{t.memoryScope}</span>
                      <div className="segmented memory-scope-selector">
                        {memoryScopeOptions.map((scopeOption) => (
                          <button
                            aria-pressed={memoryForm.scope === scopeOption}
                            className={memoryForm.scope === scopeOption ? "selected" : ""}
                            key={scopeOption}
                            onClick={() =>
                              setMemoryForm((current) => ({
                                ...current,
                                scope: scopeOption,
                              }))
                            }
                            type="button"
                          >
                            {scopeOption}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="memory-field">
                      <span>{t.memoryTitle}</span>
                      <input
                        className="composer-input"
                        value={memoryForm.title}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="memory-field">
                      <span>{t.memoryContent}</span>
                      <textarea
                        className="composer-input"
                        rows={6}
                        value={memoryForm.content}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            content: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </article>
              </div>

              <div className="settings-dialog-column">
                <article className="settings-card">
                  <div>
                    <p>{t.memoryAuditSummary}</p>
                    <small>{t.memoryVaultDetail}</small>
                  </div>
                  <div className="settings-control-stack">
                    <label className="memory-field">
                      <span>{t.memoryTags}</span>
                      <input
                        className="composer-input"
                        value={memoryForm.tags}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            tags: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="memory-field">
                      <span>{t.memorySourceThread}</span>
                      <input
                        className="composer-input"
                        value={memoryForm.sourceThreadId}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            sourceThreadId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="memory-field">
                      <span>{t.memorySourceRun}</span>
                      <input
                        className="composer-input"
                        value={memoryForm.sourceRunId}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            sourceRunId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="memory-field">
                      <span>{t.memoryReason}</span>
                      <textarea
                        className="composer-input"
                        rows={4}
                        value={memoryForm.reason}
                        onChange={(event) =>
                          setMemoryForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                      />
                    </label>
                    {memoryFeedback ? (
                      <StateBlock title={t.memoryAuditSummary} detail={memoryFeedback} />
                    ) : null}
                    <div className="composer-actions">
                      <button
                        className="secondary-button"
                        onClick={closeMemoryEditor}
                        type="button"
                      >
                        {t.cancel}
                      </button>
                      <button onClick={() => void submitMemoryEntry()} type="button">
                        {memoryEditorMode === "create"
                          ? t.memoryCreate
                          : t.memoryCreateOrUpdate}
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {isSkillEditorOpen ? (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSkillEditor();
            }
          }}
        >
          <section
            aria-labelledby="skill-dialog-title"
            aria-modal="true"
            className="settings-dialog skill-dialog"
            role="dialog"
            ref={skillDialogRef}
          >
            <header className="settings-dialog-header">
              <div>
                <p className="section-label">{t.skillVault}</p>
                <h2 id="skill-dialog-title">
                  {skillEditorMode === "create" ? t.skillCreate : t.skillEdit}
                </h2>
                <p>{t.skillVaultDetail}</p>
              </div>
              <button
                className="ghost-button"
                onClick={closeSkillEditor}
                type="button"
              >
                {t.closeSettings}
              </button>
            </header>

            <div className="settings-dialog-grid skill-dialog-grid">
              <div className="settings-dialog-column">
                <article className="settings-card">
                  <div>
                    <p>{t.skillName}</p>
                    <small>{t.skillDescription}</small>
                  </div>
                  <div className="settings-control-stack">
                    <label className="skill-field">
                      <span>{t.skillName}</span>
                      <input
                        className="composer-input"
                        value={skillForm.name}
                        onChange={(event) =>
                          setSkillForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="skill-field">
                      <span>{t.skillDescription}</span>
                      <textarea
                        className="composer-input"
                        rows={4}
                        value={skillForm.description}
                        onChange={(event) =>
                          setSkillForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="skill-field">
                      <span>{t.skillInstruction}</span>
                      <textarea
                        className="composer-input"
                        rows={8}
                        value={skillForm.instruction}
                        onChange={(event) =>
                          setSkillForm((current) => ({
                            ...current,
                            instruction: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </article>
              </div>

              <div className="settings-dialog-column">
                <article className="settings-card">
                  <div>
                    <p>{t.skillAuditSummary}</p>
                    <small>{t.skillVaultDetail}</small>
                  </div>
                  <div className="settings-control-stack">
                    <div className="settings-card-control">
                      <span>{t.skillSource}</span>
                      <div className="segmented skill-selector">
                        {skillSourceOptions.map((sourceOption) => (
                          <button
                            aria-pressed={skillForm.source === sourceOption}
                            className={skillForm.source === sourceOption ? "selected" : ""}
                            key={sourceOption}
                            onClick={() =>
                              setSkillForm((current) => ({
                                ...current,
                                source: sourceOption,
                              }))
                            }
                            type="button"
                          >
                            {formatSkillSource(sourceOption, t)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <StateBlock
                      title={t.skillStatus}
                      detail={t.skillDraftAfterSave}
                    />
                    <label className="skill-field">
                      <span>{t.skillTags}</span>
                      <input
                        className="composer-input"
                        value={skillForm.tags}
                        onChange={(event) =>
                          setSkillForm((current) => ({
                            ...current,
                            tags: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="skill-field">
                      <span>{t.skillReason}</span>
                      <textarea
                        className="composer-input"
                        rows={4}
                        value={skillForm.reason}
                        onChange={(event) =>
                          setSkillForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                      />
                    </label>
                    {skillFeedback ? (
                      <StateBlock title={t.skillAuditSummary} detail={skillFeedback} />
                    ) : null}
                    <div className="composer-actions">
                      <button
                        className="secondary-button"
                        onClick={closeSkillEditor}
                        type="button"
                      >
                        {t.cancel}
                      </button>
                      <button onClick={() => void submitSkillEntry()} type="button">
                        {skillEditorMode === "create"
                          ? t.skillCreate
                          : t.skillCreateOrUpdate}
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {isSettingsOpen ? (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSettings();
            }
          }}
        >
          <section
            aria-labelledby="settings-dialog-title"
            aria-modal="true"
            className="settings-dialog"
            role="dialog"
            ref={settingsDialogRef}
          >
            <header className="settings-dialog-header">
              <div>
                <p className="section-label">{t.currentConfiguration}</p>
                <h2 id="settings-dialog-title">{t.settingsTitle}</h2>
                <p>{t.settingsSubtitle}</p>
              </div>
              <button
                className="ghost-button"
                onClick={closeSettings}
                type="button"
              >
                {t.closeSettings}
              </button>
            </header>

            <div className="settings-dialog-grid">
              <div className="settings-dialog-column">
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
                    <p>{t.workspaceSettings}</p>
                    <small>{t.workspaceSettingsDetail}</small>
                  </div>
                  <div className="workspace-policy-stack">
                    <section className="workspace-policy-block">
                      <span>{t.workspaceRoot}</span>
                      <strong>{t.workspaceRootSource}</strong>
                      <small>{t.workspaceRootDetail}</small>
                      <small>{t.workspaceRootReadOnly}</small>
                    </section>
                    <section className="workspace-policy-block">
                      <span>
                        {t.readProjectFileTool} · {t.readProjectFileAllowed}
                      </span>
                      <strong>{t.readProjectFileAllowed}</strong>
                      <small>{t.readProjectFileAllowedDetail}</small>
                    </section>
                    <section className="workspace-policy-block">
                      <span>{t.readProjectFileDenied}</span>
                      <strong>{t.blockedPathPolicy}</strong>
                      <small>{getBlockedPathPolicyDetail(t)}</small>
                      <ul className="policy-chip-list" aria-label={t.blockedPathPolicy}>
                        {READ_PROJECT_FILE_BLOCKED_PATHS.map((blockedPath) => (
                          <li key={blockedPath}>
                            <code>{blockedPath}</code>
                          </li>
                        ))}
                      </ul>
                      <small>{t.readProjectFileDeniedDetail}</small>
                    </section>
                  </div>
                </article>
              </div>

              <div className="settings-dialog-column">
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
                    <div className="provider-status-panel" aria-live="polite">
                      <div className="provider-status-header">
                        <div>
                          <p>{t.providerConfigStatus}</p>
                          <small>
                            {isProviderStatusLoading
                              ? t.providerStatusLoading
                              : providerStatus?.configStatus === "valid"
                                ? t.providerConfigValid
                                : providerStatus?.configStatus === "invalid"
                                  ? t.providerConfigInvalid
                                  : t.notConfigured}
                          </small>
                        </div>
                        <div className="provider-status-actions">
                          <button
                            className="ghost-button"
                            disabled={isProviderStatusLoading}
                            onClick={() => void loadProviderStatus()}
                            type="button"
                          >
                            {t.refreshProviderStatus}
                          </button>
                          <button
                            className="ghost-button"
                            disabled={isProviderTesting}
                            onClick={handleProviderConnectionTest}
                            type="button"
                          >
                            {isProviderTesting
                              ? t.testingProviderConnection
                              : t.testProviderConnection}
                          </button>
                        </div>
                      </div>

                      {providerStatusError ? (
                        <StateBlock
                          title={t.providerStatusFailed}
                          detail={providerStatusError}
                          tone="danger"
                        />
                      ) : null}

                      {providerStatus ? (
                        <dl className="settings-summary provider-summary">
                          <div>
                            <dt>{t.apiKeyReadiness}</dt>
                            <dd>
                              {providerStatus.apiKeyReadiness === "configured"
                                ? t.apiKeyConfigured
                                : t.apiKeyMissing}
                            </dd>
                          </div>
                          <div>
                            <dt>{t.baseUrl}</dt>
                            <dd>{providerStatus.baseUrl ?? t.notConfigured}</dd>
                          </div>
                          <div>
                            <dt>{t.providerDefaultModel}</dt>
                            <dd>{providerStatus.defaultModel ?? t.notConfigured}</dd>
                          </div>
                          <div>
                            <dt>{t.providerThinking}</dt>
                            <dd>
                              {providerStatus.thinkingEnabled === null
                                ? t.notConfigured
                                : providerStatus.thinkingEnabled
                                  ? t.enabled
                                  : t.disabled}
                            </dd>
                          </div>
                          <div>
                            <dt>{t.providerReasoningEffort}</dt>
                            <dd>
                              {providerStatus.reasoningEffort ?? t.notConfigured}
                            </dd>
                          </div>
                          <div>
                            <dt>{t.providerIssues}</dt>
                            <dd>
                              {providerStatus.issueCodes.length > 0
                                ? providerStatus.issueCodes.join(", ")
                                : t.noProviderIssues}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <StateBlock
                          title={t.providerConfigStatus}
                          detail={
                            isProviderStatusLoading
                              ? t.providerStatusLoading
                              : t.notConfigured
                          }
                        />
                      )}

                      {lastProviderTestResult ? (
                        <StateBlock
                          title={`${t.recentConnectionTest}: ${getConnectionTestLabel(
                            lastProviderTestResult.code,
                            t,
                          )}${lastProviderTestResult.status ? ` (${lastProviderTestResult.status})` : ""}`}
                          detail={`${getConnectionTestNextStep(
                            lastProviderTestResult.code,
                            t,
                          )} ${t.lastUpdated}: ${formatAuditTime(
                            lastProviderTestResult.checkedAt,
                          )}`}
                          tone={lastProviderTestResult.ok ? "neutral" : "danger"}
                        />
                      ) : (
                        <StateBlock
                          title={t.recentConnectionTest}
                          detail={t.connectionNotTested}
                        />
                      )}

                      <div className="provider-registry-panel">
                        <div>
                          <p>{t.providerRegistry}</p>
                          <small>{t.providerRegistryDetail}</small>
                        </div>
                        {providerRegistry ? (
                          <>
                            <dl className="settings-summary provider-summary">
                              <div>
                                <dt>{t.providerDefault}</dt>
                                <dd>{providerRegistry.defaultProviderId}</dd>
                              </div>
                              <div>
                                <dt>{t.providerFallback}</dt>
                                <dd>
                                  {providerRegistry.fallbackRules
                                    .map((rule) =>
                                      rule.mode === "disabled"
                                        ? t.providerFallbackDisabled
                                        : `${rule.fromProviderId} -> ${rule.toProviderId}`,
                                    )
                                    .join(", ")}
                                </dd>
                              </div>
                            </dl>
                            <div className="provider-list">
                              {providerRegistry.providers.map((provider) => (
                                <article className="provider-item" key={provider.id}>
                                  <div>
                                    <strong>{provider.label}</strong>
                                    <small>
                                      {provider.kind} · {getProviderStatusLabel(provider.status, t)}
                                    </small>
                                  </div>
                                  <code>{provider.supportedModels.join(", ")}</code>
                                </article>
                              ))}
                            </div>
                          </>
                        ) : (
                          <StateBlock
                            title={t.providerRegistry}
                            detail={
                              isProviderStatusLoading
                                ? t.providerStatusLoading
                                : t.notConfigured
                            }
                          />
                        )}
                      </div>

                      <div className="provider-registry-panel">
                        <div>
                          <p>{t.entrySurfaces}</p>
                          <small>{t.entrySurfacesDetail}</small>
                        </div>
                        {entrySurfaces ? (
                          <div className="provider-list">
                            {entrySurfaces.surfaces.map((surface) => (
                              <article className="provider-item" key={surface.id}>
                                <div>
                                  <strong>{surface.label}</strong>
                                  <small>
                                    {getEntrySurfaceStatusLabel(surface.status, t)} ·{" "}
                                    {surface.sharedStateModel}
                                  </small>
                                </div>
                                <span>{surface.detail}</span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <StateBlock
                            title={t.entrySurfaces}
                            detail={
                              isProviderStatusLoading
                                ? t.providerStatusLoading
                                : t.notConfigured
                            }
                          />
                        )}
                      </div>

                      <div className="provider-registry-panel">
                        <div>
                          <p>{t.platformExtensions}</p>
                          <small>{t.platformExtensionsDetail}</small>
                        </div>
                        {platformExtensions ? (
                          <>
                            <dl className="settings-summary provider-summary">
                              <div>
                                <dt>{t.extensionCurrentState}</dt>
                                <dd>
                                  {platformExtensions.checkedAt} · {t.extensionNotImplemented}
                                </dd>
                              </div>
                              <div>
                                <dt>{t.extensionScopeNote}</dt>
                                <dd>{t.extensionCandidateReason}</dd>
                              </div>
                            </dl>
                            <div className="provider-list">
                              {platformExtensions.entries.map((surface) => (
                                  <article className="provider-item" key={surface.id}>
                                    <div>
                                      <strong>{surface.label}</strong>
                                      <small>
                                        {getPlatformExtensionStatusLabel(surface.status, t)} ·{" "}
                                        {getPlatformExtensionCategoryLabel(surface.category, t)}
                                      </small>
                                    </div>
                                    <span>
                                      {surface.detail} {surface.boundary} {surface.nextStep}
                                    </span>
                                  </article>
                              ))}
                              <StateBlock
                                eyebrow={t.extensionNotImplemented}
                                title={t.extensionNotBuiltTitle}
                                detail={t.extensionNotBuiltDetail}
                              />
                            </div>
                            <ul className="policy-chip-list" aria-label={t.extensionCandidateSurfaces}>
                              <li>{t.extensionCandidateCron}</li>
                              <li>{t.extensionCandidateVoice}</li>
                              <li>{t.extensionCandidateGateway}</li>
                              <li>{t.extensionCandidateUpdate}</li>
                            </ul>
                          </>
                        ) : (
                          <StateBlock
                            title={t.platformExtensions}
                            detail={
                              isProviderStatusLoading
                                ? t.providerStatusLoading
                                : t.notConfigured
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
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

async function fetchDeepSeekProviderStatus(
  signal?: AbortSignal,
): Promise<DeepSeekProviderStatusResponse> {
  const response = await fetch("/api/settings/deepseek", {
    method: "GET",
    signal,
  });

  return parseJsonResponse<DeepSeekProviderStatusResponse>(
    response,
    "provider_status_failed",
  );
}

async function testDeepSeekProviderConnectionApi(): Promise<DeepSeekProviderConnectionTestResponse> {
  const response = await fetch("/api/settings/deepseek", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  return parseJsonResponse<DeepSeekProviderConnectionTestResponse>(
    response,
    "provider_connection_test_failed",
  );
}

async function fetchMemorySnapshot(): Promise<MemorySnapshotResponse> {
  const response = await fetch("/api/memory", {
    method: "GET",
  });

  return parseJsonResponse<MemorySnapshotResponse>(response, "memory_load_failed");
}

async function fetchSkillSnapshot(): Promise<SkillSnapshotResponse> {
  const response = await fetch("/api/skills", {
    method: "GET",
  });

  return parseJsonResponse<SkillSnapshotResponse>(response, "skill_load_failed");
}

function normalizeMemoryForm(
  form: MemoryFormState,
):
  | {
      ok: true;
      value: {
        scope: MemoryScope;
        title: string;
        content: string;
        tags: readonly string[];
        sourceThreadId: string | null;
        sourceRunId: string | null;
        createdBy: "user";
        reason: string;
      };
    }
  | { ok: false; message: string } {
  const title = form.title.trim();
  const content = form.content.trim();
  const reason = form.reason.trim();
  if (title.length === 0) return { ok: false, message: "Memory title is required." };
  if (content.length === 0) return { ok: false, message: "Memory content is required." };
  if (reason.length === 0) return { ok: false, message: "Memory reason is required." };

  return {
    ok: true,
    value: {
      scope: form.scope,
      title,
      content,
      tags: parseCommaSeparatedList(form.tags),
      sourceThreadId: normalizeOptionalMemoryId(form.sourceThreadId),
      sourceRunId: normalizeOptionalMemoryId(form.sourceRunId),
      createdBy: "user",
      reason,
    },
  };
}

function normalizeSkillForm(
  form: SkillFormState,
):
  | {
      ok: true;
      value: {
        name: string;
        description: string;
        instruction: string;
        tags: readonly string[];
        source: SkillSource;
        createdBy: "user";
        reason: string;
      };
    }
  | { ok: false; message: string } {
  const name = form.name.trim();
  const description = form.description.trim();
  const instruction = form.instruction.trim();
  const reason = form.reason.trim();
  if (name.length === 0) return { ok: false, message: "Skill name is required." };
  if (description.length === 0) return { ok: false, message: "Skill description is required." };
  if (instruction.length === 0) return { ok: false, message: "Skill instruction is required." };
  if (reason.length === 0) return { ok: false, message: "Skill reason is required." };

  return {
    ok: true,
    value: {
      name,
      description,
      instruction,
      tags: parseCommaSeparatedList(form.tags),
      source: form.source,
      createdBy: "user",
      reason,
    },
  };
}

function formatSkillSource(source: SkillSource, t: CopyText): string {
  switch (source) {
    case "user":
      return t.skillSourceUser;
    case "agent":
      return t.skillSourceAgent;
    case "template":
      return t.skillSourceTemplate;
  }
}

function formatSkillStatus(status: SkillStatus, t: CopyText): string {
  switch (status) {
    case "draft":
      return t.skillStatusDraft;
    case "curated":
      return t.skillStatusCurated;
    case "disabled":
      return t.skillStatusDisabled;
  }
}

function formatSkillAuditAction(action: SkillAuditAction, t: CopyText): string {
  switch (action) {
    case "create":
      return t.skillActionCreate;
    case "update":
      return t.skillActionUpdate;
    case "delete":
      return t.skillActionDelete;
    case "enable":
      return t.skillActionEnable;
    case "disable":
      return t.skillActionDisable;
  }
}

function parseCommaSeparatedList(value: string): readonly string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function normalizeOptionalMemoryId(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    threadId: run.threadId,
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

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(", "),
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
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
  locale: Locale,
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
    message:
      failedEvent.payload.error.trim().length > 0
        ? failedEvent.payload.error
        : locale === "zh"
          ? copy.zh.providerErrorSafeMessage
          : copy.en.providerErrorSafeMessage,
  };
}

function getAuditSummary(
  events: readonly RunEvent[],
  activeRunId: string,
): AuditSummary {
  const runEventsForAudit = getEventsForRun(events, activeRunId);
  const lastEvent = runEventsForAudit.at(-1) ?? null;
  const lastEventTitle = lastEvent ? toTimelineRow(lastEvent).title : null;

  return {
    eventCount: runEventsForAudit.length,
    lastEventType: lastEvent?.type ?? null,
    lastEventTitle,
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

function formatPhase4Status(
  status: "missing" | "pending" | "running" | "completed" | "failed" | "skipped",
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "missing":
      return t.phase4Missing;
    case "running":
      return t.running;
    case "completed":
      return t.phase4Ready;
    case "failed":
      return t.phase4Blocked;
    case "pending":
      return t.enabled;
    case "skipped":
      return t.phase4Missing;
  }
}

function formatPhase4GateStatus(
  status: "missing" | "ready" | "blocked",
  t: (typeof copy)[Locale],
): string {
  switch (status) {
    case "missing":
      return t.phase4Missing;
    case "ready":
      return t.phase4Ready;
    case "blocked":
      return t.phase4Blocked;
  }
}

function formatPhase4SummaryDetail(parts: readonly (string | null)[]): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" · ");
}

function formatPhase4KeyValue(label: string, value: string | null): string | null {
  if (!value) return null;
  return `${label}: ${value}`;
}

function summarizeList(items: readonly string[], limit = 3): string | null {
  const normalized = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (normalized.length === 0) return null;

  const visible = normalized.slice(0, limit);
  const remainder = normalized.length - visible.length;
  return remainder > 0 ? `${visible.join(", ")} +${remainder}` : visible.join(", ");
}
