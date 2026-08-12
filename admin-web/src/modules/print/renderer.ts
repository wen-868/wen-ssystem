/**
 * 打印模板渲染器
 *
 * 将服务端模板内容中的 {{变量}} 替换为实际值（业务字段 HTML 转义防注入），
 * 并负责生成商品明细行等结构化片段。
 */
import type { PrintVars } from "./types";
import type {
  PrintCodeWidget,
  PrintModule,
  PrintModuleType,
  PrintTemplateJson,
  PrintTemplateV3,
  PrintWidget,
} from "./types";
import { COMMON_PRINT_VARIABLES, BILL_TYPE_VARIABLES } from "./variables";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode-generator";

/** 金额类字段：渲染时自动补 ¥ */
const AMOUNT_KEYS = new Set([
  "totalAmount", "paidAmount", "changeAmount", "discountAmount", "receivedAmount",
  "memberBalance", "price", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount",
]);

/** 商品明细列元信息（可视化编辑器可勾选/排序的列） */
const ITEM_COLUMN_META: Record<
  string,
  { label: string; align?: "left" | "center" | "right"; formatter?: (row: Record<string, unknown>) => string }
> = {
  name: { label: "商品名称", align: "left" },
  spec: { label: "规格", align: "left" },
  barcode: { label: "条码" },
  unit: { label: "单位" },
  qty: { label: "数量" },
  price: { label: "单价", align: "right", formatter: (r) => `¥${fmtMoney(r.price)}` },
  amount: {
    label: "金额",
    align: "right",
    formatter: (r) => `¥${fmtMoney(r.amount ?? Number(r.price ?? 0) * Number(r.qty ?? r.quantity ?? 0))}`,
  },
  trace: { label: "追溯码", align: "left" },
  remark: { label: "备注", align: "left" },
};

/** 变量中文名：优先模块自定义名 → 当前单据类型 → 通用变量 → 回退键名 */
function getVariableLabel(key: string, billType?: string, module?: PrintModule): string {
  const custom = module?.fieldLabels?.[key];
  if (custom) return custom;
  if (billType) {
    const typeVars = BILL_TYPE_VARIABLES[billType as keyof typeof BILL_TYPE_VARIABLES];
    const found = typeVars?.find((v) => v.key === key);
    if (found) return found.label;
  }
  const common = COMMON_PRINT_VARIABLES.find((v) => v.key === key);
  return common?.label ?? key;
}

