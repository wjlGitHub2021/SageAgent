# `@sage/runtime`

Sage Agent 的 runtime package。

当前 Stage 2 先提供 local single-user 的 in-memory runtime state store：

- `RuntimeSnapshot`：统一保存 threads、runs、messages、steps、tool calls、approvals、artifacts 和 events。
- `createMemoryRuntimeStore`：创建内存 store。
- `appendEvent`：写入 run event，并根据事件 payload 更新对应实体。

当前不包含真实 agent loop、API handler、SSE endpoint、数据库持久化或 DeepSeek provider 调用。
