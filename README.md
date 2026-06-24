# Sage Agent

Sage Agent 是一个轻量级 Hermes-like agent 工作台。它希望呈现 Codex 桌面端那种专注、密集、可观察的工作体验：用户前台看到一个统一助手，后台由一组小 agent 协作推进任务，并在关键操作前请求 approval。

这是一个商业化项目，不是一次性 demo。项目从一开始就要求清晰文档、可追踪任务、可审计安全边界和稳定的工程质量。

## MVP 目标

- 构建 Web First 的 local single-user agent workspace。
- 使用 Codex desktop-inspired 三栏布局：左侧 threads/runs，中间当前任务工作区，右侧 timeline/tool/artifact/approval inspector。
- 一期只接入 DeepSeek V4。
- 支持 `deepseek-v4-flash` 和 `deepseek-v4-pro`。
- 默认 `deepseek-v4-flash`、thinking enabled、`reasoning_effort: high`。
- UI 只暴露 `high` 和 `max` 两档 reasoning effort。
- 使用 run-based 模型组织任务：Run、Step、ToolCall、Approval、Artifact、Event。
- 先采用 Read + Draft 工具权限；写文件、shell、外部副作用操作都必须 approval。

## 计划架构

```text
apps/web
  Next.js 前端、API routes、SSE event endpoints

packages/runtime
  orchestrator、agent loop、event bus、approval handling

packages/agents
  supervisor、researcher、builder、reviewer

packages/deepseek
  DeepSeek V4 provider adapter

packages/shared
  共享 domain types 和 schemas
```

## MVP Agent Team

- Supervisor：理解用户目标，创建 run plan，分派子任务，汇总最终结果。
- Researcher：读取项目上下文，整理发现。
- Builder：生成实现方案、patch 草稿、文档或 artifact。
- Reviewer：检查风险、遗漏、质量问题和商业化可用性。

## 工作方法

每个小 task 遵循固定流程：

```text
写文档 -> 实现 -> QA 审查 -> 修复或记录 BUG -> 中文 git commit
```

复杂任务可以分派一次性子 agent 协助 research、implementation 或 QA。子 agent 完成明确子任务后立即结束，由主 agent 负责整合结论。

## 文档

- [计划](docs/PLAN.md)
- [规格](docs/SPEC.md)
- [Phase 2 规格](docs/PHASE2_SPEC.md)
- [Stage 1 实施规格](docs/STAGE1_SPEC.md)
- [任务](docs/TASKS.md)
- [决策](docs/DECISIONS.md)
- [BUG 跟踪](docs/BUGS.md)
