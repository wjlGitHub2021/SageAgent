# Stage 2 实施规格

## 目标

Stage 2 的目标是把 Sage Agent 从静态 product shell 推进到 run-based 执行模型。UI、runtime、API 和后续 DeepSeek provider 必须围绕同一套 domain types 工作，避免各层各自定义状态形状。

## 分块策略

Stage 2 按以下小 task 推进：

1. 定义 shared domain types。
2. 添加 local runtime state store。
3. 添加 create-run API。
4. 添加 SSE event endpoint。
5. 将 UI timeline 改为 event-driven 渲染。
6. 将 inspector 的 tool calls、approvals、artifacts 接到 runtime state。

每个小 task 都要先更新文档，再实现，再 QA，最后中文提交。

## Task 2.1：Shared Domain Types

范围：

- 在 `packages/shared` 中建立 TypeScript package。
- 导出 `Thread`、`Run`、`Message`、`Step`、`ToolCall`、`Approval`、`Artifact`、`RunEvent` 等 domain types。
- 固化 Stage 2 需要的 status、agent role、event type、tool action、artifact kind、DeepSeek setting 类型。
- `RunEvent` 应包含 `step.failed`、`tool.failed` 等失败事件，`run.failed` 应携带完整 `run` 快照和 `error`。
- 保持类型只描述数据合同，不引入 runtime store、API handler、React 组件或真实 provider 调用。

验收：

- `packages/shared` 可以独立通过 TypeScript typecheck。
- shared types 与 `docs/SPEC.md` 的 Run System 字段保持一致。
- 类型能覆盖后续 `Thread -> Run -> Step -> ToolCall / Approval / Artifact / Event` 链路。
- 失败事件语义清晰，后续 SSE reducer 不需要额外猜测 `run.failed` 的快照来源。
- root `pnpm build` 不因新增 package 失败。

## 暂不做

- 不实现真实 agent loop。
- 不实现 create-run API。
- 不实现 SSE endpoint。
- 不把 Stage 1 seed data 迁移到 runtime store。
- 不接入 DeepSeek API。

## QA 重点

- 检查类型命名是否清晰、可维护、商业化可扩展。
- 检查所有 union 类型是否与规格一致，避免 UI 与 runtime 后续出现状态漂移。
- 检查 package export 是否稳定，后续 `apps/web` 和 `packages/runtime` 可以直接引用。

## Task 2.2：Local Runtime State Store

范围：

- 在 `packages/runtime` 中建立 TypeScript package。
- 使用 `@sage/shared` 的 domain types 定义 `RuntimeSnapshot` 和内存 store。
- store 至少支持读取完整 snapshot、按 id 读取 thread/run、按 thread 读取 runs、按 run 读取 events。
- store 至少支持 upsert thread/run/message/step/tool call/approval/artifact，以及 append run event。
- append run event 时要把事件写入 event log，并根据事件 payload 更新对应实体，形成后续 SSE reducer 的服务端侧基础。
- `message.delta` 需要累积更新 message snapshot；重复 `event.id` 的 append 应当幂等处理。
- 保持 local single-user、in-memory，不引入数据库、文件持久化、API handler、SSE endpoint 或真实 agent loop。

验收：

- `packages/runtime` 可以独立通过 TypeScript typecheck。
- root `pnpm build` 会先构建 `@sage/shared`，再构建 `@sage/runtime` 和 web app。
- store 不重新定义 Run System 类型，所有 domain entity 必须来自 `@sage/shared`。
- `run.failed`、`step.failed`、`tool.failed` 能通过 append event 更新对应 state。
- `message.delta` 能正确累积 message content，并在重复 event id 时保持幂等。

暂不做：

- 不实现 create-run API。
- 不实现 SSE endpoint。
- 不把 Stage 1 UI seed data 迁移到 runtime store。
- 不做跨进程持久化或数据库。

## Task 2.3：Create Run API

范围：

- 在 `apps/web` 中添加 `POST /api/runs`。
- API 使用 `@sage/runtime` 的 local in-memory store 创建 thread/run/event。
- request body 支持：
  - `goal`：必填，非空字符串。
  - `threadId`：可选；提供时必须能在 runtime store 中找到对应 thread。
  - `threadTitle`：可选；当未提供 `threadId` 时用于创建 thread。
  - `title`：可选；未提供时从 `goal` 生成 run title。
  - `settings`：可选，只允许 `deepseek-v4-flash` / `deepseek-v4-pro`、`high` / `max` 和 boolean thinking。
