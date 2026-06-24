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

- 将 DeepSeek streaming response 增量解析为 `message.delta` events。
- 完成时写入 `message.completed` 和 `run.completed`。
- 前端按 events 增量更新 message 内容。

验收：

- 用户能看到输出逐步出现。
- message delta 不重复、不乱序。
- 中途失败能保留已收到内容并显示失败状态。

## Task 2.4：Read-only File Tool

范围：

- 增加只读项目文件工具。
- 工具调用必须产生日志化 `tool.started` / `tool.completed` / `tool.failed` events。
- 工具只能读取项目范围内允许路径，不做写入或 shell。

验收：

- 用户可要求分析指定项目文件。
- UI tool calls 面板可见工具名、agent、状态。
- 越界路径被拒绝并写入安全错误。

## Task 2.5：Supervisor-led Multi-Agent Run

范围：

- 将真实 run 从 Supervisor-only 扩展为 Supervisor -> Researcher -> Builder -> Reviewer -> Supervisor summary。
- 子 agent 输出通过 steps/messages/artifacts/events 可追踪。
- Reviewer pass 仍是 final summary 前置条件。

验收：

- 一个任务能完整经过多 agent 阶段。
- UI 能清楚显示每个 agent 的状态和产出。
- Risky actions 仍不会绕过 approval。

## API Key 策略

Phase 2 默认使用 `.env` 配置 DeepSeek：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_DEFAULT_MODEL`
- `DEEPSEEK_DEFAULT_REASONING_EFFORT`
- `DEEPSEEK_THINKING_ENABLED`

Phase 2 不提供 API key 输入 UI。前端后续只显示“已配置/未配置”状态，避免过早引入敏感信息存储、加密和清除策略。
