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

- [ ] 完善 error states、empty states、loading states。
- [ ] 添加 cancel / retry 行为。
- [ ] 完善 run history 和 audit trail。
- [ ] 添加关键测试。
- [ ] 建立手动 QA checklist。
- [ ] 清理 `docs/BUGS.md` 中高优先级问题。
