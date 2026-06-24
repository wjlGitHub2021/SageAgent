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

## Task 5.5：手动 QA Checklist

范围：

- 新增 `docs/QA_CHECKLIST.md`，作为商业化质量加固阶段的人工验收入口。
- Checklist 覆盖本地环境、自动化门禁、UI 双语、响应式布局、run/audit、approval 安全边界、agent 编排、DeepSeek 配置、BUG 记录。
- 明确每个检查项的状态字段，支持 `pass`、`fail`、`blocked`、`n/a`。
- 明确发现问题后如何记录到 `docs/BUGS.md`，避免手动 QA 只停留在口头结论。
- 不在本 task 执行完整人工验收，只建立可复用 checklist 和执行规则。

验收：

- `docs/QA_CHECKLIST.md` 存在，并能让后续执行者按步骤完成手动验收。
- Checklist 包含中文/English UI 切换、desktop/mobile、approval、安全边界、provider error、audit trail、关键命令。
- `docs/TASKS.md` 标记“建立手动 QA checklist”完成。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不要求本 task 完成所有人工 QA 记录。
- 不引入外部测试管理系统。
- 不新增 screenshot artifact 到仓库。
- 不修改产品 UI 或 runtime 行为。

## Task 5.6：高优先级 BUG 清理

范围：

- 审查 `docs/BUGS.md` 中是否存在 open / blocked 的 P0/P1 问题。
- 搜索仓库中的 `BUG`、`FIXME`、`TODO`、`P0`、`P1`、`blocked` 等线索，确认是否有未登记的高优先级问题。
- 对当前可解决的 P0/P1 立即修复；当前无法解决的必须补充阻塞原因和后续处理建议。
- 若没有发现高优先级问题，在 `docs/BUGS.md` 写入本次审计记录，包含日期、commit、检查范围、命令和结论。
- 不把普通失败状态文案、测试断言里的 blocked 分支误判为 bug。

验收：

- `docs/BUGS.md` 明确记录当前 P0/P1 审计结论。
- `docs/TASKS.md` 标记“清理 `docs/BUGS.md` 中高优先级问题”完成。
- 仓库搜索未发现未记录的 P0/P1 / TODO / FIXME 缺陷线索。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不把低优先级改进项强行升格为 P0/P1。
- 不为了清空 BUG 文档而删除真实问题。
- 不执行完整手动 QA checklist；完整人工验收另行按 `docs/QA_CHECKLIST.md` 运行。

## Task 5.7：最小本地 Telemetry / Logging

范围：

- 在 `@sage/runtime` 添加本地 in-memory telemetry logger，用于记录 API / runtime 边界的最小诊断事件。
- telemetry event 至少包含 id、sequence、name、level、source、message、runId、threadId、metadata、createdAt。
- metadata 必须做敏感 key 脱敏，避免记录 API key、authorization、token、secret、password 等值。
- 在 `apps/web` 的 create-run、run events SSE、stream output API 边界记录本地 telemetry 事件。
- telemetry 只保存在本地进程内，不写磁盘、不发外部请求、不引入第三方 telemetry 服务。

验收：

- `@sage/runtime` 导出 telemetry logger 和 metadata sanitization helper。
- API 入口成功和拒绝路径都能记录本地 telemetry 事件。
- 单元测试覆盖事件顺序、过滤、最大数量裁剪和敏感 metadata 脱敏。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不接 OpenTelemetry、Sentry、Logtail 或任何远程日志服务。
- 不做文件日志、数据库日志或跨进程持久化。
- 不在 UI 中展示 telemetry 面板。
- 不记录完整 prompt、model response、API key 或用户私密内容。

## Task 5.8：首屏水合与桌面滚动容器修复

范围：

- 修复 Product Shell 首屏 hydration mismatch，避免 SSR 与 client 因本地化时间格式不同产生 Recoverable Error。
- 桌面端保持工作台式固定视口：整体页面不应因为右侧 inspector 或消息列表变长而滚动。
- 中间 conversation 使用内部滚动，composer 必须在 1440x900 等桌面首屏可见。
- 右侧 inspector 使用内部滚动；Agent 时间线作为独立滑动列表，避免撑高整个页面。
- 移动端继续允许页面纵向滚动，避免小屏出现不可达内容或滚动陷阱。
- 不接真实 DeepSeek provider，不改变 run system，不新增依赖。

验收：

- 打开 `http://localhost:3000/` 不出现 Next.js hydration mismatch / Recoverable Error overlay。
- 1440x900 desktop 下左、中、右三栏在首屏内稳定，composer 不需要页面下滑即可看到。
- Agent 时间线内容较长时在自身列表内滚动，不带动整个页面滚动。
- 390x844 mobile 下仍可纵向浏览全部内容，无横向溢出。
- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。

暂不做：

- 不实现真实 prompt 输入和发送链路。
- 不新增 API key 设置页。
- 不改 DeepSeek API adapter 的环境变量配置方式。
- 不把当前本地 seed UI 改成完整后端驱动 UI。
