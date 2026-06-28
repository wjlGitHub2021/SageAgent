# Hermes 对照与下一版产品路线图

## 目标

Sage Agent 的长期方向不是复制 Hermes Agent 的平台规模，而是做一个“小型 Hermes Agent”。

当前策略是：

- v1 继续保持 local single-user、Web First、DeepSeek-only。
- 下一版开始补齐 Hermes 级别的核心能力，但仍然保持可控、可审计、可定制。
- 桌面端是明确方向，但当前只先做 Web。

说明：

- 本文是基于当前已知官方资料和产品对照整理出的路线图，不作为 Hermes 官方能力清单。
- 表格里的“v1 只保留”表示 v1 期间只保留相关入口、状态或边界，不实现对应 Hermes 级能力。

## 结论

Hermes 的关键特征是“同一个 agent core，跑在 CLI、desktop、gateway、消息平台、cron、voice、profiles、skills、memory 这些 surfaces 上”。我们要做的是保留这个核心理念，但把平台扩张顺序反过来：

1. 先把 Web 工作台做成稳定的核心壳。
2. 再补跨会话记忆和技能系统。
3. 再扩展多 provider 和多入口。
4. 最后再把 desktop、cron、voice、profile、gateway 这些平台能力逐步加上。

## 对照表

| Hermes 能力 | Hermes 的做法 | 我们当前已有 | v1 只保留 | 后续再做 |
| --- | --- | --- | --- | --- |
| Web + desktop + gateway + CLI 多入口 | 同一 agent core 覆盖 CLI、TUI、desktop、gateway、消息平台 | 只有 Web workbench，desktop 只是方向 | 保留 Web shell、run workspace、inspector、composer 的稳定入口 | desktop app、gateway、消息平台 |
| 多 provider | 支持 OpenAI-compatible、云 provider、本地模型和 fallback | v1 只做 DeepSeek | 保留 provider 状态、错误脱敏和单 provider 入口 | provider registry、多 provider fallback、provider allowlist |
| 跨会话记忆 | bounded memory、memory providers、记忆沉淀 | 目前只有 run/audit 历史，没有长期记忆底座 | 保留历史记录和未来记忆入口，不实现跨会话记忆 | memory providers、自动摘要、知识检索、个性化记忆 |
| 技能自动生长 | skills 作为 on-demand knowledge docs，可创建、加载、同步、整理 | 目前没有技能系统 | 保留技能入口和未来扩展位置，不实现技能系统 | skills hub、技能创建流程、自动整理、技能市场 |
| 定制化 prompt / profile | profile、SOUL.md、profile distributions、独立 home 目录 | 只有当前产品级 system prompt 和 settings | 保留 prompt / settings 入口，不做 profile 体系 | profile 管理、profile distribution、模板市场 |
| 安全边界与多用户入口 | gateway allowlist、DM pairing、消息平台权限 | Read + Draft + approval | 继续收紧 approval、脱敏、审计和 workspace 边界 | 远程登录、gateway 权限、团队/多用户治理 |
| 自动化任务 | cron jobs、定时触发、无 agent mode | 当前没有自动化调度 | 保留自动化入口，不进入 v1 主线 | cron、定时任务、触发器、自动交付 |
| 语音 | voice mode、TTS、voice channel | 当前没有语音能力 | 保留语音入口，不进入 v1 主线 | voice input/output、TTS、会议/通话接入 |
| 自动更新与运维 | update、profile check、配置迁移、可恢复安装 | 当前只有普通 web app 发布链路 | 保留更新提示和版本检查入口 | 自动更新、配置迁移、运维面板 |

## 下一版路线图

### V2.1：Web 壳层对齐

目标：

- 把当前 Web 界面整理成 Hermes-like 的工作台壳。
- 左侧保留长期导航和对象列表。
- 中间保留当前 run 工作区。
- 底部固定 composer。
- 右侧保留 timeline、tool calls、approvals、artifacts。

要做的事：

- 强化空态首页，让它像一个 agent home，不像普通 dashboard。
- 保持 run 进入后和 empty state 的视觉切换清楚。
- 统一 desktop 与 mobile 的壳层行为。

### V2.2：跨会话记忆底座

目标：

- 把 Hermes 的“跨会话记忆”变成我们的核心差异化能力之一。
- 让 agent 能记住项目、用户偏好、历史约束和可复用结论。
- 当前实现口径先落在本地 registry + audit + run prompt 注入，后续再替换成更强的持久化后端。

要做的事：

- 定义记忆对象的类型、范围和边界。
- 明确什么能写入、谁能触发写入、如何审计。
- 提供记忆的读取、更新、删除和上下文注入路径。

### V2.3：技能系统与自动生长

目标：

- 把 skills 做成一等公民。
- 让 agent 可以从经验中生成、整理、复用技能。

要做的事：

- 定义 skills 的存储、加载、版本和展示。
- 支持技能来源于用户、agent 经验和项目模板。
- 提供技能 curation，但保留人工确认边界。

### V2.4：多 provider 与多入口

目标：

- 从 DeepSeek-only 过渡到多 provider。
- 从 Web-only 过渡到 Web + Desktop 的统一 core。

要做的事：

- 建 provider registry 和 fallback 策略。
- 把 provider 状态、选择和错误统一成 UI 能看懂的对象。
- 为 desktop 端做共享 shell 和共享状态模型。

### V2.5：平台扩展

目标：

- 在核心 shell、记忆、技能、provider 稳定后，再加入 Hermes 已经覆盖的扩展面。

候选项：

- cron
- voice
- profiles
- remote login
- gateway / messaging
- 自动更新

## 约束

- v1 仍然只做 DeepSeek、Web First、local single-user。
- 任何平台级扩展都必须先有单独提案，再进入实现。
- 记忆、技能、profile、gateway、cron、voice 这些能力都必须和安全边界、审计链路、可恢复性一起设计。

## 结语

Hermes 给我们的不是“复制一个更大壳子”的答案，而是一个方向：agent core 要跨 surface、跨 session、跨能力演进。

Sage Agent 的做法是先把这个核心缩成一个可交付的产品，再逐步长出 memory、skills 和 desktop。
