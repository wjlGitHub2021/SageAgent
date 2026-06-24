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
