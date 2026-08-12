/**
 * 打印客户端：模板加载、渲染、打印通道编排与留痕上报
 *
 * 通道优先级：
 * 1. 本地打印助手（127.0.0.1:5178，客户端本地安装，按配置的打印机直出，适合热敏/针式/标签）；
 * 2. 浏览器打印（window.print，用户在打印对话框选择打印机，适合 A4/通用）。
 *
 * 弹窗限制处理：window.open 必须在用户手势同步调用，故先同步打开空窗口，
 * 异步加载模板后写入内容再触发打印。
 */
import { fetchPrintTemplates, reportPrintRecord } from "./api";
import { getLocalPrintConfig } from "./localConfig";
import { renderJsonTemplate, renderTemplate } from "./renderer";
import type {
  LocalAgentPrinter,
  PrintResult,
  PrintTemplateJson,
  PrintTemplateV3,
  PrintVars,
} from "./types";
import { isTemplateJson, isTemplateV3 } from "./types";

/** 同步打开打印窗口（必须在用户点击等手势内调用） */
export function openPrintWindow(): Window | null {
  return window.open("", "_blank", "width=860,height=640");
}

/** 将渲染完成的 HTML 写入窗口并触发打印 */
export function fillPrintWindow(win: Window, title: string, html: string, copies = 1): void {
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`);
  win.document.close();
  win.document.title = title;
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      // 打印对话框由用户手动触发
    }
  }, 350);
  // 份数 > 1 时循环触发打印（浏览器打印对话框允许改份数，此处作为补充）
  for (let i = 1; i < copies; i++) {
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* 忽略 */
      }
    }, 350 + i * 600);
  }
}

/** 检测本地打印助手是否可用 */
export async function detectLocalAgent(baseUrl?: string): Promise<boolean> {
  const cfg = getLocalPrintConfig();
  const url = (baseUrl ?? cfg.agentBaseUrl).replace(/\/+$/, "");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${url}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** 获取本地打印机列表（未安装助手时返回空数组） */
export async function listLocalPrinters(baseUrl?: string): Promise<LocalAgentPrinter[]> {
  const cfg = getLocalPrintConfig();
  const url = (baseUrl ?? cfg.agentBaseUrl).replace(/\/+$/, "");
  try {
    const res = await fetch(`${url}/printers`);
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (Array.isArray(data)) return data as LocalAgentPrinter[];
    return ((data as Record<string, unknown>)?.printers as LocalAgentPrinter[]) ?? [];
  } catch {
    return [];
  }
}

/** 通过本地打印助手直出（热敏/针式/标签推荐） */
export async function printViaAgent(opts: {
  html: string;
  copies?: number;
  printerName?: string;
  paperType?: string;
  baseUrl?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const cfg = getLocalPrintConfig();
  const url = (opts.baseUrl ?? cfg.agentBaseUrl).replace(/\/+$/, "");
  try {
    const res = await fetch(`${url}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: opts.html,
        copies: opts.copies ?? cfg.copies,
        printerName: opts.printerName ?? cfg.printerName,
        paperType: opts.paperType ?? cfg.paperType,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || `打印助手返回 ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** 加载单据类型模板（取启用状态的第一条） */
export async function loadTemplate(billType: string): Promise<{ content: string; paperType: string } | null> {
  const list = await fetchPrintTemplates({ billType });
  const active =
    list.find((t) => t.status === 1 && t.isDefault === 1) ??
    list.find((t) => t.status === 1) ??
    list[0];
  if (!active) return null;
  return { content: active.content ?? "", paperType: active.paperType };
}

/** 默认模板内容兜底（服务端初始化前使用，保证打印不中断） */
export const FALLBACK_TEMPLATE = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:"Microsoft YaHei",sans-serif;font-size:13px;color:#000;padding:16px}
h2{text-align:center}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border:1px solid #999;padding:5px 8px;text-align:center;font-size:12px}
th{background:#f5f5f5}
.total{margin-top:12px;text-align:right;font-weight:700}
.foot{margin-top:16px;text-align:center;color:#666;font-size:11px}
</style></head><body>
<h2>智享全链 · 单据</h2>
<div>单号：{{billNo}}　日期：{{billDate}}　操作人：{{operatorName}}</div>
<table><tr><th>#</th><th>商品</th><th>数量</th><th>金额</th></tr>{{items}}</table>
<div class="total">合计：¥{{totalAmount}}</div>
<div class="foot">{{footerText}}</div>
</body></html>`;

/** 渲染模板内容（兼容可视化 JSON 与旧 HTML） */
export function renderAnyTemplate(content: string, vars: PrintVars, billType?: string): string {
  if (isTemplateV3(content) || isTemplateJson(content)) {
    try {
      const json = JSON.parse(content) as PrintTemplateJson | PrintTemplateV3;
      return renderJsonTemplate(json, vars, billType);
    } catch {
      // JSON 解析失败回退 HTML 渲染
    }
  }
  return renderTemplate(content, vars);
}

/**
 * 打印单据（异步加载模板后输出）
 * @param win 已同步打开的打印窗口（推荐）；为空时尝试本地助手，再兜底新窗口
 */
export async function printBill(opts: {
  billType: string;
  billNo: string;
  vars: PrintVars;
  title?: string;
  win?: Window | null;
  copies?: number;
  report?: boolean;
}): Promise<PrintResult> {
  const cfg = getLocalPrintConfig();
  const { billType, billNo, vars, title = "打印", report = true, copies = cfg.copies } = opts;
  let html = "";
  try {
    const template = await loadTemplate(billType);
    html = renderAnyTemplate(template?.content ?? FALLBACK_TEMPLATE, vars, billType);
  } catch (e) {
    html = renderAnyTemplate(FALLBACK_TEMPLATE, vars, billType);
    if (report) {
      reportPrintRecord({
        billType,
        billNo,
        copies,
        status: "FAILED",
        errorMsg: `模板加载失败：${e instanceof Error ? e.message : String(e)}`,
      }).catch(() => {});
    }
    // 已同步打开的窗口也要填充兜底模板，避免白屏
    if (opts.win) {
      fillPrintWindow(opts.win, title, html, copies);
      return { ok: true, channel: "browser", message: "模板加载失败，已使用默认样式" };
    }
    return { ok: false, channel: "browser", message: "模板加载失败，已使用默认样式" };
  }

  // 优先：已同步打开的窗口（浏览器打印）
  if (opts.win) {
    fillPrintWindow(opts.win, title, html, copies);
    if (report) {
      reportPrintRecord({ billType, billNo, copies, status: "SUCCESS" }).catch(() => {});
    }
    return { ok: true, channel: "browser" };
  }

  // 次优先：本地打印助手（收银小票/针式/标签直出）
  if (cfg.useLocalAgent) {
    const agentResult = await printViaAgent({ html, copies, paperType: cfg.paperType });
    if (agentResult.ok) {
      if (report) {
        reportPrintRecord({
          billType,
          billNo,
          copies,
          printerMac: cfg.printerName || undefined,
          status: "SUCCESS",
        }).catch(() => {});
      }
      return { ok: true, channel: "agent" };
    }
  }

  // 兜底：新窗口浏览器打印
  const win = openPrintWindow();
  if (!win) {
    if (report) {
      reportPrintRecord({ billType, billNo, copies, status: "FAILED", errorMsg: "浏览器拦截弹窗" }).catch(() => {});
    }
    return { ok: false, channel: "browser", message: "请允许弹出窗口以打印" };
  }
  fillPrintWindow(win, title, html, copies);
  if (report) {
    reportPrintRecord({ billType, billNo, copies, status: "SUCCESS" }).catch(() => {});
  }
  return { ok: true, channel: "browser" };
}
