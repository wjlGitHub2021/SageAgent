# Sage Agent Tasks

## Stage 0: Project Foundation

- [x] Initialize local git repository on `main`.
- [x] Add `.gitignore`.
- [x] Add `AGENTS.md`.
- [x] Add `README.md`.
- [x] Add `docs/PLAN.md`.
- [x] Add `docs/SPEC.md`.
- [x] Add `docs/TASKS.md`.
- [x] Add `docs/DECISIONS.md`.
- [x] Create initial commit.

## Stage 1: Product Shell

- [ ] Choose package manager and workspace layout.
- [ ] Scaffold `apps/web`.
- [ ] Add TypeScript configuration.
- [ ] Add UI styling approach.
- [ ] Build Codex desktop-inspired app shell.
- [ ] Add static seed data for threads, runs, events, tools, approvals, and artifacts.
- [ ] Verify desktop layout.
- [ ] Verify mobile layout.

## Stage 2: Run System and Event Flow

- [ ] Define shared domain types.
- [ ] Add local runtime state store.
- [ ] Add create-run API.
- [ ] Add SSE event endpoint.
- [ ] Render event-driven timeline.
- [ ] Render tool calls, approvals, and artifacts in the inspector.

## Stage 3: DeepSeek V4 Provider

- [ ] Add provider configuration.
- [ ] Add API key environment handling.
- [ ] Implement DeepSeek V4 adapter.
- [ ] Add model selector.
- [ ] Add thinking mode toggle.
- [ ] Add reasoning effort selector with `high` and `max`.
- [ ] Stream model output into run events.
- [ ] Show provider errors in the UI.

## Stage 4: Multi-Agent MVP

- [ ] Add Supervisor agent.
- [ ] Add Researcher agent.
- [ ] Add Builder agent.
- [ ] Add Reviewer agent.
- [ ] Add orchestrator delegation flow.
- [ ] Add Read + Draft tool set.
- [ ] Add approval flow for writes, shell commands, and external side effects.
- [ ] Add final artifact flow.
- [ ] Add reviewer pass before final summary.
