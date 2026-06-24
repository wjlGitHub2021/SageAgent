# Stage 5 实施规格

## 目标

Stage 5 的目标是把 Sage Agent 从可演示 MVP 推进到更接近商业化产品的质量基础。重点是让状态表达、错误处理、审计链路、测试和 QA 记录更可靠、更一致。

Stage 5 必须继续遵守：

- 文档、回复、提交信息默认中文。
- UI 新增文案必须支持中文/English。
- 不为了视觉 polish 改变 runtime 安全边界。
- 小 task 继续按文档 -> 实现 -> QA -> 修复/记录 BUG -> 中文提交推进。

## Task 5.1：Error / Empty / Loading States

范围：

- 统一 inspector 中 empty states 的视觉结构，让暂无工具调用、暂无 provider error、暂无审批、暂无产物更像产品状态，而不是普通灰色占位条。
- 为 provider error 保留清晰的错误层级和下一步提示。
- 为 composer run 添加轻量 loading / busy state，点击后短暂展示本地运行中状态，避免用户以为按钮无反馈。
- 所有新增 UI 文案必须进入 copy 字典，保持中文/English 切换。
- 不接真实 provider，不改变 run system，不新增依赖。

验收：

- Empty states 包含 title 和 detail，desktop / mobile 下不溢出。
- Provider error 显示失败来源、状态、安全错误文案和下一步提示。
- Run 点击后按钮短暂进入 busy/disabled 状态，并恢复可操作。
- 中文和 English 切换后，empty / loading / error 文案都能同步切换。
- `rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不实现 cancel / retry。
- 不做持久化 run history。
- 不引入 toast 系统。
- 不接真实 DeepSeek 请求。

## Task 5.2：Local Cancel / Retry Feedback

范围：

- 为 composer 添加本地 Cancel 操作：仅在本地 busy 状态中可用，用于取消当前模拟 run 反馈。
- 为 provider error 面板添加本地 Retry 操作：仅追加本地模拟 retry message / event，不调用真实 DeepSeek。
- Cancel / Retry 的新增 UI 文案必须进入 copy 字典，保持中文/English 切换。
- Cancel / Retry 必须提供可见反馈，避免用户不知道操作是否生效。
- 不改变真实 runtime/provider 行为，不新增依赖。

验收：

- Run 进入 busy 状态后，Cancel 可见且可点击，点击后 busy 状态结束并追加取消反馈。
- Provider error 出现后，Retry 可见且可点击，点击后追加重试反馈并保留原 provider error 审计信息。
- 中文和 English 切换后，Cancel / Retry 相关文案同步切换。
- `rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不取消真实网络请求。
- 不重试真实 provider。
- 不实现队列级 cancel。
- 不写持久化 run history。

## Task 5.3：Run History / Audit Trail Polish

范围：

- 在 inspector 中添加当前 run 的 audit summary。
- audit summary 从现有 run events 派生，不新增持久化层。
- 展示事件总数、最后事件类型、最后事件时间、tool calls / approvals / artifacts 计数。
- 左侧 runs 列表继续作为 lightweight run history，不改变数据来源。
- 所有新增 UI 文案必须进入 copy 字典，保持中文/English 切换。
- 根据浏览器视觉反馈 polish audit summary，避免中文标签和值挤在一起，让 inspector 信息层级与其他面板一致。

验收：

- 当前 run 的 audit summary 在 inspector 中可见。
- 切换 run 后 audit summary 根据 activeRunId 更新。
- audit summary 不直接依赖手写静态数字，必须从 events 派生。
- audit summary 在中文和 English 下都要清楚区分最后事件、更新时间和统计计数，不能出现标签和值粘连。
- desktop / mobile 下不溢出。
- `rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不做数据库持久化。
- 不做跨 session run history。
- 不接真实 telemetry。
- 不新增图表库。

## Task 5.4：关键自动化测试

范围：

- 添加轻量单元测试框架，用于覆盖当前 MVP 中最关键、最稳定的纯逻辑。
- 测试入口放在根目录脚本，运行前构建 workspace packages，测试已导出的 public API。
- 覆盖 DeepSeek provider 配置、API key、请求/响应解析，不触发真实网络请求。
- 覆盖 runtime store 的 event application、approval flow、tool permission、artifact flow、final summary reviewer gate。
- 覆盖 multi-agent delegation happy path 与 reviewer gate blocked path。
- 不在本 task 引入浏览器 e2e、数据库、真实 DeepSeek 调用或 UI screenshot 测试。

验收：

- 根目录提供 `rtk pnpm test`。
- 单元测试覆盖 provider / runtime / agents 的关键商业化风险点。
- 测试不能依赖外部网络或本机私有环境变量。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不建立完整 e2e 测试矩阵。
- 不测试真实 API key 和真实 DeepSeek 服务。
- 不新增 coverage gate。
- 不把临时截图或测试报告写入仓库。
