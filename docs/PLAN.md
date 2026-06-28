# Sage Agent 计划

## 目标

Sage Agent 当前进入“本地单用户 v1 收口”阶段。

这一阶段的重点不是继续扩展平台边界，而是把现有 Web First workbench 收敛成一个稳定、可审计、可交付的本地产品。

## 产品边界

- local single-user
- Web First
- 默认中文，支持中文/English 切换
- 以 Run 为核心
- Read + Draft 安全边界，写文件、shell、外部副作用必须走 approval
- 不做 hosted multi-user auth、billing、tenant isolation
- 不做云端 secret vault

## 已完成基线

- Stage 0：项目地基
- Stage 1：Product Shell
- Stage 2：Run System 与 Event Flow
- Stage 3：DeepSeek V4 Provider
- Phase 2：真实 Run Loop 最小闭环
- Phase 3：产品化设置与本地配置体系
- Phase 4：Multi-Agent 产品化承接
- Stage 5：商业化质量加固

这些阶段已经把基础架构、运行链路、设置面、multi-agent 承接和质量加固铺出来了。当前主线是收口，不是重新开新平台阶段。

## 当前主线：v1 收口

1. 口径统一
   - 统一 `docs/PLAN.md`、`docs/TASKS.md`、`docs/SPEC.md`、`docs/QA_CHECKLIST.md`、`docs/BUGS.md` 的当前 active scope。
   - 将历史阶段保留为基线，把当前工作面收束成 v1。

2. 体验收敛
   - 保持 workbench、run history、timeline、approvals、artifacts、settings、provider status 和 error states 的可读性。
   - 继续压实 desktop/mobile 的布局、空态、loading、busy、cancel、retry 和审计表达。

3. 稳定性收口
   - 清理剩余 P0 / P1 和高风险 P2。
   - 继续保持安全边界、脱敏和可审计性。

4. 发布门禁
   - 自动化门禁、浏览器 QA、手动 QA checklist、README / 启动说明 / 环境变量说明一致。
   - 让新成员可以不改代码完成安装、启动、理解边界和基础验证。

## v1 退出标准

- 本地开发和常用验证命令通过。
- 关键工作流可稳定复现。
- P0 / P1 为 0，或都有明确 blocked 说明。
- 文档、实现、QA 和记忆中的产品边界一致。
- 用户可以按文档完成安装、配置、运行和基础验证。

## v2 候选范围

以下内容只作为下一阶段候选，不是当前工作项：

- 核心候选：memory（V2.2 本地 registry 已完成，后续可扩展 provider / 自动摘要）、skills、provider registry、desktop shell
- 平台候选：hosted multi-user、auth 与 tenant isolation、billing 与 plans、remote storage / sync、automation / tool ecosystem

这些候选项只有在 v1 稳定后、并且有单独提案时才进入新规划。当前仍然以 v1 收口为主。详细对照和路线图见 [HERMES_ROADMAP](HERMES_ROADMAP.md)。
