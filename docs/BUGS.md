# Sage Agent BUG 跟踪

## 规则

当 QA、review 或实现过程中发现问题时，先判断是否能在当前小 task 内解决。

- 当前可解决：立即修复，并重新验证。
- 当前不适合解决：记录到本文件，后续按优先级处理。

每条 bug 需要包含：

- 编号：`BUG-0001` 递增。
- 状态：`open`、`in_progress`、`blocked`、`fixed`、`wontfix`。
- 严重级别：`P0`、`P1`、`P2`、`P3`。
- 发现阶段：例如 docs、implementation、QA、manual review。
- 影响范围。
- 复现步骤或线索。
- 暂不修复原因。
- 后续处理建议。

## 当前主线

当前规划主线是“本地单用户 v1 收口”。本文件保留历史审计记录和现存缺陷线索，后续新增问题也按 v1 的稳定性、安全边界和发布门禁口径登记。

## 当前 BUG

### 2026-06-29 V2.1-V2.5 QA 后续修复

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：QA / implementation handoff
- 影响范围：`apps/web` Settings / memory / skill dialog 可达性、V2.1 首页态、V2.5 platform extension 共享口径。
- 复现步骤或线索：
  - Settings、记忆和技能弹窗已经声明 `aria-modal`，但关闭按钮、遮罩点击和保存后关闭路径不完全统一，容易绕过焦点回收。
  - V2.1 首屏增加了 `hasSelectedRun` 状态但尚未完整接入渲染分支，默认仍会像已选中 seed run。
  - `packages/shared/src/platform-extension.ts` 与旧 `platform-extension-registry.ts` 同时保留实现，后续维护容易出现登记对象、状态和 audit action 口径漂移。
  - `RunItem` 已新增 `threadId`，但新建 run 的 append helper 还没有写入该字段。
- 修复方式：
  - 统一三个 dialog 的 focus trap、Escape、遮罩关闭、按钮关闭和保存后关闭路径。
  - 让首屏明确区分 agent home 与已选中 run，并保留新建 run 后切换到 run 工作区。
  - 将旧 platform extension registry 文件收敛为兼容 re-export，避免两套实现并存。
- 验证结论：
  - `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 均已通过。
  - Browser QA 复核 `http://localhost:3000`：首屏非空、无 framework overlay、console 无 error / warn，默认是 home 态且未选中 run。
  - Settings modal 复核：焦点进入弹窗后可 Tab 循环，Escape 可关闭并回到 Settings 入口。
  - 390px mobile 复核：无横向溢出，Settings 入口和主工作台仍可读。

### BUG-0001：首屏 hydration mismatch 与桌面滚动容器不符合工作台预期

- 状态：`fixed`
- 严重级别：`P1`
- 发现阶段：manual review
- 影响范围：`apps/web` Product Shell 首屏稳定性与桌面可用性。
- 复现步骤或线索：
  - 打开 `http://localhost:3000/`，页面出现 Next.js `Recoverable Error Hydration failed because the server rendered text didn't match the client`。
  - 右侧 Agent 时间线和 inspector 内容会撑高页面，导致整个页面需要向下滚动。
  - 运行输入框 composer 需要下滑才能看到，不符合 Codex-like desktop workbench 预期。
- 初步原因：
  - audit 时间使用 `toLocaleTimeString`，SSR 与 client 的 locale / timezone 输出可能不同。
  - desktop 根容器未固定为视口高度，conversation / inspector / timeline 缺少内部滚动边界。
- 修复方式：
  - 将 audit 时间从 `toLocaleTimeString` 改为固定 UTC `HH:mm UTC` 格式，避免 SSR/client locale 或 timezone 差异。
  - 将 desktop Product Shell 固定在视口高度内，conversation、inspector 和 Agent 时间线改为内部滚动，composer 保持首屏可见。
  - 移动端恢复页面纵向滚动，避免小屏滚动陷阱。
- 验证结论：
  - `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build` 通过。
  - 临时 Playwright QA 验证 desktop 无 hydration / recoverable console error，composer 首屏可见，desktop 整页不滚动，mobile 无横向溢出且可纵向浏览。

### 2026-06-28 V1.2 高优先级复核

