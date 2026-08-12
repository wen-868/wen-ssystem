/**
 * 客户端本地打印配置（localStorage 持久化，每台终端独立）
 *
 * 服务端只管理模板；打印机/纸张/份数/自动打印/抬头页脚等设备相关配置
 * 全部保存在本机浏览器，实现"客户端本地配置"。
 */
import type { LocalPrintConfig, PrintPaperType } from "./types";

const STORAGE_KEY = "zx_print_local_config_v1";

/** 默认本地打印配置 */
export const DEFAULT_LOCAL_PRINT_CONFIG: LocalPrintConfig = {
  printerName: "",
  paperType: "RECEIPT_80",
  copies: 1,
  autoPrint: true,
  headerName: "智享全链",
  headerPhone: "",
  headerAddress: "",
  footerText: "谢谢惠顾，欢迎再次光临！",
  labelWidth: 60,
  labelHeight: 40,
  useLocalAgent: false,
  agentBaseUrl: "http://127.0.0.1:5178",
};

/** 纸张类型中文名（配置面板展示） */
export const PAPER_TYPE_LABELS: Record<PrintPaperType, string> = {
  RECEIPT_58: "热敏小票 58mm",
  RECEIPT_80: "热敏小票 80mm",
  RECEIPT_110: "热敏小票 110mm",
  A4: "A4 纸",
  DOT_1UP: "针式连续纸（一等分）",
  DOT_2UP: "针式连续纸（二等分）",
  DOT_3UP: "针式连续纸（三等分）",
  LABEL_60X40: "标签纸 60x40mm",
  LABEL_CUSTOM: "标签纸（自定义尺寸）",
};

function isLocalPrintConfig(value: unknown): value is LocalPrintConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.printerName === "string" &&
    typeof v.paperType === "string" &&
    typeof v.copies === "number" &&
    typeof v.autoPrint === "boolean" &&
    typeof v.headerName === "string" &&
    typeof v.headerPhone === "string" &&
    typeof v.headerAddress === "string" &&
    typeof v.footerText === "string" &&
    typeof v.labelWidth === "number" &&
    typeof v.labelHeight === "number" &&
    typeof v.useLocalAgent === "boolean" &&
    typeof v.agentBaseUrl === "string"
  );
}

/** 读取本地打印配置（无/损坏时回退默认） */
export function getLocalPrintConfig(): LocalPrintConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LOCAL_PRINT_CONFIG };
    const parsed = JSON.parse(raw) as unknown;
    if (!isLocalPrintConfig(parsed)) return { ...DEFAULT_LOCAL_PRINT_CONFIG };
    return { ...DEFAULT_LOCAL_PRINT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_LOCAL_PRINT_CONFIG };
  }
}

/** 保存本地打印配置 */
export function saveLocalPrintConfig(config: LocalPrintConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 重置为默认 */
export function resetLocalPrintConfig(): LocalPrintConfig {
  const def = { ...DEFAULT_LOCAL_PRINT_CONFIG };
  saveLocalPrintConfig(def);
  return def;
}
