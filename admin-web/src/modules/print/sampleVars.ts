/**
 * 模板预览示例数据（可视化编辑器与模板页预览共用）
 *
 * 单一口径：本文件只服务打印模板预览，不是业务提交数据源。示例值必须明显中性——
 * 不得使用真实商户名/真实品牌/真实人名或看似真实的手机号/地址/单号（PAGE-PRODUCTION-COPY §三.4）；
 * 字段结构保持完整，删除或缩字段会使打印编辑器预览失效。
 */
import { buildTableHtml, rawHtml } from "./renderer";
import type { PrintVars } from "./types";

export function sampleVars(_billType?: string): PrintVars {
  const items = buildTableHtml(
    [
      { name: "示例商品A 52度 500ml", qty: "10", price: "980.00" },
      { name: "示例商品B 水晶装 500ml", qty: "5", price: "2,995.00" },
    ],
    [
      { key: "name", label: "商品", align: "left" },
      { key: "qty", label: "数量" },
      { key: "price", label: "金额", align: "right" },
    ]
  );
  const itemsRows = [
    { name: "示例商品A 52度 500ml", spec: "500ml/瓶", barcode: "6900000000001", unit: "瓶", qty: "10", price: "980.00", amount: "9800.00", trace: "ZX-EXAMPLE-0001", remark: "" },
    { name: "示例商品B 水晶装 500ml", spec: "500ml/瓶", barcode: "6900000000002", unit: "瓶", qty: "5", price: "599.00", amount: "2995.00", trace: "ZX-EXAMPLE-0002", remark: "" },
  ];
  return {
    storeName: "智享全链门店",
    storePhone: "0755-00000000",
    storeAddress: "深圳市宝安区示例路 1 号",
    headerName: "智享全链",
    headerPhone: "0755-00000000",
    headerAddress: "深圳市宝安区示例路 1 号",
    billNo: "XS-EXAMPLE-0001",
    billDate: "2026-08-12 12:00",
    operatorName: "示例操作员",
    auditorName: "示例审核员",
    salesmanName: "示例业务员",
    customerName: "示例客户",
    customerPhone: "138-0000-0000",
    saleType: "赊销",
    billStatus: "已创建",
    items: rawHtml(items),
    itemsRows,
    totalAmount: "3,975.00",
    discountAmount: "0.00",
    paidAmount: "3,975.00",
    receivedAmount: "3,975.00",
    changeAmount: "0.00",
    paymentMethod: "微信",
    amountChinese: "叁仟玖佰柒拾伍元整",
    memberBalance: "500.00",
    remarkBlock: "",
    signRoles: "制单人：示例操作员    审核人：示例审核员    业务员：示例业务员",
    footerText: "谢谢惠顾，欢迎再次光临！",
    reportTitle: "销售日报表",
    reportPeriod: "2026-08-01 ~ 2026-08-31",
    reportHeaders: rawHtml("<th>日期</th><th>销售额</th><th>订单数</th>"),
    productName: "示例商品",
    skuName: "52度 500ml",
    barcode: "6900000000001",
    price: "980.00",
    unit: "瓶",
    shiftNo: "EX-20260812-01",
    receiverName: "示例收银员",
    saleCount: "36",
    cashAmount: "1,000.00",
    wechatAmount: "2,000.00",
    alipayAmount: "800.00",
    balanceAmount: "175.00",
  };
}
