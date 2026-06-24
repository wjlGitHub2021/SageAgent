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
