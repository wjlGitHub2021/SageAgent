# Phase 2 规格：真实 Run Loop 最小闭环

## 目标

Phase 2 的目标是把 Sage Agent 从“可演示工作台壳”推进到“真实 run loop 工作台”。用户在 composer 输入任务后，前端调用后端 API 创建 run，后端把 run events 写入 runtime store，前端再用 events 回填 conversation、timeline、audit 和状态面板。

Phase 2 继续遵守：

- 文档、回复、提交信息默认中文。
- UI 新增文案必须支持中文/English。
- 每个小 task 走文档 -> 实现 -> QA -> 修复或记录 BUG -> 中文 commit。
- 优先 local single-user，不做登录、多用户、远程部署或 billing。
- 安全边界仍是 Read + Draft；写文件、shell、外部副作用操作必须走 approval。

## Phase 2 范围

Phase 2 采用渐进闭环：

1. 先接通前端 composer 与后端 run/event API。
2. 再接 DeepSeek provider，让 Supervisor-only run 真正调用模型。
3. 再把 streamed model output 转成 run events。
4. 再接 read-only file tool。
5. 最后扩展到 supervisor-led multi-agent 编排。

不在 Phase 2 一开始做完整 Hermes-like swarm，也不在第一步做 API key 设置页。

## Task 2.1：Composer -> Run API -> Events UI

范围：

- 将中间 composer 从“本地模拟按钮”升级为真实输入框。
- 用户输入任务后调用 `POST /api/runs` 创建新 thread/run。
- 调用 `POST /api/runs/:runId/stream-output` 写入一个本地模拟 Supervisor 输出，作为真实 API/event 闭环的占位。
- 调用 `GET /api/runs/:runId/events` 拉取 run events，并用返回 events 更新 conversation、timeline、audit、provider error、tool calls、approval、artifacts。
- 前端 run history 使用真实 API 返回的 thread/run 信息追加到左侧列表。
- 保留模型、thinking、reasoning effort 控件，并把当前设置传给 create-run API。
- 所有新增 UI 文案进入 copy 字典，保持中文/English 切换。
- 不接 DeepSeek，不读取本地文件，不写文件，不执行 shell。

验收：

- composer 显示多行输入框，空输入时不能提交。
- 输入任务并点击运行后，左侧 runs 出现真实 run，conversation 出现用户输入和 Supervisor API event 输出。
- timeline / audit 从后端 events 派生更新，而不是只追加本地假消息。
- 运行中按钮有 disabled / busy 状态，失败时显示双语错误提示且不泄露敏感信息。
- 切换中文/English 后新增 composer 文案同步切换。
- Desktop 下 composer 仍在首屏可见；mobile 下无横向溢出。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不调用真实 DeepSeek provider。
- 不实现真实 streaming transport；本 task 可以先用一次性 HTTP 调用返回 events。
- 不实现 API key UI 设置页。
- 不做持久化数据库；继续使用进程内 runtime store。
- 不做 read file tool、write file approval 或 shell approval 的真实执行链路。

构建稳定性要求：

- Web app 不依赖外部字体下载完成才能 build。
- 默认字体使用本地系统字体栈，避免 `next/font/google` 在代理或离线环境下导致生产构建失败。

## Task 2.2：Supervisor-only DeepSeek 调用

范围：

- 后端读取 `DEEPSEEK_API_KEY` 和 DeepSeek 默认配置。
- 新增 `POST /api/runs/:runId/supervisor`，由 Supervisor-only run 调用 DeepSeek Chat Completions。
- Phase 2.2 采用非 streaming 调用：请求完成后一次性把结果写入 run events；真正的增量输出留到 Task 2.3。
- 成功路径追加 `run.status_changed` -> `message.delta` -> `message.completed` -> `run.completed`。
- `message.delta` 与 `message.completed` 必须使用同一个 `messageId`，`message.completed.content` 必须等于 delta 拼接结果。
- 无 API key、配置错误、网络失败、HTTP 失败、响应解析失败或空输出写入 `run.failed` event，并在 UI provider error 面板可见。
- 缺少 API key 时不得发起真实 HTTP 请求。
- 已经开始、完成或失败的 run 不允许重复触发 Supervisor provider 调用。
- 前端 composer 停止调用本地占位 `stream-output`，改为调用真实 Supervisor route，再通过 `GET /api/runs/:runId/events` 回填 UI。

验收：

- 配置有效 API key 时，用户任务能得到真实 DeepSeek 回复。
- 未配置 API key 时不发真实请求，UI 显示安全错误。
- provider error 不泄露完整 API key、authorization 或 token。
- 成功和失败都保留完整可审计 run events，不只返回 HTTP error。
- 测试覆盖成功、缺 key、provider 失败、空模型输出。

暂不做：

- 不提供 API key UI 设置页。
- 不实现真正的 streaming transport 或实时 SSE 订阅。
- 不读取项目文件，不写文件，不运行 shell。
- 不启动 Researcher / Builder / Reviewer 子 agent；本 task 只运行 Supervisor。

## Task 2.3：Streamed Output Events

范围：

- 在 `@sage/deepseek` 中新增 streaming Chat Completions helper，发送 `stream: true` 并解析 DeepSeek data-only SSE。
- `POST /api/runs/:runId/supervisor` 默认返回 `text/event-stream`，把后端生成的 Sage `RunEvent` 逐条转发给前端，同时 append 到 runtime store。
- DeepSeek `content` delta 转换为 Sage `message.delta`；`reasoning_content` 暂不显示在 UI，只作为后续思考可视化扩展点。
- 完成时写入并转发 `message.completed` 和 `run.completed`。
- 中途失败时写入并转发 `run.failed`，保留已经收到并写入的 `message.delta`。
- 前端 composer 边读 SSE 边应用 events，conversation 中同一条 Supervisor 消息按 `message.delta` 增量更新。
- 非 streaming JSON 模式不再作为 composer 默认路径，但 runner 保留可测试的 non-streaming helper，便于回归与后续 fallback。

