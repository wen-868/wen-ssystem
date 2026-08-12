/**
 * 打印模板渲染器
 *
 * 将服务端模板内容中的 {{变量}} 替换为实际值（业务字段 HTML 转义防注入），
 * 并负责生成商品明细行等结构化片段。
 */
import type { PrintVars } from "./types";

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
