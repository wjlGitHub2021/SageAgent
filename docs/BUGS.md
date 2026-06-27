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

## 当前 BUG

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
