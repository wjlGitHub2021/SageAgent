# Sage Agent

Sage Agent is a lightweight Hermes-like agent workspace. It aims to feel like a Codex desktop-style workbench: a local, focused UI where one visible assistant coordinates a small team of agents, shows its work, asks for approval before risky actions, and produces useful artifacts.

## MVP Goals

- Build a Web First local single-user agent workspace.
- Use a Codex desktop-inspired layout with threads/runs on the left, task conversation in the center, and timeline/tool/artifact details on the right.
- Use DeepSeek V4 as the only LLM provider in the first release.
- Support `deepseek-v4-flash` and `deepseek-v4-pro`.
- Default to `deepseek-v4-flash`, thinking enabled, and `reasoning_effort: high`.
- Expose only `high` and `max` reasoning effort options in the UI.
- Model work as runs, steps, tool calls, approvals, artifacts, and events.
- Start with Read + Draft tools; require approval for writes, shell commands, and external side effects.

## Planned Architecture

```text
apps/web
  Next.js frontend, API routes, SSE event endpoints

packages/runtime
  orchestrator, agent loop, event bus, approvals

packages/agents
  supervisor, researcher, builder, reviewer

packages/deepseek
  DeepSeek V4 provider adapter

packages/shared
  shared domain types and schemas
```

## MVP Agent Team

- Supervisor: understands the user goal, creates the run plan, delegates work, and summarizes the final result.
- Researcher: reads files and gathers context.
- Builder: drafts implementation plans, patches, documents, or artifacts.
- Reviewer: checks risks, missing requirements, and quality before final handoff.

## Documentation

- [Plan](docs/PLAN.md)
- [Spec](docs/SPEC.md)
- [Tasks](docs/TASKS.md)
- [Decisions](docs/DECISIONS.md)
