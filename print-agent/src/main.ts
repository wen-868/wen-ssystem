/**
 * 智享全链 · 本地打印助手（主进程）
 *
 * 原生常驻服务：
 *  - 系统托盘常驻，开机可自启
 *  - 本地 HTTP 服务 127.0.0.1:5178，供工作台/收银台调用
 *  - 静默直出打印（热敏小票 / 针式 / A4 / 标签）
 *  - 原始指令通道（ESC/POS，针式/热敏指令级，预留）
 *  - 钱箱弹开通道（ESC/POS 脉冲，经打印机 RJ11 钱箱口）
 *  - 串口通道（客显/电子秤：经 PowerShell System.IO.Ports 读写 COM 口）
 *
 * HTTP API：
 *  GET  /health             服务状态
 *  GET  /printers           本机打印机列表
 *  POST /print              打印 HTML（静默直出）
 *  POST /print-raw          原始指令打印（base64，ESC/POS）
 *  POST /cash-drawer        弹开钱箱（ESC/POS 脉冲指令）
 *  GET  /serial/ports       本机 COM 口列表
 *  POST /serial/write       向 COM 口写入字节（客显/盒子指令）
 *  POST /serial/read        读取 COM 口数据（电子秤连续输出）
 *  POST /serial/transaction 写后读（电子秤命令应答协议）
 */
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** 本机配置（每台终端独立） */
interface AgentSettings {
  port: number;
  printerName: string;
  copies: number;
  autoStart: boolean;
  rawMode: boolean;
  /** 更新检查接口（总台发布） */
  updateCheckUrl: string;
}

const DEFAULT_SETTINGS: AgentSettings = {
  port: 5178,
  printerName: "",
  copies: 1,
  autoStart: true,
  rawMode: false,
  updateCheckUrl: "https://api.onepan.cn/api/app/version/print_agent",
};

let settings: AgentSettings = { ...DEFAULT_SETTINGS };
let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let server: http.Server | null = null;
let portInUse = false;

function settingsFile(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings(): void {
  try {
    const raw = fs.readFileSync(settingsFile(), "utf-8");
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(): void {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("保存配置失败：", e);
  }
}

// ==================== 版本更新检查 ====================

interface LatestAgentVersion {
  versionName?: string;
  isForce?: boolean;
  updateUrl?: string;
  updateNote?: string;
}

/** 启动后检查总台发布的最新版本，有新版弹窗提示并打开下载 */
async function checkAgentUpdate(): Promise<void> {
  try {
    const res = await fetch(settings.updateCheckUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const json = (await res.json()) as { data?: LatestAgentVersion | null };
    const latest = json.data;
    const current = app.getVersion();
    if (!latest?.versionName || latest.versionName === current) return;

    const note = latest.updateNote ? `\n${latest.updateNote}` : "";
    const result = await dialog.showMessageBox({
      type: "info",
      title: "发现新版本",
      message: `本地打印助手有新版本 ${latest.versionName}（当前 ${current}）`,
      detail: note || "建议更新以获得最新功能与修复。",
      buttons: ["打开下载", "稍后再说"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0 && latest.updateUrl) {
      await shell.openExternal(latest.updateUrl);
    }
  } catch {
    // 检查失败静默，不影响打印服务
  }
}

// ==================== 打印核心 ====================

/** 获取本机打印机列表（Electron 需要 webContents 环境） */
async function listPrinters(): Promise<Array<Record<string, unknown>>> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
    }));
  } finally {
    win.destroy();
  }
}

/** 静默打印 HTML（自动适配纸张，@page 控制尺寸） */
function printHtml(
  html: string,
  printerName: string,
  copies: number
): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false },
    });
    let settled = false;
    const done = (ok: boolean, message?: string) => {
      if (settled) return;
      settled = true;
      setTimeout(() => win.destroy(), 500);
      resolve({ ok, message });
    };

    win.webContents.on("did-fail-load", (_e, code, desc) => {
      done(false, `页面加载失败：${code} ${desc}`);
    });
    win.webContents.on("did-finish-load", async () => {
      try {
        const success = await new Promise<boolean>((resolve) => {
          win.webContents.print(
            {
              silent: true,
              deviceName: printerName || "",
              copies: Math.max(1, copies || 1),
              color: false,
              landscape: false,
              margins: { marginType: "none" },
            },
            (ok) => resolve(Boolean(ok))
          );
        });
        done(Boolean(success), success ? undefined : "打印任务未成功提交（可能被取消或打印机离线）");
      } catch (e) {
        done(false, e instanceof Error ? e.message : String(e));
      }
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch((e) => {
      done(false, `模板加载失败：${e instanceof Error ? e.message : String(e)}`);
    });
  });
}

