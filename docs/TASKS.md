# Sage Agent 任务

## 工作规则

每个小 task 都必须走完整闭环：

- [ ] 先更新相关文档，明确目标、边界和验收标准。
- [ ] 再实现当前 task，不做无关扩展。
- [ ] 做 QA 审查；复杂 task 分派独立 QA 子 agent。
- [ ] 当前可修复 bug 当下修复；暂不修复 bug 记录到 `docs/BUGS.md`。
- [ ] task 完成后使用中文提交一次 git。

任务分块原则：

- 每个 task 只对应一个清晰交付物。
- 单个 task 应能在一次上下文内完成文档、实现、QA、提交。
- 如果任务跨越多个阶段，先拆分再执行。

## Stage 0：项目地基

- [x] 初始化 `main` 分支本地 git 仓库。
- [x] 添加 `.gitignore`。
- [x] 添加 `AGENTS.md`。
- [x] 添加 `README.md`。
- [x] 添加 `docs/PLAN.md`。
- [x] 添加 `docs/SPEC.md`。
- [x] 添加 `docs/TASKS.md`。
- [x] 添加 `docs/DECISIONS.md`。
- [x] 添加 `docs/BUGS.md`。
- [x] 创建初始化 commit。
- [x] 将项目治理文档统一为中文，并补充商业化、子 agent、QA、BUG 跟踪和中文提交规范。

## Stage 1：Product Shell

- [x] 锁定 Stage 1 技术选型与验收标准。
- [x] 选择 package manager 和 workspace layout。
- [x] Scaffold `apps/web`。
- [x] 添加 TypeScript configuration。
- [x] 选择 UI styling approach。
- [x] 建立 Codex desktop-inspired app shell。
- [x] 添加 threads、runs、events、tools、approvals、artifacts 静态 seed data。
- [x] 添加 `.env.example`。
- [x] 为 Stage 1 关键控件添加本地交互反馈。
- [x] 添加 Settings 中文/English 界面切换，并建立双语文案约束。
- [x] 优化 Settings 移动端视觉，使语言切换更紧凑、对齐且符合商业化设置项质感。
- [x] 根据浏览器视觉反馈 polish Settings 侧栏区域。
- [x] 根据浏览器选区反馈再次 polish Settings 语言切换区域。
- [x] 验证 desktop layout。
- [x] 验证 mobile layout。

## Stage 2：Run System 与 Event Flow

- [x] 编写 `docs/STAGE2_SPEC.md`，锁定 Stage 2 分块策略与 Task 2.1 验收标准。
- [x] 定义 shared domain types。
- [x] 添加 local runtime state store。
- [x] 编写 Task 2.3 create-run API 范围与验收标准。
- [x] 添加 create-run API。
- [x] 编写 Task 2.4 SSE event endpoint 范围与验收标准。
- [x] 添加 SSE event endpoint。
- [x] 编写 Task 2.5 event-driven timeline 范围与验收标准。
- [x] 渲染 event-driven timeline。
- [x] 编写 Task 2.6 inspector event-derived panels 范围与验收标准。
- [x] 在 inspector 中渲染 tool calls、approvals、artifacts。

## Stage 3：DeepSeek V4 Provider

说明：本节是已完成的历史 Stage 3 provider 任务记录；当前 Phase 3 任务以本文件下方 “Phase 3：产品化设置与本地配置体系” 章节和 `docs/PHASE3_SPEC.md` 为准。

- [x] 编写 `docs/STAGE3_SPEC.md`，锁定 Stage 3 分块策略与 Task 3.1 验收标准。
- [x] 添加 provider configuration。
- [x] 编写 Task 3.2 API key environment handling 范围与验收标准。
- [x] 添加 API key environment handling。
- [x] 编写 Task 3.3 DeepSeek V4 adapter 范围与验收标准。
- [x] 实现 DeepSeek V4 adapter。
- [x] 编写 Task 3.4 model selector 范围与验收标准。
- [x] 添加 model selector。
- [x] 编写 Task 3.5 thinking mode toggle 范围与验收标准。
- [x] 添加 thinking mode toggle。
- [x] 编写 Task 3.6 reasoning effort selector 范围与验收标准。
- [x] 添加 `high` / `max` reasoning effort selector。
- [x] 编写 Task 3.7 streamed output run events 范围与验收标准。
- [x] 将 streamed model output 写入 run events。
- [x] 编写 Task 3.8 provider error display 范围与验收标准。
- [x] 在 UI 中清楚展示 provider errors。

## Stage 4：Multi-Agent MVP

说明：本节记录的是 Stage 4 已完成的本地类型、纯函数、模拟编排与文档基础；真实 runtime 中的 supervisor-led multi-agent run 仍以 Phase 2 清单为准。

- [x] 编写 `docs/STAGE4_SPEC.md`，锁定 Stage 4 分块策略与 Task 4.1 验收标准。
- [x] 添加 Supervisor agent。
- [x] 添加 Researcher agent。
- [x] 添加 Builder agent。
- [x] 添加 Reviewer agent。
- [x] 添加 orchestrator delegation flow。
- [x] 添加 Read + Draft tool set。
- [x] 添加 writes、shell commands、external side effects 的 approval flow。
- [x] 添加 final artifact flow。
- [x] 在 final summary 前添加 reviewer pass。

## Stage 5：商业化质量加固

说明：本节记录的是 Stage 5 已完成的本地质量基础；真实 provider、read-only tool、多 agent run 的商业化验收仍以 Phase 2 及后续 release checklist 为准。

- [x] 编写 `docs/STAGE5_SPEC.md`，锁定 Stage 5 分块策略与 Task 5.1 验收标准。
- [x] 完善 error states、empty states、loading states。
- [x] 添加 cancel / retry 行为。
- [x] 完善 run history 和 audit trail。
- [x] 建立最小可行 telemetry/logging。
- [x] 添加关键测试。
- [x] 建立手动 QA checklist。
- [x] 清理 `docs/BUGS.md` 中高优先级问题。
- [x] 修复首屏 hydration mismatch 和桌面工作台滚动容器。

## Phase 2：真实 Run Loop 最小闭环

- [x] 编写 `docs/PHASE2_SPEC.md`，锁定 Phase 2 分块策略与 Task 2.1 验收标准。
- [x] 将 composer 接入 create-run / stream-output / events API。
- [x] 接入 Supervisor-only DeepSeek 调用。
- [x] 将 DeepSeek streamed output 转换为 run events。
- [x] 文档化 read-only file tool 的触发方式、安全边界、事件顺序和验收标准。
- [x] 添加 read-only file tool。
- [x] 文档化 supervisor-led multi-agent run 的事件链路与验收标准。
- [x] 扩展到 supervisor-led multi-agent run。

## Phase 3：产品化设置与本地配置体系

说明：本节是当前 active phase；`Task 3.x` 指 Phase 3 Settings 与本地配置体系任务，不再引用历史 `docs/STAGE3_SPEC.md` 的 provider 任务编号。

- [x] Task 3.0：补齐 Phase 3 规划文档、任务拆分、设置安全策略和 QA checklist。
- [x] Task 3.1：添加独立 Settings 入口与 Settings 页面 / 面板骨架。
- [x] Task 3.2：将语言、默认模型、thinking、reasoning effort 集中到 Settings，并添加非敏感偏好持久化。
- [x] Task 3.3：展示 DeepSeek provider 配置状态，并添加安全连接测试。
- [x] Task 3.4：展示 workspace root 与 read-only file tool 安全边界说明。
- [ ] Task 3.5：完成 Phase 3 QA、BUG 复核和阶段收尾。