- 审计时间：2026-06-28 CST
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PLAN.md`、`docs/SPEC.md`、`docs/QA_CHECKLIST.md`、`README.md`、`apps/web/src/app/page.tsx`、`apps/web/src/lib/supervisor-runner.ts`、`apps/web/src/lib/deepseek-provider-status.ts`、`apps/web/src/app/api/settings/deepseek/route.ts`、`apps/web/src/app/api/runs/[runId]/supervisor/route.ts`、`packages/runtime/src/read-project-file-tool.ts`、`packages/deepseek/src/config.ts`、`tests/runtime-flows.test.ts`、`tests/deepseek-provider-status.test.ts`、`tests/web-workspace-policy.test.ts`。
- 搜索线索：`BUG`、`FIXME`、`TODO`、`P0`、`P1`、`blocked`、`HACK`、`XXX`。
- 结论：未发现未登记的 open / blocked P0/P1；搜索结果中的 `blocked` 主要是状态枚举、read-only policy 或 reviewer gate 文案，不构成待修复缺陷。
- 备注：现有历史 P1/P2 记录继续保留，当前主线仍围绕 v1 收口和发布门禁推进。

## 高优先级审计记录

### 2026-06-24 Stage 5 P0/P1 审计

- 审计时间：2026-06-24 18:12:27 CST
- 审计 commit：`0823e1f`
- 审计范围：`docs/BUGS.md`、`docs/QA_CHECKLIST.md`、Stage 5 文档、`apps/`、`packages/`、`tests/` 中的高优先级问题线索。
- 搜索线索：`BUG`、`FIXME`、`TODO`、`P0`、`P1`、`blocked`、`fail`、`失败`、`风险`。
- 自动化门禁：本阶段已运行 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`，均通过。
- 结论：未发现未登记的 P0/P1 问题；当前 `docs/BUGS.md` 无 open / blocked bug。
- 备注：搜索结果中的 `failed`、`blocked` 多为 Run/Event 状态、测试分支和 QA checklist 状态定义，不构成待修复 bug。

### 2026-06-24 Stage 5 最终 P0/P1 复核

- 审计时间：2026-06-24 21:04:01 CST
- 审计 commit：`f546d89`
- 复核原因：Task 5.7 补齐最小本地 telemetry/logging 后，重新确认 Stage 5 退出状态。
- 搜索线索：`FIXME`、`TODO`、`P0`、`P1`。
- 自动化门禁：Task 5.7 后已重新运行 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`，均通过。
- 结论：未发现未登记的 P0/P1 / TODO / FIXME 缺陷线索；当前 `docs/BUGS.md` 仍无 open / blocked bug。

### 2026-06-26 Phase 2.5 收尾复核

- 审计时间：2026-06-26 CST
- 审计 commit：本记录随 Phase 2.5 收尾提交归档。
- 审计范围：Phase 2.5 supervisor-led multi-agent run、read-only file tool event contract、Reviewer gate、QA checklist、`tests/runtime-flows.test.ts`。
- 审计发现：
  - read-only file tool 的 `ToolCall.stepId` 需要对应真实 Step；已在当前 task 修复。
  - Supervisor plan 需要作为真实 run event 进入审计流；已在当前 task 修复。
  - multi-agent planning failure 与 Reviewer gate 非 pass 需要落 `run.failed`；已在当前 task 修复。
  - streaming 空输出需要明确失败测试；已在当前 task 补测。
- 自动化门禁：本阶段收尾需重新运行 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check`。
- 结论：当前复核未留下 open / blocked bug；未配置真实 DeepSeek API key 的在线调用回归作为发布前 QA 风险记录在 `docs/QA_CHECKLIST.md`，不作为代码缺陷登记。

### 2026-06-26 Phase 3 启动前复核

- 审计时间：2026-06-26 CST
- 审计 commit：本记录随 Phase 3 文档启动提交归档。
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PLAN.md`、`docs/SPEC.md`、`docs/PHASE2_SPEC.md`、Phase 3 设置体系规划。
- 搜索线索：`open`、`blocked`、`in_progress`、`TODO`、`FIXME`、`Settings`、`API key`、`SAGE_WORKSPACE_ROOT`。
- 结论：当前没有未处理 P0/P1 bug；Phase 2 中明确暂不做的 API key UI 与 Settings 权限配置已转入 `docs/PHASE3_SPEC.md` 规划，不作为 bug 登记。

### 2026-06-27 Task 3.1 启动前复核

- 审计时间：2026-06-27 CST
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PHASE3_SPEC.md`、`apps/web/src/app/page.tsx`、`apps/web/src/app/globals.css`。
- 搜索线索：`open`、`blocked`、`P0`、`P1`、`TODO`、`FIXME`、`待优化`、`Settings`、`copy`、`i18n`、`language`。
- 结论：当前没有未处理 P0/P1 bug；现有侧栏 language settings 是历史 Stage 1 能力，不满足 Phase 3 独立 Settings surface 目标，应在 Task 3.1 中作为功能骨架优化处理，不登记为 bug。

