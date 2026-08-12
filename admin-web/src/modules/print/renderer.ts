/**
 * 打印模板渲染器
 *
 * 将服务端模板内容中的 {{变量}} 替换为实际值（业务字段 HTML 转义防注入），
 * 并负责生成商品明细行等结构化片段。
 */
import type { PrintVars } from "./types";
import type { PrintModule, PrintModuleType, PrintTemplateJson } from "./types";
import { COMMON_PRINT_VARIABLES, BILL_TYPE_VARIABLES } from "./variables";

/** 变量中文名映射（渲染键值行用） */
const VARIABLE_LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const v of COMMON_PRINT_VARIABLES) map[v.key] = v.label;
  for (const list of Object.values(BILL_TYPE_VARIABLES)) {
    for (const v of list) map[v.key] = v.label;
  }
  return map;
})();

/** 可视化模板纸张样式 */
function paperCss(paper: string): string {
  if (paper.startsWith("RECEIPT_")) {
    const width = paper === "RECEIPT_58" ? "54mm" : paper === "RECEIPT_110" ? "104mm" : "76mm";
    return `body{font-family:monospace,"Courier New",sans-serif;font-size:12px;color:#000;margin:0}
.pwrap{width:${width};margin:0 auto;padding:6px 3px}
.m-title{text-align:center;font-size:18px;margin:2px 0 6px;letter-spacing:2px}
.m-header{text-align:center;margin-bottom:4px}
.m-header .name{font-size:15px;font-weight:700}
.m-header .sub{font-size:11px;line-height:1.5}
.m-block{margin:6px 0}
.m-block hr{border:none;border-top:1px dashed #000;margin:6px 0}
.m-row{display:flex;justify-content:space-between;font-size:11px;line-height:1.6}
.m-row .k{color:#333}
.m-row.total{font-weight:700;font-size:13px;margin-top:2px}
.m-items{width:100%;border-collapse:collapse;font-size:11px}
.m-items th{border-bottom:1px dashed #000;padding:2px 0;text-align:left}
.m-items td{padding:2px 0;vertical-align:top}
.m-items td.num,.m-items th.num{text-align:right;white-space:nowrap}
.m-sign{display:flex;justify-content:space-between;margin-top:12px;font-size:11px}
.m-footer{text-align:center;margin-top:8px;font-size:10px}`;
  }
  if (paper.startsWith("LABEL")) {
    return `body{margin:0;font-family:"Microsoft YaHei",sans-serif}
.pwrap{width:56mm;height:37mm;margin:1mm auto;padding:1mm 2mm;border:1px dashed #bbb;box-sizing:border-box;text-align:center;overflow:hidden}
.m-title{font-size:14px;font-weight:700;margin:3px 0 2px;line-height:1.25}
.m-block{margin:2px 0;font-size:11px}
.m-items{display:none}
.m-row{font-size:11px;line-height:1.5}
.m-row .k{color:#333}
.m-row.total{font-size:18px;font-weight:700;color:#c00}
.m-footer{display:none}`;
  }
  // A4 / 针式
  return `@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000;margin:0}
.pwrap{width:100%}
.m-title{text-align:center;font-size:22px;letter-spacing:8px;margin:8px 0 12px}
.m-header{text-align:center;margin-bottom:8px}
.m-header .name{font-size:18px;font-weight:700}
.m-header .sub{font-size:12px;line-height:1.5}
.m-block{margin:8px 0}
.m-block hr{border:none;border-top:1px solid #999;margin:8px 0}
.m-rows{border:1px solid #999}
.m-row{display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #eee;font-size:12px;line-height:1.6}
.m-row:last-child{border-bottom:none}
.m-row.total{font-weight:700}
.m-items{width:100%;border-collapse:collapse;margin-bottom:8px}
.m-items th,.m-items td{border:1px solid #999;padding:5px 6px;font-size:12px;text-align:center}
.m-items th{background:#f5f5f5}
.m-items td.left{text-align:left}
.m-sign{display:flex;justify-content:space-between;margin-top:36px;font-size:12px}
.m-footer{text-align:center;font-size:11px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px}`;
}

