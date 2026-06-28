# Sage Agent 规格

## 产品定义

Sage Agent 是一个 local single-user、Web First 的 agent workbench。产品名称为 Sage Agent，信息架构和工作密度参考 Codex 桌面端，但不做逐像素克隆。

产品体验目标：前台像一个统一助手，后台像一支小 agent 团队。用户应该能看到当前谁在工作、做了什么、调用了什么工具、产出了什么，以及哪里需要 approval。

这是商业化项目。规格要优先考虑可维护性、可审计性、安全边界、用户信任和后续扩展。

## 当前主线

当前实现与规划的主线是“本地单用户 v1 收口”。

- 继续把现有 workbench、run flow、settings、provider status、approval、artifact 和 audit 体验收稳。
- 不再把历史阶段当成新平台阶段展开。
- 历史 Phase / Stage 章节保留为能力基线与实现记录。
- 之后的新工作优先围绕 v1 稳定性、可读性、QA 和发布门禁展开。
- V2.2 已完成跨会话记忆底座：本地 registry、审计轨迹和 supervisor prompt 注入。
- V2.3 已完成技能系统底座：本地 skill registry、人工 curation、工作台管理和 supervisor prompt 注入。

## UI Layout

桌面端主布局：

- 左侧 sidebar：threads、runs、workspace context、recent activity。
- 中间 workspace：当前 run conversation、streamed agent messages、final output、composer。
- 右侧 inspector：agent timeline、tool calls、approvals、artifacts、run metadata。

响应式行为：

- Desktop：三栏同时可见。
- Tablet：inspector 可以折叠为 tabs。
- Mobile：优先显示中间 workspace，sidebar 和 inspector 通过导航控件进入。

视觉方向：

- 密集但可读。
- 安静、实用、工作导向。
- 默认首屏不是 marketing landing page。
- 不做装饰性 card-heavy hero。
- timeline、toolbar controls、panels、buttons 需要稳定尺寸，避免状态变化导致布局跳动。

## 双语界面

Sage Agent 从 Stage 1 开始支持中文/英文界面切换。

- 默认界面语言：中文。
- Settings 中必须提供 language selector，至少支持 `中文` 和 `English`。
- 新增 UI 文案必须进入本地 copy 字典或后续 i18n 资源，不要在组件中继续散落硬编码。
- 专业名词、模型名、API 字段、agent role、tool name 可以保留英文。
- 中英文切换必须覆盖主要导航、面板标题、按钮、状态说明、composer 提示和 seed data 展示文案。

## Run System

Sage Agent 以 Run 为核心，而不是单纯 message-based chat。

```text
Thread
  -> Messages
  -> Runs
      -> Steps
          -> ToolCalls
      -> Approvals
      -> Artifacts
      -> Events
```

### Thread

Thread 用于组织连续对话和相关 runs。

字段：

- `id`
- `title`
- `createdAt`
- `updatedAt`

### Run

Run 是一次完整任务执行。

字段：

- `id`
- `threadId`
- `title`
- `goal`
- `status`
- `activeAgent`
- `settings`
- `createdAt`
- `updatedAt`
- `completedAt`

允许的 status：

- `queued`
- `planning`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `cancelled`

### Message

Message 是用户、agent 或 system 可见的对话内容。

字段：

- `id`
- `threadId`
- `runId`
- `role`
- `agent`
- `content`
- `createdAt`

### Step

Step 是某个 agent 执行的一段工作。

字段：

- `id`
- `runId`
- `agent`
- `title`
- `status`
- `input`
- `output`
- `startedAt`
- `completedAt`

允许的 agents：

- `supervisor`
- `researcher`
- `builder`
- `reviewer`

允许的 step status：

- `pending`
- `running`
- `completed`
- `failed`
- `skipped`

### ToolCall

ToolCall 记录 agent 调用工具的过程。

字段：

