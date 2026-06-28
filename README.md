# Sage Agent 使用说明

Sage Agent 是一个本地单用户、Web First 的 agent workbench。当前主线是“本地单用户 v1 收口”。

目标界面是一个类似 Codex desktop 的三栏工作台：左侧 threads / runs，中间当前 run 工作区，右侧 timeline、tool calls、approvals 和 artifacts。默认中文，支持中文/English 切换。

## 快速开始

1. 安装依赖：

```bash
rtk pnpm install
```

2. 准备本地环境变量：

```bash
cp .env.example .env.local
```

3. 启动开发服务：

```bash
rtk pnpm dev
```

4. 打开：

```text
http://localhost:3000
```

5. 做一次最小 smoke check：

- 左侧能看到 threads / runs
- 中间能看到当前 run 工作区和 composer
- 右侧能看到 timeline、tool calls、approvals 和 artifacts
- Settings 能切换中文 / English
- `.env.local` 只放本地，不要提交

## 本地配置

`.env.local` 只放在本机，不要提交到仓库。

- `DEEPSEEK_API_KEY`：DeepSeek API key
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`
- `DEEPSEEK_DEFAULT_MODEL`：默认 `deepseek-v4-flash`
- `DEEPSEEK_DEFAULT_REASONING_EFFORT`：默认 `high`
- `DEEPSEEK_THINKING_ENABLED`：默认 `true`
- `SAGE_WORKSPACE_ROOT`：工作区根目录

## 常用命令

```bash
rtk pnpm test
rtk pnpm run typecheck
rtk pnpm lint
rtk pnpm build
```

## 启动检查

如果页面打不开，先确认：

- `rtk pnpm dev` 是否仍在运行
- `.env.local` 是否来自 `.env.example`
- `DEEPSEEK_API_KEY` 是否只配置在本地服务端环境
- 浏览器是否打开了 `http://localhost:3000`

如果只需要验证本地工作台是否可用，先看最小 smoke check 是否全部成立，不必先配置真实 API key。

## 你能看到什么

- 左侧：threads、runs、workspace context、recent activity
- 中间：当前 run、消息流、最终输出、composer
- 右侧：agent timeline、tool calls、approvals、artifacts、run metadata
- 设置：语言、默认模型、thinking mode、reasoning effort

## 文档入口

- [PLAN](docs/PLAN.md)：当前路线图和 v1 收口边界
- [SPEC](docs/SPEC.md)：产品与系统规格
- [TASKS](docs/TASKS.md)：当前可执行任务
- [QA_CHECKLIST](docs/QA_CHECKLIST.md)：手动验收清单
- [BUGS](docs/BUGS.md)：缺陷与审计记录

## 安全提示

- 不要把真实 API key 写进仓库文件
- 不要提交 `.env.local`
- 只在本地环境配置 DeepSeek 相关密钥
