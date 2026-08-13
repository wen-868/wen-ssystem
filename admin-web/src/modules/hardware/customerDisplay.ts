/**
 * 客显（顾客显示屏）指令编码
 *
 * 常见协议：
 * - ESC_POS：ESC Z 清屏 + ESC J 第一行 + ESC K 第二行（启明/亿城/中崎等多数品牌）
 * - VKP80：ESC Z 清屏 + ESC J 文本（威肯/联迪等）
 * - TEXT：纯文本 + 回车换行（支持 UTF-8 的串口显示屏）
 * - CUSTOM：自定义十六进制模板，支持 {line1} {line2} {amount} 占位（按 UTF-8 十六进制替换）
 */
import { serialWrite } from "./serialClient";

export type DisplayProtocol = "ESC_POS" | "VKP80" | "TEXT" | "CUSTOM";

function utf8Hex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** hex 字符串 → base64（浏览器安全，无 Buffer 依赖） */
function hexToBase64(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  let bin = "";
  for (let i = 0; i < clean.length; i += 2) {
    bin += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return btoa(bin);
}

/** 编码客显指令（hex） */
export function encodeDisplayCommand(
  protocol: DisplayProtocol,
  lines: string[],
  vars: { amount?: number; template?: string } = {}
): string {
  const line1 = lines[0] || "";
  const line2 = lines[1] || "";
  switch (protocol) {
    case "ESC_POS":
      return `1B5A1B4A${utf8Hex(line1)}1B4B${utf8Hex(line2)}`;
    case "VKP80":
      return `1B5A1B4A${utf8Hex(line1)}${line2 ? `1B4B${utf8Hex(line2)}` : ""}`;
    case "TEXT":
      return utf8Hex(`${line1}${line2 ? `\r\n${line2}` : ""}\r\n`);
    case "CUSTOM": {
      const tpl = vars.template || "";
      const amount = typeof vars.amount === "number" ? vars.amount.toFixed(2) : "";
      return tpl
        .replace(/\{line1\}/g, utf8Hex(line1))
        .replace(/\{line2\}/g, utf8Hex(line2))
        .replace(/\{amount\}/g, utf8Hex(amount));
    }
    default:
      return "";
  }
}

/** 向客显显示内容（经本地打印助手写串口） */
export async function showCustomerDisplay(opts: {
  port: string;
  baudRate?: number;
  protocol: DisplayProtocol;
  lines: string[];
  amount?: number;
  template?: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!opts.port) return { ok: false, message: "未配置客显 COM 口" };
  const base64 = hexToBase64(encodeDisplayCommand(opts.protocol, opts.lines, {
    amount: opts.amount,
    template: opts.template,
  }));
  return serialWrite({
    port: opts.port,
    baudRate: opts.baudRate || 9600,
    base64,
  });
}