- `id`
- `runId`
- `stepId`
- `agent`
- `toolName`
- `args`
- `status`
- `result`
- `error`
- `startedAt`
- `completedAt`

允许的 status：

- `running`
- `completed`
- `failed`

### Approval

Approval 记录 risky action request。

字段：

- `id`
- `runId`
- `requestedBy`
- `reason`
- `payloadSummary`
- `action`
- `status`
- `createdAt`
- `resolvedAt`

允许的 action types：

- `write_file`
- `run_shell`
- `external_request`
- `persist_state`

允许的 status：

- `pending`
- `approved`
- `rejected`

### Artifact

Artifact 是 run 产生的中间或最终产物。

字段：

- `id`
- `runId`
- `kind`
- `title`
- `content`
- `path`
- `createdAt`

初始 artifact kinds：

- `plan`
- `patch`
- `document`
- `summary`
- `link`

## Run Events

MVP 中 UI 通过 SSE 接收 run updates。

初始 event types：

- `run.created`
- `run.status_changed`
- `step.started`
- `step.completed`
- `step.failed`
- `message.delta`
- `message.completed`
- `tool.started`
- `tool.completed`
- `tool.failed`
- `approval.requested`
- `approval.resolved`
- `artifact.created`
- `run.completed`
- `run.failed`

`run.failed` 事件应携带完整的 `run` 快照和 `error`，便于 UI 与 runtime 在失败时同步更新状态。

## Phase 2 Run Loop

Phase 2 起，首页 composer 必须逐步从本地模拟切换为真实后端 run loop：

```text
用户输入任务
  -> POST /api/runs 创建 Thread/Run
  -> 后端写入 run.created event
  -> 后端执行 Supervisor-only 或后续 multi-agent loop
  -> run events 写入 runtime store
  -> 前端拉取或订阅 run events
  -> conversation / timeline / audit / inspector 从 events 派生
```

Phase 2 的第一步允许使用本地模拟 Supervisor output 写入真实 run events，用来验证 UI 与 API/event 闭环。真实 DeepSeek 调用在后续 task 接入。

Phase 2 不把 API key 放入前端存储；DeepSeek key 默认来自 `.env`。

Phase 2.2 起，composer 调用真实 Supervisor route：

- `POST /api/runs` 创建 queued run。
- `POST /api/runs/:runId/supervisor` 调用 DeepSeek Chat Completions。
- 成功追加 `run.status_changed`、`message.delta`、`message.completed`、`run.completed`。
- 失败追加 `run.status_changed`、`run.failed`，失败 payload 只包含安全错误说明。
- 前端再通过 `GET /api/runs/:runId/events` 拉取该 run 的事件并更新 conversation、timeline、audit 和 provider error 面板。
- Task 2.2 是非 streaming；真实增量输出属于 Task 2.3。

Phase 2.3 起，Supervisor route 的默认响应升级为 live SSE：

- route 仍是 `POST /api/runs/:runId/supervisor`，但响应 `content-type` 为 `text/event-stream`。
- 后端调用 DeepSeek `stream: true`，把每个 content chunk 写入 `message.delta` event。
- 每个 Sage event 先 append 到 runtime store，再通过 HTTP stream 转发给前端。
- 前端边读 SSE 边应用 events；`message.delta` 创建或追加当前 Supervisor message，`message.completed` 固化最终内容。
- 失败事件也通过同一条 stream 返回，确保 UI 和 runtime audit 不断链。

只读文件上下文由 Supervisor route 在调用 DeepSeek 前执行最小 context pass：

