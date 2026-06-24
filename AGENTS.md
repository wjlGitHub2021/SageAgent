# Sage Agent 协作规范

## 项目定位

Sage Agent 是一个商业化项目。所有设计、实现、测试、文档和提交都要按照商业化产品标准推进：稳定、可维护、可审计、可扩展，并且避免临时玩具式实现。

Sage Agent 的一期目标是 Web First 的 Hermes-like agent 工作台，UI 信息架构参考 Codex 桌面端：左侧任务/会话，中间当前 run 工作区，右侧 agent timeline、tool calls、artifacts 和 approval。

## 语言规范

- 文档、回复、任务说明、提交信息默认使用中文。
- 专业英语名词、模型名、API 字段、文件名、目录名、代码标识符可以保留英文，例如 `Run`、`ToolCall`、`Approval`、`reasoning_effort`、`AGENTS.md`。
- 面向用户的最终说明要简洁清楚，优先说明完成了什么、如何验证、还有什么风险。

## 双语 UI 规范

- 产品 UI 从 Stage 1 开始支持中文/English 切换，默认中文。
- 新增 UI 文案必须进入 copy 字典或后续 i18n 资源，不要在组件中散落硬编码。
- 后续实现要同步考虑中英文界面，包括导航、面板标题、按钮、状态说明、空状态、错误提示、composer 提示和 seed data 展示文案。
- 专业名词、模型名、API 字段、agent role、tool name 可以保留英文。
- QA 时要至少验证一次中文和英文主界面都能显示关键内容。

## 本地规则

- shell 命令必须使用 `rtk` 前缀，例如 `rtk git status`、`rtk npm test`。
- 优先使用 TypeScript 编写产品代码、共享类型、runtime 编排和 provider adapter。
- MVP 优先 Web 交付，暂不做桌面封装。
- 任何改动都要尊重现有 git 工作区。不要回滚用户或其他 agent 的改动，除非用户明确要求。

## 商业化质量标准

- 每个功能都要有明确的用户价值、边界、验收标准和失败处理。
- UI 不能只是 demo，要按真实产品体验设计：可读、稳定、可操作、状态清楚。
- Runtime 不能隐藏关键状态：agent 活动、tool calls、approval、artifact、错误都要可追踪。
- 安全边界优先于便利性。写文件、shell、外部副作用操作必须进入 approval 流程。
- 文档要能支撑后续开发者继续工作，而不是只记录当前聊天结论。

## MVP 技术方向

- UI：Codex desktop-inspired workbench，不做普通聊天页或营销落地页。
- Runtime：supervisor-led multi-agent orchestration。
- Agents：`supervisor`、`researcher`、`builder`、`reviewer`。
- Provider：一期只支持 DeepSeek V4。
- 默认模型：`deepseek-v4-flash`。
- 可选模型：`deepseek-v4-pro`。
- 默认 thinking mode：开启。
- UI 暴露的 `reasoning_effort`：`high` 和 `max`。
- 默认 `reasoning_effort`：`high`。

## 安全边界

一期采用 Read + Draft 权限模型：

- 默认允许：读取项目文件、分析上下文、制定计划、生成总结、生成 patch 草稿或 artifact 草稿。
- 必须审批：写文件、运行 shell、发起有外部副作用的请求、修改非文件类持久化状态。
- 每个 approval 必须记录 requesting agent、reason、action type、payloadSummary、status、resolution timestamp。
- MVP 默认 local single-user。未经明确要求，不做 hosted multi-user auth、billing、tenant isolation。

## 任务工作流

每个小 task 都按以下流程推进：

1. 写文档：先更新或补充相关 spec、plan、task、decision 或 bug 文档，明确目标、边界和验收标准。
2. 实现：只实现当前小 task 的范围，不顺手做无关重构。
3. QA 审查：实现后进行验证。复杂 task 应分派独立 QA 子 agent，避免实现上下文影响审查判断。
4. 修复或记录 bug：当下可解决的问题当下解决；依赖后续链路或当前不适合处理的问题，记录到 `docs/BUGS.md`。
5. 中文提交：每个小 task 完成后提交一次 git，提交信息使用中文，格式建议为 `类型：简短说明`，例如 `文档：完善任务工作流规范`。

## 任务分块原则

- 一个 task 只解决一个清晰目标，避免跨越多个阶段。
- 优先按交付物分块：文档、UI shell、domain types、event flow、provider adapter、agent orchestration、approval flow。
- 优先按风险分块：先搭骨架，再接真实 provider，再开放工具，再加审批和持久化。
- 单个 task 应能在一次上下文内完成设计、实现、QA 和提交。
- 如果 task 变大，先拆成 2 到 5 个小 task，并更新 `docs/TASKS.md`。

## 子 agent 分派规则

可以分派子 agent 协助，但要保持主 agent 对结果负责。

适合分派的场景：

- Research 子 agent：查阅文档、阅读代码、整理上下文，不做写入。
- Implementation 子 agent：处理边界清晰的小模块或草稿方案。
- QA 子 agent：在实现完成后独立审查功能、测试、文档和风险。
- Review 子 agent：专门做代码 review、规格一致性检查或商业化质量检查。

分派逻辑：

- 主 agent 先把任务拆清楚，再给子 agent 明确输入、输出、禁止事项和验收标准。
- 子 agent 的任务必须足够小，能独立完成并返回结构化结论。
- 子 agent 完成后，主 agent 必须吸收结论、关闭该子 agent 的工作上下文，并决定是否采纳。
- 不保留长期运行的子 agent；每个子 agent 完成一个明确子任务后即结束。
- 不把敏感决策完全交给子 agent。架构取舍、用户承诺、git 提交由主 agent 最终负责。

## QA 与 BUG 跟踪

- QA 不只跑测试，还要检查产品行为、文档一致性、安全边界和商业化可用性。
- 发现 bug 后先判断：当前 task 内可修复，还是需要后续链路支持。
- 当前可修复的 bug 必须在同一 task 中修复并再次验证。
- 暂不修复的 bug 必须写入 `docs/BUGS.md`，包含编号、状态、严重级别、发现阶段、影响、复现/线索、阻塞原因和后续处理建议。
- 提交前要确认 `docs/TASKS.md` 与 `docs/BUGS.md` 状态可信。

## 目标架构

- `apps/web`：未来 Next.js 前端和 API routes。
- `packages/runtime`：未来 orchestrator、agent loop、event bus 和 approval handling。
- `packages/agents`：未来 supervisor、researcher、builder、reviewer 定义。
- `packages/deepseek`：未来 DeepSeek provider adapter。
- `packages/shared`：未来共享类型，例如 Run、Step、ToolCall、Approval、Artifact、Event。

## 文档维护

- `docs/PLAN.md`：阶段路线图。
- `docs/SPEC.md`：当前产品与系统规格。
- `docs/TASKS.md`：可执行任务清单。
- `docs/DECISIONS.md`：架构决策记录。
- `docs/BUGS.md`：bug 与技术债跟踪。
