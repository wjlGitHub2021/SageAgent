# `@sage/agents`

Stage 4 开始承载 Sage Agent 的 agent definitions。

当前包含：

- `supervisorAgent`：Supervisor agent 的职责、权限边界和 handoff 目标。
- `createSupervisorPlan(goal)`：本地纯函数 planning，返回 Researcher、Builder、Reviewer 和最终 Supervisor 汇总步骤。

边界：

- 不调用 LLM。
- 不执行工具。
- 不写文件、不运行 shell、不发起外部副作用请求。
