# Sage Agent 计划

## Stage 0：项目地基

目标：建立干净的本地仓库和项目治理文档，为后续商业化标准开发打基础。

交付物：

- 初始化 `main` 分支 git 仓库。
- 添加 `.gitignore`。
- 添加 `AGENTS.md`。
- 添加 `README.md`。
- 添加 plan、spec、task、decision、bug 跟踪文档。
- 提交初始化文档。

退出标准：

- `rtk git status --short --branch` 显示 `main` 分支且工作区干净。
- `rtk git log --oneline -1` 显示初始化 commit。
- `docs/TASKS.md` 中 Stage 0 任务完成。

## Stage 1：Product Shell

目标：创建 Web First 的 Sage Agent 应用壳，形成 Codex desktop-inspired 工作台。

计划交付物：

- 锁定 Stage 1 技术选型与验收标准。
- 在 `apps/web` 下创建 Next.js app。
- 建立 TypeScript workspace。
- 创建三栏 app shell：左侧导航、中间 run workspace、右侧 inspector。
- 添加 threads、runs、steps、tool calls、approvals、artifacts 的静态 seed data。
- 建立适合密集工作台的 design tokens。
- 添加 `.env.example`，但不接入真实 DeepSeek 请求。

退出标准：

- 本地 dev server 可以成功启动。
- 首屏是可用的 Sage Agent workbench，不是 landing page。
- 桌面和移动端布局无明显溢出、遮挡或不可读文本。
- Stage 1 只展示静态/模拟状态，不实现真实 agent loop、DeepSeek provider 或工具执行。

## Stage 2：Run System 与 Event Flow

目标：实现 run-based 执行模型和实时 UI 更新路径。

计划交付物：

- 定义 Thread、Run、Message、Step、ToolCall、Approval、Artifact、RunEvent 共享类型。
- 为 local MVP 添加 runtime state store。
- 添加 create-run API。
- 添加 SSE event endpoint。
- UI timeline 能从 events 更新。

退出标准：

- 创建一个 run 后，UI 能显示状态、steps 和 event updates。
- 右侧 inspector 能显示 timeline、tool calls、approvals、artifacts。

## Stage 3：DeepSeek V4 Provider

目标：通过 provider adapter 接入 DeepSeek V4。

计划交付物：

- 添加 DeepSeek provider 配置。
- 支持 `deepseek-v4-flash` 和 `deepseek-v4-pro`。
- 添加 thinking mode toggle，默认开启。
- 添加 `high` / `max` reasoning effort selector。
- 将 streaming model output 转换为 run events。

退出标准：

- 用户提交 prompt 后可以看到 streamed model output。
- provider 错误能在 run UI 中清楚显示。
- model 与 reasoning settings 在本地可见并可持久化。

## Stage 4：Multi-Agent MVP

目标：实现 supervisor-led multi-agent 行为，并保持安全工具边界。

计划交付物：

- 添加 Supervisor、Researcher、Builder、Reviewer agent definitions。
- 添加 orchestrator，负责创建 steps、分派子 agent、汇总结果。
- 添加 Read + Draft tool set。
- 添加 write、shell、external side-effect actions 的 approval flow。
- 添加 final artifact 生成与 reviewer pass。

退出标准：

- 一个用户目标可以完整经过 supervisor planning、context gathering、builder output、reviewer feedback、final summary。
- 所有 risky actions 在执行前都会产生 approval request。
- UI 能让用户理解 agent activity、tool calls 和 final output。

## Stage 5：商业化质量加固

目标：将 MVP 从可演示推进到可长期维护的商业化基础。

计划交付物：

- 完善 error handling、empty states、loading states 和 cancel/retry 行为。
- 完善 audit trail 和 run history。
- 建立最小可行 telemetry/logging。
- 补齐关键测试和手动 QA checklist。
- 根据 `docs/BUGS.md` 清理高优先级问题。

退出标准：

- 核心流程有明确测试和手动验收记录。
- 高优先级 bug 已解决或有清晰延期说明。
- 文档、实现和 UI 行为保持一致。