- 当用户目标中明确提到项目相对路径，例如 `README.md`、`docs/SPEC.md`、`packages/runtime/src/tools.ts`，后端使用 `read_project_file` 工具尝试读取这些路径。
- workspace root 默认从 monorepo root 推导；部署或特殊启动方式可用 `SAGE_WORKSPACE_ROOT` 显式固定。
- 每次工具调用都写入 `tool.started`，成功写入 `tool.completed`，失败写入 `tool.failed`。
- 工具只允许读取 workspace root 内的文本文件；路径必须标准化并确认没有越界。
- 工具拒绝 `.env`、`.git/`、`node_modules/`、`.next/`、`dist/`、`build/`、`coverage/`、`tmp/`、`playwright-report/`、`test-results/`、目录、二进制文件和超过读取上限的文件。
- 成功读取的文件片段会作为额外 context 传入 Supervisor prompt；失败原因也作为安全 context 传入，便于 Supervisor 用用户语言解释限制。
- 只读工具不触发 approval；写文件、shell 和外部副作用仍必须 approval。

Phase 2.5 起，真实 run 从 Supervisor-only 扩展为顺序编排的 multi-agent event flow：

- run 以 Supervisor 为起点，但中间步骤必须显式写入 `step.started` / `step.completed`。
- Researcher、Builder、Reviewer 的输出通过 `Message`、`Step`、`Artifact` 和 `RunEvent` 进入同一条审计流。
- Phase 2.5 复用现有 `@sage/agents` 纯函数作为 agent contract，不引入自由 swarm。
- Supervisor summary 仍由 Supervisor 负责，但必须消费 Reviewer 结论后再结束 run。
- 若 Reviewer 判定 `needs_changes`，final summary 需要保留阻塞原因或重新分派后的处理说明。

## Multi-Agent Model

MVP 使用 supervisor-led workflow。

Agents：

- Supervisor：理解用户目标、创建计划、分派工作、汇总结果。
- Researcher：读取本地上下文并整理发现。
- Builder：生成方案、patch content、文档或 artifacts。
- Reviewer：检查风险、遗漏、规格一致性和质量问题。

MVP orchestration pattern：

```text
User goal
  -> Supervisor plan
  -> Researcher context pass
  -> Builder draft
  -> Reviewer critique
  -> Builder revision when needed
  -> Supervisor final summary
```

MVP 避免 free-form agent swarm。子 agents 是职责明确的 task workers，不是长期开放聊天角色。

Phase 2.5 的实现优先级：

1. 先把 Supervisor / Researcher / Builder / Reviewer 的纯函数结果写入真实 run events。
2. 再让 UI 从 events 派生 step timeline、messages、tool calls、artifacts 和 final summary。
3. 最后再考虑是否把某些阶段拆成更细的 LLM 或工具调用。

## 子 agent 工作策略

Sage Agent 自身实现过程中也允许使用子 agent 协作，但必须遵守：

- 主 agent 负责拆分任务、定义输入输出、检查结果和最终提交。
- 子 agent 只处理单一明确子任务。
- 子 agent 结束后关闭其工作上下文，不保留长期运行状态。
- QA 子 agent 应在实现完成后独立审查，避免实现上下文污染判断。
- 任何由子 agent 发现但暂不修复的问题，要进入 `docs/BUGS.md`。

## DeepSeek Settings

Provider：

- 当前真实 provider 只支持 DeepSeek。
- API base URL 默认 `https://api.deepseek.com`。
- API style：OpenAI-compatible chat completions。

Models：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

Defaults：

- Model：`deepseek-v4-flash`
- Thinking mode：enabled
- Reasoning effort：`high`

UI options：

- Model selector：Flash 或 Pro。
- Thinking mode toggle：on / off。
- Reasoning effort selector：`high` 或 `max`。

UI 不暴露当前未明确支持的 provider options。

## Provider Registry 与 Entry Surfaces

V2.4 起，Sage Agent 把 provider 状态从单 DeepSeek 状态槽升级为共享 provider registry 快照。

Provider registry 当前包含：

