"use strict";

// 预加载脚本：contextIsolation 下连接渲染进程与主进程的安全桥。
// v0 暂不暴露任何 IPC（壳只是加载本地 Next）。后续若需原生能力
//（菜单、文件对话框、keychain、自动更新等），在此用 contextBridge 暴露受控 API。
