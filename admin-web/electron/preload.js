const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // 获取 API 基础地址
  getApiBase: () => ipcRenderer.invoke("get-api-base"),

  // 打开系统浏览器
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // 显示消息对话框
  showMessage: (options) => ipcRenderer.invoke("show-message", options),

  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
