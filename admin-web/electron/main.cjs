const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");

// 后端 API 地址（桌面版直连远程服务器；api.onepan.cn 解析到生产服务器 IP：159.75.153.59）
const API_BASE = "https://api.onepan.cn/api";

// AI 底座地址（桌面版通过 nginx /ai-api 代理访问）
const AI_BASE = "https://admin.onepan.cn/ai-api";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    center: true,
    show: false,
    title: "智享全链管理系统",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: false,
    },
  });

  // 隐藏默认菜单栏（后台系统不需要）
  mainWindow.setMenuBarVisibility(false);

  // 加载本地构建产物
  const indexPath = path.join(__dirname, "../dist/index.html");
  mainWindow.loadFile(indexPath);

  // 窗口准备好后再显示，避免白屏
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // 拦截新窗口打开，用系统浏览器打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC 通信：提供 API 基础地址
ipcMain.handle("get-api-base", () => API_BASE);

// IPC 通信（同步）：渲染层模块加载时同步获取 API 地址
ipcMain.on("get-api-base-sync", (event) => {
  event.returnValue = API_BASE;
});

// IPC 通信（同步）：渲染层模块加载时同步获取 AI 地址
ipcMain.on("get-ai-base-sync", (event) => {
  event.returnValue = AI_BASE;
});

// IPC 通信：打开系统浏览器
ipcMain.handle("open-external", async (_event, url) => {
  await shell.openExternal(url);
});

// IPC 通信：显示消息对话框
ipcMain.handle("show-message", async (_event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || "info",
    title: options.title || "提示",
    message: options.message || "",
    buttons: options.buttons || ["确定"],
  });
  return result;
});
// Build timestamp: 2026-07-14T19:30:28Z
