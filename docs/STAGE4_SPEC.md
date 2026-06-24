# Stage 4 实施规格

## 目标

Stage 4 的目标是实现 Sage Agent 的 supervisor-led multi-agent MVP。前台仍是一个统一任务入口，后台逐步具备 Supervisor、Researcher、Builder、Reviewer 的职责边界、step 计划和可审计事件流。

Stage 4 必须延续 Stage 2 的 Run System 和 Stage 3 的 provider settings，不允许绕过 run events 更新 UI。

## 分块策略

Stage 4 按以下小 task 推进：

1. 添加 Supervisor agent。
2. 添加 Researcher agent。
3. 添加 Builder agent。
4. 添加 Reviewer agent。
5. 添加 orchestrator delegation flow。
6. 添加 Read + Draft tool set。
7. 添加 writes、shell commands、external side effects 的 approval flow。
8. 添加 final artifact flow。
9. 在 final summary 前添加 reviewer pass。

每个小 task 都要先更新文档，再实现，再 QA，最后中文提交。

## Agent 边界

- Supervisor：理解目标、创建计划、决定子 agent 顺序、汇总最终结果。
- Researcher：读取本地上下文、整理发现和约束，不执行写入。
- Builder：生成草稿、patch plan、artifact 内容，不默认写入。
- Reviewer：检查规格一致性、安全边界、风险和遗漏。

## 安全边界

Stage 4 仍采用 Read + Draft 权限模型：

- 默认允许：读上下文、生成计划、生成草稿、生成 artifact 草稿。
- 必须审批：写文件、运行 shell、外部副作用请求、修改持久状态。
- agent definition 不应直接执行工具；工具执行必须通过后续 orchestrator / tool layer。

## Task 4.1：Supervisor Agent

范围：

- 建立 `@sage/agents` TypeScript package。
- 定义通用 agent definition 类型，至少包含：
  - `role`
  - `displayName`
  - `mission`
  - `allowedActions`
  - `handoffTargets`
- 实现 `supervisorAgent` definition。
- 提供纯函数 `createSupervisorPlan(goal)`，将用户目标拆成 Stage 4 MVP 的 step 草案。
- `createSupervisorPlan` 不调用 LLM、不读写文件、不执行工具，只返回结构化 plan。
- Supervisor plan 至少包含 Researcher、Builder、Reviewer 三类后续 step。

验收：

- `@sage/agents` 能独立 typecheck 和 build。
- root `typecheck`、`lint`、`build` 通过。
- `createSupervisorPlan` 对非空 goal 返回稳定结构，包含 goal、summary、steps。
- 空 goal 返回结构化 `invalid_goal` 错误。
- Supervisor definition 不包含写文件、shell、external request 等 risky action 权限。

暂不做：

- 不实现 Researcher、Builder、Reviewer 的完整 definition。
- 不实现 orchestrator delegation flow。
- 不调用真实 LLM。
- 不接 UI。

## Task 4.2：Researcher Agent

范围：

- 实现 `researcherAgent` definition。
- Researcher 的职责是整理本地上下文需求、约束、风险和下一步交接信息。
- 提供纯函数 `createResearcherBrief(input)`，根据目标、建议阅读路径和已知约束生成结构化 research brief。
- `createResearcherBrief` 不调用 LLM、不读写文件、不执行工具、不联网，只返回结构化 brief。
- Researcher 只拥有 `read_context` 和 `draft_artifact` 权限；不允许写文件、运行 shell、发起外部副作用请求。
- Researcher 不 handoff 给其他 agent；后续交接由 Supervisor / orchestrator 决定。

验收：

- `researcherAgent.role` 为 `researcher`。
- `researcherAgent.allowedActions` 不包含写文件、shell、external request 等 risky action 权限。
- `createResearcherBrief` 对非空 goal 返回稳定结构，至少包含 goal、summary、contextTargets、constraints、handoffNotes。
- `createResearcherBrief` 对空 goal 返回结构化 `invalid_goal` 错误。
- 建议阅读路径需要去重、trim，并过滤空字符串。
- root `typecheck`、`lint`、`build` 通过。

暂不做：

- 不实现真实文件读取。
- 不实现联网 research。
- 不实现 orchestrator delegation flow。
- 不接 UI。

## Task 4.3：Builder Agent

范围：

- 实现 `builderAgent` definition。
- Builder 的职责是基于目标和 Researcher brief 生成实现草稿、patch plan 或 artifact 草稿。
- 提供纯函数 `createBuilderDraft(input)`，根据目标、上下文摘要和约束生成结构化 draft。
- `createBuilderDraft` 不调用 LLM、不读写文件、不执行工具、不联网，只返回结构化 draft。
- Builder 只拥有 `read_context` 和 `draft_artifact` 权限；不允许写文件、运行 shell、发起外部副作用请求。
- Builder 不直接 handoff 给其他 agent；后续 reviewer pass 由 Supervisor / orchestrator 决定。

验收：

- `builderAgent.role` 为 `builder`。
- `builderAgent.allowedActions` 不包含写文件、shell、external request 等 risky action 权限。
- `createBuilderDraft` 对非空 goal 返回稳定结构，至少包含 goal、summary、implementationNotes、constraints、patchPlan、artifactDrafts、safetyNotes。
- `createBuilderDraft` 对空 goal 返回结构化 `invalid_goal` 错误。
- 输入的 context notes / constraints 需要 trim、过滤空字符串、去重。
- root `typecheck`、`lint`、`build` 通过。

