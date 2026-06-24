# Stage 3 实施规格

## 目标

Stage 3 的目标是接入 DeepSeek V4 provider，并把模型输出转换为 Sage Agent 的 run events。Stage 3 必须延续 Stage 2 的 Run System，不允许让 provider 直接绕过 runtime/event flow 更新 UI。

## 外部依据

以 DeepSeek 官方文档为准：

- API base URL：`https://api.deepseek.com`
- provider base URL 必须使用 `https`，且不得包含 query/hash。
- API 形态：OpenAI-compatible Chat Completions。
- 支持模型：`deepseek-v4-flash`、`deepseek-v4-pro`。
- thinking mode：通过 `thinking.type` 控制，默认使用 `enabled`。
- `reasoning_effort`：Stage 3 只暴露 `high` 和 `max`。

## 分块策略

Stage 3 按以下小 task 推进：

1. 添加 provider configuration。
2. 添加 API key environment handling。
3. 实现 DeepSeek V4 adapter。
4. 添加 model selector。
5. 添加 thinking mode toggle。
6. 添加 `high` / `max` reasoning effort selector。
7. 将 streamed model output 写入 run events。
8. 在 UI 中清楚展示 provider errors。

每个小 task 都要先更新文档，再实现，再 QA，最后中文提交。

## Task 3.1：Provider Configuration

范围：

- 在 `packages/deepseek` 中建立 TypeScript package。
- 定义 DeepSeek provider config 类型。
- 从环境变量读取并校验：
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_BASE_URL`
  - `DEEPSEEK_DEFAULT_MODEL`
  - `DEEPSEEK_DEFAULT_REASONING_EFFORT`
  - `DEEPSEEK_THINKING_ENABLED`
- 默认值：
  - base URL：`https://api.deepseek.com`
  - model：`deepseek-v4-flash`
  - reasoning effort：`high`
  - thinking enabled：`true`
- 配置模块必须复用 `@sage/shared` 的 `DeepSeekModel`、`ReasoningEffort` 和常量列表。
- 缺失 API key 在 Task 3.1 中不阻止配置创建；真实请求前再强校验。

验收：

- `packages/deepseek` 可以独立通过 TypeScript typecheck。
- root `pnpm build` 会构建 `@sage/deepseek`。
- 非法 base URL、model、reasoning effort、thinking flag 能给出结构化错误。
- base URL 必须为 HTTPS，且不允许 query/hash。
- 不发起真实 DeepSeek HTTP 请求。
- 不在日志、错误或文档中泄露 API key。

暂不做：

- 不实现 Chat Completions HTTP adapter。
- 不实现 streaming parser。
- 不把 UI composer 接到 DeepSeek。
- 不持久化 provider settings。

## Task 3.2：API Key Environment Handling

范围：

- 在 `@sage/deepseek` 中添加 API key 状态与请求前校验工具。
- 配置加载阶段仍允许 `apiKey: null`，用于本地启动和 UI 提示。
- adapter 发起真实请求前必须通过显式 guard 获取非空 API key。
- 提供 API key 脱敏显示工具，只暴露前后少量字符和长度状态，不返回完整 key。
- 提供 provider readiness 状态，便于后续 UI 展示 DeepSeek 是否可用。

验收：

- 空 API key 返回 `missing_api_key` 类结构化错误。
- 非空 API key 可以通过请求前校验，并返回完整 key 给 adapter 内部使用。
- 脱敏工具不会泄露完整 API key。
- 错误 message 不包含真实 API key。
- 不发起真实 DeepSeek HTTP 请求。

暂不做：

- 不读取 `.env` 文件本身，只消费传入 env 或 `process.env`。
- 不实现 adapter。
- 不把 readiness 状态接入 UI。

## Task 3.3：DeepSeek V4 Adapter

范围：

- 在 `@sage/deepseek` 中实现 DeepSeek V4 Chat Completions adapter。
- 生成 OpenAI-compatible `POST /chat/completions` 请求：
  - `model`
  - `messages`
  - `stream`
  - `thinking: { type: "enabled" | "disabled" }`
  - `reasoning_effort: "high" | "max"`
