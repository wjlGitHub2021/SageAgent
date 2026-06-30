"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain,
  safeStorage,
} = require("electron");

// 两种运行模式：
// - dev（默认）：连外部已运行的 Next dev 服务（localhost:3000）。
// - serve（packaged 或 SAGE_DESKTOP_SERVE=1）：自己起内嵌的 Next standalone 服务，脱离终端独立运行。
const SERVE_EMBEDDED = app.isPackaged || process.env.SAGE_DESKTOP_SERVE === "1";
const EMBEDDED_PORT = Number(process.env.SAGE_DESKTOP_PORT || 34518);
const DEV_URL = process.env.SAGE_DESKTOP_URL || "http://localhost:3000";

let serverProcess = null;

// ---- DeepSeek 密钥安全存储（OS keychain via Electron safeStorage）----
function keyFilePath() {
  return path.join(app.getPath("userData"), "deepseek-key.enc");
}

function readStoredKey() {
  try {
    const file = keyFilePath();
    if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return "";
    return safeStorage.decryptString(fs.readFileSync(file));
  } catch {
    return "";
  }
}

// 环境变量优先（dev/.env.local/CI），否则用 keychain 存储的 key
function resolveApiKey() {
  return process.env.DEEPSEEK_API_KEY || readStoredKey() || "";
}

function registerKeyIpc() {
  ipcMain.handle("deepseek:key-status", () => ({
    hasKey: Boolean(resolveApiKey()),
    source: process.env.DEEPSEEK_API_KEY
      ? "env"
      : readStoredKey()
        ? "keychain"
        : "none",
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  }));
  ipcMain.handle("deepseek:set-key", (_event, key) => {
    if (typeof key !== "string" || !key.trim()) {
      throw new Error("密钥不能为空");
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("当前系统的加密存储不可用");
    }
    fs.writeFileSync(keyFilePath(), safeStorage.encryptString(key.trim()));
    // 内嵌服务在启动时读取 env，改 key 需重启应用生效（避免热重启服务的端口竞态）
    return { ok: true, requiresRestart: SERVE_EMBEDDED };
  });
  ipcMain.handle("deepseek:clear-key", () => {
    fs.rmSync(keyFilePath(), { force: true });
    return { ok: true, requiresRestart: SERVE_EMBEDDED };
  });
}

// 原生应用菜单：用内置 role，自动获得 OS 本地化标签与标准快捷键
//（重载、强制重载、DevTools、缩放、全屏、复制/粘贴/撤销、最小化/关闭/退出）。
function buildApplicationMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function standaloneServerPath() {
  // packaged：standalone 作为 extraResources 放在 resources/standalone 下。
  // 未打包的 serve 验证：直接用 repo 内 apps/web/.next/standalone 产物。
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", "web", ".next", "standalone");
  return path.join(base, "apps", "web", "server.js");
}

function startEmbeddedServer() {
  const serverPath = standaloneServerPath();
  // 用 Electron 自带的 Node 跑 standalone 服务（ELECTRON_RUN_AS_NODE），无需系统 Node。
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(EMBEDDED_PORT),
      HOSTNAME: "127.0.0.1",
      DEEPSEEK_API_KEY: resolveApiKey(),
    },
    stdio: "inherit",
  });
  serverProcess.on("exit", (code) => {
    if (code && code !== 0) console.error("[server] exited with code", code);
  });
}

function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("server start timeout"));
        else setTimeout(ping, 250);
      });
    };
    ping();
  });
}

function createWindow(targetUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 600,
    title: "Sage Agent",
    backgroundColor: "#f6f5f1", // 与应用暖白底一致，避免加载时白闪
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadURL(targetUrl);

  // 外部链接交给系统浏览器，避免应用内导航走丢
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 冒烟自检：SAGE_DESKTOP_SMOKE=1 时，加载完成即退出（CI / 无人值守验证用）
  if (process.env.SAGE_DESKTOP_SMOKE === "1") {
    win.webContents.once("did-finish-load", () => {
      console.log("[smoke] loaded:", targetUrl);
      setTimeout(() => app.quit(), 600);
    });
    win.webContents.once("did-fail-load", (_event, code, desc) => {
      console.error("[smoke] failed:", code, desc);
      app.exit(1);
    });
  }
}

async function boot() {
  let targetUrl = DEV_URL;
  if (SERVE_EMBEDDED) {
    targetUrl = `http://127.0.0.1:${EMBEDDED_PORT}`;
    startEmbeddedServer();
    try {
      await waitForServer(targetUrl);
    } catch (error) {
      console.error("[server] failed to start:", error.message);
      app.exit(1);
      return;
    }
  }
  createWindow(targetUrl);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(targetUrl);
  });
}

app.whenReady().then(() => {
  buildApplicationMenu();
  registerKeyIpc();
  return boot();
});

app.on("window-all-closed", () => {
  // macOS 习惯保留进程；其他平台关窗即退出
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
