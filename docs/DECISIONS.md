# Sage Agent 决策记录

## DEC-0001：Web First MVP

状态：accepted

决策：

Sage Agent 从 Web First local app 开始，而不是 desktop-first app。

理由：

- 第一阶段目标是尽快验证 agent workbench 体验。
- Web 更适合快速实现 Codex desktop-inspired layout、SSE streaming 和本地开发循环。
- 等核心 runtime 和 UI 真正可用后，再考虑 desktop wrapper。

## DEC-0002：TypeScript Primary Stack

状态：accepted

决策：

MVP 使用 TypeScript 作为主语言。

理由：

- 产品有大量 frontend surface。
- shared domain types 可以复用于 UI、API routes、runtime 和 provider adapters。
- Python 后续可作为 specialized tool worker，但不进入 Stage 0。

## DEC-0003：DeepSeek V4 Only for First Release

状态：accepted

决策：

第一版只支持 DeepSeek V4 models。

支持模型：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

默认值：

- Model：`deepseek-v4-flash`
- Thinking mode：enabled
- Reasoning effort：`high`

理由：

- 单 provider 可以让 provider settings、error handling、cost control 和 UI 更简单。
- DeepSeek 的 OpenAI-compatible API 形态便于实现 provider adapter。
- UI 只暴露明确支持的 reasoning effort：`high` 和 `max`。

## DEC-0004：Supervisor-Led Multi-Agent Flow

状态：accepted

决策：

MVP 采用 supervisor-led multi-agent flow，而不是 free-form swarm。

Agent roles：

- Supervisor
- Researcher
- Builder
- Reviewer

理由：

- Supervisor-led orchestration 更容易观察、调试和呈现在 UI 中。
- 职责明确的 agents 更容易评估输出质量。
- Free-form agent collaboration 可以在 run system 和 approval model 稳定后再探索。

## DEC-0005：Read + Draft Permission Model

状态：accepted

决策：

MVP 默认允许 read 和 draft 操作；write、shell command、external side-effect operation 必须 approval。

理由：

- 第一版需要有能力，但不能让用户失去安全感。
- Approval request 能在 risky action 前暴露 agent 意图。
- 该模型符合 local single-user 开发体验，同时保留 auditability。

## DEC-0006：中文优先文档与沟通

状态：accepted

决策：

项目文档、回复、任务说明和 git commit message 默认使用中文。专业英语名词、模型名、API 字段、文件名、目录名和代码标识符可以保留英文。

理由：

- 项目 owner 使用中文推进需求和评审。
- 中文文档能降低沟通损耗。
- 保留必要英文名词可以避免技术概念翻译失真。

## DEC-0007：商业化项目标准

状态：accepted

决策：

Sage Agent 按商业化项目标准推进，而不是 demo 标准。

要求：

- 每个 task 有文档、实现、QA、bug 处理和中文 commit。
- UI、runtime、安全、错误处理、文档都要按长期维护标准设计。
- 暂不修复的问题必须记录在 `docs/BUGS.md`。

理由：

- Agent 产品很容易因上下文过长和边界不清而变复杂。
- 固定工作流可以减少返工和隐性技术债。
- 商业化标准能让项目从第一天就具备可演进性。

## DEC-0008：一次性子 Agent 协作

状态：accepted

决策：

开发 Sage Agent 时，可以分派子 agent 协助 research、implementation、QA 或 review，但每个子 agent 只处理一个明确子任务，完成后即结束。

理由：

- 子 agent 能隔离上下文，尤其适合 QA 和 review。
- 明确生命周期可以避免多个 agent 长期运行导致状态混乱。
- 主 agent 仍负责最终整合、判断和提交。

## DEC-0009：Stage 1 前端技术选型

状态：accepted

决策：

Stage 1 使用 `pnpm` workspace、Next.js App Router、TypeScript 和 Tailwind CSS 初始化 Web app。

默认结构：

- `apps/web`：Next.js 应用。
- `packages/shared`：后续共享类型。
- `packages/runtime`：后续 runtime。
- `packages/agents`：后续 agent definitions。
- `packages/deepseek`：后续 DeepSeek provider adapter。

理由：

- `pnpm` workspace 适合 monorepo，依赖安装快且边界清晰。
- Next.js App Router 能同时承载前端页面和后续 API/SSE endpoints。
- TypeScript 便于共享 Run、Step、ToolCall、Approval、Artifact 等 domain types。
- Tailwind CSS 适合快速构建密集、稳定、可控的工作台 UI。

限制：

- Stage 1 只做静态 product shell，不接真实 DeepSeek。
- Stage 1 不实现真实 agent loop、工具执行或持久化 runtime。

## DEC-0010：Shared Domain Types 作为 Run System 合同

状态：accepted

决策：

Stage 2 从 `@sage/shared` package 开始，先定义 `Thread`、`Run`、`Message`、`Step`、`ToolCall`、`Approval`、`Artifact`、`RunEvent` 等共享 domain types，再实现 runtime store、API 和 SSE。

要求：

- UI、runtime、API、provider adapter 后续都复用 `@sage/shared` 的类型。
- status、agent role、event type、approval action、artifact kind、DeepSeek model 和 reasoning effort 使用共享 union 类型。
- 未完成或暂不存在的字段优先显式建模为 `null`，避免 API consumer 猜测字段缺失含义。
- `run.failed` 必须携带完整 `run` 快照和 `error`；step/tool 失败使用独立失败事件，便于后续 SSE reducer 和 audit UI 稳定处理。

理由：

