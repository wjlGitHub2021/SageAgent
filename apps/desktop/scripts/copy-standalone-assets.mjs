// Next standalone 默认不含 .next/static 与 public，需手动拷到 standalone 树内，
// 否则打包后页面样式/静态资源 404。打完 web build 后跑此脚本。
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, "..", "..", "..");
const webNext = path.join(repoRoot, "apps", "web", ".next");
const standaloneWeb = path.join(webNext, "standalone", "apps", "web");

if (!existsSync(path.join(standaloneWeb, "server.js"))) {
  console.error(
    "[standalone] 未找到 standalone server.js，请先 build web（output: standalone）",
  );
  process.exit(1);
}

cpSync(
  path.join(webNext, "static"),
  path.join(standaloneWeb, ".next", "static"),
  { recursive: true },
);

const publicDir = path.join(repoRoot, "apps", "web", "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, path.join(standaloneWeb, "public"), { recursive: true });
}

console.log("[standalone] copied .next/static + public into standalone tree");