/** 金额字段格式化：空值显示 -，非空补 ¥ */
function formatAmountValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  const str = String(value);
  if (AMOUNT_KEYS.has(key) && !str.includes("¥")) return `¥${str}`;
  return str;
}

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
.m-rows{display:grid;gap:2px 10px;margin:2px 0}
.m-cell{display:flex;justify-content:space-between;font-size:11px;line-height:1.6}
.m-cell .k{color:#333}
.m-cell.total{font-weight:700;font-size:13px;margin-top:2px}
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
.m-rows{display:grid;gap:2px}
.m-cell{display:flex;justify-content:space-between;font-size:11px;line-height:1.5}
.m-cell .k{color:#333}
.m-cell.total{font-size:18px;font-weight:700;color:#c00}
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
.m-rows{display:grid;gap:0;border:1px solid #999}
.m-cell{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;border-bottom:1px solid #eee;font-size:12px;line-height:1.6}
.m-cell:last-child{border-bottom:none}
.m-cell.total{font-weight:700}
.m-items{width:100%;border-collapse:collapse;margin-bottom:8px}
.m-items th,.m-items td{border:1px solid #999;padding:5px 6px;font-size:12px;text-align:center}
.m-items th{background:#f5f5f5}
.m-items td.left{text-align:left}
.m-sign{display:flex;justify-content:space-between;margin-top:36px;font-size:12px}
.m-footer{text-align:center;font-size:11px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px}`;
}

/** 渲染单个可视化模块（导出供编辑器画布逐模块渲染与拖拽） */
export function renderModuleHtml(module: PrintModule, vars: PrintVars, billType?: string): string {
  const enabledFields = Object.entries(module.fields ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
  const align = module.align ? ` style="text-align:${module.align}"` : "";
  const label = (key: string) => getVariableLabel(key, billType, module);
  const colCount = module.layout === "2col" ? 2 : module.layout === "3col" ? 3 : 1;
  const cell = (key: string, total = false) =>
    `<div class="m-cell${total ? " total" : ""}"><span class="k">${label(key)}</span><span>${escapeHtml(formatAmountValue(key, vars[key]))}</span></div>`;

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
      return `<div class="m-block m-rows" style="grid-template-columns:repeat(${colCount},1fr)">${enabledFields.map((k) => cell(k)).join("")}</div>`;
    }
    case "items": {
      // 优先结构化明细（可视化编辑器可配置列），否则兼容旧 HTML
      if (Array.isArray(vars.itemsRows)) {
        const colKeys = Object.keys(module.fields ?? {}).filter((k) => module.fields?.[k]);
        const cols = colKeys.length > 0
          ? colKeys
          : ["name", "qty", "amount"];
        const head = cols
          .map((key) => {
            const meta = ITEM_COLUMN_META[key];
            const align = meta?.align === "right" ? ' class="num"' : meta?.align === "left" ? ' class="left"' : "";
            const headLabel = module.fieldLabels?.[key] ?? meta?.label ?? key;
            return `<th${align}>${escapeHtml(headLabel)}</th>`;
          })
          .join("");
        const rows = (vars.itemsRows as Array<Record<string, unknown>>)
          .map(
            (row) =>
              `<tr>${cols
                .map((key) => {
                  const meta = ITEM_COLUMN_META[key];
                  const align = meta?.align === "right" ? ' class="num"' : meta?.align === "left" ? ' class="left"' : "";
                  return `<td${align}>${escapeHtml(meta?.formatter ? meta.formatter(row) : (row[key] ?? ""))}</td>`;
                })
                .join("")}</tr>`
          )
          .join("");
        return `<table class="m-items"><tr>${head}</tr>${rows}</table>`;
      }
      const items = (vars.items as string) || "";
      const raw = items.startsWith("__raw:") ? items.slice(6) : items;
      return `<table class="m-items">${raw}</table>`;
    }
    case "summary": {
      const totalKey = enabledFields.includes("totalAmount") ? "totalAmount" : enabledFields[enabledFields.length - 1];
      return `<div class="m-block m-rows" style="grid-template-columns:repeat(${colCount},1fr)">${enabledFields.map((k) => cell(k, k === totalKey)).join("")}</div>`;
    }
    case "memberBalance": {
      const balance = vars.memberBalance ?? vars.memberBalanceRow ?? "";
      const value = String(balance).startsWith("__raw:")
        ? String(balance).slice(6)
        : String(balance);
      if (!value && !vars.memberBalance) return "";
      return `<div class="m-block m-rows"><div class="m-cell"><span class="k">${getVariableLabel("memberBalance", billType, module)}</span><span>${escapeHtml(value.startsWith("¥") ? value : `¥${value}`)}</span></div></div>`;
    }
    case "remark": {
      const remark = (vars.remarkBlock as string) || "";
      const raw = remark.startsWith("__raw:") ? remark.slice(6) : remark;
      return raw ? `<div class="m-block">${raw}</div>` : "";
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

// ==================== v3 自由控件渲染 ====================

/** 替换 {{变量}} 占位符（与 renderTemplate 同规则） */
function replaceVars(text: string, vars: PrintVars): string {
  return String(text ?? "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = vars[key];
    if (typeof value === "string" && value.startsWith("__raw:")) {
      return value.slice("__raw:".length);
    }
    return escapeHtml(value);
  });
}

/** 控件通用 CSS（位置/尺寸/字体/边框等，单位 mm/pt） */
function widgetStyle(w: PrintWidget): string {
  const s: string[] = [
    `left:${w.x}mm`,
    `top:${w.y}mm`,
    `width:${w.width}mm`,
    `height:${w.height}mm`,
    `z-index:${w.zIndex ?? 0}`,
  ];
  if (w.fontSize) s.push(`font-size:${w.fontSize}pt`);
  if (w.fontWeight) s.push(`font-weight:${w.fontWeight}`);
  if (w.align) s.push(`text-align:${w.align}`);
  if (w.color) s.push(`color:${w.color}`);
  if (w.opacity !== undefined && w.opacity < 1) s.push(`opacity:${w.opacity}`);
  if (w.rotation) s.push(`transform:rotate(${w.rotation}deg)`);
  if (w.borderWidth) {
    if (w.kind === "line") {
      const style = (w as PrintWidget & { lineStyle?: "solid" | "dashed" | "dotted" }).lineStyle ?? "solid";
      s.push("border:none");
      if (w.width >= w.height) {
        s.push(`border-top:${w.borderWidth}pt ${style} ${w.color ?? "#000"}`);
      } else {
        s.push(`border-left:${w.borderWidth}pt ${style} ${w.color ?? "#000"}`);
      }
    } else {
      s.push(`border:${w.borderWidth}pt solid ${w.borderColor ?? "#000"}`);
    }
  }
  if (w.backgroundColor) s.push(`background:${w.backgroundColor}`);
  if (w.padding) s.push(`padding:${w.padding}mm`);
  return s.join(";");
}

/** 生成一维条码 dataURL（同步） */
function renderBarcodeDataUrl(value: string, widget: PrintCodeWidget): string {
  try {
    const canvas = document.createElement("canvas");
    const px = (n: number) => Math.max(2, Math.round(n * 3.78));
    JsBarcode(canvas, value, {
      format: (widget.format ?? "CODE128") as "CODE128" | "CODE39" | "EAN13",
      displayValue: widget.showText !== false,
      width: 2,
      height: px(widget.height),
      margin: 2,
      font: "monospace",
      fontSize: 12,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

/** 生成二维码 dataURL（同步） */
function renderQrcodeDataUrl(value: string): string {
  try {
    const qr = QRCode(0, "M");
    qr.addData(value);
    qr.make();
    return qr.createDataURL(4, 4);
  } catch {
    return "";
  }
}

/** 字段值格式化（金额自动 ¥、空值占位） */
function widgetFieldValue(key: string, vars: PrintVars, emptyText?: string): string {
  const value = vars[key];
  if (value === null || value === undefined || value === "") return emptyText ?? "";
  const str = String(value);
  if (AMOUNT_KEYS.has(key) && !str.includes("¥")) return `¥${str}`;
  return str;
}

/** 渲染单个 v3 控件内容 HTML（编辑器画布内层使用，不含定位样式） */
function widgetContentHtml(w: PrintWidget, vars: PrintVars, billType?: string, scale?: number): string {
  switch (w.kind) {
    case "text":
      return replaceVars(w.text, vars);

    case "field": {
      const value = widgetFieldValue(w.fieldKey, vars, w.emptyText);
      if (!w.showLabel) return escapeHtml(value);
      const label = w.label || getVariableLabel(w.fieldKey, billType);
      return `<span class="zx-field-label">${escapeHtml(label)}：</span><span class="zx-field-value">${escapeHtml(value)}</span>`;
    }

    case "table": {
      const rows = Array.isArray(vars[w.dataSource]) ? (vars[w.dataSource] as Array<Record<string, unknown>>) : [];
      const totalColWidth = w.columns.reduce((sum, c) => sum + (c.width || 10), 0) || 1;
      const colCss = w.columns
        .map(
          (c) =>
            `<col style="width:${((c.width || 10) / totalColWidth) * 100}%">`
        )
        .join("");
      const head = w.showHeader
        ? `<tr>${w.columns
            .map(
              (c) =>
                `<th style="text-align:${c.align ?? "center"}">${escapeHtml(c.label || c.key)}</th>`
            )
            .join("")}</tr>`
        : "";
      const body = rows
        .map((row, rowIndex) => {
          const tds = w.columns
            .map((c) => {
              const meta = ITEM_COLUMN_META[c.key];
              const align = c.align ?? meta?.align ?? "center";
              // 序号列自动生成行号
              const value = c.key === "index" ? String(rowIndex + 1) : meta?.formatter ? meta.formatter(row) : (row[c.key] ?? "");
              return `<td style="text-align:${align}">${escapeHtml(value)}</td>`;
            })
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      const pad = w.cellPadding ?? 1;
      // 编辑器画布按 scale 放大字号保证清晰；打印保持 pt 单位
      const fs = w.fontSize ?? 9;
      const fsCss = scale ? `${(fs * scale).toFixed(1)}px` : `${fs}pt`;
      return `<table class="zx-table" style="width:100%;border-collapse:collapse;font-size:${fsCss};line-height:1.35">` +
        `<colgroup>${colCss}</colgroup>${head}${body || `<tr><td style="text-align:center">（无明细）</td></tr>`}</table>`;
    }

    case "image": {
      const src = w.src.startsWith("{{") ? String(vars[w.src.slice(2, -2).trim()] ?? "") : w.src;
      if (!src) return "";
      return `<img src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:${w.fit}" />`;
    }

    case "barcode":
    case "qrcode": {
      const value = w.value.startsWith("{{")
        ? String(vars[w.value.slice(2, -2).trim()] ?? "")
        : w.value;
      const dataUrl = w.kind === "barcode" ? renderBarcodeDataUrl(value, w) : renderQrcodeDataUrl(value);
      if (!dataUrl) return escapeHtml(value || "（空）");
      return `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain" />`;
    }

    case "rect":
      return "";

    case "line":
      return "";

    default:
      return "";
  }
}

/** 渲染单个 v3 控件 HTML（打印使用，mm 精确定位） */
export function renderV3WidgetHtml(w: PrintWidget, vars: PrintVars, billType?: string): string {
  const cls = ["zx-widget", w.kind === "table" ? "zx-table-wrap" : w.kind === "rect" ? "zx-rect" : w.kind === "line" ? "zx-line" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${cls}" data-widget-id="${escapeHtml(w.id)}" style="${widgetStyle(w)}">${widgetContentHtml(w, vars, billType)}</div>`;
}

/** 渲染控件内容（编辑器画布内层使用，不含定位样式） */
export function renderV3WidgetContentHtml(w: PrintWidget, vars: PrintVars, billType?: string, scale?: number): string {
  return widgetContentHtml(w, vars, billType, scale);
}

/** v3 纸张 CSS（精确 mm 打印） */
function v3PaperCss(paper: PrintTemplateV3["paper"]): string {
  const { width, height } = paper;
  const orientation = paper.orientation === "landscape" && width < height
    ? `size:${height}mm ${width}mm`
    : `size:${width}mm ${height}mm`;
  return `@page{${orientation};margin:0}
body{margin:0;font-family:"Microsoft YaHei","SimSun",sans-serif;color:#000}
.zx-paper{position:relative;width:${width}mm;height:${height}mm;margin:0 auto;overflow:hidden;box-sizing:border-box;background:#fff}
.zx-widget{position:absolute;box-sizing:border-box;overflow:hidden;white-space:pre-wrap;word-break:break-all}
.zx-widget.zx-table-wrap{overflow:visible}
.zx-table{width:100%;border-collapse:collapse;table-layout:fixed}
.zx-table th,.zx-table td{border:1px solid #000;padding:${paper.type.startsWith("RECEIPT_") ? 0 : 1}mm 1mm;vertical-align:top}
.zx-table th{font-weight:700}
.zx-field-label{font-weight:700}
.zx-rect{background:${"#fff"}}`;
}

/** 渲染完整 v3 纸张 HTML（打印用，mm 精确） */
export function renderV3PaperHtml(json: PrintTemplateV3, vars: PrintVars, billType?: string): string {
  const css = v3PaperCss(json.paper);
  const widgets = (json.widgets ?? [])
    .filter((w) => w.visible !== false)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((w) => renderV3WidgetHtml(w, vars, billType))
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="zx-paper">${widgets}</div></body></html>`;
}

/** 渲染可视化模板：v3 自由控件 / v2 模块化 分流 */
export function renderJsonTemplate(
  json: PrintTemplateJson | PrintTemplateV3,
  vars: PrintVars,
  billType?: string
): string {
  if (json.version === 3) {
    return renderV3PaperHtml(json, vars, billType);
  }
  const css = paperCss(json.paperType);
  const body = json.modules
    .filter((m) => m.enabled)
    .map((m) => renderModuleHtml(m, vars, billType))
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}
