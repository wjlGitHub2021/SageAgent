# Sage Agent 手动 QA Checklist

## 使用规则

本 checklist 用于 Sage Agent MVP 的商业化质量验收。执行者应在每次 release candidate、阶段完成或重要 UI/runtime 变更后按本文件检查。

当前主线是“本地单用户 v1 收口”。历史 Stage / Phase 记录保留为基线，当前验收继续围绕稳定性、可读性、安全边界和发布门禁展开。

## 最小回归步骤

1. 运行自动化门禁。
2. 启动本地 dev server。
3. 打开 `http://localhost:3000`。
4. 确认三栏工作台、Settings 双语切换、空态、busy / cancel / retry、provider error、安全边界和 run history 都能正常显示。
5. 检查记忆底座和技能库：新建一条本地条目，确认列表、审计、删除反馈正常；技能必须先保存为 draft，再通过启用按钮进入 curated。
6. 至少确认一次 English 界面下技能来源、状态、操作和审计文案不直接暴露原始枚举。
7. 只要发现 P0 / P1，就先修复或写入 `docs/BUGS.md`，不要继续往下走发布流程。

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
| QA-ENV-01 | `rtk pnpm --version` | 使用项目约定的 pnpm 主版本，当前为 11.x | pass | 2026-06-28 `rtk pnpm --version` returned 11.7.0 |
| QA-ENV-02 | `rtk git status --short --branch` | 位于目标分支，除当前 QA 记录外无意外脏文件 | pass | 2026-06-28 `main...origin/main` clean before this QA edit |
| QA-ENV-03 | `.env.example` | 不包含真实 API key 或敏感凭据 | pass | `.env.example` contains blank key and safe defaults only |
| QA-ENV-04 | `docs/TASKS.md` | 当前主线任务状态与实际进度一致 | pass | `docs/TASKS.md` now shows the v1收口 task group plus completed historical baselines |
| QA-ENV-05 | `docs/BUGS.md` | 高优先级问题有状态、影响和后续处理建议 | pass | `docs/BUGS.md` contains fixed P1/P2 records and no open P0/P1 |

## 1. 自动化门禁

| ID | 命令 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-AUTO-01 | `rtk pnpm test` | 关键单元测试全部通过 | pass | 2026-06-28 and 2026-06-28 follow-up runs both passed |
| QA-AUTO-02 | `rtk pnpm run typecheck` | TypeScript 类型检查通过 | pass | 2026-06-28 and 2026-06-28 follow-up runs passed |
| QA-AUTO-03 | `rtk pnpm lint` | ESLint 通过，无新增 lint error | pass | 2026-06-28 and 2026-06-28 follow-up runs passed |
| QA-AUTO-04 | `rtk pnpm build` | workspace packages 与 Next.js build 通过 | pass | 2026-06-28 and 2026-06-28 follow-up builds passed |
| QA-AUTO-05 | `rtk git diff --check` | 无 trailing whitespace 或 patch 格式问题 | pass | 2026-06-28 and 2026-06-28 follow-up checks passed |

## 1.5 启动与 smoke check

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SMOKE-01 | 本地启动 | `rtk pnpm dev` 可以启动本地 dev server | pass | README 中的启动步骤与当前实现一致 |
| QA-SMOKE-02 | 入口页 | 打开 `http://localhost:3000` 直接进入三栏 workbench | pass | 页面不是 landing page |
| QA-SMOKE-03 | 最小可用性 | 左侧 threads / runs、中间 composer、右侧 inspector 都可见 | pass | 用来判断本地工作台是否已经可用 |
| QA-SMOKE-04 | 语言切换 | Settings 可切换中文 / English | pass | smoke check 的最低门槛之一 |
| QA-SMOKE-05 | 安全边界提示 | README 和 UI 都说明 `.env.local`、API key 和 read-only 边界 | pass | 不要求真实 API key 才能完成 smoke check |

## 1.6 Hermes-like 壳层 QA

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SHELL-01 | sidebar 首页态 | 左侧有更强的 home / overview 组织，但不新增多余入口 | pass | 由 browser QA 复核 |
| QA-SHELL-02 | workspace 分层 | 中间区域存在更明确的 agent home / current run 分层 | pass | 由 browser QA 复核 |
| QA-SHELL-03 | composer 锚点 | composer 在 desktop 下稳定贴底，滚动时仍保持可见性 | pass | `web` lint/build 后浏览器核对通过 |
| QA-SHELL-04 | 既有状态保留 | run、timeline、approvals、artifacts、provider error 不丢失 | pass | 浏览器核对无回归 |
| QA-SHELL-05 | 窄屏回归 | 390px 宽度下仍保持可读，不出现明显 runtime error | pass | 浏览器核对无明显异常 |

