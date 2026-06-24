# Sage Agent Decisions

## DEC-0001: Web First MVP

Status: accepted

Decision:

Sage Agent starts as a Web First local app rather than a desktop-first app.

Reasoning:

- The first product goal is to validate the agent workbench experience quickly.
- Web delivery makes it easier to build the Codex desktop-inspired layout, SSE streaming, and local development loop.
- A desktop wrapper can be added later after the core runtime and UI are useful.

## DEC-0002: TypeScript Primary Stack

Status: accepted

Decision:

TypeScript is the primary language for the MVP.

Reasoning:

- The product has a significant frontend surface.
- Shared domain types can be reused across UI, API routes, runtime, and provider adapters.
- Python remains available later as a worker language for specialized tools, but is not part of Stage 0.

## DEC-0003: DeepSeek V4 Only for First Release

Status: accepted

Decision:

The first release supports only DeepSeek V4 models.

Supported models:

- `deepseek-v4-flash`
- `deepseek-v4-pro`

Defaults:

- Model: `deepseek-v4-flash`
- Thinking mode: enabled
- Reasoning effort: `high`

Reasoning:

- A single provider keeps provider settings, error handling, cost controls, and UI simple.
- DeepSeek's OpenAI-compatible API shape allows a straightforward provider adapter.
- The UI should expose only the supported reasoning effort options: `high` and `max`.

## DEC-0004: Supervisor-Led Multi-Agent Flow

Status: accepted

Decision:

The MVP uses a supervisor-led multi-agent flow instead of a free-form swarm.

Agent roles:

- Supervisor
- Researcher
- Builder
- Reviewer

Reasoning:

- Supervisor-led orchestration is easier to observe, debug, and present in the UI.
- Narrow agent roles make outputs easier to evaluate.
- Free-form agent collaboration can be explored later after the run system and approval model are stable.

## DEC-0005: Read + Draft Permission Model

Status: accepted

Decision:

The MVP allows read and draft operations by default, while writes, shell commands, and external side-effect operations require approval.

Reasoning:

- The first version should feel capable without feeling unsafe.
- Approval requests make the agent's intent visible before risky actions.
- The model matches a local single-user development workflow while preserving auditability.