/** 原始指令打印（ESC/POS）：Windows 下经 PowerShell Out-Printer 直发打印机驱动 */
async function printRaw(base64: string, printerName: string): Promise<{ ok: boolean; message?: string }> {
  if (process.platform !== "win32") {
    return { ok: false, message: "原始指令打印暂仅支持 Windows 客户端" };
  }
  if (!printerName) {
    return { ok: false, message: "未选择打印机" };
  }
  const tmp = path.join(app.getPath("temp"), `zx_print_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bin`);
  try {
    fs.writeFileSync(tmp, Buffer.from(base64, "base64"));
    const ps = `Get-Content -LiteralPath '${tmp}' -Encoding Byte | Out-Printer -Name '${printerName.replace(/'/g, "''")}'`;
    await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
      timeout: 30000,
      windowsHide: true,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
}

// ==================== 串口（客显 / 电子秤） ====================

interface SerialOptions {
  port: string;
  baudRate?: number;
  dataBits?: number;
  parity?: string;
  stopBits?: string;
}

const SERIAL_PS = `
param([string]$Port,[int]$Baud,[string]$Parity,[int]$DataBits,[string]$StopBits,[string]$HexWrite,[string]$ReadMode,[int]$Bytes,[int]$TimeoutMs)
$sp = New-Object System.IO.Ports.SerialPort $Port,$Baud,$Parity,$DataBits,$StopBits
$sp.ReadTimeout = 300
function Out-Line([string]$Text){ [pscustomobject]@{ ok=$true; output=$Text } | ConvertTo-Json -Compress }
try {
  $sp.Open()
  if ($HexWrite) {
    $len = $HexWrite.Length / 2
    $bytes = New-Object byte[] $len
    for($i=0; $i -lt $HexWrite.Length; $i+=2){ $bytes[$i/2] = [Convert]::ToByte($HexWrite.Substring($i,2),16) }
    $sp.Write($bytes,0,$bytes.Length)
  }
  if ($ReadMode -eq 'line') {
    $sb = New-Object System.Text.StringBuilder
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    while([DateTime]::UtcNow -lt $deadline){
      try { $ch = $sp.ReadExisting(); if($ch){ [void]$sb.Append($ch); if($ch.IndexOf([char]10) -ge 0){ break } } } catch { }
      Start-Sleep -Milliseconds 80
    }
    Out-Line $sb.ToString()
  } elseif ($ReadMode -eq 'bytes') {
    $buf = New-Object byte[] $Bytes
    $read = 0
    $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
    while($read -lt $Bytes -and [DateTime]::UtcNow -lt $deadline){
      try { $n = $sp.Read($buf,$read,$Bytes-$read); if($n -gt 0){ $read += $n } } catch { }
      if($read -lt $Bytes){ Start-Sleep -Milliseconds 60 }
    }
    Out-Line (([BitConverter]::ToString($buf,0,$read)) -replace '-','')
  } else {
    Out-Line ''
  }
} catch {
  [pscustomobject]@{ ok=$false; message=$_.Exception.Message } | ConvertTo-Json -Compress
} finally {
  if($sp.IsOpen){ $sp.Close() }
  $sp.Dispose()
}
`;

/** 执行串口脚本（临时 ps1 + powershell.exe，避免命令注入） */
async function runSerialScript(args: string[]): Promise<{ ok: boolean; output?: string; message?: string }> {
  const tmp = path.join(app.getPath("temp"), `zx_serial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ps1`);
  try {
    fs.writeFileSync(tmp, SERIAL_PS, "utf8");
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", tmp, ...args,
    ], { timeout: 30000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    const trimmed = stdout.trim();
    if (!trimmed) return { ok: false, message: "串口脚本无输出（请确认 COM 口与参数）" };
    return JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    fs.promises.unlink(tmp).catch(() => {});
  }
}

function normalizeSerialBody(body: Record<string, unknown>) {
  return {
    port: String(body.port || ""),
    baudRate: Number(body.baudRate || 9600),
    dataBits: Number(body.dataBits || 8),
    parity: String(body.parity || "None"),
    stopBits: String(body.stopBits || "One"),
    writeBase64: String(body.writeBase64 || ""),
    readMode: String(body.readMode || ""),
    bytes: Number(body.bytes || 64),
    timeoutMs: Number(body.timeoutMs || 3000),
  };
}

// ==================== HTTP 服务 ====================

function json(res: http.ServerResponse, code: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf-8");
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function startServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        if (req.method === "GET" && url.pathname === "/health") {
          json(res, 200, {
            ok: true,
            service: "zhixiang-print-agent",
            version: app.getVersion(),
            printer: settings.printerName || null,
            port: settings.port,
          });
          return;
        }

        if (req.method === "GET" && url.pathname === "/printers") {
          const printers = await listPrinters();
          json(res, 200, { ok: true, printers });
          return;
        }

        if (req.method === "POST" && url.pathname === "/print") {
          const body = JSON.parse(await readBody(req)) as {
            html?: string;
            printerName?: string;
            copies?: number;
            paperType?: string;
          };
          if (!body.html) {
            json(res, 400, { ok: false, message: "缺少 html 内容" });
            return;
          }
          const printer = body.printerName || settings.printerName;
          const copies = Math.max(1, Math.min(99, body.copies ?? settings.copies ?? 1));
          const result = await printHtml(body.html, printer, copies);
          json(res, result.ok ? 200 : 500, { ok: result.ok, message: result.message, printer: printer || "系统默认" });
          return;
        }

        if (req.method === "POST" && url.pathname === "/print-raw") {
          const body = JSON.parse(await readBody(req)) as { base64?: string; printerName?: string };
          if (!body.base64) {
            json(res, 400, { ok: false, message: "缺少 base64 原始指令" });
            return;
          }
          const printer = body.printerName || settings.printerName;
          const result = await printRaw(body.base64, printer);
          json(res, result.ok ? 200 : 500, result);
          return;
        }

        if (req.method === "POST" && url.pathname === "/cash-drawer") {
          const body = JSON.parse(await readBody(req)) as { printerName?: string; pulse?: number };
          const printer = body.printerName || settings.printerName;
          // ESC/POS 钱箱脉冲：ESC p m t1 t2（m=0 常开，1B 70 00 19 FA 为常见 80ms 脉冲）
          const pulse = Math.max(0, Math.min(1, body.pulse ?? 0));
          const base64 = Buffer.from([0x1b, 0x70, pulse, 0x19, 0xfa]).toString("base64");
          const result = await printRaw(base64, printer);
          json(res, result.ok ? 200 : 500, result);
          return;
        }

        if (req.method === "GET" && url.pathname === "/serial/ports") {
          try {
            const { stdout } = await execFileAsync("powershell.exe", [
              "-NoProfile", "-NonInteractive", "-Command",
              "[System.IO.Ports.SerialPort]::GetPortNames()",
            ], { timeout: 10000, windowsHide: true });
            json(res, 200, { ok: true, ports: stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) });
          } catch (e) {
            json(res, 500, { ok: false, message: e instanceof Error ? e.message : String(e) });
          }
          return;
        }

        if (req.method === "POST" && url.pathname === "/serial/write") {
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const opt = normalizeSerialBody(body);
          if (!opt.port) { json(res, 400, { ok: false, message: "缺少 COM 口" }); return; }
          if (!opt.writeBase64) { json(res, 400, { ok: false, message: "缺少写入内容 base64" }); return; }
          const result = await runSerialScript([
            "-Port", opt.port, "-Baud", String(opt.baudRate), "-Parity", opt.parity,
            "-DataBits", String(opt.dataBits), "-StopBits", opt.stopBits,
            "-HexWrite", opt.writeBase64, "-ReadMode", "", "-Bytes", String(opt.bytes),
            "-TimeoutMs", String(opt.timeoutMs),
          ]);
          json(res, result.ok ? 200 : 500, result);
          return;
        }

        if (req.method === "POST" && url.pathname === "/serial/read") {
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const opt = normalizeSerialBody(body);
          if (!opt.port) { json(res, 400, { ok: false, message: "缺少 COM 口" }); return; }
          if (opt.readMode !== "line" && opt.readMode !== "bytes") opt.readMode = "line";
          const result = await runSerialScript([
            "-Port", opt.port, "-Baud", String(opt.baudRate), "-Parity", opt.parity,
            "-DataBits", String(opt.dataBits), "-StopBits", opt.stopBits,
            "-HexWrite", "", "-ReadMode", opt.readMode, "-Bytes", String(opt.bytes),
            "-TimeoutMs", String(opt.timeoutMs),
          ]);
          json(res, result.ok ? 200 : 500, result);
          return;
        }

        if (req.method === "POST" && url.pathname === "/serial/transaction") {
          const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const opt = normalizeSerialBody(body);
          if (!opt.port) { json(res, 400, { ok: false, message: "缺少 COM 口" }); return; }
          if (!opt.readMode) opt.readMode = "line";
          const result = await runSerialScript([
            "-Port", opt.port, "-Baud", String(opt.baudRate), "-Parity", opt.parity,
            "-DataBits", String(opt.dataBits), "-StopBits", opt.stopBits,
            "-HexWrite", opt.writeBase64, "-ReadMode", opt.readMode, "-Bytes", String(opt.bytes),
            "-TimeoutMs", String(opt.timeoutMs),
          ]);
          json(res, result.ok ? 200 : 500, result);
          return;
        }

        json(res, 404, { ok: false, message: "接口不存在" });
      } catch (e) {
        json(res, 400, { ok: false, message: e instanceof Error ? e.message : String(e) });
      }
    });

    server.once("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EADDRINUSE") {
        portInUse = true;
        reject(new Error(`端口 ${port} 已被占用（可能已有一个打印助手在运行）`));
      } else {
        reject(e);
      }
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

