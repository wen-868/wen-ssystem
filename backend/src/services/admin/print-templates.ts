/**
 * 打印模板默认值（可视化 JSON 结构）
 *
 * 模板内容为 JSON：{ version: 2, paperType, modules: [...] }，
 * 由前端可视化编辑器生成，打印时前端渲染引擎将 JSON 渲染为 HTML。
 */

/** 单据类型枚举（打印模板按单据类型管理） */
export const PRINT_BILL_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "SALE_RECEIPT", label: "收银小票" },
  { value: "SALE_BILL", label: "批发销售单" },
  { value: "SALE_RETURN", label: "销售退货单" },
  { value: "PURCHASE_ORDER", label: "采购单" },
  { value: "REPORT", label: "报表" },
  { value: "LABEL", label: "商品标签" },
  { value: "SHIFT", label: "交接班小票" },
  { value: "DAILY_SETTLE", label: "日结单" },
] as const;

/** 纸张类型枚举 */
export const PRINT_PAPER_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "RECEIPT_58", label: "热敏小票 58mm" },
  { value: "RECEIPT_80", label: "热敏小票 80mm" },
  { value: "RECEIPT_110", label: "热敏小票 110mm" },
  { value: "A4", label: "A4 纸" },
  { value: "DOT_1UP", label: "针式连续纸（一等分）" },
  { value: "DOT_2UP", label: "针式连续纸（二等分）" },
  { value: "DOT_3UP", label: "针式连续纸（三等分）" },
  { value: "LABEL_60X40", label: "标签纸 60x40mm" },
  { value: "LABEL_CUSTOM", label: "标签纸（自定义尺寸）" },
] as const;

/** 可视化模板模块类型 */
export type PrintModuleType =
  | "title"
  | "header"
  | "billInfo"
  | "customer"
  | "items"
  | "summary"
  | "memberBalance"
  | "remark"
  | "sign"
  | "footer";

/** 可视化模板模块 */
export interface PrintModule {
  id: string;
  type: PrintModuleType;
  enabled: boolean;
  text?: string;
  fields?: Record<string, boolean>;
  align?: "left" | "center" | "right";
  fontSize?: number;
  layout?: "1col" | "2col" | "3col";
}

/** 模板内容 JSON */
export interface PrintTemplateJson {
  version: 2;
  paperType: string;
  modules: PrintModule[];
}

let moduleSeq = 0;
function m(
  type: PrintModuleType,
  fields?: string[],
  opts?: { text?: string; align?: "left" | "center" | "right"; enabled?: boolean; layout?: "1col" | "2col" | "3col" }
): PrintModule {
  const fieldsObj: Record<string, boolean> = {};
  (fields ?? []).forEach((k) => {
    fieldsObj[k] = true;
  });
  moduleSeq += 1;
  return {
    id: `${type}-${moduleSeq}`,
    type,
    enabled: opts?.enabled ?? true,
    text: opts?.text,
    fields: fieldsObj,
    align: opts?.align,
    layout: opts?.layout,
  };
}