验收：

- 用户能看到输出逐步出现。
- message delta 不重复、不乱序。
- 中途失败能保留已收到内容并显示失败状态。
- 未配置 API key 时仍不发真实 DeepSeek 请求，直接 stream `run.status_changed` 与 `run.failed` 事件。
- provider error 继续不泄露完整 API key、authorization 或 token。
- 测试覆盖 streaming 成功、stream line 解析失败、HTTP/network failure、前端 event reducer 的 delta 应用。

## Task 2.4：Read-only File Tool

范围：

- 增加只读项目文件工具 `read_project_file`，用于把明确指定的项目文本文件作为 Supervisor 上下文。
- Phase 2.4 只支持显式路径触发，例如用户输入“读取 `docs/SPEC.md` 并总结”或“分析 `README.md`”。暂不做全仓库自动搜索或 LLM 自主选择任意文件。
- 工具调用必须产生日志化 `tool.started` / `tool.completed` / `tool.failed` events；事件进入同一条 run stream，并在 UI tool calls / timeline / audit 中可见。
- 只允许读取项目根目录内的文本文件。路径必须先标准化、resolve，再确认仍位于 workspace root 内。
- 禁止路径穿越、绝对路径越界、目录读取、隐藏敏感文件、依赖/构建产物目录和二进制/过大文件：
  - 拒绝 `.env`、`.env.*`、`.git/`、`node_modules/`、`.next/`、`dist/`、`build/`、`coverage/`、`tmp/`、`playwright-report/`、`test-results/`。
  - 默认最大读取 `64 KiB`；超过上限返回结构化安全错误，不读取全文。
  - 检测到 NUL byte 或明显二进制内容时拒绝。
- 工具结果只把安全摘要和文本片段放入 `ToolCall.result`，不得泄露被拒绝敏感文件内容。
- 读取成功时，将文件内容片段作为额外 context 传给 DeepSeek；读取失败时仍继续 Supervisor 回复，让模型说明无法读取的安全原因。
- 不写文件、不执行 shell、不发起外部副作用请求、不触发 approval。

验收：

- 用户可要求分析指定项目文件。
- UI tool calls 面板可见工具名、agent、状态。
- 越界路径被拒绝并写入安全错误。
- `.env`、目录、过大文件、二进制文件被拒绝且不产生 approval。
- 成功读取时的事件顺序包含 `run.status_changed` -> `tool.started` -> `tool.completed` -> `message.delta` -> `message.completed` -> `run.completed`。
- 读取失败时的事件顺序包含 `tool.started` -> `tool.failed`，随后仍可进入 Supervisor 模型回复或 provider failure。
- 测试覆盖成功读取、路径穿越、绝对路径越界、敏感路径拒绝、runner tool events 和 streaming 上下文注入。

暂不做：

- 不做 Settings 页面中的文件权限配置。
- 不做目录列表、glob 搜索、代码索引或语义检索。
- 不做 LLM tool calling schema；路径提取先由后端 deterministic parser 处理明确路径。
- 不让工具读取 workspace root 外的文件，即使用户显式给出绝对路径。
- 不读取图片、PDF、Office 文档或其它二进制资产。

## Task 2.5：Supervisor-led Multi-Agent Run

范围：

- 将真实 run 从 Supervisor-only 扩展为可审计的 Supervisor -> Researcher -> Builder -> Reviewer -> Supervisor summary 链路。
- Phase 2.5 不做 free-form swarm，不做每个子 agent 独立 LLM 调用，不引入新的 provider；优先复用现有 `@sage/agents` 纯函数与 `@sage/runtime` event model。
- 真实 run 要补齐 `step.started` / `step.completed` / 必要时 `step.failed`，并让 Researcher、Builder、Reviewer 的输出通过 step / tool / message / artifact / event 可追踪。
- Researcher 负责 context brief，Builder 负责 draft，Reviewer 负责 review gate，Supervisor 负责最终 summary。
- 子 agent 生命周期是一次性 task worker：每个 stage 完成后不保留长期会话状态。
- Reviewer pass 仍是 final summary 前置条件；review 不通过时 final summary 必须说明阻塞原因。

验收：

- 一个任务能完整经过多 agent 阶段。
- UI 能清楚显示每个 agent 的状态和产出。
- Risky actions 仍不会绕过 approval。
- 事件流中可以看到 multi-agent 的 step / message / artifact 轨迹，而不是单条 Supervisor 回复。
- Phase 2.5 仍保持 Read + Draft 安全边界。

## API Key 策略

Phase 2 默认使用 `.env` 配置 DeepSeek：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_DEFAULT_MODEL`
- `DEEPSEEK_DEFAULT_REASONING_EFFORT`
- `DEEPSEEK_THINKING_ENABLED`
- `SAGE_WORKSPACE_ROOT`：可选；用于固定 read-only file tool 的 workspace root。默认从 monorepo root 推导，本地开发建议显式设置为 `/Users/wangjinlong/DailySage`。

Phase 2 不提供 API key 输入 UI。前端后续只显示“已配置/未配置”状态，避免过早引入敏感信息存储、加密和清除策略。

该能力从 Phase 3 起由独立 Settings surface 承接；详见 `docs/PHASE3_SPEC.md`。
