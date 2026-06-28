# Sage Agent 任务

## 工作规则

每个小 task 都必须走完整闭环：

- [ ] 先更新相关文档，明确目标、边界和验收标准。
- [ ] 再实现当前 task，不做无关扩展。
- [ ] 做 QA 审查，复杂 task 分派独立 QA 子 agent。
- [ ] 当前可修复 bug 当下修复；暂不修复 bug 记录到 `docs/BUGS.md`。
- [ ] task 完成后使用中文提交一次 git。

任务分块原则：

- 每个 task 只对应一个清晰交付物。
- 单个 task 应能在一次上下文内完成文档、实现、QA、提交。
- 如果任务跨越多个阶段，先拆分再执行。

## 当前主线：本地单用户 v1 收口

说明：以下任务是当前 active phase。历史 Stage / Phase 已完成，只保留为基线，不再继续扩展成新阶段任务。

### Task V1.1：统一路线图与文档口径

- [x] 更新 `docs/PLAN.md`、`docs/TASKS.md`、`docs/SPEC.md`、`docs/QA_CHECKLIST.md`、`docs/BUGS.md` 对当前 active scope 的描述。
- [x] 收束 Stage / Phase 混用的命名，让新读者一眼看懂历史基线和当前主线。
- [x] 将历史已完成阶段折叠成可追溯的基线说明，避免继续堆叠旧任务。
- [x] 验收标准：路线图能清楚说明 v1 当前做什么、不做什么、下一步是什么。

### Task V1.2：清理剩余 P0 / P1 与高风险回归

- [x] 审查 `docs/BUGS.md` 和当前实现中的高优先级风险。
- [x] 修复当前可解决的问题，不顺手引入新功能。
- [x] 暂不修复的问题必须记录到 `docs/BUGS.md`，并写清楚阻塞原因和后续建议。
- [x] 验收标准：无未处理的 P0 / P1，或者所有阻塞项都有明确说明。

### Task V1.3：发布门禁与 QA 收口

- [x] 整理自动化门禁、手动 QA checklist 和浏览器回归步骤。
- [x] 补齐 README、启动说明、环境变量和安全边界说明的一致性。
- [x] 确认新成员按文档可以完成安装、启动和一次基础 smoke check。
- [x] 验收标准：v1 的安装、启动、基础验证路径清楚且可复现。

### Task V1.4：冻结 v1 范围并准备下一阶段提案

- [x] 明确 v1 不做事项和 v2 候选范围。
- [x] 给未来的新阶段留出提案入口，但不在当前主线展开实现。
- [x] 收口当前文档中的悬空表达，避免 v1 继续向外发散。
- [x] 验收标准：路线图有清晰的 v1 / v2 分界。

### Task V2.1：Web 壳层对齐

- [x] 把当前 Web 界面整理成 Hermes-like 的工作台壳。
- [x] 左侧保留长期导航和对象列表。
- [x] 中间保留当前 run 工作区。
- [x] 底部固定 composer。
- [x] 右侧保留 timeline、tool calls、approvals、artifacts。
- [x] 强化空态首页，让它像一个 agent home，不像普通 dashboard。
- [x] 保持 run 进入后和 empty state 的视觉切换清楚。
- [x] 统一 desktop 与 mobile 的壳层行为。
- [x] 验收标准：Web shell 更接近 Hermes-like 布局，同时不破坏现有 run 流和 inspector 信息。

### Task V2.2：跨会话记忆底座

- [x] 定义记忆对象、范围和审计字段的共享类型。
- [x] 实现本地记忆 registry、CRUD 路由和运行时上下文注入。
- [x] 在工作台中提供记忆列表、编辑和删除入口。
- [x] 验收标准：记忆可以跨会话保留、可读、可写、可删，且能进入 supervisor 上下文。

### Task V2.3：技能系统与自动生长

- [x] 定义技能对象、来源、状态、版本和审计字段的共享类型。
- [x] 实现本地 skill registry、CRUD 路由和 curated skill 上下文注入。
- [x] 在工作台中提供技能列表、编辑、启用 / 停用和删除入口。
- [x] 验收标准：技能可以本地持久化、人工 curated、可读写删，并且启用技能能进入 supervisor 上下文。

## 已完成基线

- [x] Stage 0：项目地基
- [x] Stage 1：Product Shell
- [x] Stage 2：Run System 与 Event Flow
- [x] Stage 3：DeepSeek V4 Provider
- [x] Phase 2：真实 Run Loop 最小闭环
- [x] Phase 3：产品化设置与本地配置体系
- [x] Phase 4：Multi-Agent 产品化承接
- [x] Stage 5：商业化质量加固

## 执行原则

- 先文档，再实现，再 QA。
- 当前只做 v1 收口相关工作，不再新增平台级能力。
- 安全边界、脱敏和审计链路优先于便利性。
