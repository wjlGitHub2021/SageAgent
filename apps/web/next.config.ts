import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 桌面端打包用：产出自包含的 standalone 服务（含最小 node_modules trace）。
  output: "standalone",
  // monorepo 必须把 trace 根指到仓库根，否则 standalone 会漏掉 @sage/* 工作区依赖。
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