## 1.7 记忆与技能底座 QA

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-CONTEXT-01 | 记忆 CRUD | 新建、展示、删除记忆后列表和审计反馈正常 | pass | V2.2 browser QA 已覆盖 |
| QA-CONTEXT-02 | 技能 draft 保存 | 新建技能后只能以 draft/user 进入列表，不直接 curated | pass | V2.3 browser QA 和 route tests 已覆盖 |
| QA-CONTEXT-03 | 技能人工 curation | 列表中的启用 / 停用按钮能产生 enable / disable 审计 | pass | V2.3 browser QA 已覆盖 |
| QA-CONTEXT-04 | 技能 supervisor 注入 | 只有 curated skill 会进入 supervisor context，draft / disabled 不注入 | pass | `tests/skill-registry.test.ts` 覆盖 curated-only context |
| QA-CONTEXT-05 | 技能坏文件恢复 | 无效 `skill-registry.json` 会先备份为 `.invalid-*`，不会被保存覆盖 | pass | `tests/skill-registry.test.ts` 覆盖 |
| QA-CONTEXT-06 | 技能双语展示 | 中文 / English 下技能来源、状态、操作和审计文案走 copy 字典 | pass | V2.3 UI 已补齐本地化映射 |

## 2. UI 工作台与双语

验证 URL：`http://localhost:3000`

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-UI-01 | 首屏信息架构 | 左侧 threads/runs、中间 current run、右侧 inspector 同时可见 | pass | 2026-06-28 in-app browser QA confirmed three-column layout remains visible at first viewport |
| QA-UI-02 | 视觉密度 | 页面像工作台，不像 landing page；没有大面积装饰性 hero | pass | 2026-06-28 in-app browser QA confirmed compact workbench layout without hero-style framing |
| QA-UI-03 | 中文默认界面 | 默认显示中文导航、按钮、状态文案 | pass | 2026-06-28 browser QA confirmed default Chinese copy on first load |
| QA-UI-04 | English 切换 | 点击 `English` 后主要导航、面板、按钮、状态文案切换 | pass | 2026-06-28 in-app browser QA confirmed English copy swap in Settings and workbench labels |
| QA-UI-05 | 中文切回 | 点击 `中文` 后界面恢复中文，状态不丢失 | pass | 2026-06-28 in-app browser QA confirmed Chinese copy restored without losing run/settings state |
| QA-UI-06 | 文案溢出 | 中英文长文案不遮挡、不挤压、不横向溢出 | pass | 2026-06-28 browser QA confirmed no clipping or horizontal overflow in mixed-length copy |
| QA-UI-07 | 桌面布局 | 1440x900 下三栏稳定，inspector 面板可读 | pass | 2026-06-28 browser QA confirmed stable desktop three-column layout and readable inspector |
| QA-UI-08 | 移动布局 | 390x844 下无横向滚动，面板按顺序可读 | pass | Stage 5.3 Browser QA confirmed no horizontal overflow |

## 3. Run、Audit 与状态表达

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-RUN-01 | runs 切换 | 点击不同 run 后，中间标题和右侧派生信息更新 | pass | Stage 5.3 Browser QA confirmed run-1839 switch updates current run and audit |
| QA-RUN-02 | audit summary | 显示最后事件、最后更新时间、events/tools/approvals/artifacts 计数 | pass | Stage 5.3 now shows localized last event, raw event type, timestamp, and counts from events |
| QA-RUN-03 | audit 可读性 | 中文和 English 下 label/value 不粘连、不截断关键数字 | pass | Browser QA confirmed Chinese / English audit labels and values remain readable |
| QA-RUN-04 | empty states | 无 tool/approval/artifact/provider error 时显示 title + detail | pass | 2026-06-28 browser QA confirmed empty state cards for provider error and the relevant empty-state components are present in UI code |
| QA-RUN-05 | loading state | 点击 Run 后按钮进入短暂 running/disabled 状态 | pass | 2026-06-28 browser QA confirmed run busy state and disabled composer during request start; stateBlock rendered as expected in code |
| QA-RUN-06 | cancel feedback | busy 状态下 Cancel 可用，点击后追加取消反馈 | pass | Browser QA confirmed busy -> cancel -> local cancelled hint |
| QA-RUN-07 | retry feedback | provider error 出现后 Retry 可用，点击后追加重试反馈 | pass | Browser QA confirmed provider error -> retry -> local retry feedback |
| QA-RUN-08 | provider error | 模拟 provider error 后显示失败来源、状态、安全错误和下一步 | pass | Browser QA confirmed localized safe error text and next-step content |

