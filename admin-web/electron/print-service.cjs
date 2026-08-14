/**
 * 智享全链管理系统 · 桌面客户端内置打印服务
 *
 * 将原「本地打印助手」的能力集成进客户端主进程，随桌面版启动自动提供
 * 127.0.0.1:5178 HTTP 服务（打印/钱箱/串口/更新检查），前端代码无需改动。
 * 浏览器版仍可单独安装打印助手使用同一端口。
 */
const { app, BrowserWindow, dialog, shell } = require("electron");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

let printServer = null;

// ==================== 打印核心 ====================

/** 获取本机打印机列表 */
async function listPrinters() {
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

/** 静默打印 HTML（@page 控制纸张尺寸） */
function printHtml(html, printerName, copies) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false },
    });
    let settled = false;
    const done = (ok, message) => {
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
        const success = await new Promise((resolvePrint) => {
          win.webContents.print(
            {
              silent: true,
              deviceName: printerName || "",
              copies: Math.max(1, copies || 1),
              color: false,
              landscape: false,
              margins: { marginType: "none" },
            },
            (ok) => resolvePrint(Boolean(ok))
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

/** 原始指令打印（ESC/POS）：Windows 经 PowerShell Out-Printer 直发打印机驱动 */
async function printRaw(base64, printerName) {
  if (process.platform !== "win32") return { ok: false, message: "原始指令打印暂仅支持 Windows 客户端" };
  if (!printerName) return { ok: false, message: "未选择打印机" };
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

async function runSerialScript(args) {
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

function normalizeSerialBody(body) {
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

function json(res, code, data) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c.toString();
      if (data.length > 2 * 1024 * 1024) req.destroy(new Error("请求体过大"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** 启动内置打印服务（默认 127.0.0.1:5178，与打印助手同端口，前端无感） */
async function startPrintService(port = 5178) {
  if (printServer) return true;
  try {
    printServer = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const pathname = url.pathname;
        if (req.method === "OPTIONS") {
          json(res, 200, { ok: true });
          return;
        }
        if (req.method === "GET" && pathname === "/health") {
          json(res, 200, { ok: true, service: "zhixiang-print-service" });
          return;
        }
        if (req.method === "GET" && pathname === "/printers") {
          const printers = await listPrinters();
          json(res, 200, { ok: true, printers });
          return;
        }
        if (req.method === "POST" && pathname === "/print") {
          const body = JSON.parse((await readBody(req)) || "{}");
          if (!body.html) { json(res, 400, { ok: false, message: "缺少 html 内容" }); return; }
          const result = await printHtml(body.html, body.printerName || "", Math.max(1, Number(body.copies || 1)));
          json(res, result.ok ? 200 : 500, result);
          return;
        }
        if (req.method === "POST" && pathname === "/print-raw") {
          const body = JSON.parse((await readBody(req)) || "{}");
          if (!body.base64) { json(res, 400, { ok: false, message: "缺少 base64 原始指令" }); return; }
          const result = await printRaw(body.base64, body.printerName || "");
          json(res, result.ok ? 200 : 500, result);
          return;
        }
        if (req.method === "POST" && pathname === "/cash-drawer") {
          const body = JSON.parse((await readBody(req)) || "{}");
          const pulse = Math.max(0, Math.min(1, Number(body.pulse || 0)));
          const base64 = Buffer.from([0x1b, 0x70, pulse, 0x19, 0xfa]).toString("base64");
          const result = await printRaw(base64, body.printerName || "");
          json(res, result.ok ? 200 : 500, result);
          return;
        }
        if (req.method === "GET" && pathname === "/serial/ports") {
          const { stdout } = await execFileAsync("powershell.exe", [
            "-NoProfile", "-NonInteractive", "-Command",
            "[System.IO.Ports.SerialPort]::GetPortNames()",
          ], { timeout: 10000, windowsHide: true });
          json(res, 200, { ok: true, ports: stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) });
          return;
        }
        if (req.method === "POST" && ["/serial/write", "/serial/read", "/serial/transaction"].includes(pathname)) {
          const body = JSON.parse((await readBody(req)) || "{}");
          const opt = normalizeSerialBody(body);
          if (!opt.port) { json(res, 400, { ok: false, message: "缺少 COM 口" }); return; }
          if (pathname === "/serial/write" && !opt.writeBase64) {
            json(res, 400, { ok: false, message: "缺少写入内容 base64" }); return;
          }
          if (pathname === "/serial/read" && !opt.readMode) opt.readMode = "line";
          if (pathname === "/serial/transaction" && !opt.readMode) opt.readMode = "line";
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
    await new Promise((resolve, reject) => {
      printServer.once("error", reject);
      printServer.listen(port, "127.0.0.1", () => resolve());
    });
    console.log(`[print-service] 内置打印服务已启动 127.0.0.1:${port}`);
    return true;
  } catch (e) {
    console.warn(`[print-service] 启动失败（可能端口被占用）：${e.message}`);
    printServer = null;
    return false;
  }
}

function stopPrintService() {
  if (printServer) {
    printServer.close();
    printServer = null;
  }
}

// ==================== 桌面客户端更新检查 ====================

/** 启动后检查总台发布的桌面客户端版本，有新版弹窗打开下载 */
async function checkDesktopUpdate() {
  try {
    // 按客户端架构请求对应安装包地址（x64 / ia32 / arm64）
    const arch = process.arch;
    const res = await fetch(`https://api.onepan.cn/api/app/version/admin_web?arch=${arch}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const jsonRes = await res.json();
    const latest = jsonRes.data;
    const current = app.getVersion();
    if (!latest?.versionName || latest.versionName === current) return;
    const note = latest.updateNote ? `\n${latest.updateNote}` : "";
    const result = await dialog.showMessageBox({
      type: "info",
      title: "发现新版本",
      message: `智享全链管理系统有新版本 ${latest.versionName}（当前 ${current}）`,
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
    // 检查失败静默
  }
}

module.exports = {
  startPrintService,
  stopPrintService,
  checkDesktopUpdate,
  listPrinters,
  printHtml,
  printRaw,
};
