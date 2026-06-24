# Sage Agent Plan

## Stage 0: Project Foundation

Goal: create a clean local repository with the governing documents needed to build Sage Agent intentionally.

Deliverables:

- Initialize local git repository on `main`.
- Add `.gitignore`.
- Add `AGENTS.md`.
- Add project README.
- Add plan, spec, task, and decision documents.
- Commit the initial project documents.

Exit criteria:

- `rtk git status --short --branch` shows a clean `main` branch.
- `rtk git log --oneline -1` shows the initialization commit.
- Stage 0 tasks in `docs/TASKS.md` are complete.

## Stage 1: Product Shell

Goal: create the Web First application shell for a Codex desktop-inspired Sage Agent workspace.

Planned deliverables:

- Next.js app scaffold under `apps/web`.
- TypeScript workspace setup.
- Basic app shell with left navigation, center run workspace, and right inspector.
- Static seed data for threads, runs, steps, tool calls, approvals, and artifacts.
- Design tokens for dense, quiet, work-focused UI.

Exit criteria:

- Local dev server starts successfully.
- The first screen is the usable Sage Agent workbench, not a landing page.
- Desktop and mobile layouts avoid overflow and unreadable text.

## Stage 2: Run System and Event Flow

Goal: implement the run-based execution model and live UI update path.

Planned deliverables:

- Shared domain types for Thread, Run, Message, Step, ToolCall, Approval, Artifact, and RunEvent.
- Runtime state store for local MVP use.
- API route to create a run.
- SSE route for run events.
- UI timeline that updates from events.

Exit criteria:

- Creating a run produces visible status, steps, and event updates.
- The right inspector can show timeline, tool calls, approvals, and artifacts.

## Stage 3: DeepSeek V4 Provider

Goal: connect Sage Agent to DeepSeek V4 through a provider adapter.

Planned deliverables:

- DeepSeek provider configuration.
- Support for `deepseek-v4-flash` and `deepseek-v4-pro`.
- Thinking mode toggle, default enabled.
- Reasoning effort selector with `high` and `max`.
- Streaming model output into run events.

Exit criteria:

- A user can submit a prompt and see streamed model output.
- Provider errors are shown clearly in the run UI.
- Model and reasoning settings are visible and persisted locally.

## Stage 4: Multi-Agent MVP

Goal: implement supervisor-led multi-agent behavior with safe tool boundaries.

Planned deliverables:

- Supervisor, Researcher, Builder, and Reviewer agent definitions.
- Orchestrator that creates steps, delegates to sub-agents, and summarizes results.
- Read + Draft tool set.
- Approval flow for write, shell, and external side-effect actions.
- Final artifact creation and reviewer pass.

Exit criteria:

- One user goal can move through supervisor planning, context gathering, builder output, reviewer feedback, and final summary.
- All risky actions produce approval requests before execution.
- The UI makes agent activity, tool calls, and final output understandable.
