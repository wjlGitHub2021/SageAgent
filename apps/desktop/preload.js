"use strict";

// 预加载脚本：contextIsolation 下连接渲染进程与主进程的安全桥。
// 只暴露受控的、最小面的 API（不暴露 ipcRenderer 本体）。
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sageDesktop", {
  isDesktop: true,
  deepseek: {
    getKeyStatus: () => ipcRenderer.invoke("deepseek:key-status"),
    setKey: (key) => ipcRenderer.invoke("deepseek:set-key", key),
    clearKey: () => ipcRenderer.invoke("deepseek:clear-key"),
  },
});
