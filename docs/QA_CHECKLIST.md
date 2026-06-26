# Sage Agent 手动 QA Checklist

## 使用规则

本 checklist 用于 Sage Agent MVP 的商业化质量验收。执行者应在每次 release candidate、阶段完成或重要 UI/runtime 变更后按本文件检查。

状态字段：

- `pass`：已验证通过。
- `fail`：验证失败，必须记录到 `docs/BUGS.md`。
- `blocked`：当前无法验证，必须说明阻塞原因并记录到 `docs/BUGS.md`。
- `n/a`：当前阶段不适用，必须说明原因。

执行规则：

- 手动 QA 前先运行自动化门禁。
- 所有 shell 命令使用 `rtk` 前缀。
- 发现 P0/P1 问题时，不继续 release；先修复或记录明确阻塞。
- 当前可修复的问题在对应 task 内修复；依赖后续链路的问题写入 `docs/BUGS.md`。
- QA 结论必须包含执行日期、执行者、commit、环境、命令结果和遗留风险。

## QA Run 记录模板

```text
日期：
执行者：
Commit：
环境：
浏览器：
结论：pass / fail / blocked
自动化门禁：
主要风险：
BUG 记录：
备注：
```

## 0. 本地环境

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-ENV-01 | `rtk pnpm --version` | 使用项目约定的 pnpm 主版本，当前为 11.x |  |  |
| QA-ENV-02 | `rtk git status --short --branch` | 位于目标分支，除当前 QA 记录外无意外脏文件 |  |  |
| QA-ENV-03 | `.env.example` | 不包含真实 API key 或敏感凭据 |  |  |
| QA-ENV-04 | `docs/TASKS.md` | 当前阶段任务状态与实际进度一致 |  |  |
| QA-ENV-05 | `docs/BUGS.md` | 高优先级问题有状态、影响和后续处理建议 |  |  |

## 1. 自动化门禁

| ID | 命令 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-AUTO-01 | `rtk pnpm test` | 关键单元测试全部通过 |  |  |
| QA-AUTO-02 | `rtk pnpm run typecheck` | TypeScript 类型检查通过 |  |  |
| QA-AUTO-03 | `rtk pnpm lint` | ESLint 通过，无新增 lint error |  |  |
| QA-AUTO-04 | `rtk pnpm build` | workspace packages 与 Next.js build 通过 |  |  |
| QA-AUTO-05 | `rtk git diff --check` | 无 trailing whitespace 或 patch 格式问题 |  |  |

## 2. UI 工作台与双语

验证 URL：`http://localhost:3000`

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-UI-01 | 首屏信息架构 | 左侧 threads/runs、中间 current run、右侧 inspector 同时可见 |  |  |
| QA-UI-02 | 视觉密度 | 页面像工作台，不像 landing page；没有大面积装饰性 hero |  |  |
| QA-UI-03 | 中文默认界面 | 默认显示中文导航、按钮、状态文案 |  |  |
| QA-UI-04 | English 切换 | 点击 `English` 后主要导航、面板、按钮、状态文案切换 |  |  |
| QA-UI-05 | 中文切回 | 点击 `中文` 后界面恢复中文，状态不丢失 |  |  |
| QA-UI-06 | 文案溢出 | 中英文长文案不遮挡、不挤压、不横向溢出 |  |  |
| QA-UI-07 | 桌面布局 | 1440x900 下三栏稳定，inspector 面板可读 |  |  |
| QA-UI-08 | 移动布局 | 390x844 下无横向滚动，面板按顺序可读 |  |  |

## 3. Run、Audit 与状态表达

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-RUN-01 | runs 切换 | 点击不同 run 后，中间标题和右侧派生信息更新 |  |  |
| QA-RUN-02 | audit summary | 显示最后事件、最后更新时间、events/tools/approvals/artifacts 计数 |  |  |
| QA-RUN-03 | audit 可读性 | 中文和 English 下 label/value 不粘连、不截断关键数字 |  |  |
| QA-RUN-04 | empty states | 无 tool/approval/artifact/provider error 时显示 title + detail |  |  |
| QA-RUN-05 | loading state | 点击 Run 后按钮进入短暂 running/disabled 状态 |  |  |
| QA-RUN-06 | cancel feedback | busy 状态下 Cancel 可用，点击后追加取消反馈 |  |  |
| QA-RUN-07 | retry feedback | provider error 出现后 Retry 可用，点击后追加重试反馈 |  |  |
| QA-RUN-08 | provider error | 模拟 provider error 后显示失败来源、状态、安全错误和下一步 |  |  |

## 4. Approval 与安全边界

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SAFE-01 | Read + Draft 默认边界 | 读文件、计划、patch 草稿、artifact 草稿不需要 approval |  |  |
| QA-SAFE-02 | 写文件 approval | `write_file` 类动作必须产生 approval request |  |  |
| QA-SAFE-03 | shell approval | `run_shell` 类动作必须产生 approval request |  |  |
| QA-SAFE-04 | external request approval | 外部副作用请求必须产生 approval request |  |  |
| QA-SAFE-05 | approval 信息完整 | requesting agent、reason、action、payload summary、status、resolvedAt 可追踪 |  |  |
| QA-SAFE-06 | approve/reject | 审批处理后状态清楚，不重复处理已完成 approval |  |  |
| QA-SAFE-07 | 敏感信息 | provider error 和 API key 状态不泄露完整凭据 |  |  |

