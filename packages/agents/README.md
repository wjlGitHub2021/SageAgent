# `@sage/agents`

Stage 4 开始承载 Sage Agent 的 agent definitions。

当前包含：

- `supervisorAgent`：Supervisor agent 的职责、权限边界和 handoff 目标。
- `createSupervisorPlan(goal)`：本地纯函数 planning，返回 Researcher、Builder、Reviewer 和最终 Supervisor 汇总步骤。
- `researcherAgent`：Researcher agent 的职责、只读权限边界和无直接 handoff 策略。
- `createResearcherBrief(input)`：本地纯函数 research brief，整理目标、建议阅读路径、已知约束和交接说明。
- `builderAgent`：Builder agent 的职责、草稿权限边界和无直接 side effects 策略。
- `createBuilderDraft(input)`：本地纯函数 builder draft，整理实现说明、patch plan、artifact 草稿和安全提示。
- `reviewerAgent`：Reviewer agent 的职责、审查权限边界和 final synthesis 前检查策略。
- `createReviewerReport(input)`：本地纯函数 reviewer report，整理验收标准、findings、risks、missing checks 和 review decision。

边界：

- 不调用 LLM。
- 不执行工具。
- 不写文件、不运行 shell、不发起外部副作用请求。