## 4. Approval 与安全边界

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SAFE-01 | Read + Draft 默认边界 | 读文件、计划、patch 草稿、artifact 草稿不需要 approval | pass | Covered by runtime tool definitions and read-only tool tests |
| QA-SAFE-02 | 写文件 approval | `write_file` 类动作必须产生 approval request | pass | Covered by approval-flow tests and runtime event fixtures |
| QA-SAFE-03 | shell approval | `run_shell` 类动作必须产生 approval request | pass | Covered by approval-flow tests and runtime event fixtures |
| QA-SAFE-04 | external request approval | 外部副作用请求必须产生 approval request | pass | Covered by approval-flow rules and event model constraints |
| QA-SAFE-05 | approval 信息完整 | requesting agent、reason、action、payload summary、status、resolvedAt 可追踪 | pass | Covered by approval-flow tests and approval panel rendering |
| QA-SAFE-06 | approve/reject | 审批处理后状态清楚，不重复处理已完成 approval | pass | Covered by approval-flow tests and approval UI state handling |
| QA-SAFE-07 | 敏感信息 | provider error 和 API key 状态不泄露完整凭据 | pass | Covered by provider status tests, browser QA, and safe error rendering |

## 5. Multi-Agent 编排

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-AGENT-01 | Supervisor plan | Supervisor 先拆解目标和验收标准 | pass | Covered by `createSupervisorPlan` / `createDelegationFlow` tests and live multi-agent run layout |
| QA-AGENT-02 | Researcher brief | Researcher 只做上下文整理，不执行写入或副作用 | pass | Covered by agent/orchestrator tests and read-only tool boundary |
| QA-AGENT-03 | Builder draft | Builder 生成实现/patch/artifact 草稿，不直接越权写入 | pass | Covered by builder draft tests and approval boundary checks |
| QA-AGENT-04 | Reviewer gate | final summary 前必须有 Reviewer pass 或明确 blocked 原因 | pass | Covered by final summary gate tests and phase 4 UI state |
| QA-AGENT-05 | Timeline | agent timeline 能反映 agent、状态和关键动作 | pass | Confirmed in browser QA on `/` run timeline panel |
| QA-AGENT-06 | Artifacts | final artifacts 能区分 plan、patch、document、summary、link | pass | Confirmed in browser QA and phase 4 artifact summary tests |

## 6. DeepSeek Provider 设置

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-DS-01 | 默认模型 | 默认 `deepseek-v4-flash` | pass | `tests/deepseek-provider.test.ts` confirms safe default config and UI settings show `deepseek-v4-flash` as default |
| QA-DS-02 | 可选模型 | 只暴露 `deepseek-v4-flash` 和 `deepseek-v4-pro` | pass | `apps/web/src/app/page.tsx` and provider tests confirm only the two allowed models are surfaced |
| QA-DS-03 | thinking 默认 | 默认 thinking enabled | pass | `tests/deepseek-provider.test.ts` confirms `thinkingEnabled: true` in safe defaults |
| QA-DS-04 | reasoning effort | UI 只暴露 `high` / `max`，默认 `high` | pass | `tests/deepseek-provider.test.ts` confirms default `high`; UI segmented control only exposes `high` / `max` |
| QA-DS-05 | base URL | 默认 `https://api.deepseek.com`，拒绝 insecure URL；可用 `rtk pnpm test -- tests/deepseek-provider.test.ts` 验证配置规则 | pass | Task 3.3 tests + 2026-06-28 online connection check |
| QA-DS-06 | 无 API key 行为 | 无 key 时不发真实请求，提示安全可理解 | pass | Task 3.3 tests + 2026-06-28 browser/settings connection check |

