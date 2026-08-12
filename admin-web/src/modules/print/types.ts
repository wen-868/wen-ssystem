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
  [key: string]: unknown;
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

// ==================== v3 自由控件模板（行业标准可视化设计） ====================

/** 控件种类 */
export type PrintWidgetKind =
  | "text"       // 文本（可含 {{变量}} 占位符）
  | "field"      // 数据字段（标签 + 值）
  | "table"      // 表格（商品明细/报表数据）
  | "image"      // 图片（Logo 等）
  | "barcode"    // 一维条码
  | "qrcode"     // 二维码
  | "rect"       // 矩形
  | "line";      // 线条

/** 控件基础属性（位置/尺寸均以毫米 mm 为单位，与纸张一致） */
export interface PrintWidgetBase {
  id: string;
  kind: PrintWidgetKind;
  /** 距纸面左上角水平距离（mm） */
  x: number;
  /** 距纸面左上角垂直距离（mm） */
  y: number;
  /** 控件宽度（mm） */
  width: number;
  /** 控件高度（mm） */
  height: number;
  /** 层叠顺序 */
  zIndex: number;
  /** 锁定（编辑时不可拖动） */
  locked?: boolean;
  /** 是否显示 */
  visible?: boolean;
  /** 字号（pt，1pt ≈ 0.3528mm） */
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  color?: string;
  opacity?: number;
  /** 旋转角度（度） */
  rotation?: number;
  /** 边框宽度（pt） */
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  /** 内边距（mm） */
  padding?: number;
}

/** 文本控件 */
export interface PrintTextWidget extends PrintWidgetBase {
  kind: "text";
  /** 文本内容，支持 {{变量}} 占位符 */
  text: string;
}

/** 数据字段控件（显示"标签：值"） */
export interface PrintFieldWidget extends PrintWidgetBase {
  kind: "field";
  /** 模板变量 key（如 billNo、customerName） */
  fieldKey: string;
  /** 显示名（如"客户名称"） */
  label: string;
  /** 是否显示标签 */
  showLabel: boolean;
  /** 空值显示文案 */
  emptyText?: string;
}

/** 表格列配置 */
export interface PrintTableColumn {
  key: string;
  label: string;
  /** 列宽（mm） */
  width: number;
  align?: "left" | "center" | "right";
}

/** 表格控件（商品明细/报表数据） */
export interface PrintTableWidget extends PrintWidgetBase {
  kind: "table";
  /** 数据源变量 key（如 itemsRows、reportRows） */
  dataSource: string;
  columns: PrintTableColumn[];
  /** 是否显示表头 */
  showHeader: boolean;
  /** 行高（mm） */
  rowHeight?: number;
  /** 表头字号（pt） */
  headerFontSize?: number;
  /** 单元格内边距（mm） */
  cellPadding?: number;
}

/** 图片控件 */
export interface PrintImageWidget extends PrintWidgetBase {
  kind: "image";
  /** 图片地址，或模板变量 key（如 logo） */
  src: string;
  fit: "contain" | "cover" | "stretch";
}

/** 条码/二维码控件 */
export interface PrintCodeWidget extends PrintWidgetBase {
  kind: "barcode" | "qrcode";
  /** 编码内容：固定值或模板变量 key（如 barcode） */
  value: string;
  /** 一维条码格式 */
  format?: "CODE128" | "CODE39" | "EAN13";
  /** 条码下方是否显示文字 */
  showText?: boolean;
}

/** 矩形控件 */
export interface PrintRectWidget extends PrintWidgetBase {
  kind: "rect";
  borderRadius?: number;
}

/** 线条控件 */
export interface PrintLineWidget extends PrintWidgetBase {
  kind: "line";
  lineStyle?: "solid" | "dashed" | "dotted";
}

/** 全部控件类型 */
export type PrintWidget =
  | PrintTextWidget
  | PrintFieldWidget
  | PrintTableWidget
  | PrintImageWidget
  | PrintCodeWidget
  | PrintRectWidget
  | PrintLineWidget;

/** 纸张设置（v3 完整可自定义） */
export interface PrintPaperSettings {
  /** 纸张类型标识（便于与旧数据/配置对接） */
  type: PrintPaperType;
  /** 纸宽（mm） */
  width: number;
  /** 纸高（mm） */
  height: number;
  orientation: "portrait" | "landscape";
  /** 上边距（mm） */
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

/** v3 自由控件模板（存储于 t_print_template.content，JSON 字符串） */
export interface PrintTemplateV3 {
  version: 3;
  paper: PrintPaperSettings;
  widgets: PrintWidget[];
}

/** 判断 content 是否为 v3 自由控件模板 */
export function isTemplateV3(content: string): boolean {
  const trimmed = (content ?? "").trim();
  return trimmed.startsWith("{") && trimmed.includes('"version":3');
}

/** 纸张类型默认尺寸（mm）：用于新建模板与纸张切换 */
export const PAPER_DEFAULT_SIZE: Record<PrintPaperType, { width: number; height: number }> = {
  RECEIPT_58: { width: 58, height: 120 },
  RECEIPT_80: { width: 80, height: 140 },
  RECEIPT_110: { width: 110, height: 160 },
  A4: { width: 210, height: 297 },
  DOT_1UP: { width: 241, height: 279 },
  DOT_2UP: { width: 241, height: 140 },
  DOT_3UP: { width: 241, height: 93 },
  LABEL_60X40: { width: 60, height: 40 },
  LABEL_CUSTOM: { width: 60, height: 40 },
};

/** 创建默认 v3 纸张设置 */
export function createPaperSettings(type: PrintPaperType = "A4"): PrintPaperSettings {
  const size = PAPER_DEFAULT_SIZE[type] ?? PAPER_DEFAULT_SIZE.A4;
  return {
    type,
    width: size.width,
    height: size.height,
    orientation: "portrait",
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
  };
}
