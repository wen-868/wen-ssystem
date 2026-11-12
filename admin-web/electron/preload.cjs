const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // API 基础地址（同步，供渲染层模块加载时读取）
  apiBase: ipcRenderer.sendSync("get-api-base-sync"),
  // AI 底座地址（同步）
  aiBase: ipcRenderer.sendSync("get-ai-base-sync"),
  // 获取 API 基础地址
  getApiBase: () => ipcRenderer.invoke("get-api-base"),

  // 打开系统浏览器
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // 显示消息对话框
  showMessage: (options) => ipcRenderer.invoke("show-message", options),

  // 无边框窗口控制
  windowControls: {
    minimize: () => ipcRenderer.send("window-control", "minimize"),
    toggleMaximize: () => ipcRenderer.send("window-control", "toggle-maximize"),
    close: () => ipcRenderer.send("window-control", "close"),
  },

  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
