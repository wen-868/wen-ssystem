/**
 * 打印模板 v3 控件工厂：创建控件、默认模板、v2 模板升级转换
 */
import type {
  PrintBillType,
  PrintPaperSettings,
  PrintPaperType,
  PrintTemplateJson,
  PrintTemplateV3,
  PrintWidget,
  PrintWidgetKind,
} from "./types";
import { createPaperSettings } from "./types";

/** 生成控件唯一 ID */
export function uid(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 默认表格列（商品明细） */
export function defaultTableColumns(): Array<{ key: string; label: string; width: number; align: "left" | "center" | "right" }> {
  return [
    { key: "name", label: "商品名称", width: 38, align: "left" },
    { key: "spec", label: "规格", width: 16, align: "left" },
    { key: "unit", label: "单位", width: 8, align: "center" },
    { key: "qty", label: "数量", width: 10, align: "right" },
    { key: "price", label: "单价", width: 14, align: "right" },
    { key: "amount", label: "金额", width: 16, align: "right" },
  ];
}

/** 创建指定类型控件（位置/尺寸 mm） */
export function createWidget(
  kind: PrintWidgetKind,
  x = 10,
  y = 10,
  billType?: PrintBillType
): PrintWidget {
  const base = {
    id: uid(),
    x,
    y,
    zIndex: 0,
    visible: true,
    fontSize: 11,
    fontWeight: "normal" as const,
    align: "left" as const,
    color: "#000",
  };
  switch (kind) {
    case "text":
      return { ...base, kind: "text", width: 50, height: 8, text: "文本内容" };
    case "field":
      return {
        ...base,
        kind: "field",
        width: 55,
        height: 6,
        fieldKey: "billNo",
        label: billType === "SALE_BILL" ? "单号" : "单号",
        showLabel: true,
      };
    case "table":
      return {
        ...base,
        kind: "table",
        width: 90,
        height: 32,
        dataSource: "itemsRows",
        columns: defaultTableColumns(),
        showHeader: true,
        rowHeight: 5,
        headerFontSize: 10,
        cellPadding: 1,
        fontSize: 10,
      };
    case "image":
      return { ...base, kind: "image", width: 22, height: 22, src: "", fit: "contain" };
    case "barcode":
      return { ...base, kind: "barcode", width: 45, height: 14, value: "{{barcode}}", format: "CODE128", showText: true };
    case "qrcode":
      return { ...base, kind: "qrcode", width: 18, height: 18, value: "{{billNo}}" };
    case "rect":
      return { ...base, kind: "rect", width: 60, height: 30, borderWidth: 1, borderColor: "#000" };
    case "line":
      return { ...base, kind: "line", width: 60, height: 1, borderWidth: 1, lineStyle: "solid" };
    default:
      return { ...base, kind: "text", width: 40, height: 10, text: "" };
  }
}

/** 默认模板控件库：单据标题/抬头等常用文本 */
function defaultTexts(billType: PrintBillType): Array<{ text: string; align: "left" | "center" | "right"; size: number }> {
  const map: Partial<Record<PrintBillType, { text: string; align: "left" | "center" | "right"; size: number }>> = {
    SALE_RECEIPT: { text: "销 售 小 票", align: "center", size: 16 },
    SALE_BILL: { text: "销 售 单", align: "center", size: 18 },
    SALE_RETURN: { text: "销 售 退 货 单", align: "center", size: 18 },
    PURCHASE_ORDER: { text: "采 购 订 单", align: "center", size: 18 },
    REPORT: { text: "经 营 报 表", align: "center", size: 18 },
    LABEL: { text: "商品标签", align: "center", size: 12 },
    SHIFT: { text: "交 接 班 报 表", align: "center", size: 16 },
    DAILY_SETTLE: { text: "日 结 报 表", align: "center", size: 16 },
  };
  return [map[billType] ?? { text: "智享全链 · 单据", align: "center", size: 16 }];
}

/** 单据类型默认展示字段 */
function defaultFieldKeys(billType: PrintBillType): string[] {
  const map: Partial<Record<PrintBillType, string[]>> = {
    SALE_RECEIPT: ["headerName", "billNo", "billDate", "operatorName", "customerName", "totalAmount", "paidAmount", "changeAmount", "paymentMethod", "remarkBlock", "footerText"],
    SALE_BILL: ["headerName", "billNo", "billDate", "saleType", "customerName", "customerPhone", "operatorName", "auditorName", "salesmanName", "totalAmount", "discountAmount", "paidAmount", "amountChinese", "remarkBlock", "signRoles"],
    SALE_RETURN: ["headerName", "billNo", "billDate", "customerName", "totalAmount", "paidAmount", "remarkBlock"],
    PURCHASE_ORDER: ["headerName", "billNo", "billDate", "customerName", "totalAmount", "remarkBlock"],
    REPORT: ["reportTitle", "reportPeriod"],
    LABEL: ["productName", "skuName", "price", "unit"],
    SHIFT: ["shiftNo", "billDate", "operatorName", "receiverName", "saleCount", "totalAmount"],
    DAILY_SETTLE: ["billDate", "operatorName", "saleCount", "totalAmount", "cashAmount", "wechatAmount", "alipayAmount", "balanceAmount"],
  };
  return map[billType] ?? ["headerName", "billNo", "billDate", "operatorName", "totalAmount"];
}

/** 生成 v3 默认模板（按行业常用排版自动布局） */
export function createDefaultV3Template(
  billType: PrintBillType = "SALE_BILL",
  paperType: PrintPaperType = "A4"
): PrintTemplateV3 {
  const paper = createPaperSettings(paperType);
  const isReceipt = paperType.startsWith("RECEIPT_");
  const isLabel = paperType.startsWith("LABEL");
  const innerW = paper.width - paper.marginLeft - paper.marginRight;
  const widgets: PrintWidget[] = [];
  const X = paper.marginLeft;
  let Y = paper.marginTop;

  if (isLabel) {
    // 标签：居中商品名 + 条码 + 价格
    widgets.push(createWidget("text", X, Y, billType));
    const title = widgets[0] as PrintWidget & { text: string };
    title.text = "{{productName}}";
    title.width = innerW;
    title.height = 8;
    title.align = "center";
    title.fontSize = 13;
    title.fontWeight = "bold";
    Y += 10;
    const code = createWidget("barcode", X, Y, billType);
    (code as PrintWidget & { value: string; width: number }).value = "{{barcode}}";
    code.width = innerW;
    code.height = 12;
    widgets.push(code);
    Y += 14;
    const price = createWidget("field", X, Y, billType);
    (price as PrintWidget & { fieldKey: string; label: string }).fieldKey = "price";
    (price as PrintWidget & { label: string }).label = "售价";
    price.width = innerW / 2;
    price.height = 6;
    price.fontSize = 14;
    price.fontWeight = "bold";
    widgets.push(price);
    return { version: 3, paper, widgets };
  }

  // 抬头（店名）默认从变量取：门店名称或小票抬头
  const header = createWidget("field", X, Y, billType);
  (header as PrintWidget & { fieldKey: string }).fieldKey = isReceipt ? "headerName" : "storeName";
  (header as PrintWidget & { label: string }).label = "";
  (header as PrintWidget & { showLabel: boolean }).showLabel = false;
  header.width = innerW;
  header.height = isReceipt ? 7 : 9;
  header.align = "center";
  header.fontSize = isReceipt ? 14 : 18;
  header.fontWeight = "bold";
  widgets.push(header);
  Y += (isReceipt ? 8 : 11);

  // 单据标题
  const title = createWidget("text", X, Y, billType);
  (title as PrintWidget & { text: string }).text = defaultTexts(billType)[0].text;
  title.width = innerW;
  title.height = 8;
  title.align = "center";
  title.fontSize = defaultTexts(billType)[0].size;
  title.fontWeight = "bold";
  widgets.push(title);
  Y += 10;

  // 单据信息字段（小票 1 列，其余 2 列）
  const fields = defaultFieldKeys(billType);
  const cols = isReceipt ? 1 : 2;
  const colW = (innerW - 4) / cols;
  for (let i = 0; i < fields.length; i++) {
    const key = fields[i];
    // 大字段单独占整行
    const wide = key === "remarkBlock" || key === "signRoles" || key === "amountChinese";
    const row = Math.floor(i / cols);
    const col = i % cols;
    const f = createWidget("field", X + col * (colW + 4), Y + row * 7, billType) as PrintWidget & {
      fieldKey: string;
      label: string;
      showLabel: boolean;
    };
    f.fieldKey = key;
    f.label = "";
    f.showLabel = true;
    f.width = wide ? innerW : colW;
    f.height = 6;
    f.fontSize = isReceipt ? 10 : 12;
    widgets.push(f);
    if (wide && i === fields.length - 1) {
      // 宽字段占用后不再叠加
    }
  }
  const fieldRows = Math.ceil(fields.length / cols) + (fields.some((k) => k === "remarkBlock" || k === "signRoles") ? 1 : 0);
  Y += fieldRows * 7 + 3;

  // 商品明细表
  const table = createWidget("table", X, Y, billType) as PrintWidget & {
    dataSource: string;
    columns: Array<{ key: string; label: string; width: number; align: string }>;
  };
  table.width = innerW;
  table.height = Math.min(70, Math.max(28, fieldRows * 0 + 40));
  if (isReceipt) {
    table.columns = [
      { key: "name", label: "商品", width: 30, align: "left" },
      { key: "qty", label: "数量", width: 8, align: "right" },
      { key: "amount", label: "金额", width: 14, align: "right" },
    ];
  }
  widgets.push(table);
  Y += table.height + 4;

  // 金额汇总
  const summaryKeys = isReceipt
    ? ["totalAmount", "paidAmount", "changeAmount"]
    : ["totalAmount", "discountAmount", "paidAmount", "amountChinese"];
  for (let i = 0; i < summaryKeys.length; i++) {
    const key = summaryKeys[i];
    const wide = key === "amountChinese";
    const f = createWidget("field", X, Y, billType) as PrintWidget & {
      fieldKey: string;
      label: string;
      showLabel: boolean;
    };
    f.fieldKey = key;
    f.label = "";
    f.showLabel = true;
    f.width = wide ? innerW : innerW / 2;
    f.height = 6;
    f.fontSize = isReceipt ? 11 : 12;
    f.fontWeight = key === "totalAmount" ? "bold" : "normal";
    if (key === "totalAmount") f.fontSize = isReceipt ? 13 : 14;
    // 金额靠右对齐，宽字段整行
    if (wide) {
      f.y = Y;
      f.align = "left";
      Y += 7;
    } else {
      f.x = X + (i % 2) * (innerW / 2);
      f.y = Y;
      f.align = "right";
      if (i % 2 === 1) Y += 7;
    }
    widgets.push(f);
  }
  if (summaryKeys.length % 2 === 1) Y += 7;
  Y += 3;

  // 备注
  const remark = createWidget("field", X, Y, billType) as PrintWidget & {
    fieldKey: string;
    label: string;
    showLabel: boolean;
  };
  remark.fieldKey = "remarkBlock";
  remark.label = "备注";
  remark.showLabel = true;
  remark.width = innerW;
  remark.height = 8;
  remark.fontSize = 11;
  widgets.push(remark);
  Y += 10;

  // 签章区
  const sign = createWidget("text", X, Y, billType);
  (sign as PrintWidget & { text: string }).text = "制单：{{operatorName}}    审核：{{auditorName}}    业务：{{salesmanName}}";
  sign.width = innerW;
  sign.height = 8;
  sign.fontSize = 11;
  widgets.push(sign);
  Y += 9;

  // 页脚
  const footer = createWidget("field", X, Y, billType) as PrintWidget & {
    fieldKey: string;
    label: string;
    showLabel: boolean;
  };
  footer.fieldKey = "footerText";
  footer.label = "";
  footer.showLabel = false;
  footer.width = innerW;
  footer.height = 6;
  footer.align = "center";
  footer.fontSize = 10;
  widgets.push(footer);

  // 控件超高时加高纸张
  const maxY = Math.max(...widgets.map((w) => w.y + w.height));
  paper.height = Math.max(paper.height, Math.ceil(maxY + paper.marginBottom));
  return { version: 3, paper, widgets };
}

/** v2 模块化模板 → v3 自由控件（保持可编辑性） */
export function v2ToV3(json: PrintTemplateJson, billType?: PrintBillType): PrintTemplateV3 {
  const paper = createPaperSettings(json.paperType);
  const innerW = paper.width - paper.marginLeft - paper.marginRight;
  const X = paper.marginLeft;
  let Y = paper.marginTop;
  const widgets: PrintWidget[] = [];

  for (const mod of json.modules.filter((m) => m.enabled)) {
    switch (mod.type) {
      case "title": {
        const w = createWidget("text", X, Y, billType) as PrintWidget & { text: string };
        w.text = mod.text || "{{title}}";
        w.width = innerW;
        w.height = 9;
        w.align = mod.align ?? "center";
        w.fontSize = mod.fontSize ?? 18;
        w.fontWeight = "bold";
        widgets.push(w);
        Y += 11;
        break;
      }
      case "header": {
        const w = createWidget("field", X, Y, billType) as PrintWidget & { fieldKey: string; showLabel: boolean };
        w.fieldKey = "headerName";
        w.showLabel = false;
        w.width = innerW;
        w.height = 8;
        w.align = "center";
        w.fontSize = 15;
        w.fontWeight = "bold";
        widgets.push(w);
        Y += 10;
        break;
      }
      case "billInfo":
      case "customer":
      case "summary":
      case "memberBalance": {
        const keys = Object.entries(mod.fields ?? {})
          .filter(([, on]) => on)
          .map(([key]) => key);
        const cols = mod.layout === "2col" ? 2 : mod.layout === "3col" ? 3 : 1;
        const colW = (innerW - (cols - 1) * 4) / cols;
        keys.forEach((key, i) => {
          const w = createWidget("field", X + (i % cols) * (colW + 4), Y + Math.floor(i / cols) * 7, billType) as PrintWidget & {
            fieldKey: string;
            label: string;
          };
          w.fieldKey = key;
          w.label = mod.fieldLabels?.[key] ?? "";
          w.width = colW;
          w.height = 6;
          w.fontSize = mod.fontSize ?? 12;
          w.align = "right";
          widgets.push(w);
        });
        Y += Math.ceil(keys.length / cols) * 7 + 2;
        break;
      }
      case "items": {
        const w = createWidget("table", X, Y, billType) as PrintWidget & {
          columns: Array<{ key: string; label: string; width: number; align: "left" | "center" | "right" }>;
        };
        const enabled = Object.entries(mod.fields ?? {}).filter(([, on]) => on).map(([k]) => k);
        w.columns = enabled.length
          ? enabled.map((key) => {
              const meta = (() => {
                const map: Record<string, { label: string; width: number; align: "left" | "center" | "right" }> = {
                  name: { label: "商品名称", width: 30, align: "left" },
                  spec: { label: "规格", width: 14, align: "left" },
                  barcode: { label: "条码", width: 18, align: "center" },
                  unit: { label: "单位", width: 8, align: "center" },
                  qty: { label: "数量", width: 9, align: "right" },
                  price: { label: "单价", width: 13, align: "right" },
                  amount: { label: "金额", width: 15, align: "right" },
                  trace: { label: "追溯码", width: 20, align: "left" },
                  remark: { label: "备注", width: 14, align: "left" },
                };
                return map[key] ?? { label: key, width: 12, align: "left" };
              })();
              return { key, label: mod.fieldLabels?.[key] ?? meta.label, width: meta.width, align: meta.align };
            })
          : defaultTableColumns();
        w.width = innerW;
        w.height = 36;
        w.fontSize = 10;
        widgets.push(w);
        Y += 40;
        break;
      }
      case "remark": {
        const w = createWidget("field", X, Y, billType) as PrintWidget & { fieldKey: string; label: string };
        w.fieldKey = "remarkBlock";
        w.label = "备注";
        w.width = innerW;
        w.height = 8;
        w.fontSize = 11;
        widgets.push(w);
        Y += 10;
        break;
      }
      case "sign": {
        const w = createWidget("text", X, Y, billType);
        (w as PrintWidget & { text: string }).text = "{{signRoles}}";
        w.width = innerW;
        w.height = 8;
        w.fontSize = 11;
        widgets.push(w);
        Y += 10;
        break;
      }
      case "footer": {
        const w = createWidget("field", X, Y, billType) as PrintWidget & { fieldKey: string; showLabel: boolean };
        w.fieldKey = "footerText";
        w.showLabel = false;
        w.width = innerW;
        w.height = 6;
        w.align = "center";
        w.fontSize = 10;
        widgets.push(w);
        Y += 8;
        break;
      }
      default:
        break;
    }
  }
  paper.height = Math.max(paper.height, Math.ceil(Y + paper.marginBottom));
  return { version: 3, paper, widgets };
}
