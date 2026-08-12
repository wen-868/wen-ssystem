/**
 * 打印模板/参数默认值与枚举
 *
 * 用途：打印配置页初始化与重置默认模板使用。
 * 模板内容为 HTML + {{变量}} 占位符，由前端 usePrintRenderer 渲染。
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

/** 单据类型默认模板（首次访问自动写入，模板内容含分号不放入 SQL 迁移） */
export const DEFAULT_PRINT_TEMPLATES: Readonly<
  Record<string, { name: string; paper: string; content: string }>
> = {
  // ==================== 收银小票（80mm 热敏） ====================
  SALE_RECEIPT: {
    name: "收银小票（默认）",
    paper: "RECEIPT_80",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:monospace,"Courier New",sans-serif;width:76mm;margin:0 auto;font-size:12px;color:#000}
.wrap{padding:6px 3px}
h1{text-align:center;font-size:16px;margin:2px 0}
.store-info{text-align:center;font-size:11px;line-height:1.5}
hr{border:none;border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;font-size:11px;line-height:1.6}
table{width:100%;border-collapse:collapse;font-size:11px}
th{border-bottom:1px dashed #000;padding:2px 0;text-align:left}
td{padding:2px 0;vertical-align:top}
td.num{text-align:right;white-space:nowrap}
.total{font-size:14px;font-weight:700}
.footer{text-align:center;margin-top:8px;font-size:10px}
.remark{margin-top:6px;font-size:10px}
</style></head><body><div class="wrap">
<h1>{{headerName}}</h1>
<div class="store-info">{{storePhone}}{{storeAddressLine}}</div>
<hr>
<div class="row"><span>单号</span><span>{{billNo}}</span></div>
<div class="row"><span>时间</span><span>{{billDate}}</span></div>
<div class="row"><span>收银员</span><span>{{operatorName}}</span></div>
<div class="row"><span>客户</span><span>{{customerName}}</span></div>
<hr>
<table><tr><th>品名</th><th>数量</th><th style="text-align:right">金额</th></tr>{{items}}</table>
<hr>
<div class="row total"><span>合计</span><span>¥{{totalAmount}}</span></div>
<div class="row"><span>实收</span><span>¥{{paidAmount}}</span></div>
<div class="row"><span>找零</span><span>¥{{changeAmount}}</span></div>
<div class="row"><span>支付方式</span><span>{{paymentMethod}}</span></div>
{{memberBalanceRow}}
{{remarkBlock}}
<div class="footer">{{footerText}}</div>
</div></body></html>`,
  },
  // ==================== 批发销售单（A4 / 针式） ====================
  SALE_BILL: {
    name: "批发销售单（默认）",
    paper: "A4",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000}
h1{text-align:center;font-size:22px;letter-spacing:8px;margin:8px 0 12px}
table.head{width:100%;border-collapse:collapse;margin-bottom:10px}
table.head td{border:1px solid #999;padding:5px 8px;font-size:12px}
table.head td.lbl{background:#f5f5f5;font-weight:600;width:74px;text-align:center}
table.items{width:100%;border-collapse:collapse;margin-bottom:8px}
table.items th,table.items td{border:1px solid #999;padding:5px 6px;font-size:12px;text-align:center}
table.items th{background:#f5f5f5}
td.left{text-align:left}
.summary{display:flex;justify-content:space-between;align-items:flex-end;margin:10px 0}
.amounts{text-align:right;line-height:1.9}
.amount-chinese{border:1px solid #999;padding:6px 10px;font-size:13px;margin-bottom:10px}
.remark-box{border:1px solid #999;margin-bottom:10px}
.remark-box .title{font-weight:600;background:#f5f5f5;padding:4px 10px;border-bottom:1px solid #999}
.remark-box .body{padding:6px 10px;min-height:20px}
.sign{display:flex;justify-content:space-between;margin-top:36px;font-size:12px}
.footer{text-align:center;font-size:11px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px}
</style></head><body>
<h1>销 售 单</h1>
<table class="head">
<tr><td class="lbl">单号</td><td>{{billNo}}</td><td class="lbl">客户</td><td>{{customerName}}</td><td class="lbl">门店</td><td>{{storeName}}</td></tr>
<tr><td class="lbl">销售类型</td><td>{{saleType}}</td><td class="lbl">日期</td><td>{{billDate}}</td><td class="lbl">单据状态</td><td>{{billStatus}}</td></tr>
{{roleRow}}
</table>
<table class="items">
<tr><th style="width:34px">#</th><th>商品名称</th><th>规格</th><th>条码</th><th style="width:50px">单位</th><th style="width:64px">数量</th><th style="width:88px">单价</th><th style="width:100px">金额</th><th>追溯码</th><th>备注</th></tr>
{{items}}
</table>
<div class="summary">
<div class="amount-chinese">金额（大写）：{{amountChinese}}</div>
<div class="amounts">
<div>应收金额：<b>¥{{totalAmount}}</b></div>
<div>优惠金额：-¥{{discountAmount}}</div>
<div>实收金额：<b>¥{{paidAmount}}</b></div>
<div>已收金额：¥{{receivedAmount}}</div>
</div>
</div>
{{remarkBlock}}
<div class="sign">
<span>{{signRoles}}</span>
<span>客户签收：____________</span>
</div>
<div class="footer">{{footerText}}</div>
</body></html>`,
  },
  // ==================== 销售退货单（A4） ====================
  SALE_RETURN: {
    name: "销售退货单（默认）",
    paper: "A4",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000}
h1{text-align:center;font-size:22px;letter-spacing:8px;margin:8px 0 12px}
table.head{width:100%;border-collapse:collapse;margin-bottom:10px}
table.head td{border:1px solid #999;padding:5px 8px}
table.head td.lbl{background:#f5f5f5;font-weight:600;width:74px;text-align:center}
table.items{width:100%;border-collapse:collapse;margin-bottom:10px}
table.items th,table.items td{border:1px solid #999;padding:5px 6px;text-align:center}
table.items th{background:#f5f5f5}
.amounts{text-align:right;line-height:1.9}
.remark-box{border:1px solid #999;margin-bottom:10px}
.remark-box .title{font-weight:600;background:#f5f5f5;padding:4px 10px;border-bottom:1px solid #999}
.remark-box .body{padding:6px 10px}
.sign{display:flex;justify-content:space-between;margin-top:36px}
.footer{text-align:center;font-size:11px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px}
</style></head><body>
<h1>销 售 退 货 单</h1>
<table class="head">
<tr><td class="lbl">单号</td><td>{{billNo}}</td><td class="lbl">客户</td><td>{{customerName}}</td><td class="lbl">门店</td><td>{{storeName}}</td></tr>
<tr><td class="lbl">日期</td><td>{{billDate}}</td><td class="lbl">经手人</td><td>{{operatorName}}</td><td class="lbl">状态</td><td>{{billStatus}}</td></tr>
</table>
<table class="items">
<tr><th style="width:34px">#</th><th>商品名称</th><th>规格</th><th style="width:50px">单位</th><th style="width:64px">数量</th><th style="width:88px">单价</th><th style="width:100px">金额</th><th>备注</th></tr>
{{items}}
</table>
<div class="amounts">
<div>退货合计：<b>¥{{totalAmount}}</b></div>
<div>退款金额：¥{{paidAmount}}</div>
</div>
{{remarkBlock}}
<div class="sign"><span>经手人：____________</span><span>客户签收：____________</span></div>
<div class="footer">{{footerText}}</div>
</body></html>`,
  },
  // ==================== 采购单（A4 / 针式） ====================
  PURCHASE_ORDER: {
    name: "采购单（默认）",
    paper: "A4",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000}
h1{text-align:center;font-size:22px;letter-spacing:8px;margin:8px 0 12px}
table.head{width:100%;border-collapse:collapse;margin-bottom:10px}
table.head td{border:1px solid #999;padding:5px 8px}
table.head td.lbl{background:#f5f5f5;font-weight:600;width:74px;text-align:center}
table.items{width:100%;border-collapse:collapse;margin-bottom:10px}
table.items th,table.items td{border:1px solid #999;padding:5px 6px;text-align:center}
table.items th{background:#f5f5f5}
.amounts{text-align:right;line-height:1.9}
.remark-box{border:1px solid #999;margin-bottom:10px}
.remark-box .title{font-weight:600;background:#f5f5f5;padding:4px 10px;border-bottom:1px solid #999}
.remark-box .body{padding:6px 10px}
.sign{display:flex;justify-content:space-between;margin-top:36px}
.footer{text-align:center;font-size:11px;color:#666;margin-top:14px;border-top:1px dashed #999;padding-top:6px}
</style></head><body>
<h1>采 购 单</h1>
<table class="head">
<tr><td class="lbl">单号</td><td>{{billNo}}</td><td class="lbl">供应商</td><td>{{customerName}}</td><td class="lbl">门店</td><td>{{storeName}}</td></tr>
<tr><td class="lbl">日期</td><td>{{billDate}}</td><td class="lbl">采购员</td><td>{{operatorName}}</td><td class="lbl">状态</td><td>{{billStatus}}</td></tr>
</table>
<table class="items">
<tr><th style="width:34px">#</th><th>商品名称</th><th>规格</th><th style="width:50px">单位</th><th style="width:64px">数量</th><th style="width:88px">单价</th><th style="width:100px">金额</th><th>备注</th></tr>
{{items}}
</table>
<div class="amounts"><div>采购合计：<b>¥{{totalAmount}}</b></div></div>
{{remarkBlock}}
<div class="sign"><span>采购员：____________</span><span>供应商签收：____________</span></div>
<div class="footer">{{footerText}}</div>
</body></html>`,
  },
  // ==================== 报表（A4） ====================
  REPORT: {
    name: "报表（默认）",
    paper: "A4",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000}
h1{text-align:center;font-size:20px;margin:6px 0 4px}
.sub{text-align:center;font-size:12px;color:#333;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #999;padding:5px 6px;text-align:center;font-size:12px}
th{background:#f5f5f5}
.footer{text-align:center;font-size:11px;color:#666;margin-top:12px}
</style></head><body>
<h1>{{reportTitle}}</h1>
<div class="sub">{{storeName}} · {{reportPeriod}} · 制表人：{{operatorName}}</div>
<table><tr>{{reportHeaders}}</tr>{{items}}</table>
<div class="footer">{{footerText}}</div>
</body></html>`,
  },
  // ==================== 商品标签（60x40） ====================
  LABEL: {
    name: "商品标签（默认）",
    paper: "LABEL_60X40",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:"Microsoft YaHei",sans-serif}
.label{width:56mm;height:37mm;margin:1mm auto;padding:1mm 2mm;border:1px dashed #bbb;box-sizing:border-box;text-align:center;overflow:hidden}
.name{font-size:14px;font-weight:700;margin:3px 0 2px;line-height:1.25}
.spec{font-size:11px;color:#333;margin-bottom:3px}
.barcode{font-family:monospace;font-size:15px;letter-spacing:2px;margin:3px 0}
.price{font-size:18px;font-weight:700;color:#c00}
.price .unit{font-size:12px;color:#333;font-weight:400}
</style></head><body>
<div class="label">
<div class="name">{{productName}}</div>
<div class="spec">{{skuName}}</div>
<div class="barcode">{{barcode}}</div>
<div class="price">¥{{price}} <span class="unit">{{unit}}</span></div>
</div>
</body></html>`,
  },
  // ==================== 交接班小票（80mm） ====================
  SHIFT: {
    name: "交接班小票（默认）",
    paper: "RECEIPT_80",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:monospace,"Courier New",sans-serif;width:76mm;margin:0 auto;font-size:12px;color:#000}
.wrap{padding:6px 3px}
h1{text-align:center;font-size:16px;margin:2px 0}
hr{border:none;border-top:1px dashed #000;margin:6px 0}
.row{display:flex;justify-content:space-between;font-size:11px;line-height:1.6}
.total{font-size:14px;font-weight:700}
.footer{text-align:center;margin-top:8px;font-size:10px}
</style></head><body><div class="wrap">
<h1>交接班小票</h1>
<hr>
<div class="row"><span>班次</span><span>{{shiftNo}}</span></div>
<div class="row"><span>交班人</span><span>{{operatorName}}</span></div>
<div class="row"><span>接班人</span><span>{{receiverName}}</span></div>
<div class="row"><span>时间</span><span>{{billDate}}</span></div>
<hr>
<div class="row"><span>销售笔数</span><span>{{saleCount}}</span></div>
<div class="row total"><span>销售金额</span><span>¥{{totalAmount}}</span></div>
<div class="row"><span>现金</span><span>¥{{cashAmount}}</span></div>
<div class="row"><span>微信</span><span>¥{{wechatAmount}}</span></div>
<div class="row"><span>支付宝</span><span>¥{{alipayAmount}}</span></div>
<div class="row"><span>余额</span><span>¥{{balanceAmount}}</span></div>
<div class="footer">{{footerText}}</div>
</div></body></html>`,
  },
  // ==================== 日结单（A4） ====================
  DAILY_SETTLE: {
    name: "日结单（默认）",
    paper: "A4",
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:15mm}
body{font-family:"SimSun","Microsoft YaHei",sans-serif;font-size:12px;color:#000}
h1{text-align:center;font-size:20px;margin:6px 0 4px}
.sub{text-align:center;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #999;padding:5px 8px;text-align:center}
th{background:#f5f5f5}
.amounts{text-align:right;line-height:1.9;margin-top:10px}
.footer{text-align:center;font-size:11px;color:#666;margin-top:12px}
</style></head><body>
<h1>日 结 单</h1>
<div class="sub">{{storeName}} · {{billDate}} · 制表人：{{operatorName}}</div>
<table><tr><th>项目</th><th>金额/数量</th></tr>{{items}}</table>
<div class="amounts"><div>营业合计：<b>¥{{totalAmount}}</b></div></div>
<div class="footer">{{footerText}}</div>
</body></html>`,
  },
};

/** 打印模板单据类型白名单（校验用） */
export const PRINT_BILL_TYPE_VALUES = PRINT_BILL_TYPES.map((t) => t.value);

/** 打印纸张类型白名单（校验用） */
export const PRINT_PAPER_TYPE_VALUES = PRINT_PAPER_TYPES.map((t) => t.value);