- `defaultProviderId`：当前为 `deepseek`。
- `providers`：至少包含 DeepSeek provider descriptor，字段覆盖 provider id、label、kind、status、默认设置、base URL、supported models、issue codes 和 checkedAt。
- `fallbackRules`：当前自动 fallback 为 `disabled`，直到后续 task 引入第二个已审批 provider。
- `auditTrail`：记录 registry 初始化、状态检查、连接测试或 fallback blocked 等审计摘要。

Entry surfaces 当前包含：

- `web`：active，承载当前 workbench。
- `desktop`：planned，只声明未来会复用同一 run / provider / inspector 状态模型。

约束：

- V2.4 不实现真实第二 provider、不实现自动 fallback、不实现桌面 app。
- 新建 run 必须显式记录当前 `providerId`；旧 DeepSeek settings 没有 `providerId` 时按 `deepseek` 兼容处理。
- Provider registry 和 entry surface 必须进入双语 Settings UI，不能只停留在文档或后端类型。

## Settings System

Phase 3 起，Sage Agent 需要独立 Settings surface，而不是把配置控件散落在工作台各处。

Settings 初始分区：

- General / 通用：界面语言、偏好说明。
- Providers / 入口：provider registry、默认 provider、fallback 状态、entry surfaces、API key 配置状态、base URL、默认模型、thinking、reasoning effort、连接测试。
- Workspace / 工作区：当前 workspace root、只读文件工具范围。
- Safety / 安全边界：Read + Draft 权限模型、approval 触发条件、敏感信息处理说明。

Settings 入口要求：

- 工作台中必须有清晰可发现的 Settings 入口。
- Settings 页面 / 面板必须支持中文/English。
- Desktop 和 mobile 下必须可读、可操作，不遮挡主 run 状态。
- Settings 的配置变化不应破坏当前 run 的 event stream。

本地偏好策略：

- 可以在浏览器本地保存非敏感偏好：语言、默认模型、thinking、reasoning effort。
- 不得在 localStorage、sessionStorage 或前端 state 中保存完整 API key。
- API key 默认来自 server environment，例如 `.env` 中的 `DEEPSEEK_API_KEY`。
- 前端只展示 API key 是否已配置，以及必要的脱敏状态。

连接测试策略：

- DeepSeek 连接测试必须通过后端 route。
- 缺少 API key 时不得发起真实 DeepSeek 请求。
- 错误信息必须复用 provider 脱敏规则，不泄露完整 API key、Authorization header、token、secret 或 password。
- 连接测试结果应进入 Settings UI 的状态反馈；是否写入 run events 由后续实现 task 决定。

## Tool and Approval Model

MVP 默认模式：Read + Draft。

无需 approval：

- Read allowed project text files through `read_project_file`。
- Inspect project metadata。
- Draft plans。
- Draft patches。
- Generate artifacts that do not mutate persistent state。

必须 approval：

- Write or edit files。
- Run shell commands。
- Make external requests with side effects。
- Persist non-file state changes outside local run state。

Approval requests 必须展示：

- Requesting agent。
- Reason。
- Action type。
- Payload summary，对应数据字段 `payloadSummary`。
- Approve / reject controls。
- Final resolution。

## 工作流与质量门禁

每个小 task 必须遵循：

```text
写文档 -> 实现 -> QA 审查 -> 修复或记录 BUG -> 中文 git commit
```

质量门禁：

- 文档与实现一致。
- UI 行为符合规格。
- 安全边界未被绕过。
- 关键状态可追踪。
- 当前可修复 bug 已修复。
- 暂不修复 bug 已记录到 `docs/BUGS.md`。

## MVP 不做

- Hosted multi-user accounts。
- Billing。
- Tenant isolation。
- Full desktop wrapper。
- Unrestricted local automation。
- Arbitrary provider marketplace。
- Free-form multi-agent swarm。

## v2 候选边界

上面的 `MVP 不做` 是当前 v1 的明确边界，不代表默认自动进入下一阶段。若未来要推进这些方向，需要单独写提案、重新定边界和验收标准，再进入新的路线图。
