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
- [ ] Scaffold `apps/web`。
- [ ] 添加 TypeScript configuration。
- [ ] 选择 UI styling approach。
- [ ] 建立 Codex desktop-inspired app shell。
- [ ] 添加 threads、runs、events、tools、approvals、artifacts 静态 seed data。
- [ ] 添加 `.env.example`。
- [ ] 验证 desktop layout。
- [ ] 验证 mobile layout。

## Stage 2：Run System 与 Event Flow

- [ ] 定义 shared domain types。
- [ ] 添加 local runtime state store。
- [ ] 添加 create-run API。
- [ ] 添加 SSE event endpoint。
- [ ] 渲染 event-driven timeline。
- [ ] 在 inspector 中渲染 tool calls、approvals、artifacts。

## Stage 3：DeepSeek V4 Provider

- [ ] 添加 provider configuration。
- [ ] 添加 API key environment handling。
- [ ] 实现 DeepSeek V4 adapter。
- [ ] 添加 model selector。
- [ ] 添加 thinking mode toggle。
- [ ] 添加 `high` / `max` reasoning effort selector。
- [ ] 将 streamed model output 写入 run events。
- [ ] 在 UI 中清楚展示 provider errors。

## Stage 4：Multi-Agent MVP

- [ ] 添加 Supervisor agent。
- [ ] 添加 Researcher agent。
- [ ] 添加 Builder agent。
- [ ] 添加 Reviewer agent。
- [ ] 添加 orchestrator delegation flow。
- [ ] 添加 Read + Draft tool set。
- [ ] 添加 writes、shell commands、external side effects 的 approval flow。
- [ ] 添加 final artifact flow。
- [ ] 在 final summary 前添加 reviewer pass。

## Stage 5：商业化质量加固

- [ ] 完善 error states、empty states、loading states。
- [ ] 添加 cancel / retry 行为。
- [ ] 完善 run history 和 audit trail。
- [ ] 添加关键测试。
- [ ] 建立手动 QA checklist。
- [ ] 清理 `docs/BUGS.md` 中高优先级问题。