/** 构造指定单据类型的默认可视化模板 */
function buildDefault(billType: string): { name: string; paper: string; content: string } {
  switch (billType) {
    case "SALE_RECEIPT":
      return {
        name: "收银小票（默认）",
        paper: "RECEIPT_80",
        content: JSON.stringify({
          version: 2,
          paperType: "RECEIPT_80",
          modules: [
            m("header", ["headerName", "headerPhone", "headerAddress"], { align: "center" }),
            m("billInfo", ["billNo", "billDate", "operatorName", "customerName"]),
            m("items", ["name", "qty", "amount"]),
            m("summary", ["totalAmount", "paidAmount", "changeAmount", "paymentMethod"]),
            m("memberBalance", ["memberBalance"]),
            m("remark", ["remarkBlock"]),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "SALE_BILL":
      return {
        name: "批发销售单（默认）",
        paper: "A4",
        content: JSON.stringify({
          version: 2,
          paperType: "A4",
          modules: [
            m("title", [], { text: "销 售 单", align: "center" }),
            m("header", ["storeName", "storePhone", "storeAddress"], { align: "center" }),
            m("billInfo", ["billNo", "saleType", "billDate", "billStatus", "operatorName", "auditorName", "salesmanName"]),
            m("customer", ["customerName", "customerPhone"]),
            m("items", ["name", "spec", "barcode", "unit", "qty", "price", "amount", "trace", "remark"]),
            m("summary", ["totalAmount", "discountAmount", "paidAmount", "receivedAmount"]),
            m("remark", ["remarkBlock"]),
            m("sign", [], { align: "center" }),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "SALE_RETURN":
      return {
        name: "销售退货单（默认）",
        paper: "A4",
        content: JSON.stringify({
          version: 2,
          paperType: "A4",
          modules: [
            m("title", [], { text: "销 售 退 货 单", align: "center" }),
            m("header", ["storeName", "storePhone"], { align: "center" }),
            m("billInfo", ["billNo", "billDate", "operatorName", "billStatus"]),
            m("customer", ["customerName"]),
            m("items", ["name", "spec", "unit", "qty", "price", "amount", "remark"]),
            m("summary", ["totalAmount", "paidAmount"]),
            m("remark", ["remarkBlock"]),
            m("sign", [], { align: "center" }),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "PURCHASE_ORDER":
      return {
        name: "采购单（默认）",
        paper: "A4",
        content: JSON.stringify({
          version: 2,
          paperType: "A4",
          modules: [
            m("title", [], { text: "采 购 单", align: "center" }),
            m("header", ["storeName", "storePhone"], { align: "center" }),
            m("billInfo", ["billNo", "billDate", "operatorName", "billStatus"]),
            m("customer", ["customerName"]),
            m("items", ["name", "spec", "unit", "qty", "price", "amount", "remark"]),
            m("summary", ["totalAmount"]),
            m("remark", ["remarkBlock"]),
            m("sign", [], { align: "center" }),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "REPORT":
      return {
        name: "报表（默认）",
        paper: "A4",
        content: JSON.stringify({
          version: 2,
          paperType: "A4",
          modules: [
            m("title", [], { text: "数据报表", align: "center" }),
            m("billInfo", ["storeName", "reportPeriod", "operatorName"]),
            m("items"),
            m("footer", [], { text: "", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "LABEL":
      return {
        name: "商品标签（默认）",
        paper: "LABEL_60X40",
        content: JSON.stringify({
          version: 2,
          paperType: "LABEL_60X40",
          modules: [
            m("title", [], { text: "{{productName}}", align: "center" }),
            m("billInfo", ["skuName", "barcode", "unit"]),
            m("summary", ["price"]),
          ],
        } satisfies PrintTemplateJson),
      };
    case "SHIFT":
      return {
        name: "交接班小票（默认）",
        paper: "RECEIPT_80",
        content: JSON.stringify({
          version: 2,
          paperType: "RECEIPT_80",
          modules: [
            m("title", [], { text: "交接班小票", align: "center" }),
            m("billInfo", ["shiftNo", "operatorName", "receiverName", "billDate"]),
            m("summary", ["totalAmount", "saleCount", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount"]),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    case "DAILY_SETTLE":
      return {
        name: "日结单（默认）",
        paper: "A4",
        content: JSON.stringify({
          version: 2,
          paperType: "A4",
          modules: [
            m("title", [], { text: "日 结 单", align: "center" }),
            m("billInfo", ["storeName", "billDate", "operatorName"]),
            m("summary", ["totalAmount", "saleCount", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount"], { layout: "2col" }),
            m("footer", [], { text: "谢谢惠顾，欢迎再次光临！", align: "center" }),
          ],
        } satisfies PrintTemplateJson),
      };
    default:
      throw new Error(`未知单据类型默认模板：${billType}`);
  }
}

/** 单据类型默认模板（首次访问自动写入，模板内容含分号不放入 SQL 迁移） */
export const DEFAULT_PRINT_TEMPLATES: Readonly<
  Record<string, { name: string; paper: string; content: string }>
> = Object.fromEntries(PRINT_BILL_TYPES.map((t) => [t.value, buildDefault(t.value)]));

/** 打印模板单据类型白名单（校验用） */
export const PRINT_BILL_TYPE_VALUES = PRINT_BILL_TYPES.map((t) => t.value);

/** 打印纸张类型白名单（校验用） */
export const PRINT_PAPER_TYPE_VALUES = PRINT_PAPER_TYPES.map((t) => t.value);
