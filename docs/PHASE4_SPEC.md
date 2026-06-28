# Phase 4 规格：Multi-Agent 产品化承接

## 目标

Phase 4 的目标不是继续发明新的 agent 类型，而是把现有的 multi-agent 纯函数基础、approval helper、artifact helper 和 final summary gate 串成真正可审计、可验证、可接 UI 的产品化闭环。

Phase 4 继续沿用 Read + Draft 安全边界；写文件、shell、外部副作用必须走 approval。Phase 4 也继续沿用 Stage 2 的 run/event 模型和 Stage 3 的 provider settings，不允许绕过 run events 更新 UI。

## 现状基线

当前仓库已经具备：

- `@sage/agents`：`supervisorAgent`、`researcherAgent`、`builderAgent`、`reviewerAgent` 与对应纯函数 `createSupervisorPlan` / `createResearcherBrief` / `createBuilderDraft` / `createReviewerReport`。
- `@sage/runtime`：`createDelegationFlow`、Read + Draft tool registry、approval helper、final artifact helper、final summary gate。
- `apps/web/src/lib/supervisor-runner.ts`：真实 supervisor run 已经写入 read-only context pass、multi-agent pass、artifact、step、message、run.completed / run.failed 事件。
- `tests/`：已有 agent/orchestrator、approval、artifact、final summary gate、runtime flow 的单元测试。

Phase 4 要做的是：把这些基础能力整理成一套当前 phase 的任务顺序，并补齐 UI / runtime / QA 的承接。

## 推荐任务拆分

### Task 4.1：Phase 4 基线对齐

范围：

- 说明当前已经完成的 multi-agent、approval、artifact、final summary 基础能力。
- 明确 Phase 4 的真正空缺：事件化承接、UI 可读性、QA 和文档一致性。
- 统一 `docs/PLAN.md`、`docs/TASKS.md`、`docs/STAGE4_SPEC.md`、`docs/SPEC.md` 的口径，避免把已完成的 Stage 4 纯函数能力当成未完成工作。
- 已完成：`createDelegationFlow` 作为 multi-agent 纯函数 source of truth 的基础已经落地；runner 也已开始消费该输出。
- 已完成：`apps/web/src/lib/phase4-summary.ts` 已把 reviewer gate、final summary gate、artifact summary 和 phase4 相关状态接入 UI 可读状态，不再依赖静态 seed data 解释当前 run。

验收：

- 文档能准确区分“已完成基础”和“当前待做承接”。
- Phase 4 的后续 task 能从文档里直接读出。

### Task 4.2：事件承接与 UI 对齐

范围：

- 检查 `apps/web/src/lib/supervisor-runner.ts`、runtime store、inspector、timeline、artifact 面板是否已经消费 Phase 4 helper。
- 若已有 helper 但未被主链路使用，则补上接入；若已在测试覆盖中存在，则补文档和 QA。
- 确保 reviewer gate、final summary、artifact summary、approval 状态在 UI 中可理解。
- 优先明确 source of truth：`apps/web/src/lib/supervisor-runner.ts` 继续组装事件，还是下沉到 `packages/runtime` 统一产出事件；在未明确之前不要重复实现两套逻辑。
- 当前阶段仍由 `apps/web/src/lib/supervisor-runner.ts` 组装 run events，但 multi-agent 的纯函数输入已经收敛到 `packages/runtime`。
- 需要补齐的 UI 面向内容包括：reviewer gate 的可读状态、final summary gate 的阻断说明、multi-agent artifact 摘要、以及 approval / artifact / step 之间的关联显示。

验收：

- 用户在工作台里能看懂 multi-agent 进度、审批和最终总结。
- UI 和 runtime 事件状态一致。
- runner/helper 的职责边界明确，不再出现重复组装。
- 界面中不再只依赖 seed data 解释 multi-agent 阶段，而是能从真实 event / helper 输出中读取核心状态。

### Task 4.3：Phase 4 QA 与 BUG 收尾

范围：

- 更新 `docs/QA_CHECKLIST.md` 的 Phase 4 条目。
- 搜索当前阶段的 P0 / P1 / 明显 P2 风险。
- 能修复的当场修复，不能修复的写入 `docs/BUGS.md`。
- 如果 Phase 4 过程中发现 runner/helper 重复逻辑，优先记录为架构性风险或在同一 task 内做唯一 source of truth 收敛，不要让 UI 和 runtime 双写事件。
- 当前已修复 runner/helper 重复调用 agent 纯函数的问题。

验收：

- Phase 4 对应的 QA 状态可信。
- `docs/BUGS.md` 只保留真实待处理项。

## 优先检查的风险

- `apps/web/src/lib/supervisor-runner.ts` 已经绕过部分 helper 自己组装事件，容易和 `@sage/runtime` 的 helper 产生重复逻辑。
- `docs/TASKS.md` 里 Stage 4 仍是“已完成的历史本地类型基础”口径，和当前 Phase 4 目标不一致。
- `docs/STAGE4_SPEC.md` 与 `docs/SPEC.md` 当前描述的边界需要重新对齐，避免后续实现继续引用旧任务表。
- `packages/runtime` 的 helper 已存在，但未必都被主 UI 直接消费；这类“已实现但未承接”的能力需要通过任务显式收口。

## 建议的下一步

先更新 `docs/PLAN.md`、`docs/TASKS.md`、`docs/QA_CHECKLIST.md`，再决定 Phase 4 的下一个实现 task 是“runner/helper 去重补强”还是“继续扩展 phase4 summary 细节”。