## 6.5 Phase 3 Settings

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-SET-01 | Settings 入口 | 工作台中有清晰可发现的 Settings 入口 | pass | Task 3.1 browser QA |
| QA-SET-02 | Settings 分区 | 至少展示 General、Provider、Workspace、Safety 分区 | pass | Task 3.1/3.4 browser QA |
| QA-SET-03 | 双语覆盖 | Settings 标题、说明、按钮、错误状态支持中文/English | pass | Task 3.1/3.2/3.3 browser QA |
| QA-SET-04 | 非敏感偏好持久化 | 语言、默认模型、thinking、reasoning effort 刷新后保持 | pass | Task 3.2 tests + browser QA |
| QA-SET-05 | API key 安全 | 前端不显示、不存储完整 API key，只展示已配置/未配置或脱敏状态 | pass | Task 3.3 tests + browser QA |
| QA-SET-06 | 连接测试 | 缺 key 不发真实请求；失败和成功都有清楚、脱敏反馈 | pass | Task 3.3 tests + browser QA |
| QA-SET-07 | Workspace 说明 | workspace root 与 read-only file tool 允许/拒绝规则可见 | pass | Task 3.4 tests |
| QA-SET-08 | 响应式布局 | Settings 在 desktop/mobile 下可读、可操作、无横向溢出 | pass | Task 3.1/3.3/3.4 QA；已复查桌面 Settings 留白问题 |

## 6.6 Phase 4 Multi-Agent 产品化承接

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-4-01 | 任务口径 | `docs/PHASE4_SPEC.md` 明确 Phase 4 的现状、目标和任务拆分 | pass | 已新增 Phase 4 规格文档 |
| QA-4-02 | 现状对齐 | `docs/STAGE4_SPEC.md` 与当前实现事实不冲突 | pass | 已恢复为历史 Stage 4 规格 |
| QA-4-03 | 主链路承接 | multi-agent helper 的后续 task 能明确指向 UI / runtime / QA 承接 | pass | Phase 4 规格已改写为承接型路线图 |
| QA-4-04 | 风险可见 | 已识别 runner/helper 重复逻辑、文档口径不一致、承接断层等风险 | pass | 已在 Phase 4 规格和 BUG 文档中列出并部分收敛 |
| QA-4-05 | UI 真实状态 | reviewer gate / final summary gate / artifact summary 已接入真实可读状态，不再只靠 seed data 说明 | pass | Phase 4 live state 面板已直接读取 runtime events / helper 输出 |
| QA-4-06 | 事件派生 | multi-agent 核心状态从 runtime event 派生，而不是只看静态文案 | pass | phase4 summary helper 仅汇总 phase4 相关 step / artifact / gate 结果 |

## 6.7 V2.4 Provider Registry 与入口

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-PROVIDER-01 | Registry 快照 | `/api/settings/deepseek` 返回 `providerRegistry` 和 `entrySurfaces` | pass | V2.4 route / status tests 覆盖 |
| QA-PROVIDER-02 | 默认 provider | 新建 run 的 settings 明确包含 `providerId: deepseek` | pass | V2.4 create-run tests 覆盖 |
| QA-PROVIDER-03 | Fallback 边界 | UI 明确显示自动 fallback 未开启，不假装存在第二 provider | pass | V2.4 Settings UI 与 docs 决策记录覆盖 |
| QA-PROVIDER-04 | Entry surfaces | UI 展示 Web active / Desktop planned，且声明共享 run/provider/state 模型 | pass | V2.4 Settings UI 覆盖 |
| QA-PROVIDER-05 | 双语与响应式 | Provider registry 和 entry surface 文案支持中文/English，Settings 窄屏可读 | pass | 2026-06-28 Browser QA 覆盖 desktop / 390px mobile；无横向溢出 |

## 6.8 V2.5 平台扩展登记面板

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-EXT-01 | Registry 快照 | Settings 中显示 cron、voice、profiles、remote login、gateway / messaging、auto update 的只读登记信息 | pass | 2026-06-28 browser DOM QA confirmed platform extension panel renders in Settings |
| QA-EXT-02 | 状态表达 | 条目状态明确标出 planned / blocked / proposed，且不伪装成已实现 | pass | `tests/platform-extension.test.ts` locks the registry shape and statuses |
| QA-EXT-03 | 双语文案 | 中文 / English 都能看到平台扩展登记标题、边界说明和未实现提示 | pass | `tests/platform-extension-ui.test.ts` checks both locales in `apps/web/src/app/page.tsx` |
| QA-EXT-04 | 安全边界 | 面板只读展示，不提供调度、语音、网关、远程登录或自动更新执行入口 | pass | 2026-06-28 browser DOM QA confirmed read-only snapshot-only copy |
| QA-EXT-05 | 与现有入口分离 | V2.5 registry 不覆盖 V2.4 entry surfaces，两个合同同时存在且可读 | pass | `apps/web/src/lib/deepseek-provider-status.ts` now returns `entrySurfaces` and `platformExtensions` separately |

## 7. BUG 记录与退出标准