### 2026-06-27 Task 3.2 启动前复核

- 审计时间：2026-06-27 CST
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PHASE3_SPEC.md`、`docs/SPEC.md`、`apps/web/src/app/page.tsx`、`apps/web/src/app/globals.css`。
- 搜索线索：`open`、`blocked`、`P0`、`P1`、`TODO`、`FIXME`、`待优化`、`localStorage`、`sessionStorage`、`settings`、`API key`、`model`、`thinkingEnabled`、`reasoningEffort`。
- 结论：当前没有未处理 P0/P1 bug；Task 3.2 需要把现有 header 中可编辑的 model / thinking / reasoning controls 收敛到 Settings，并添加只保存非敏感偏好的 browser-local persistence。

### 2026-06-27 Task 3.3 启动前复核

- 审计时间：2026-06-27 CST
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PHASE3_SPEC.md`、`docs/SPEC.md`、`packages/deepseek/src/config.ts`、`packages/deepseek/src/api-key.ts`、`apps/web/src/app/api/runs/[runId]/supervisor/route.ts`、`apps/web/src/app/page.tsx`。
- 搜索线索：`provider status`、`readiness`、`connection test`、`API key`、`missing_api_key`、`http_error`、`network_error`、`invalid_response`、`invalid_config`、`Authorization`、`token`、`secret`。
- 结论：当前没有未处理 P0/P1 bug；Task 3.3 需要以后端安全摘要和结构化结果展示 DeepSeek provider 状态，并避免前端直接拿到完整凭据。

### 2026-06-27 Task 3.4 启动前复核

- 审计时间：2026-06-27 CST
- 审计范围：`docs/BUGS.md`、`docs/TASKS.md`、`docs/PHASE3_SPEC.md`、`docs/SPEC.md`、`docs/PHASE2_SPEC.md`、`packages/runtime/src/read-project-file-tool.ts`、`apps/web/src/app/page.tsx`、`apps/web/src/app/globals.css`。
- 搜索线索：`workspace root`、`read-only`、`blocked_path`、`SAGE_WORKSPACE_ROOT`、`.env`、`.git/`、`node_modules/`、`.next/`、`dist/`、`build/`、`coverage/`、`tmp/`。
- 结论：当前没有未处理 P0/P1 bug；Task 3.4 需要把 runtime read-only file policy 与 Settings 的可见说明对齐，但不暴露敏感文件内容。

### 2026-06-27 Settings 弹窗左侧大块留白

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：manual review
- 影响范围：`apps/web` Settings dialog 的桌面可读性。
- 复现步骤或线索：
  - 打开 `http://localhost:3000/`
  - 打开 Settings
  - 在桌面截图里，左侧区域出现一大片空白，视觉重心偏右。
- 修复方式：
  - 将 Settings dialog 改成两列独立堆叠布局，避免单列内容把大块空白留在左侧。
  - 去掉卡片内部的 `space-between`，改为顶部自然堆叠，减少视觉空洞。
- 验证结论：
  - 重新打开 `http://localhost:3000/` 并展开 Settings 后，左侧大块留白已消失，General、Workspace、Provider、Safety 的信息都能按预期阅读。

### 2026-06-28 Phase 4 runner/helper 承接断层风险

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：docs review
- 影响范围：`apps/web/src/lib/supervisor-runner.ts`、`packages/runtime`、`docs/PLAN.md`、`docs/TASKS.md` 的 multi-agent 承接一致性。
- 复现步骤或线索：
  - 当前 `supervisor-runner.ts` 已经直接组装 multi-agent step、message、artifact 和 final summary 事件。
  - 同时 `packages/runtime` 里又存在 `createDelegationFlow`、approval helper、artifact helper、final summary gate 等独立 helper。
  - 如果 Phase 4 继续推进而不明确谁是唯一 source of truth，后续很容易出现重复逻辑或 UI / runtime 口径不一致。