## 5. Multi-Agent 编排

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-AGENT-01 | Supervisor plan | Supervisor 先拆解目标和验收标准 |  |  |
| QA-AGENT-02 | Researcher brief | Researcher 只做上下文整理，不执行写入或副作用 |  |  |
| QA-AGENT-03 | Builder draft | Builder 生成实现/patch/artifact 草稿，不直接越权写入 |  |  |
| QA-AGENT-04 | Reviewer gate | final summary 前必须有 Reviewer pass 或明确 blocked 原因 |  |  |
| QA-AGENT-05 | Timeline | agent timeline 能反映 agent、状态和关键动作 |  |  |
| QA-AGENT-06 | Artifacts | final artifacts 能区分 plan、patch、document、summary、link |  |  |

## 6. DeepSeek Provider 设置

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-DS-01 | 默认模型 | 默认 `deepseek-v4-flash` |  |  |
| QA-DS-02 | 可选模型 | 只暴露 `deepseek-v4-flash` 和 `deepseek-v4-pro` |  |  |
| QA-DS-03 | thinking 默认 | 默认 thinking enabled |  |  |
| QA-DS-04 | reasoning effort | UI 只暴露 `high` / `max`，默认 `high` |  |  |
| QA-DS-05 | base URL | 默认 `https://api.deepseek.com`，拒绝 insecure URL；可用 `rtk pnpm test -- tests/deepseek-provider.test.ts` 验证配置规则 |  |  |
| QA-DS-06 | 无 API key 行为 | 无 key 时不发真实请求，提示安全可理解 |  |  |

## 6.5 Phase 3 Settings

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SET-01 | Settings 入口 | 工作台中有清晰可发现的 Settings 入口 |  |  |
| QA-SET-02 | Settings 分区 | 至少展示 General、Provider、Workspace、Safety 分区 |  |  |
| QA-SET-03 | 双语覆盖 | Settings 标题、说明、按钮、错误状态支持中文/English |  |  |
| QA-SET-04 | 非敏感偏好持久化 | 语言、默认模型、thinking、reasoning effort 刷新后保持 |  |  |
| QA-SET-05 | API key 安全 | 前端不显示、不存储完整 API key，只展示已配置/未配置或脱敏状态 |  |  |
| QA-SET-06 | 连接测试 | 缺 key 不发真实请求；失败和成功都有清楚、脱敏反馈 |  |  |
| QA-SET-07 | Workspace 说明 | workspace root 与 read-only file tool 允许/拒绝规则可见 |  |  |
| QA-SET-08 | 响应式布局 | Settings 在 desktop/mobile 下可读、可操作、无横向溢出 |  |  |

## 7. BUG 记录与退出标准

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-BUG-01 | 失败项记录 | 每个 `fail` / `blocked` 都有 `BUG-xxxx` 记录 |  |  |
| QA-BUG-02 | 严重级别 | 每个 bug 标注 P0/P1/P2/P3 |  |  |
| QA-BUG-03 | 复现线索 | 每个 bug 有复现步骤或足够线索 |  |  |
| QA-BUG-04 | 处理建议 | 每个 bug 有当下修复、延期或阻塞说明 |  |  |
| QA-BUG-05 | 退出标准 | P0/P1 均已 fixed 或明确 blocked，P2/P3 有后续处理建议 |  |  |

## 当前 Stage 5 最小通过标准

- `QA-AUTO-01` 到 `QA-AUTO-05` 全部 pass。
- `QA-UI-03` 到 `QA-UI-08` 全部 pass。
- `QA-RUN-02`、`QA-RUN-03`、`QA-RUN-08` 全部 pass。
- `QA-SAFE-01` 到 `QA-SAFE-07` 全部 pass 或有明确 blocked 记录。
- `QA-AGENT-04` pass。
- `QA-DS-01` 到 `QA-DS-04` pass。
- `QA-BUG-01` 到 `QA-BUG-05` 全部 pass。
- `docs/BUGS.md` 中没有未处理的 P0/P1；P2/P3 必须有后续处理建议。

## 2026-06-26 Phase 2.5 / Product Shell QA

- 日期：2026-06-26
- 执行者：Codex
- Commit：本 QA 记录随 Phase 2.5 提交一并归档
- 环境：`http://localhost:3000`，Next.js 本地 dev server
- 浏览器：in-app browser
- 结论：pass
- 自动化门禁：`rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过
- 主要风险：当前浏览器验证基于本地 dev server 的静态首屏与响应式检查；未在真实 API key 环境下做 DeepSeek 在线调用回归
- BUG 记录：`BUG-0001` 已 fixed，无新增 P0/P1
- Phase 2.5 契约审查：已补齐 Supervisor plan event、read-only file tool 所属 Step、multi-agent planning failure 的 `run.failed`、Reviewer gate 非 pass 阻塞，以及 streaming 空输出失败测试。
- 备注：桌面首屏 composer 可见，inspector 内部滚动正常；移动端无横向溢出，页面可继续向下浏览，未见 hydration / recoverable console error
