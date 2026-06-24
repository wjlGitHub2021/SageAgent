# Sage Agent Spec

## Product Definition

Sage Agent is a local single-user, Web First agent workbench named Sage Agent. It is inspired by the Codex desktop app's information architecture and work-focused density, but it is not a pixel clone.

The product should feel like one assistant in the foreground and a small agent team in the background.

## UI Layout

Primary desktop layout:

- Left sidebar: threads, runs, workspace context, and recent activity.
- Center workspace: current run conversation, streamed agent messages, final output, and composer.
- Right inspector: agent timeline, tool calls, approvals, artifacts, and run metadata.

Responsive behavior:

- Desktop keeps all three regions visible.
- Tablet may collapse the inspector into tabs.
- Mobile prioritizes the center workspace, with sidebar and inspector accessible through navigation controls.

Visual direction:

- Dense but readable.
- Quiet, utilitarian, and work-focused.
- No marketing landing page as the default screen.
- No decorative card-heavy hero treatment.
- Stable dimensions for timelines, toolbar controls, panels, and buttons.

## Run System

Sage Agent is run-based rather than message-only.

```text
Thread
  -> Messages
  -> Runs
      -> Steps
          -> ToolCalls
      -> Approvals
      -> Artifacts
      -> Events
```

### Thread

A thread groups user conversation and related runs.

Required fields:

- `id`
- `title`
- `createdAt`
- `updatedAt`

### Run

A run is one complete task execution.

Required fields:

- `id`
- `threadId`
- `title`
- `goal`
- `status`
- `activeAgent`
- `createdAt`
- `updatedAt`
- `completedAt`

Allowed statuses:

- `queued`
- `planning`
- `running`
- `waiting_for_approval`
- `completed`
- `failed`
- `cancelled`

### Message

A message is visible conversation content from the user, an agent, or the system.

Required fields:

- `id`
- `threadId`
- `runId`
- `role`
- `agent`
- `content`
- `createdAt`

### Step

A step is a unit of work performed by an agent.

Required fields:

- `id`
- `runId`
- `agent`
- `title`
- `status`
- `input`
- `output`
- `startedAt`
- `completedAt`

Allowed agents:

- `supervisor`
- `researcher`
- `builder`
- `reviewer`

Allowed step statuses:

- `pending`
- `running`
- `completed`
- `failed`
- `skipped`

### ToolCall

A tool call records an agent using a tool.

Required fields:

- `id`
- `runId`
- `stepId`
- `agent`
- `toolName`
- `args`
- `status`
- `result`
- `error`
- `startedAt`
- `completedAt`

Allowed statuses:

- `running`
- `completed`
- `failed`

### Approval

An approval records a risky action request.

Required fields:

- `id`
- `runId`
- `requestedBy`
- `reason`
- `action`
- `status`
- `createdAt`
- `resolvedAt`

Allowed action types:

- `write_file`
- `run_shell`
- `external_request`

Allowed statuses:

- `pending`
- `approved`
- `rejected`

### Artifact

An artifact is an output produced by the run.

Required fields:

- `id`
- `runId`
- `kind`
- `title`
- `content`
- `path`
- `createdAt`

Initial artifact kinds:

- `plan`
- `patch`
- `document`
- `summary`
- `link`

## Run Events

The UI receives run updates over SSE in the MVP.

Initial event types:

- `run.created`
- `run.status_changed`
- `step.started`
- `step.completed`
- `message.delta`
- `message.completed`
- `tool.started`
- `tool.completed`
- `approval.requested`
- `approval.resolved`
- `artifact.created`
- `run.completed`
- `run.failed`

## Multi-Agent Model

Sage Agent uses one supervisor-led workflow in the MVP.

Agents:

- Supervisor: understands the user goal, creates a plan, delegates work, and summarizes.
- Researcher: reads local context and prepares findings.
- Builder: drafts plans, patch content, documents, or artifacts.
- Reviewer: checks output for risk, missing requirements, and quality issues.

MVP orchestration pattern:

```text
User goal
  -> Supervisor plan
  -> Researcher context pass
  -> Builder draft
  -> Reviewer critique
  -> Builder revision when needed
  -> Supervisor final summary
```

The MVP should avoid free-form agent swarm behavior. Sub-agents are task workers with narrow responsibilities.

## DeepSeek Settings

Provider:

- DeepSeek only in the first release.
- API base URL default: `https://api.deepseek.com`.
- API style: OpenAI-compatible chat completions.

Models:

- `deepseek-v4-flash`
- `deepseek-v4-pro`

Defaults:

- Model: `deepseek-v4-flash`
- Thinking mode: enabled
- Reasoning effort: `high`

UI options:

- Model selector: Flash or Pro.
- Thinking mode toggle: on or off.
- Reasoning effort selector: `high` or `max`.

The UI should not expose provider options that are not intentionally supported by the MVP.

## Tool and Approval Model

Default MVP mode: Read + Draft.

Allowed without approval:

- Read project files.
- Inspect project metadata.
- Draft plans.
- Draft patches.
- Generate artifacts that do not mutate persistent state.

Requires approval:

- Write or edit files.
- Run shell commands.
- Make external requests with side effects.
- Persist changes outside the local run state.

Approval requests must show:

- Requesting agent.
- Reason.
- Action type.
- Payload summary.
- Approve and reject controls.
- Final resolution.

## Out of Scope for MVP

- Hosted multi-user accounts.
- Billing.
- Tenant isolation.
- Full desktop wrapper.
- Unrestricted local automation.
- Arbitrary provider marketplace.
- Free-form multi-agent swarm.