- 修复方式：
  - `packages/runtime/src/orchestrator.ts` 的 `createDelegationFlow` 增加 `builderContextNotes`，让 runtime 成为 multi-agent 纯函数输出的 source of truth。
  - `apps/web/src/lib/supervisor-runner.ts` 改为消费 `createDelegationFlow` 的 `supervisorPlan`、`researcherBrief`、`builderDraft`、`reviewerReport`、`finalSummaryGate`，不再分别重复调用 agent 纯函数。
  - runner 仍负责把结构化输出转换为真实 run events，维持现有 UI / SSE / runtime store 合同。
- 验证结论：
  - `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过。

### 2026-06-28 Phase 4 UI 仍以 seed data 解释 multi-agent

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：docs review
- 影响范围：`apps/web/src/app/page.tsx` 的 multi-agent 展示、`docs/QA_CHECKLIST.md` 的 Phase 4 验收。
- 复现步骤或线索：
  - 打开 `http://localhost:3000/`
  - 查看当前 run 的 multi-agent 区域，能看到 Supervisor / Researcher / Builder / Reviewer 的静态 seed 文案。
  - 这些文案仍然主要是阶段性示意，而不是从 `supervisor-runner` 真实事件和 helper 输出里直接派生的 UI 状态。
- 暂不修复原因：
  - 需要把当前 Phase 4 的 UI 对齐任务拆成独立实现项，避免一次性重写工作台。
- 后续处理建议：
  - 已改为由 `apps/web/src/lib/phase4-summary.ts` 从 phase4 相关 runtime events / helper 输出派生可读状态。
- 后续若继续扩展 multi-agent 面板，应沿用该 summary helper，而不要回到静态 seed data。

### 2026-06-28 Stage 5 收口复核

- 状态：`fixed`
- 严重级别：`P1`
- 发现阶段：QA
- 影响范围：`apps/web/src/app/page.tsx` 的 provider error 展示与本地 cancel / provider error 反馈状态同步。
- 复现步骤或线索：
  - 在 Stage 5 收口复核中，真实 `run.failed` 事件会被页面展示为本地模拟错误文案，而不是后端返回的安全错误内容。
  - 本地 cancel / provider error 事件会更新审计轨迹，但左侧 run history 可能不同步成 `已取消` 或 `失败`。
- 修复方式：
  - `run.failed` 优先透传 `payload.error`，仅在空值时 fallback 到本地安全文案。
  - 本地 cancel / provider error 追加事件后同步调用 run history reducer 更新左侧状态。
- 验证结论：
  - 已通过 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check`。
  - Browser QA 复核后，Cancel / Retry / Provider Error 的提示与左侧 run 状态同步更新。
  - `GET /api/settings/deepseek` 与 `POST /api/settings/deepseek` 在线检查均返回 provider ready / connection test succeeded。

### 2026-06-28 V2.1 壳层复核

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：implementation / QA
- 影响范围：`apps/web` 的首页态组织、composer 固定感、窄屏可读性。
- 复现步骤或线索：
  - V2.1 壳层改造后，首屏会更明显地展示 sidebar home/overview、workspace 分层和 launchpad 卡片。
  - 在 390px 视口下，如果壳层布局压得过紧，composer 的贴底感和 launchpad 视觉节奏可能受影响。
- 修复方式：
  - 通过 CSS 调整 `sidebar-hero`、`workspace-launchpad` 和 `composer` 的布局密度，保留现有 run 流和 inspector。
- 验证结论：
  - `rtk pnpm --filter web lint` 通过。
  - `rtk pnpm --filter web build` 通过。
  - 浏览器核对确认桌面视口和窄屏视口均保持可读，无明显 runtime error。

### 2026-06-28 V2.2 记忆底座 QA 复核

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：QA
- 影响范围：`@sage/shared` memory domain、`@sage/runtime` memory registry/context、`apps/web` memory API / workbench UI、supervisor prompt 注入。
- 复现步骤或线索：
  - Task V2.2 实现后，QA 需要确认记忆不是只停留在 UI 层，而是可跨会话持久化、可审计、可读写删，并能进入 supervisor 上下文。
  - 只读 QA 发现 `docs/TASKS.md` 状态未勾选，持久化测试也只覆盖同实例读取，不能充分证明重启后可恢复。
- 修复方式：
  - 将 `tests/memory-registry.test.ts` 的持久化测试补成“写入后重新创建 registry，再从同一 storagePath 读取”。
  - 同步 `docs/TASKS.md`、`docs/SPEC.md`、`docs/PLAN.md` 的 V2.2 完成状态。
  - Browser QA 通过工作台新建 / 展示 / 删除一条 QA memory，确认列表、反馈和 audit trail 正常。
- 验证结论：
  - 重新运行 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check`。
  - Browser QA 确认 `http://localhost:3000/` 首屏非空、无 framework overlay、console 无 error / warn，记忆 CRUD 与审计反馈正常。

