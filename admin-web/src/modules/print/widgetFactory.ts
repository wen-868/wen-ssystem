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

/** 字段行定义（默认模板布局用） */
interface FieldRow {
  /** 每格字段（整行字段放单元素数组） */
  cells: Array<{
    key: string;
    label?: string;
    align?: "left" | "center" | "right";
    bold?: boolean;
    fontSize?: number;
    height?: number;
  }>;
}

/** 生成 v3 默认模板（按行业常用排版自动布局，完整可直接使用） */
export function createDefaultV3Template(
  billType: PrintBillType = "SALE_BILL",
  paperType: PrintPaperType = "A4"
): PrintTemplateV3 {
  const paper = createPaperSettings(paperType);
  const isReceipt = paperType.startsWith("RECEIPT_");
  const isLabel = paperType.startsWith("LABEL");
  const X = paper.marginLeft;
  const innerW = paper.width - paper.marginLeft - paper.marginRight;
  const widgets: PrintWidget[] = [];
  let Y = paper.marginTop;

  /** 添加一个字段控件 */
  function addField(
    key: string,
    opts: { label?: string; x?: number; width?: number; align?: "left" | "center" | "right"; bold?: boolean; fontSize?: number; height?: number; showLabel?: boolean } = {}
  ): PrintWidget {
    const w = createWidget("field", opts.x ?? X, Y, billType) as PrintWidget & {
      fieldKey: string;
      label: string;
      showLabel: boolean;
      align: "left" | "center" | "right";
      fontWeight: "normal" | "bold";
      fontSize: number;
      height: number;
    };
    w.fieldKey = key;
    w.label = opts.label ?? "";
    w.showLabel = opts.showLabel ?? true;
    w.width = opts.width ?? innerW;
    w.height = opts.height ?? (isReceipt ? 6 : 7);
    w.align = opts.align ?? (isReceipt ? "left" : "right");
    w.fontWeight = opts.bold ? "bold" : "normal";
    w.fontSize = opts.fontSize ?? (isReceipt ? 10 : 12);
    widgets.push(w);
    return w;
  }

  /** 添加一行文本 */
  function addText(text: string, opts: { fontSize?: number; align?: "left" | "center" | "right"; bold?: boolean; height?: number } = {}): PrintWidget {
    const w = createWidget("text", X, Y, billType) as PrintWidget & {
      text: string;
      align: "left" | "center" | "right";
      fontWeight: "normal" | "bold";
      fontSize: number;
      height: number;
    };
    w.text = text;
    w.width = innerW;
    w.height = opts.height ?? 7;
    w.align = opts.align ?? "left";
    w.fontSize = opts.fontSize ?? (isReceipt ? 11 : 13);
    w.fontWeight = opts.bold ? "bold" : "normal";
    widgets.push(w);
    return w;
  }

  /** 添加字段行组（按列数自动分行，不重叠） */
  function addFieldRows(rows: FieldRow[], rowHeight: number): void {
    for (const row of rows) {
      const cols = row.cells.length;
      const gap = isReceipt ? 6 : 12;
      const cellW = (innerW - (cols - 1) * gap) / cols;
      let maxH = 0;
      row.cells.forEach((cell, ci) => {
        const w = addField(cell.key, {
          label: cell.label,
          x: X + ci * (cellW + gap),
          width: cellW,
          align: cell.align ?? (isReceipt ? "left" : "right"),
          bold: cell.bold,
          fontSize: cell.fontSize,
          height: cell.height ?? rowHeight,
        });
        maxH = Math.max(maxH, w.height);
      });
      Y += maxH + (isReceipt ? 2 : 3);
    }
  }

  if (isLabel) {
    // ===== 商品标签：商品名 + 条码 + 售价 =====
    const name = addText("{{productName}}", { fontSize: 13, align: "center", bold: true, height: 8 });
    name.y = Y;
    Y += 10;
    const spec = addText("{{skuName}}", { fontSize: 10, align: "center", height: 5 });
    spec.y = Y;
    Y += 7;
    const code = createWidget("barcode", X, Y, billType) as PrintWidget & { value: string; width: number; height: number };
    code.value = "{{barcode}}";
    code.width = innerW;
    code.height = 12;
    widgets.push(code);
    Y += 14;
    const price = addField("price", { label: "售价", width: innerW / 2, align: "left", bold: true, fontSize: 14, height: 7, showLabel: true });
    price.y = Y;
    Y += 9;
    const unit = addField("unit", { label: "单位", width: innerW / 2, align: "right", fontSize: 10, height: 7 });
    unit.x = X + innerW / 2;
    unit.y = Y - 9;
    paper.height = Math.max(paper.height, Math.ceil(Y + paper.marginBottom));
    return { version: 3, paper, widgets };
  }

  // ===== 抬头（店名） =====
  const header = addField(isReceipt ? "headerName" : "storeName", {
    label: "",
    showLabel: false,
    align: "center",
    bold: true,
    fontSize: isReceipt ? 15 : 18,
    height: isReceipt ? 8 : 10,
  });
  header.y = Y;
  Y += (isReceipt ? 9 : 12);

  // 抬头电话/地址（小票与 A4 都显示，窄纸只放电话）
  if (isReceipt) {
    const phone = addField("headerPhone", { label: "", showLabel: false, align: "center", fontSize: 9, height: 5 });
    phone.y = Y;
    Y += 7;
  } else {
    const sub = addText("{{storePhone}}　{{storeAddress}}", { fontSize: 10, align: "center", height: 5 });
    sub.y = Y;
    Y += 7;
  }

  // 分隔线
  const line1 = createWidget("line", X, Y, billType) as PrintWidget & { width: number; height: number; lineStyle: string };
  line1.width = innerW;
  line1.height = 1;
  line1.borderWidth = isReceipt ? 1 : 1;
  line1.lineStyle = isReceipt ? "dashed" : "solid";
  widgets.push(line1);
  Y += (isReceipt ? 4 : 6);

  // 单据标题
  const titleText = defaultTexts(billType)[0];
  const title = addText(titleText.text, { fontSize: titleText.size, align: "center", bold: true, height: isReceipt ? 7 : 9 });
  title.y = Y;
  Y += (isReceipt ? 9 : 12);

  // ===== 单据信息区（按单据类型组织） =====
  const fieldRows: FieldRow[] = [];
  if (isReceipt) {
    fieldRows.push(
      { cells: [{ key: "billNo", label: "单号" }] },
      { cells: [{ key: "billDate", label: "时间" }] },
      { cells: [{ key: "operatorName", label: "收银员" }] },
      { cells: [{ key: "customerName", label: "客户" }] }
    );
  } else {
    fieldRows.push(
      { cells: [{ key: "billNo", label: "单号" }, { key: "billDate", label: "日期" }] },
      { cells: [{ key: "operatorName", label: "制单人" }, { key: "saleType", label: "销售类型" }] },
      { cells: [{ key: "customerName", label: "客户名称" }, { key: "customerPhone", label: "客户电话" }] }
    );
  }
  addFieldRows(fieldRows, isReceipt ? 6 : 7);
  Y += (isReceipt ? 2 : 4);

  // 分隔线
  const line2 = createWidget("line", X, Y, billType) as PrintWidget & { width: number; height: number; lineStyle: string };
  line2.width = innerW;
  line2.height = 1;
  line2.borderWidth = 1;
  line2.lineStyle = isReceipt ? "dashed" : "solid";
  widgets.push(line2);
  Y += (isReceipt ? 3 : 5);

  // ===== 商品明细表 =====
  const table = createWidget("table", X, Y, billType) as PrintWidget & {
    dataSource: string;
    columns: Array<{ key: string; label: string; width: number; align: string }>;
    showHeader: boolean;
    rowHeight: number;
    cellPadding: number;
    fontSize: number;
    height: number;
  };
  table.width = innerW;
  table.height = isReceipt ? 34 : 46;
  if (isReceipt) {
    table.columns = [
      { key: "name", label: "商品", width: 30, align: "left" },
      { key: "qty", label: "数量", width: 9, align: "right" },
      { key: "price", label: "单价", width: 13, align: "right" },
      { key: "amount", label: "金额", width: 16, align: "right" },
    ];
  } else {
    table.columns = [
      { key: "name", label: "商品名称", width: 42, align: "left" },
      { key: "spec", label: "规格", width: 20, align: "left" },
      { key: "unit", label: "单位", width: 8, align: "center" },
      { key: "qty", label: "数量", width: 10, align: "right" },
      { key: "price", label: "单价", width: 14, align: "right" },
      { key: "amount", label: "金额", width: 18, align: "right" },
      { key: "remark", label: "备注", width: 14, align: "left" },
    ];
  }
  table.showHeader = true;
  table.rowHeight = isReceipt ? 5 : 6;
  table.cellPadding = 1;
  table.fontSize = isReceipt ? 9 : 10;
  widgets.push(table);
  Y += table.height + (isReceipt ? 4 : 6);

  // ===== 金额汇总 =====
  const summaryRows: FieldRow[] = isReceipt
    ? [
        { cells: [{ key: "totalAmount", label: "合计", align: "left", bold: true, fontSize: 13, height: 7 }] },
        { cells: [{ key: "paidAmount", label: "实收", height: 6 }] },
        { cells: [{ key: "changeAmount", label: "找零", height: 6 }] },
        { cells: [{ key: "paymentMethod", label: "支付方式", height: 6 }] },
      ]
    : [
        { cells: [{ key: "totalAmount", label: "应收金额", align: "right", bold: true, fontSize: 14, height: 8 }] },
        { cells: [{ key: "discountAmount", label: "优惠金额" }, { key: "paidAmount", label: "实收金额" }] },
        { cells: [{ key: "amountChinese", label: "金额大写" }] },
      ];
  addFieldRows(summaryRows, isReceipt ? 6 : 7);
  Y += 2;

  // 分隔线
  if (isReceipt) {
    const line3 = createWidget("line", X, Y, billType) as PrintWidget & { width: number; height: number; lineStyle: string };
    line3.width = innerW;
    line3.height = 1;
    line3.borderWidth = 1;
    line3.lineStyle = "dashed";
    widgets.push(line3);
    Y += 4;
  }

  // ===== 备注 =====
  const remark = addField("remarkBlock", { label: "备注", height: isReceipt ? 8 : 10, fontSize: isReceipt ? 9 : 11 });
  remark.y = Y;
  remark.align = "left";
  Y += (isReceipt ? 10 : 12);

  // ===== 签章区（非小票） =====
  if (!isReceipt) {
    const sign = addText("制单：{{operatorName}}    审核：{{auditorName}}    业务：{{salesmanName}}", {
      fontSize: 11,
      align: "left",
      height: 8,
    });
    sign.y = Y;
    Y += 10;
  }

  // ===== 页脚 =====
  const footer = addField("footerText", {
    label: "",
    showLabel: false,
    align: "center",
    fontSize: isReceipt ? 9 : 10,
    height: 6,
  });
  footer.y = Y;
  Y += 7;

  // 控件超高时自动加高纸张（小票高度随内容增长）
  paper.height = Math.max(paper.height, Math.ceil(Y + paper.marginBottom));
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
