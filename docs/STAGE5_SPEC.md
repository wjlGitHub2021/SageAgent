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
