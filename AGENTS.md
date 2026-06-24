# Sage Agent Instructions

## Project

Sage Agent is a Web First, Hermes-like agent workspace with a Codex desktop-inspired UI. The MVP is a local single-user product that coordinates multiple agents behind one task interface.

## Local Rules

- Run shell commands through `rtk`, for example `rtk git status` or `rtk npm test`.
- Prefer TypeScript for product code, shared types, runtime orchestration, and provider adapters.
- Keep the MVP focused on web delivery before any desktop wrapper.
- Do not introduce app code during Stage 0 unless the current task explicitly asks for implementation.

## MVP Direction

- UI: Codex desktop-inspired workbench, not a generic chat page.
- Runtime: supervisor-led multi-agent orchestration.
- Agents: `supervisor`, `researcher`, `builder`, and `reviewer`.
- Provider: DeepSeek V4 only for the first release.
- Default model: `deepseek-v4-flash`.
- Optional model: `deepseek-v4-pro`.
- Default thinking mode: enabled.
- Reasoning effort options exposed in UI: `high` and `max`.
- Default reasoning effort: `high`.

## Safety Boundary

The first release uses a Read + Draft permission model:

- Allowed by default: reading project files, planning, producing summaries, and drafting patches or artifacts.
- Requires approval: writing files, running shell commands, making external side-effect requests, or changing persistent state.
- Every approval request must include the requesting agent, reason, action type, payload summary, status, and resolution timestamp.
- The product is local single-user by default. Do not add hosted multi-user auth, billing, or tenant isolation in the MVP unless explicitly requested.

## Architecture Direction

Documented target structure:

- `apps/web`: future Next.js frontend and API routes.
- `packages/runtime`: future orchestrator, agent loop, event bus, and approval handling.
- `packages/agents`: future supervisor, researcher, builder, and reviewer definitions.
- `packages/deepseek`: future DeepSeek provider adapter.
- `packages/shared`: future shared types such as Run, Step, ToolCall, Approval, Artifact, and Event.

## Documentation

- Keep `docs/PLAN.md` as the phase roadmap.
- Keep `docs/SPEC.md` as the current product and system spec.
- Keep `docs/TASKS.md` as the active execution checklist.
- Keep `docs/DECISIONS.md` as the architecture decision log.
