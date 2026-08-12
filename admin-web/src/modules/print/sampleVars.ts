/**
 * 模板预览示例数据（可视化编辑器与模板页预览共用）
 */
import { buildTableHtml, rawHtml } from "./renderer";
import type { PrintVars } from "./types";

export function sampleVars(_billType?: string): PrintVars {
  const items = buildTableHtml(
    [
      { name: "五粮液 52度 500ml", qty: "10", price: "980.00" },
      { name: "剑南春 水晶剑 52度 500ml", qty: "5", price: "2,995.00" },
    ],
    [
      { key: "name", label: "商品", align: "left" },
      { key: "qty", label: "数量" },
      { key: "price", label: "金额", align: "right" },
    ]
  );
  const itemsRows = [
    { name: "五粮液 52度 500ml", spec: "500ml/瓶", barcode: "6901234567890", unit: "瓶", qty: "10", price: "980.00", amount: "9800.00", trace: "ZX20260812001", remark: "" },
    { name: "剑南春 水晶剑 52度 500ml", spec: "500ml/瓶", barcode: "6901234567891", unit: "瓶", qty: "5", price: "599.00", amount: "2995.00", trace: "ZX20260812002", remark: "" },
  ];
  return {
    storeName: "智享全链门店",
    storePhone: "0755-00000000",
    storeAddress: "深圳市宝安区示例路 1 号",
    headerName: "智享全链",
    headerPhone: "0755-00000000",
    headerAddress: "深圳市宝安区示例路 1 号",
    billNo: "XS202608120001",
    billDate: "2026-08-12 12:00",
    operatorName: "演示账号",
    auditorName: "张店长",
    salesmanName: "李业务",
    customerName: "红星商行",
    customerPhone: "13900000000",
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
    signRoles: "制单人：演示账号    审核人：张店长    业务员：李业务",
    footerText: "谢谢惠顾，欢迎再次光临！",
    reportTitle: "销售日报表",
    reportPeriod: "2026-08-01 ~ 2026-08-31",
    reportHeaders: rawHtml("<th>日期</th><th>销售额</th><th>订单数</th>"),
    productName: "五粮液",
    skuName: "52度 500ml",
    barcode: "6901234567890",
    price: "980.00",
    unit: "瓶",
    shiftNo: "20260812-01",
    receiverName: "王收银",
    saleCount: "36",
    cashAmount: "1,000.00",
    wechatAmount: "2,000.00",
    alipayAmount: "800.00",
    balanceAmount: "175.00",
  };
}