- response 返回新建的 `thread`、`run`、初始 `run.created` event 和当前 `snapshot`。

验收：

- 合法请求返回 `201`，并创建 `queued` run。
- 空 goal 返回 `400`。
- 非字符串 `threadId`、`threadTitle` 或 `title` 返回 `400`。
- 提供空白 `threadId` 返回 `400`，避免误创建新 thread。
- 不存在的 `threadId` 返回 `404`。
- 非法 model 或 reasoning effort 返回 `400`。
- API 不发起真实 DeepSeek 请求，不启动 agent loop，不实现 SSE。

暂不做：

- 不把 Product Shell 的 composer 接到该 API。
- 不实现 run event streaming。
- 不持久化到数据库或文件。

## Task 2.4：SSE Event Endpoint

范围：

- 在 `apps/web` 中添加 `GET /api/runs/[runId]/events`。
- endpoint 使用 `@sage/runtime` 的 local in-memory store 读取 run events。
- 使用 `text/event-stream` 响应，事件名为 `run-event`，data 为单个 `RunEvent` JSON。
- 支持 `after` query param，只返回 `sequence > after` 的 events。
- 当前实现为 snapshot-style SSE：发送已有 events 后关闭连接，不做长连接订阅、心跳、重试或后台 agent streaming。

验收：

- 存在 run 时返回 `200` 和 SSE 格式内容。
- 不存在 run 时返回 `404` JSON error。
- 非数字 `after` 返回 `400`。
- 超出 safe integer 范围的 `after` 返回 `400`。
- `after` 能过滤旧 events。
- 不接 DeepSeek、不启动 agent loop、不实现持续订阅。

暂不做：

- 不实现 browser EventSource 长连接保持。
- 不实现 live event bus subscription。
- 不把 UI timeline 接到该 endpoint。

## Task 2.5：Event-Driven Timeline

范围：

- 将 Product Shell 右侧 `Agent Timeline` 从静态 `steps` 数组改为从 `RunEvent[]` 派生渲染。
- Stage 2.5 仍使用本地 seed events，不接 live SSE / EventSource。
- timeline 需要按当前 active run 过滤，并按 `sequence` 渲染。
- `step.*`、`message.*`、`tool.*`、`approval.*`、`artifact.created`、`run.*` 事件都要有可读 fallback。
- 中英文界面切换后，timeline 的事件标题要同步切换；agent role 和 tool name 可以保留英文。
- Composer 的本地 `Run` 点击需要追加一条本地模拟 message 和对应 `message.completed` event，用来验证 timeline 由 events 驱动。

验收：

- 首屏 `Agent Timeline` 仍展示 Supervisor、Researcher、Builder 等 agent 活动。
- 切换 run 后，timeline 跟随 active run 更新。
- 点击 composer `Run` 后，conversation 增加消息，timeline 增加对应本地 event。
- 不接 DeepSeek、不调用 `/api/runs/[runId]/events`、不实现 live subscription。
- Desktop/mobile 不出现 timeline 文本遮挡或横向溢出。

暂不做：

- 不迁移 tool calls、approvals、artifacts 面板数据源。
- 不把 create-run API 接入 composer。
- 不做真正 streaming timeline。

## Task 2.6：Event-Derived Inspector Panels

范围：

- 将右侧 `Tool Calls`、`Approval`、`Artifacts` 面板从静态数组改为从本地 `RunEvent[]` 派生。
- 继续使用 Stage 2 本地 seed events，不接 live SSE / EventSource。
- tool 面板从 `tool.started`、`tool.completed`、`tool.failed` 派生最新 tool call 状态。
- approval 面板从 `approval.requested`、`approval.resolved` 派生当前 active run 的 approval。
- artifact 面板从 `artifact.created` 派生当前 active run artifacts。
- Approve / Reject 仍是本地交互，但需要追加 `approval.resolved` event，让面板状态来自事件流。

验收：

- 切换 run 后，tool calls、approval、artifacts 跟随 active run 更新。
- Approve / Reject 后，approval 状态通过 `approval.resolved` event 更新。
- Timeline、tool calls、approval、artifacts 使用同一组本地 `RunEvent[]`。
- 不接 DeepSeek、不执行真实工具、不写文件、不运行 shell。

暂不做：

- 不把 approval 操作接到 API。
- 不实现真实 tool execution。
- 不实现 artifact 文件预览。