- Run system 是 Sage Agent 的核心抽象，必须先统一数据合同。
- 共享类型可以减少 UI 与 runtime 各自发明状态形状导致的漂移。
- 明确失败事件和快照语义，能降低后续 event-driven UI 的复杂度。

## DEC-0011：Local In-Memory Runtime Store

状态：accepted

决策：

Stage 2 先在 `@sage/runtime` 中实现 local single-user 的 in-memory runtime state store，负责保存 `RuntimeSnapshot` 并通过 `appendEvent` 把 run events 应用到当前 state。

范围：

- store 只运行在本地进程内，不做数据库、文件持久化或跨进程同步。
- store 使用 `@sage/shared` 的 domain types，不重新定义 Run System entity。
- store 维护 entities 和 event log 两条视角，便于后续 create-run API 与 SSE endpoint 复用。
- `appendEvent` 需要覆盖 completed / failed 等终态事件，让 UI 和 audit trail 可以从同一条 event stream 派生状态。
- `appendEvent` 对重复 `event.id` 必须幂等，避免 SSE 重连或重放造成状态重复累积。

理由：

- 在真实 agent loop 和 provider 接入前，需要一个可测试、可替换的本地状态层。
- in-memory store 足够支撑 MVP 的 local single-user 模式，复杂持久化可以等核心 run flow 稳定后再引入。
- 先把 event reducer 行为放到 runtime package，可以避免 UI 直接承担状态推导责任。

## DEC-0012：DeepSeek Provider Configuration First

状态：accepted

决策：

Stage 3 先实现 `@sage/deepseek` provider configuration，再实现真实 HTTP adapter。

要求：

- 配置读取与校验独立于真实请求，避免 API key 或网络问题阻塞本地开发。
- 缺失 `DEEPSEEK_API_KEY` 在配置阶段只记录为未配置，不抛出阻塞错误。
- model 和 reasoning effort 复用 `@sage/shared` 的 DeepSeek 类型与常量。
- provider package 不直接更新 UI；后续 adapter 输出必须进入 Run Events。

理由：

- provider 边界先稳定，后续 adapter、error handling、streaming event 转换才有可靠输入。
- API key 是敏感信息，配置层必须避免泄露。
- 单 provider 策略可以保持 MVP 简洁，减少过早抽象。

## DEC-0013：Phase 2.2 使用 Web-local Supervisor Runner

状态：accepted

决策：

Phase 2.2 的 Supervisor-only DeepSeek 调用先放在 `apps/web/src/lib/supervisor-runner.ts`，由 `POST /api/runs/:runId/supervisor` route 调用。

原因：

- 当前真实 provider adapter 位于 `@sage/deepseek`，如果把 runner 直接放入 `@sage/runtime`，会让 runtime package 反向依赖 provider package，过早固化分层。
- Web-local runner 可以复用 `@sage/runtime` 的 `RuntimeStore` 和 `@sage/shared` 的事件类型，同时通过依赖注入调用 DeepSeek adapter，便于单元测试成功与失败路径。
- route 只负责 HTTP 边界、环境配置读取和 telemetry，run event 生成逻辑集中在 runner，避免 API handler 膨胀。

约束：

- runner 必须只生成标准 `RunEvent`，不能绕过 runtime store 更新 UI。
- provider error 必须写入 `run.failed`，不能只返回 HTTP 500。
- 错误信息必须脱敏，不输出完整 API key、Authorization header、token、secret 或 password。
- 后续如果 provider/orchestrator 抽象稳定，再考虑把 runner 下沉到 `packages/runtime`。

## DEC-0014：Phase 3 使用独立 Settings Surface

状态：accepted

决策：

Phase 3 开始，Sage Agent 使用独立 Settings 入口与 Settings 页面 / 面板承载产品配置，而不是继续把语言、模型、provider、workspace 和安全说明散落在工作台主界面。

Settings 初始承载：

- General：界面语言和基础偏好。
- Provider：DeepSeek API key 配置状态、base URL、默认模型、thinking、reasoning effort 和连接测试。
- Workspace：workspace root 与 read-only file tool 权限说明。
- Safety：Read + Draft 权限模型、approval 边界和敏感信息处理说明。

约束：

- 前端不得保存完整 API key。
- API key 默认仍来自 server environment。
- 非敏感偏好可以使用 browser-local persistence。
- 连接测试必须由后端读取配置并返回脱敏结果。
- Settings 文案必须进入双语 copy / i18n 资源。

理由：

- Phase 2 已完成真实 run loop，下一步需要让本地用户能理解和配置运行环境。
- 独立 Settings 能降低工作台主界面的认知噪音。
- API key 和 workspace 权限属于高信任配置，必须集中展示安全边界和状态。
- 先做 local single-user Settings，可以为后续 hosted / multi-user 配置体系保留演进空间。

## DEC-0015：v1 收口优先于 v2 展开

状态：accepted

决策：

当前路线图以本地单用户 v1 收口为唯一主线。`docs/PLAN.md` 里的 v2 候选范围只作为未来提案入口，不代表进入执行阶段。

约束：

- 现阶段不把 hosted multi-user、billing、tenant isolation、remote sync、provider marketplace 或自由 swarm 作为当前工作项。
- 若未来要推进这些方向，必须先单独提出新提案，再定义范围、验收和迁移影响。

理由：

- v1 尚未完全收口时继续展开新平台能力，会让文档、QA 和实现口径再次漂移。
- 先把本地单用户产品稳定下来，后续扩展才有清晰基线。
