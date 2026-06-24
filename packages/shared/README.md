# `@sage/shared`

Sage Agent 的共享 domain types 包。

当前负责导出 Stage 2 run system 所需的数据合同：

- `Thread`
- `Run`
- `Message`
- `Step`
- `ToolCall`
- `Approval`
- `Artifact`
- `RunEvent`

本包只描述跨 UI、runtime、API、provider 共享的数据形状，不包含 runtime store、React 组件、API handler 或真实 provider 调用。
