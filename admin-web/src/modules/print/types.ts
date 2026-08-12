/**
 * 打印模块类型定义
 *
 * 架构约定：
 * - 模板（内容/纸张类型/单据类型）存服务端，多端共享；
 * - 打印机/份数/自动打印/抬头页脚等设备配置存客户端本地（localStorage），每台终端各自设置。
 */

/** 打印单据类型 */
export type PrintBillType =
  | "SALE_RECEIPT"
  | "SALE_BILL"
  | "SALE_RETURN"
  | "PURCHASE_ORDER"
  | "REPORT"
  | "LABEL"
  | "SHIFT"
  | "DAILY_SETTLE";

/** 纸张类型 */
export type PrintPaperType =
  | "RECEIPT_58"
  | "RECEIPT_80"
  | "RECEIPT_110"
  | "A4"
  | "DOT_1UP"
  | "DOT_2UP"
  | "DOT_3UP"
  | "LABEL_60X40"
  | "LABEL_CUSTOM";

/** 打印模板（服务端） */
export interface PrintTemplate {
  id: number;
  tenantId: string;
  storeId: number | null;
  billType: PrintBillType;
  paperType: PrintPaperType;
  templateName: string;
  content: string;
  isDefault: number;
  version: number;
  status: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 客户端本地打印配置（每台终端独立） */
export interface LocalPrintConfig {
  /** 默认打印机名称（打印对话框选中项，空=由系统默认） */
  printerName: string;
  /** 默认纸张类型 */
  paperType: PrintPaperType;
  /** 默认打印份数 */
  copies: number;
  /** 结算后自动打印小票 */
  autoPrint: boolean;
  /** 小票抬头店名 */
  headerName: string;
  /** 小票抬头电话 */
  headerPhone: string;
  /** 小票抬头地址 */
  headerAddress: string;
  /** 页脚文案 */
  footerText: string;
  /** 标签宽度(mm) */
  labelWidth: number;
  /** 标签高度(mm) */
  labelHeight: number;
  /** 是否启用本地打印助手（127.0.0.1:5178） */
  useLocalAgent: boolean;
  /** 本地打印助手地址 */
  agentBaseUrl: string;
}

/** 模板渲染变量（渲染器入参，键与模板 {{变量}} 对应） */
export interface PrintVars {
  [key: string]: string | number;
}

/** 本地打印助手响应 */
export interface LocalAgentPrinter {
  name: string;
  isDefault?: boolean;
}

/** 打印记录上报入参 */
export interface PrintRecordInput {
  billType: string;
  billNo: string;
  copies?: number;
  printerMac?: string;
  status?: "SUCCESS" | "FAILED" | "PENDING";
  errorMsg?: string;
}

/** 打印结果 */
export interface PrintResult {
  ok: boolean;
  channel: "browser" | "agent";
  message?: string;
}
