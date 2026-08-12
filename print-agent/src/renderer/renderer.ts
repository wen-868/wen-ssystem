/**
 * 设置窗口渲染逻辑（原生 TS，无框架）
 */
export {};

interface AgentApi {
  getSettings(): Promise<{
    port: number;
    printerName: string;
    copies: number;
    autoStart: boolean;
  }>;
  saveSettings(settings: unknown): Promise<{ ok: boolean; settings: unknown }>;
  listPrinters(): Promise<{ ok: boolean; printers?: Array<{ name: string; displayName?: string; isDefault?: boolean }>; message?: string }>;
  testPrint(html: string): Promise<{ ok: boolean; message?: string }>;
  getStatus(): Promise<{ running: boolean; portInUse: boolean; port: number; version: string }>;
}

declare global {
  interface Window {
    agent: AgentApi;
  }
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const statusEl = $<HTMLSpanElement>("status");
const portText = $<HTMLSpanElement>("portText");
const versionText = $<HTMLDivElement>("versionText");
const printerSelect = $<HTMLSelectElement>("printerSelect");
const copiesInput = $<HTMLInputElement>("copies");
const autoStartEl = $<HTMLDivElement>("autoStart");
const printerListEl = $<HTMLDivElement>("printerList");
const testBtn = $<HTMLButtonElement>("testBtn");
const testMsg = $<HTMLDivElement>("testMsg");
const saveBtn = $<HTMLButtonElement>("saveBtn");
const saveMsg = $<HTMLDivElement>("saveMsg");
const refreshBtn = $<HTMLButtonElement>("refreshBtn");

let autoStart = false;

function showStatus(ok: boolean, text: string): void {
  statusEl.textContent = text;
  statusEl.className = "status " + (ok ? "ok" : "bad");
}

async function loadStatus(): Promise<void> {
  const s = await window.agent.getStatus();
  portText.textContent = String(s.port);
  versionText.textContent = s.version;
  if (s.portInUse) showStatus(false, "端口被占用（已有实例？）");
  else showStatus(s.running, s.running ? "服务运行中" : "服务未启动");
}

async function loadSettings(): Promise<void> {
  const s = await window.agent.getSettings();
  copiesInput.value = String(s.copies ?? 1);
  autoStart = Boolean(s.autoStart);
  autoStartEl.className = "switch" + (autoStart ? " on" : "");
  portText.textContent = String(s.port);
}

async function loadPrinters(): Promise<void> {
  printerSelect.innerHTML = '<option value="">（系统默认打印机）</option>';
  const res = await window.agent.listPrinters();
  if (!res.ok || !res.printers || res.printers.length === 0) {
    printerListEl.innerHTML = '<div class="empty">未发现打印机，请检查系统打印服务</div>';
    return;
  }
  const current = (await window.agent.getSettings()).printerName;
  const list = res.printers.map((p) => {
    const display = p.displayName || p.name;
    printerSelect.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeAttr(p.name)}"${p.name === current ? " selected" : ""}>${escapeHtml(display)}</option>`
    );
    return `<div class="printer-item"><span>${escapeHtml(display)}</span></div>`;
  });
  printerListEl.innerHTML = list.join("");
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(v: string): string {
  return escapeHtml(v).replace(/'/g, "&#39;");
}

async function save(): Promise<void> {
  saveBtn.disabled = true;
  const settings = {
    printerName: printerSelect.value,
    copies: Math.max(1, Math.min(99, Number(copiesInput.value) || 1)),
    autoStart,
  };
  const res = await window.agent.saveSettings(settings);
  saveMsg.textContent = res.ok ? "已保存，立即生效" : "保存失败";
  saveMsg.className = "msg" + (res.ok ? "" : " err");
  saveBtn.disabled = false;
  setTimeout(() => (saveMsg.textContent = ""), 3000);
}

async function testPrint(): Promise<void> {
  testBtn.disabled = true;
  testMsg.textContent = "正在发送打印任务…";
  testMsg.className = "msg";
  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page { size: 58mm auto; margin: 0; }
      body { font-family: "Microsoft YaHei", sans-serif; margin: 0; padding: 6mm 4mm; width: 50mm; color: #000; }
      .t { text-align: center; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
      .s { text-align: center; font-size: 11px; margin-bottom: 8px; }
      hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
      .r { display: flex; justify-content: space-between; font-size: 12px; line-height: 1.7; }
      .r b { font-size: 14px; }
    </style></head><body>
      <div class="t">智享全链</div>
      <div class="s">本地打印助手 · 测试小票</div>
      <hr>
      <div class="r"><span>测试项目</span><span>打印通道</span></div>
      <div class="r"><span>时间</span><span>${new Date().toLocaleString("zh-CN")}</span></div>
      <hr>
      <div class="r"><span>合计</span><b>¥ 1.00</b></div>
    </body></html>`;
  const res = await window.agent.testPrint(html);
  testMsg.textContent = res.ok ? "打印任务已发送 ✓" : "打印失败：" + (res.message ?? "未知错误");
  testMsg.className = "msg" + (res.ok ? "" : " err");
  testBtn.disabled = false;
}

autoStartEl.addEventListener("click", () => {
  autoStart = !autoStart;
  autoStartEl.className = "switch" + (autoStart ? " on" : "");
});
saveBtn.addEventListener("click", save);
testBtn.addEventListener("click", testPrint);
refreshBtn.addEventListener("click", () => {
  loadStatus();
  loadSettings();
  loadPrinters();
});

window.addEventListener("DOMContentLoaded", () => {
  loadStatus();
  loadSettings();
  loadPrinters();
});