### 2026-06-28 V2.3 技能系统 QA 复核

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：QA
- 影响范围：`@sage/shared` skill domain、`@sage/runtime` skill registry/context、`apps/web` skill API / workbench UI、supervisor prompt 注入。
- 复现步骤或线索：
  - V2.3 初版需要确认技能不是只停留在 UI 层，而是本地持久化、可审计、可人工 curated，并且只有 curated skill 能进入 supervisor 上下文。
  - QA 发现两个当前可修复边界：坏的 `.sage/skill-registry.json` 不能静默覆盖；客户端不能通过 `POST/PUT` 伪造 `curated` 或 agent actor。
  - Browser QA 还发现 inspector 窄宽度下技能行操作按钮被挤压成不可读的高按钮。
- 修复方式：
  - `PersistentSkillRegistry` 读取无效 JSON 或 schema 时先备份为 `.invalid-*`，备份失败则显式抛错，避免后续保存覆盖坏文件。
  - Web skill API 强制 `POST/PUT` 写入 `draft/user`，启用 / 停用只能走 `PATCH`，`PATCH/DELETE` audit actor 也固定为 `user`。
  - 技能编辑弹窗移除直接选择 `curated` 的入口，只保留来源、内容、标签和原因；保存后必须通过列表“启用”按钮人工 curation。
  - 调整技能 / 记忆行 CSS，确保 inspector 内操作按钮在窄宽度下仍保持可读尺寸。
- 验证结论：
  - 重新运行 `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check`。
  - Browser QA 确认 `http://localhost:3000/` 首屏非空、无 framework overlay、console 无 error / warn，技能新建、启用、停用、删除和审计反馈正常。
  - `/api/skills` QA 后 `entries` 为空，只保留本地审计记录；`.sage/` 被 git ignore，不进入提交。

### 2026-06-28 V2.4 Provider Registry 与入口 QA 复核

- 状态：`fixed`
- 严重级别：`P2`
- 发现阶段：implementation / QA
- 影响范围：`@sage/shared` provider domain、`@sage/runtime` provider registry、`apps/web` settings API / run API / supervisor route / Settings UI。
- 复现步骤或线索：
  - V2.4 需要确认 provider registry 不是只停留在路线图里，而是进入共享类型、settings API、run settings、supervisor dispatch 边界和工作台 Settings。
  - 需要确认当前仍只有 DeepSeek 一个真实 provider，自动 fallback 明确 disabled，不假装存在第二 provider。
- 修复方式：
  - 新增 provider registry、fallback rule 和 Web active / Desktop planned entry surface 的共享类型与 runtime helper。
  - `/api/settings/deepseek` 返回 `providerRegistry` 和 `entrySurfaces`，并保持 DeepSeek 连接测试脱敏。
  - 新建 run 写入 `providerId: deepseek`；偏好 schema 增加 `providerId` 并兼容旧本地偏好。
  - supervisor route 对未知 provider 生成可审计 `unsupported_provider` 失败事件，不静默 fallback 到 DeepSeek。
  - Settings 增加 provider registry、fallback disabled、DeepSeek descriptor 和 entry surfaces 展示。
- 验证结论：
  - `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 已通过。
  - Browser QA 确认 `http://localhost:3000/` 首屏非空、无 framework overlay、console 无 app error / warn。
  - Settings 英文和中文均能显示 provider registry、fallback disabled、Web active / Desktop planned。
  - 390px mobile viewport 下 Settings 无横向溢出，provider registry 面板可读。
