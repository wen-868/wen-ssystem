/**
 * 打印模板变量字典（按单据类型）
 *
 * 模板编辑页提供"插入变量"面板；渲染器将 {{key}} 替换为实际值。
 */
import type { PrintBillType } from "./types";

export interface PrintVariable {
  key: string;
  label: string;
  desc?: string;
}

/** 通用变量（所有单据可用） */
export const COMMON_PRINT_VARIABLES: PrintVariable[] = [
  { key: "headerName", label: "店名" },
  { key: "headerPhone", label: "门店电话" },
  { key: "headerAddress", label: "门店地址" },
  { key: "storeName", label: "门店名称" },
  { key: "storePhone", label: "门店电话" },
  { key: "storeAddress", label: "门店地址" },
  { key: "billNo", label: "单号" },
  { key: "billDate", label: "单据日期" },
  { key: "operatorName", label: "制单人/收银员" },
  { key: "auditorName", label: "审核人" },
  { key: "salesmanName", label: "业务员" },
  { key: "billStatus", label: "单据状态" },
  { key: "saleType", label: "销售类型" },
  { key: "customerName", label: "客户名称" },
  { key: "customerPhone", label: "客户电话" },
  { key: "paymentMethod", label: "支付方式" },
  { key: "reportTitle", label: "报表标题" },
  { key: "reportPeriod", label: "报表期间" },
  { key: "reportHeaders", label: "报表表头" },
  { key: "shiftNo", label: "班次号" },
  { key: "receiverName", label: "接班人" },
  { key: "saleCount", label: "销售笔数" },
  { key: "items", label: "商品明细" },
  { key: "itemsRows", label: "商品明细数据" },
  { key: "totalAmount", label: "合计金额" },
  { key: "discountAmount", label: "优惠金额" },
  { key: "paidAmount", label: "实收金额" },
  { key: "receivedAmount", label: "已收金额" },
  { key: "changeAmount", label: "找零" },
  { key: "memberBalance", label: "会员余额" },
  { key: "memberBalanceRow", label: "会员余额行" },
  { key: "remarkBlock", label: "备注" },
  { key: "signRoles", label: "制单/审核/业务签名" },
  { key: "footerText", label: "页脚文案" },
  { key: "amountChinese", label: "金额大写" },
  { key: "productName", label: "商品名称" },
  { key: "skuName", label: "规格名称" },
  { key: "barcode", label: "条码" },
  { key: "price", label: "价格" },
  { key: "unit", label: "单位" },
  { key: "cashAmount", label: "现金收款" },
  { key: "wechatAmount", label: "微信收款" },
  { key: "alipayAmount", label: "支付宝收款" },
  { key: "balanceAmount", label: "余额收款" },
];

/** 按单据类型的专用变量 */
export const BILL_TYPE_VARIABLES: Record<PrintBillType, PrintVariable[]> = {
  SALE_RECEIPT: [
    { key: "headerName", label: "小票抬头店名" },
    { key: "customerName", label: "客户名称" },
    { key: "items", label: "商品明细行（自动生成）", desc: "占位符由系统替换为表格行" },
    { key: "totalAmount", label: "合计金额" },
    { key: "paidAmount", label: "实收金额" },
    { key: "changeAmount", label: "找零" },
    { key: "paymentMethod", label: "支付方式" },
    { key: "memberBalanceRow", label: "会员余额行（可空）" },
    { key: "memberBalance", label: "会员余额" },
    { key: "remarkBlock", label: "备注块（可空）" },
  ],
  SALE_BILL: [
    { key: "customerName", label: "客户名称" },
    { key: "customerPhone", label: "客户电话" },
    { key: "saleType", label: "销售类型（现销/赊销）" },
    { key: "billStatus", label: "单据状态" },
    { key: "items", label: "商品明细行（自动生成）" },
    { key: "totalAmount", label: "应收金额" },
    { key: "discountAmount", label: "优惠金额" },
    { key: "paidAmount", label: "实收金额" },
    { key: "receivedAmount", label: "已收金额" },
    { key: "amountChinese", label: "金额大写" },
    { key: "roleRow", label: "制单/审核/业务行（按角色）" },
    { key: "remarkBlock", label: "备注块（客户/内部备注）" },
    { key: "signRoles", label: "制单/审核/业务签名（按角色）" },
  ],
  SALE_RETURN: [
    { key: "customerName", label: "客户名称" },
    { key: "items", label: "商品明细行（自动生成）" },
    { key: "totalAmount", label: "退货合计" },
    { key: "paidAmount", label: "退款金额" },
    { key: "billStatus", label: "单据状态" },
    { key: "remarkBlock", label: "备注块（可空）" },
  ],
  PURCHASE_ORDER: [
    { key: "customerName", label: "供应商名称" },
    { key: "items", label: "商品明细行（自动生成）" },
    { key: "totalAmount", label: "采购合计" },
    { key: "billStatus", label: "单据状态" },
    { key: "remarkBlock", label: "备注块（可空）" },
  ],
  REPORT: [
    { key: "reportTitle", label: "报表标题" },
    { key: "reportPeriod", label: "报表期间" },
    { key: "reportHeaders", label: "表头列（自动生成）" },
    { key: "items", label: "数据行（自动生成）" },
  ],
  LABEL: [
    { key: "productName", label: "商品名称" },
    { key: "skuName", label: "规格名称" },
    { key: "barcode", label: "商品条码" },
    { key: "price", label: "销售价" },
    { key: "unit", label: "单位" },
  ],
  SHIFT: [
    { key: "shiftNo", label: "班次号" },
    { key: "receiverName", label: "接班人" },
    { key: "saleCount", label: "销售笔数" },
    { key: "totalAmount", label: "销售金额" },
    { key: "cashAmount", label: "现金收款" },
    { key: "wechatAmount", label: "微信收款" },
    { key: "alipayAmount", label: "支付宝收款" },
    { key: "balanceAmount", label: "余额收款" },
  ],
  DAILY_SETTLE: [
    { key: "items", label: "结算项行（自动生成）" },
    { key: "totalAmount", label: "营业合计" },
  ],
};

/** 单据类型中文名 */
export const BILL_TYPE_LABELS: Record<PrintBillType, string> = {
  SALE_RECEIPT: "收银小票",
  SALE_BILL: "批发销售单",
  SALE_RETURN: "销售退货单",
  PURCHASE_ORDER: "采购单",
  REPORT: "报表",
  LABEL: "商品标签",
  SHIFT: "交接班小票",
  DAILY_SETTLE: "日结单",
};

/** 获取单据类型的全部可用变量（通用 + 专用） */
export function getBillTypeVariables(billType: PrintBillType): PrintVariable[] {
  return [...COMMON_PRINT_VARIABLES, ...(BILL_TYPE_VARIABLES[billType] ?? [])];
}
