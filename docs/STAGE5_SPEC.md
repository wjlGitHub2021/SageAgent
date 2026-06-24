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
