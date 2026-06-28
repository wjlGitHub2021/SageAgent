# Sage Agent 使用说明

Sage Agent 是一个本地单用户、Web First 的 agent workbench。当前界面默认中文，支持中文/English 切换，目标是提供一个类似 Codex desktop 的三栏工作台：左侧 threads / runs，中间当前 run 工作区，右侧 timeline、tool calls、approvals 和 artifacts。

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

## 你能看到什么

- 左侧：threads、runs、workspace context、recent activity
- 中间：当前 run、消息流、最终输出、composer
- 右侧：agent timeline、tool calls、approvals、artifacts、run metadata
- 设置：语言、默认模型、thinking mode、reasoning effort

## 项目文档

- [PLAN](docs/PLAN.md)
- [SPEC](docs/SPEC.md)
- [TASKS](docs/TASKS.md)
- [BUGS](docs/BUGS.md)
- [QA_CHECKLIST](docs/QA_CHECKLIST.md)

## 安全提示

- 不要把真实 API key 写进仓库文件
- 不要提交 `.env.local`
- 只在本地环境配置 DeepSeek 相关密钥
