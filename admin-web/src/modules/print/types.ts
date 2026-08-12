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

// ==================== 可视化模板（JSON 结构） ====================

/** 可视化模板模块类型 */
export type PrintModuleType =
  | "title"          // 单据大标题（如：销 售 单）
  | "header"         // 门店抬头（店名/电话/地址）
  | "billInfo"       // 单据信息（单号/日期/操作员/支付方式/状态）
  | "customer"       // 客户信息（名称/电话）
  | "items"          // 商品明细表
  | "summary"        // 金额汇总（合计/应收/实收/找零/优惠）
  | "memberBalance"  // 会员余额
  | "remark"         // 备注（客户/内部）
  | "sign"           // 签章区（制单/审核/业务/客户签收）
  | "footer";        // 页脚文案

/** 可视化模板模块 */
export interface PrintModule {
  id: string;
  type: PrintModuleType;
  enabled: boolean;
  /** 标题文本（title 模块用） */
  text?: string;
  /** 字段开关：键为模板变量 key */
  fields?: Record<string, boolean>;
  /** 字段显示名自定义：键为变量 key，值为自定义中文名 */
  fieldLabels?: Record<string, string>;
  /** 对齐方式 */
  align?: "left" | "center" | "right";
  /** 字号（px） */
  fontSize?: number;
  /** 模块间距 */
  spacing?: "compact" | "normal" | "loose";
  /** 信息类模块每行显示列数（单据信息/客户/金额汇总） */
  layout?: "1col" | "2col" | "3col";
}

/** 可视化模板（存储于 t_print_template.content，JSON 字符串） */
export interface PrintTemplateJson {
  version: 2;
  paperType: PrintPaperType;
  modules: PrintModule[];
}

/** 判断 content 是否为可视化 JSON 模板 */
export function isTemplateJson(content: string): boolean {
  const trimmed = (content ?? "").trim();
  return trimmed.startsWith("{") && trimmed.includes('"modules"');
}
