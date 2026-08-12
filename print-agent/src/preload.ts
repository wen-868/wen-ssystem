/**
 * 设置窗口预加载：向渲染进程安全暴露 IPC 能力
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("agent", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("save-settings", settings),
  listPrinters: () => ipcRenderer.invoke("list-printers"),
  testPrint: (html: string) => ipcRenderer.invoke("test-print", html),
  getStatus: () => ipcRenderer.invoke("get-status"),
});
