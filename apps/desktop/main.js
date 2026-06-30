"use strict";

const path = require("path");
const { app, BrowserWindow, shell } = require("electron");

// v0：只加载本地运行的 Next 服务（dev 指向 localhost:3000）。
// 生产打包（内嵌 standalone 服务端、改端口等）留到下一轮，可经此环境变量覆盖。
const TARGET_URL = process.env.SAGE_DESKTOP_URL || "http://localhost:3000";

function createWindow() {
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

  win.loadURL(TARGET_URL);

  // 外部链接交给系统浏览器，避免应用内导航走丢
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 冒烟自检：SAGE_DESKTOP_SMOKE=1 时，加载完成即退出（CI / 无人值守验证用）
  if (process.env.SAGE_DESKTOP_SMOKE === "1") {
    win.webContents.once("did-finish-load", () => {
      console.log("[smoke] loaded:", TARGET_URL);
      setTimeout(() => app.quit(), 600);
    });
    win.webContents.once("did-fail-load", (_event, code, desc) => {
      console.error("[smoke] failed:", code, desc);
      app.exit(1);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // macOS 习惯保留进程；其他平台关窗即退出
  if (process.platform !== "darwin") app.quit();
});
