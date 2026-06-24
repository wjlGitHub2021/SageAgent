# `@sage/deepseek`

Sage Agent 的 DeepSeek provider package。

当前 Stage 3 提供 provider configuration 和 API key handling：

- 从环境变量读取 DeepSeek 相关设置。
- 复用 `@sage/shared` 的 model / reasoning effort 枚举。
- 提供 API key readiness、脱敏展示和请求前校验工具。
- 不发起真实 DeepSeek 请求。

后续 HTTP adapter 和 streaming parser 再在此 package 上扩展。