- 真实发送前必须调用 `requireDeepSeekApiKey`，缺失 key 返回结构化 `missing_api_key` 错误。
- 支持可注入 `fetch`，便于 QA 使用 fake fetch 验证请求，不发真实外部请求。
- non-stream adapter 调用固定发送 `stream: false`，公开 input 暂不暴露 `stream` 开关；streamed output 写入 run events 在 Task 3.7 单独实现。
- 提供 non-stream response parser，用于提取 assistant content、reasoning content、finish reason 和原始 id/model。
- 提供 streaming SSE line parser，支持：
  - 空行与非 `data:` 行忽略。
  - `data: [DONE]` 转换为 done event。
  - JSON chunk 转换为 delta event。
  - 非法 JSON 返回结构化 parse error。
- 不记录、不返回完整 API key；测试与错误输出不得包含真实 key。

验收：

- `packages/deepseek` 独立 typecheck 通过。
- root `typecheck`、`lint`、`build` 通过。
- fake fetch 能验证 URL、method、headers 和 body shape，不触发真实 DeepSeek 请求。
- missing API key、HTTP error、invalid response、invalid SSE JSON 都返回结构化错误。
- adapter 默认使用 config 中的 model、thinking enabled 和 reasoning effort，同时允许单次请求覆盖。

暂不做：

- 不接入 UI composer。
- 不把 streamed output 写入 run events。
- 不开放会返回完整 `Authorization` header 的 request builder；请求细节只允许在注入的 fake fetch 内验证。
- 不实现 retry、timeout、abort controller 或 rate limit。
- 不实现 tool calling、JSON mode、file upload 或其它 DeepSeek 高级参数。

## Task 3.4：Model Selector

范围：

- 将工作台 header 中的 model control 从单按钮轮换升级为明确的 model selector。
- 仅暴露 Stage 3 支持的模型：
  - `deepseek-v4-flash`
  - `deepseek-v4-pro`
- 默认选中 `deepseek-v4-flash`。
- 选中状态必须清楚，且在中文/English 界面下保持可读。
- composer 的本地模拟 run message 必须继续使用当前选中的 model。
- 不改变 create-run API 的 settings schema；该 API 已能校验 `DeepSeekSettings.model`。

验收：

- 用户可以直接看到两个可选模型，而不是只能通过点击单个按钮猜测切换。
- 切换到 `deepseek-v4-pro` 后，Run 本地模拟消息包含 `deepseek-v4-pro`。
- 切回 `deepseek-v4-flash` 后，Run 本地模拟消息包含 `deepseek-v4-flash`。
- desktop 与 mobile 下 model selector 不溢出、不遮挡 thinking/reasoning controls。
- `rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不接入真实 DeepSeek 请求。
- 不持久化 model preference。
- 不新增模型列表 API。
- 不实现 thinking mode toggle 或 reasoning effort selector 的新交互；它们在 Task 3.5 和 Task 3.6 单独处理。

## Task 3.5：Thinking Mode Toggle

范围：

- 将工作台 header 中的 thinking control 从单按钮开关升级为明确的双态 toggle。
- 仅暴露 DeepSeek V4 支持的 thinking mode：
  - enabled
  - disabled
- 默认选中 enabled，对应 adapter 请求体 `thinking: { type: "enabled" }`。
- disabled 对应 adapter 请求体 `thinking: { type: "disabled" }`。
- 中文界面显示 `开启` / `关闭`，English 界面显示 `Enabled` / `Disabled`。
- composer 的本地模拟 run message 必须继续反映当前 thinking mode。

验收：

- 用户可以直接看到 thinking enabled 与 disabled 两个状态，而不是只能通过单按钮文本判断。
- 切换到 disabled 后，Run 本地模拟消息包含当前 thinking disabled 状态。
- 切回 enabled 后，Run 本地模拟消息包含当前 thinking enabled 状态。
- desktop 与 mobile 下 thinking toggle 不溢出、不遮挡 model selector 或 reasoning controls。
- `rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不接入真实 DeepSeek 请求。
- 不持久化 thinking preference。
- 不调整 `high` / `max` reasoning effort selector；它在 Task 3.6 单独处理。
