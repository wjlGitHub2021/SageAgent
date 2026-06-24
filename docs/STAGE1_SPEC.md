# Stage 1 实施规格

## 目标

Stage 1 的目标是创建 Sage Agent 的 Web First product shell。它必须是一个可运行、可观察、Codex desktop-inspired 的工作台首屏，而不是 landing page 或普通聊天 demo。

## 技术选型

- Package manager：`pnpm`。
- Workspace：monorepo，使用 `pnpm-workspace.yaml`。
- Web app：Next.js App Router。
- Language：TypeScript。
- Styling：Tailwind CSS。
- UI 资产：优先 code-native UI 和 icon components；Stage 1 不引入真实品牌资产。

目标目录：

```text
apps/web
  Next.js app

packages/shared
  后续共享 domain types

packages/runtime
  后续 orchestrator、agent loop、event bus

packages/agents
  后续 supervisor、researcher、builder、reviewer

packages/deepseek
  后续 DeepSeek provider adapter
```

## 环境变量

Stage 1 添加 `.env.example`，但不读取真实 API。

必备字段：

- `DEEPSEEK_API_KEY=`
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`
- `DEEPSEEK_DEFAULT_MODEL=deepseek-v4-flash`
- `DEEPSEEK_DEFAULT_REASONING_EFFORT=high`

禁止事项：

- 不提交真实 API key。
- 不在 Stage 1 发起真实 DeepSeek 请求。

## Product Shell 范围

Stage 1 必须实现静态/模拟 UI：

- 左侧 sidebar：threads、runs、workspace context、recent activity。
- 中间 workspace：当前 run conversation、streamed-like messages、final output 区域、composer。
- 右侧 inspector：agent timeline、tool calls、approvals、artifacts、run metadata。
- 顶部或局部 controls：model selector、thinking mode toggle、reasoning effort selector，其中 reasoning effort 只展示 `high` 和 `max`。

Stage 1 seed data 至少覆盖：

- 2 个 threads。
- 2 个 runs。
- 4 个 agents：Supervisor、Researcher、Builder、Reviewer。
- 至少 4 个 steps。
- 至少 2 个 tool calls。
- 至少 1 个 pending approval。
- 至少 2 个 artifacts。

## 明确不做

- 不实现真实 DeepSeek provider。
- 不实现真实 agent loop。
- 不实现真实 tool execution。
- 不实现写文件、shell、external request。
- 不做 hosted multi-user auth。
- 不做 desktop wrapper。

## QA 验收

功能验收：

- 本地 dev server 可以启动。
- 首屏直接进入 Sage Agent workbench。
- seed data 在三栏中都可见。
- model、thinking mode、reasoning effort 控件有明确 selected state。
- approval 在右侧 inspector 中可见。

视觉验收：

- Desktop 三栏布局稳定。
- Mobile 不出现横向溢出。
- 文本不互相遮挡，不被按钮或 panels 截断。
- UI 密度接近 Codex 桌面端：工作导向、安静、可扫描。

文档验收：

- `docs/TASKS.md` 状态与实际完成情况一致。
- 暂不修复的问题记录到 `docs/BUGS.md`。
- 完成后使用中文 git commit。
