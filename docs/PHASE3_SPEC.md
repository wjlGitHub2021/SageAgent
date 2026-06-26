# Phase 3 规格：产品化设置与本地配置体系

## 目标

Phase 3 的目标是把 Phase 2 已跑通的真实 run loop，提升为可被本地用户稳定配置、理解和验证的产品化体验。

Phase 3 重点不是扩展 agent 能力，而是建立独立 Settings surface，集中承载界面偏好、DeepSeek provider、本地 workspace、安全边界和连接验证，让用户不用改代码也能理解当前配置状态。

Phase 3 继续遵守：

- 文档、回复、提交信息默认中文。
- UI 新增文案必须支持中文/English。
- 每个小 task 走文档 -> 实现 -> QA -> 修复或记录 BUG -> 中文 commit。
- 每个 task 开始前先查看 `docs/BUGS.md` 和待优化项，当前可修复的问题优先修复。
- 默认 local single-user，不做 hosted multi-user auth、billing、tenant isolation。
- 安全边界仍是 Read + Draft；写文件、shell、外部副作用操作必须走 approval。

## Phase 3 范围

Phase 3 采用渐进交付：

1. 先补齐 Phase 3 规划文档、任务拆分、设置安全策略和 QA checklist。
2. 再添加独立 Settings 入口与 Settings 页面 / 面板骨架。
3. 再把语言、模型、thinking、reasoning effort 迁移到 Settings 中统一管理，并保留工作台运行时可见的当前配置摘要。
4. 再提供 DeepSeek provider 配置状态、API key 安全说明、连接测试和错误展示。
5. 再补充 workspace root 与 read-only file tool 的权限说明。
6. 最后根据 QA 和 BUG 文档清理阶段内遗留问题。

Phase 3 不在一开始做：

- 不把 API key 上传到远端服务。
- 不做多用户账号、团队设置或 billing。
- 不做云端 secret vault。
- 不做数据库持久化；若需要本地持久化，必须先完成安全策略文档与最小实现。
- 不开放写文件或 shell 执行绕过 approval。

## Task 3.0：Phase 3 文档与任务拆分

范围：

- 新增 `docs/PHASE3_SPEC.md`。
- 更新 `docs/PLAN.md`、`docs/TASKS.md`、`docs/SPEC.md`、`docs/DECISIONS.md`、`docs/QA_CHECKLIST.md`、`README.md`。
- 明确 Phase 2 不做 API key UI / Settings 权限配置，Phase 3 接手这些能力。
- 记录 Settings 安全边界、任务切分和验收标准。

验收：

- 文档能说明 Phase 2 已结束，Phase 3 开始。
- Phase 3 至少拆成 2 到 5 个可执行小 task。
- 每个 task 有目标、边界和验收方向。
- `docs/BUGS.md` 当前无未处理 P0/P1；如发现遗留问题，必须记录。

## Task 3.1：Settings 入口与页面骨架

范围：

- 在 Product Shell 中添加独立 Settings 入口。
- 提供 Settings 页面或工作台内 Settings panel，优先支持桌面和移动端可读布局。
- Settings 页面至少分区展示：
  - General / 通用
  - Provider / DeepSeek
  - Workspace / 工作区
  - Safety / 安全边界
- 新增 UI 文案进入 copy 字典或后续 i18n 资源，不在组件中散落硬编码。
- 暂不保存真实 API key，不做连接测试。

验收：

- 用户可以从主工作台清楚进入 Settings。
- Settings 页面在中文/English 下关键标题、说明、按钮可切换。
- Desktop / mobile 无明显溢出、遮挡或不可读文本。
- 原有 run loop、composer、timeline 不被破坏。

## Task 3.2：本地偏好设置与配置摘要

范围：