// ==================== 窗口 / 托盘 ====================

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 620,
    resizable: false,
    title: "智享打印助手 · 设置",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function createTray(): void {
  // 使用内置图标生成托盘（无资源文件时用纯色圆形兜底）
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("智享打印助手");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开设置", click: openSettingsWindow },
      { label: `服务端口：${settings.port}`, enabled: false },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          app.quit();
        },
      },
    ])
  );
  tray.on("click", openSettingsWindow);
}

// ==================== IPC（设置窗口） ====================

function registerIpc(): void {
  ipcMain.handle("get-settings", () => settings);
  ipcMain.handle("save-settings", (_e, next: Partial<AgentSettings>) => {
    settings = { ...settings, ...next };
    saveSettings();
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: "打开设置", click: openSettingsWindow },
        { label: `服务端口：${settings.port}`, enabled: false },
        { type: "separator" },
        { label: "退出", click: () => app.quit() },
      ])
    );
    return { ok: true, settings };
  });
  ipcMain.handle("list-printers", async () => {
    try {
      return { ok: true, printers: await listPrinters() };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  });
  ipcMain.handle("test-print", async (_e, html: string) => {
    return printHtml(html || "<div style='font:24px sans-serif;padding:24px'>智享打印助手 · 测试打印</div>", settings.printerName, 1);
  });
  ipcMain.handle("get-status", async () => {
    return {
      running: server !== null,
      portInUse,
      port: settings.port,
      version: app.getVersion(),
    };
  });
}

