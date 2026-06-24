# `@sage/runtime`

Sage Agent 的 runtime package。

当前 runtime 提供 local single-user 的 in-memory state store 和 Stage 4 最小编排基础：

- `RuntimeSnapshot`：统一保存 threads、runs、messages、steps、tool calls、approvals、artifacts 和 events。
- `createMemoryRuntimeStore`：创建内存 store。
- `RuntimeStore.appendEvent`：写入 run event，并根据事件 payload 更新对应实体。
- `createDelegationFlow`：Stage 4 最小 orchestrator delegation flow，串联 Supervisor、Researcher、Builder、Reviewer 的纯函数输出。
- `READ_DRAFT_TOOL_DEFINITIONS`：Stage 4 Read + Draft tool registry，定义只读和草稿工具的 agent 权限与 approval 分类。
- `createApprovalRequest` / `resolveApproval`：Stage 4 最小 approval flow helper，生成和处理 side-effect approval 对象，但不执行动作。

当前不包含真实 agent loop、API handler、SSE endpoint、数据库持久化、工具执行器、approved action execution 或 DeepSeek provider 调用。