- 将界面语言、默认模型、thinking enabled、reasoning effort 作为 Settings 中的可配置项。
- 保留工作台运行时可见的当前配置摘要。
- 本地偏好优先使用 browser-local persistence；具体方案必须避免保存敏感凭据。
- create-run API 仍接收当前 settings，不改变 `DeepSeekSettings` 共享类型。

验收：

- 切换语言后刷新页面仍能保持偏好。
- 默认模型 / thinking / reasoning effort 从 Settings 选择后，新 run 使用该配置。
- UI 只暴露 `deepseek-v4-flash`、`deepseek-v4-pro`、`high`、`max`。
- 不在本地存储中保存 API key。

## Task 3.3：DeepSeek Provider 状态与连接测试

范围：

- Settings 中展示 DeepSeek 配置状态：
  - API key：已配置 / 未配置。
  - Base URL。
  - 默认模型。
  - Thinking 与 reasoning effort。
- 提供安全的连接测试入口。
- 连接测试由后端读取环境变量或受控本地配置，前端不得接收完整 API key。
- 成功、缺 key、HTTP error、network error、invalid response 必须有可理解错误。
- 所有错误信息必须脱敏，不泄露完整 API key、Authorization header、token、secret 或 password。

验收：

- 未配置 API key 时，测试连接不会发出真实 DeepSeek 请求。
- 配置 API key 后，用户可以从 Settings 触发连接测试并看到结果。
- provider 状态不会泄露完整凭据。
- 自动化测试覆盖 config status、缺 key、错误脱敏和连接测试失败路径。

## Task 3.4：Workspace 与 Read-only Tool 设置说明

范围：

- Settings 中展示当前 workspace root。
- 说明 `read_project_file` 只读工具能读取和不能读取的路径类型。
- 展示 blocked path policy，例如 `.env`、`.git/`、`node_modules/`、`.next/`、`dist/`、`build/`、`coverage/`、`tmp/`。
- 暂不提供修改 workspace root 的 UI；修改仍通过 `SAGE_WORKSPACE_ROOT`。

验收：

- 用户能理解为什么某些文件可读、某些文件被拒绝。
- Settings 中的权限说明与 `docs/PHASE2_SPEC.md` 和 runtime 实现一致。
- 不暴露敏感文件内容。

## Task 3.5：Phase 3 QA 与收尾

范围：

- 更新手动 QA checklist 的 Settings 专项。
- 补齐 Settings 相关自动化测试。
- 搜索 P0/P1/P2 风险，能修复则修复，暂不修复则进入 `docs/BUGS.md`。
- 清理文档与实现不一致之处。

验收：

- `rtk pnpm test`、`rtk pnpm run typecheck`、`rtk pnpm lint`、`rtk pnpm build`、`rtk git diff --check` 通过。
- Settings 的中文/English、desktop/mobile、缺 key、安全错误都完成 QA。
- `docs/TASKS.md` 与 `docs/BUGS.md` 状态可信。

## Settings 安全策略

Phase 3 的 Settings 不把便利性置于安全边界之上。

原则：

- API key 默认仍来自 `.env` / server environment。
- 前端只显示“已配置/未配置”和脱敏状态，不显示完整 API key。
- 若后续支持在 UI 中录入 API key，必须先新增单独 task，明确本地存储、加密、清除、审计和失败处理策略。
- Browser localStorage / sessionStorage 只能用于非敏感偏好，例如语言、默认模型、thinking、reasoning effort。
- 连接测试必须走后端 route，并复用 provider adapter 的错误脱敏逻辑。

## Phase 3 退出标准

- Settings 有独立入口和可用页面 / 面板。
- 语言与模型偏好可以集中配置，并能影响后续 run。
- DeepSeek 配置状态与连接测试可见、可理解、可审计。
- Workspace root 和 read-only file tool 安全边界可见。
- 所有新增 UI 文案支持中文/English。
- 自动化门禁和手动 QA 记录通过。
- `docs/BUGS.md` 没有未处理 P0/P1；P2/P3 有清晰处理建议。