// ==================== 生命周期 ====================

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    openSettingsWindow();
  });

  app.whenReady().then(async () => {
    loadSettings();
    registerIpc();
    // 冒烟测试模式：启动服务 → 自检 health/printers → 退出（供 CI/本地验证）
    if (process.env.ZX_PRINT_AGENT_SMOKE === "1") {
      try {
        await startServer(settings.port);
        const health = await new Promise<string>((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${settings.port}/health`, (res) => {
            let data = "";
            res.on("data", (c: Buffer) => (data += c.toString()));
            res.on("end", () => resolve(data));
          });
          req.on("error", reject);
          req.setTimeout(5000, () => req.destroy(new Error("health 超时")));
        });
        console.log("[smoke] health:", health);
        const printers = await listPrinters();
        console.log("[smoke] printers:", printers.length);
        console.log("[smoke] OK");
        server?.close();
        app.exit(0);
      } catch (e) {
        console.error("[smoke] FAIL:", e);
        app.exit(1);
      }
      return;
    }
    createTray();
    // 启动后延迟检查更新（不阻塞托盘与打印服务就绪）
    setTimeout(() => {
      checkAgentUpdate().catch(() => {});
    }, 6000);
    try {
      await startServer(settings.port);
    } catch (e) {
      console.error("启动服务失败：", e);
    }
  });

  // 托盘常驻：所有窗口关闭后进程不退出
  app.on("window-all-closed", () => {});

  app.on("before-quit", () => {
    server?.close();
  });
}
