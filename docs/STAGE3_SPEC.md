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