暂不做：

- 不生成真实 patch 文件。
- 不写入工作区文件。
- 不实现 approval flow。
- 不调用真实 LLM。
- 不接 UI。

## Task 4.4：Reviewer Agent

范围：

- 实现 `reviewerAgent` definition。
- Reviewer 的职责是检查规格一致性、安全边界、测试覆盖、风险和遗漏。
- 提供纯函数 `createReviewerReport(input)`，根据目标、draft 摘要、验收标准和检查结果生成结构化 review report。
- `createReviewerReport` 不调用 LLM、不读写文件、不执行工具、不联网，只返回结构化 report。
- Reviewer 只拥有 `read_context` 和 `draft_artifact` 权限；不允许写文件、运行 shell、发起外部副作用请求。
- Reviewer 不直接 handoff 给其他 agent；后续 final summary 由 Supervisor / orchestrator 决定。

验收：

- `reviewerAgent.role` 为 `reviewer`。
- `reviewerAgent.allowedActions` 不包含写文件、shell、external request 等 risky action 权限。
- `createReviewerReport` 对非空 goal 返回稳定结构，至少包含 goal、summary、decision、acceptanceCriteria、findings、risks、missingChecks、safetyNotes。
- `createReviewerReport` 对空 goal 返回结构化 `invalid_goal` 错误。
- findings、risks、missingChecks、acceptanceCriteria 需要 trim、过滤空字符串、去重。
- decision 必须能根据 findings / missingChecks 自动给出 `pass` 或 `needs_changes`。
- root `typecheck`、`lint`、`build` 通过。

暂不做：

- 不执行真实测试命令。
- 不读取真实文件。
- 不实现 final summary flow。
- 不调用真实 LLM。
- 不接 UI。

## Task 4.5：Orchestrator Delegation Flow

范围：

- 在 `@sage/runtime` 中添加最小 orchestrator delegation flow。
- 提供纯函数 `createDelegationFlow(input)`，串联 Supervisor、Researcher、Builder、Reviewer 的本地纯函数输出。
- 输入至少包含 `goal`，可选包含 suggested paths、known constraints、context notes、acceptance criteria、review findings、risks、missing checks。
- flow 必须按 Supervisor -> Researcher -> Builder -> Reviewer 顺序组织，返回结构化结果。
- 任一前置阶段出现 `invalid_goal` 时，flow 返回结构化失败结果，不继续伪造后续阶段。
- 当前 task 只建立 delegation 结构和 agent 输出汇总，不写 runtime store、不写 run events、不执行工具。

验收：

- `createDelegationFlow` 对非空 goal 返回 `ok: true`，包含 supervisor plan、researcher brief、builder draft、reviewer report 和 delegation steps。
- delegation steps 的 agent 顺序必须是 `supervisor`、`researcher`、`builder`、`reviewer`。
- reviewer decision 必须透传到 flow result，便于后续 final summary / event flow 使用。
- `createDelegationFlow` 对空 goal 返回结构化 `invalid_goal` 失败。
- `@sage/runtime` 可以独立 typecheck 和 build。
- root `typecheck`、`lint`、`build` 通过。

暂不做：

- 不写入 `RuntimeStore`。
- 不创建真实 `Step` / `RunEvent`。
- 不调用 DeepSeek provider。
- 不执行 Read + Draft tool set。
- 不实现 approval flow。
- 不接 UI。

## Task 4.6：Read + Draft Tool Set

范围：

- 在 `@sage/runtime` 中添加最小 tool registry。
- 定义一期允许的 Read + Draft tools：
  - `read_project_file`：只读项目文件意图。
  - `draft_patch`：生成 patch 草稿意图。
  - `draft_artifact`：生成 artifact 草稿意图。
- 每个 tool definition 必须包含 name、kind、description、allowedAgents、requiresApproval、approvalAction。
- Read + Draft tools 默认不需要 approval，且 `approvalAction` 必须为 `null`。
- 提供查询函数：
  - `getToolDefinition(name)`
  - `listToolDefinitions()`
  - `canAgentUseTool(agent, toolName)`
  - `requiresToolApproval(toolName)`
- 当前 task 只定义 registry 和权限判断，不执行文件读取、不生成真实 patch、不写 artifact、不写 run events。

验收：

- 三个 Read + Draft tools 均存在且可查询。
- `read_project_file` 只允许 `researcher`、`builder`、`reviewer` 使用。
- `draft_patch` 只允许 `builder` 使用。
- `draft_artifact` 允许 `researcher`、`builder`、`reviewer` 使用。
- 所有 Read + Draft tools 的 `requiresApproval` 为 `false`，`approvalAction` 为 `null`。
- 未知 tool 的查询和权限判断必须返回安全默认值。
- `@sage/runtime` 可以独立 typecheck 和 build。
- root `typecheck`、`lint`、`build` 通过。

暂不做：

- 不读取真实文件内容。
- 不应用 patch。
- 不写 artifact。
- 不实现写文件、shell、external request 等需要 approval 的工具。
- 不接 UI。