/** 渲染单个可视化模块（导出供编辑器画布逐模块渲染与拖拽） */
export function renderModuleHtml(module: PrintModule, vars: PrintVars): string {
  const enabledFields = Object.entries(module.fields ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
  const align = module.align ? ` style="text-align:${module.align}"` : "";
  const label = (key: string) => VARIABLE_LABEL_MAP[key] || key;
  const row = (key: string, total = false) =>
    `<div class="m-row${total ? " total" : ""}"><span class="k">${label(key)}</span><span>${escapeHtml(vars[key] ?? "")}</span></div>`;

  switch (module.type) {
    case "title": {
      const text = module.text || (vars.title as string) || "";
      const filled = text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key: string) => escapeHtml(vars[key] ?? ""));
      return `<h1 class="m-title"${align}>${filled}</h1>`;
    }
    case "header": {
      const name = enabledFields.find((k) => k === "headerName" || k === "storeName");
      const subKeys = enabledFields.filter((k) => k !== "headerName" && k !== "storeName");
      const nameValue = name ? (vars[name] ?? "") : "";
      const sub = subKeys
        .map((k) => escapeHtml(vars[k] ?? ""))
        .filter(Boolean)
        .join("　");
      return `<div class="m-header"${align}><div class="name">${escapeHtml(nameValue)}</div>${
        sub ? `<div class="sub">${sub}</div>` : ""
      }</div>`;
    }
    case "billInfo":
    case "customer": {
      return `<div class="m-block m-rows">${enabledFields.map((k) => row(k)).join("")}</div>`;
    }
    case "items": {
      const items = (vars.items as string) || "";
      const raw = items.startsWith("__raw:") ? items.slice(6) : items;
      return `<table class="m-items">${raw}</table>`;
    }
    case "summary": {
      const totalKey = enabledFields.includes("totalAmount") ? "totalAmount" : enabledFields[enabledFields.length - 1];
      return `<div class="m-block m-rows">${enabledFields.map((k) => row(k, k === totalKey)).join("")}</div>`;
    }
    case "memberBalance": {
      return `<div class="m-block m-rows">${row("memberBalance")}</div>`;
    }
    case "remark": {
      const remark = (vars.remarkBlock as string) || "";
      const raw = remark.startsWith("__raw:") ? remark.slice(6) : remark;
      return raw ? `<div class="m-block m-rows">${raw}</div>` : "";
    }
    case "sign": {
      const sign = (vars.signRoles as string) || "";
      return `<div class="m-sign">${escapeHtml(sign)}<span>客户签收：____________</span></div>`;
    }
    case "footer": {
      return `<div class="m-footer">${escapeHtml(module.text || (vars.footerText as string) || "")}</div>`;
    }
    default:
      return "";
  }
}

/** 渲染可视化 JSON 模板（content 为 JSON 时使用） */
export function renderJsonTemplate(json: PrintTemplateJson, vars: PrintVars): string {
  const css = paperCss(json.paperType);
  const body = json.modules
    .filter((m) => m.enabled)
    .map((m) => renderModuleHtml(m, vars))
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

/** HTML 转义（业务字段输出到模板前必须转义，防 XSS/格式破坏） */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 渲染模板：替换 {{key}} 占位符
 * - 值统一 HTML 转义（模板内已含结构标签，只有业务值走转义）；
 * - 提供空字符串的变量（如可空的 remarkBlock）会替换为空；
 * - 未提供的占位符保留原文，便于排查模板问题。
 */
export function renderTemplate(content: string, vars: PrintVars): string {
  return content.replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = vars[key];
    // 已生成好的 HTML 片段（items 等）不经转义，由调用方保证安全
    if (typeof value === "string" && value.startsWith("__raw:")) {
      return value.slice("__raw:".length);
    }
    return escapeHtml(value);
  });
}

/** 标记为原始 HTML 片段（items 行等，不转义） */
export function rawHtml(html: string): string {
  return `__raw:${html}`;
}

/** 表格列定义（生成商品明细行） */
export interface TableColumn<T extends Record<string, unknown>> {
  key: string;
  label?: string;
  align?: "left" | "center" | "right";
  formatter?: (row: T, index: number) => string;
  width?: string;
}

/** 生成表格行 HTML（含表头），调用方在模板中放置 {{items}} 占位符 */
export function buildTableHtml<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<TableColumn<T>>
): string {
  if (rows.length === 0) {
    return "<tr><td style='text-align:center' colspan='99'>（无明细）</td></tr>";
  }
  const head = columns
    .map((c) => `<th${c.width ? ` style="width:${c.width}"` : ""}>${escapeHtml(c.label ?? c.key)}</th>`)
    .join("");
  const body = rows
    .map((row, index) => {
      const tds = columns
        .map((c) => {
          const align = c.align ? ` style="text-align:${c.align}"` : "";
          const value = c.formatter ? c.formatter(row, index) : (row[c.key] ?? "");
          return `<td${align} class="${c.align === "left" ? "left" : ""}">${escapeHtml(value)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<tr>${head}</tr>${body}`;
}

/** 生成简单两列表格（日结/报表汇总用） */
export function buildKeyValueRows(rows: Array<{ label: string; value: unknown }>): string {
  return rows
    .map(
      (r) =>
        `<tr><td style="text-align:left;padding:4px 8px;border:1px solid #999">${escapeHtml(r.label)}</td>` +
        `<td style="text-align:right;padding:4px 8px;border:1px solid #999">${escapeHtml(r.value)}</td></tr>`
    )
    .join("");
}

/** 金额格式化（两位小数） */
export function fmtMoney(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

/** 空值转占位符 */
export function dash(value: unknown): string {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}