| ID | 检查项 | 期望 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| QA-BUG-01 | 失败项记录 | 每个 `fail` / `blocked` 都有 `BUG-xxxx` 记录 | pass | 当前无 fail / blocked 退出项 |
| QA-BUG-02 | 严重级别 | 每个 bug 标注 P0/P1/P2/P3 | pass | `docs/BUGS.md` 现有记录覆盖 |
| QA-BUG-03 | 复现线索 | 每个 bug 有复现步骤或足够线索 | pass | `docs/BUGS.md` 现有记录覆盖 |
| QA-BUG-04 | 处理建议 | 每个 bug 有当下修复、延期或阻塞说明 | pass | `docs/BUGS.md` 现有记录覆盖 |
| QA-BUG-05 | 退出标准 | P0/P1 均已 fixed 或明确 blocked，P2/P3 有后续处理建议 | pass | 当前 `docs/BUGS.md` 无未处理 P0/P1 |

## 当前主线最小通过标准

- `QA-AUTO-01` 到 `QA-AUTO-05` 全部 pass。
- `QA-SMOKE-01` 到 `QA-SMOKE-05` 全部 pass。
- `QA-SHELL-01` 到 `QA-SHELL-05` 全部 pass。
- `QA-UI-03` 到 `QA-UI-08` 全部 pass。
- `QA-RUN-02`、`QA-RUN-03`、`QA-RUN-08` 全部 pass。
- `QA-SAFE-01` 到 `QA-SAFE-07` 全部 pass 或有明确 blocked 记录。
- `QA-AGENT-04` pass。
- `QA-DS-01` 到 `QA-DS-04` pass。
- `QA-BUG-01` 到 `QA-BUG-05` 全部 pass。
- `docs/BUGS.md` 中没有未处理的 P0/P1；P2/P3 必须有后续处理建议。

## 当前主线：v1 收口 QA 口径

- 本 checklist 继续作为当前主线的验收入口，但不再暗示还有新的平台阶段要展开。
- 现有空态、loading、run history、settings、安全边界和双语项继续作为 v1 的稳定性门禁。
- 新增任何 v1 task 前，先检查 `docs/BUGS.md` 和本文件里是否已有可复用的失败线索或待优化项。

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

## 2026-06-28 Stage 5 收口复核

- 日期：2026-06-28
- 执行者：Codex
- Commit：本次复核随当前工作区改动记录，尚未提交
- 环境：`http://localhost:3000`，Next.js 本地 dev server
- 浏览器：in-app browser
- 结论：pass
- 自动化门禁：`rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过
- 主要风险：未在真实 DeepSeek 网络可用环境下复跑在线连接；当前验证覆盖本地 UI、run/audit、cancel/retry、provider error、Settings 与响应式状态
- 主要风险：当前连接测试依赖本机服务端环境变量；本轮已通过本地 `/api/settings/deepseek` 在线检查确认 provider ready
- BUG 记录：本次复核未新增 P0/P1；已修复真实 provider error 透传与本地 cancel/provider error 的 run history 状态同步
- 备注：桌面首屏三栏可见，Settings 双语切换正常，Cancel / Retry / Provider Error 交互有明确反馈，左侧 run 状态与审计轨迹同步更新，DeepSeek 连接测试成功

## 2026-06-28 Stage 5 UI / Safe QA 补齐

- 日期：2026-06-28
- 执行者：Codex
- Commit：待提交
- 环境：`http://localhost:3000`，Next.js 本地 dev server
- 浏览器：in-app browser
- 结论：pass
- 自动化门禁：`rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过
- 主要风险：当前空态与 loading 的可视化证据来自同一套页面和实现检查；部分状态在当前活跃 run 里不会同时呈现，需要依赖空态设计与代码路径确认
- BUG 记录：本次补齐未新增 P0/P1
- 备注：已确认 UI 首屏三栏、桌面密度、English/中文切换、长文案不溢出、run busy 状态、审批安全边界、provider error 安全文案与 run history 状态同步

## 2026-06-29 V2.1-V2.5 后续回归复核

- 日期：2026-06-29
- 执行者：Codex
- Commit：`3acfec0`
- 环境：`http://localhost:3000`，Next.js 本地 dev server
- 浏览器：in-app browser
- 结论：pass
- 自动化门禁：`rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过
- 主要风险：Browser QA 主要覆盖本地 dev server 的首屏、Settings 模态和 390px 响应式；未在真实 DeepSeek 在线请求下重复验证
- BUG 记录：`docs/BUGS.md` 的 2026-06-29 回归记录已更新为 fixed，并补齐验证结论
- 备注：首屏默认是 home 态，未选中 run；Settings 弹窗 Tab / Escape 闭环正常；390px 下无明显横向溢出
