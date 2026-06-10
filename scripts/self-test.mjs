const base = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok || body.code !== "0") {
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return body.data;
}

const login = await request("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin123" })
});
const token = login.token;
const auth = { Authorization: `Bearer ${token}` };

console.log("登录成功:", login.user.username, login.user.roles.join(","));

const dashboard = await request("/admin/reports/dashboard", { headers: auth });
console.log("看板数据:", dashboard);

const products = await request("/admin/products", { headers: auth });
console.log("商品数量:", products.records.length, "首个商品:", products.records[0]?.name);

const inventory = await request("/store/inventory", { headers: auth });
console.log("库存记录:", inventory.length, inventory[0]?.skuName);

const miniOrder = await request("/miniapp/orders", {
  method: "POST",
  headers: { "x-customer-type": "RETAIL" },
  body: JSON.stringify({
    storeId: 1,
    fulfillmentType: "PICKUP",
    receiverName: "自测买家",
    receiverMobile: "13900000001",
    items: [{ skuId: 1, qty: 1 }]
  })
});
console.log("小程序订单创建:", miniOrder.orderNo, miniOrder.payableAmount);

const miniOrders = await request("/miniapp/orders");
console.log("小程序订单列表:", miniOrders.records.length, miniOrders.records[0]?.orderNo);

const storeOrders = await request("/store/orders", { headers: auth });
console.log("门店订单列表:", storeOrders.records.length, storeOrders.records[0]?.orderNo);

const accepted = await request(`/store/orders/${miniOrder.orderNo}/accept`, { method: "POST", headers: auth });
console.log("门店接单:", accepted.orderNo, accepted.status);

const completed = await request(`/store/orders/${miniOrder.orderNo}/complete`, { method: "POST", headers: auth });
console.log("门店完成:", completed.orderNo, completed.status);

const saleBill = await request("/store/sale-bills", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    storeId: 1,
    customerName: "自测客户",
    customerMobile: "13900000000",
    items: [
      {
        skuId: 1,
        boxQty: 0,
        bottleQty: 2,
        totalBottleQty: 2,
        unitPrice: 129,
        priceType: "STORE"
      }
    ]
  })
});
console.log("销售单创建:", saleBill.billNo, saleBill.receivableAmount);

const collection = await request(`/store/sale-bills/${saleBill.billNo}/collection-link`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    shareChannel: "LINK",
    amount: saleBill.receivableAmount,
    expireHours: 72
  })
});
console.log("分享收款:", collection.linkNo, collection.shareUrl);

const shareDetail = await request(`/share/collections/${collection.token}`);
console.log("客户打开收款页:", shareDetail.sourceNo, shareDetail.amount, shareDetail.items.length);

const prepay = await request(`/share/collections/${collection.token}/pay`, { method: "POST" });
console.log("发起支付:", prepay.payNo, prepay.package);

const profile = await request("/miniapp/profile");
console.log("小程序身份:", profile.customerType, profile.memberLevel);

const stores = await request("/admin/stores", { headers: auth });
console.log("门店数量:", stores.records?.length ?? 0);

const skuId = products.records?.[0]?.skuId || products.records?.[0]?.id;
if (skuId) {
  await request(`/admin/products/${skuId}/price`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ retailPrice: 199 })
  });
  console.log("已调整SKU零售价:", skuId);
}

const adminOrders = await request("/admin/orders", { headers: auth });
console.log("后台订单列表:", adminOrders.records?.length ?? 0);

const adminSaleBills = await request("/admin/sale-bills", { headers: auth });
console.log("后台销售单列表:", adminSaleBills.records?.length ?? 0);

await request("/store/inventory/adjust", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ skuId: 1, stockType: "OFFLINE", change: -2, remark: "自测出库" })
});
console.log("已调整线下库存: skuId=1 -2");

const invLogs = await request("/admin/inventory/logs", { headers: auth });
console.log("后台库存流水:", invLogs.records?.length ?? 0, invLogs.records?.[0]?.changeQty);

const storeInvLogs = await request("/store/inventory/logs", { headers: auth });
console.log("门店库存流水:", storeInvLogs.records?.length ?? 0);

const adminCollections = await request("/admin/collection-links", { headers: auth });
console.log("后台收款记录:", adminCollections.records?.length ?? 0, adminCollections.records?.[0]?.status);

const adminPays = await request("/admin/payment-orders", { headers: auth });
console.log("后台支付记录:", adminPays.records?.length ?? 0, adminPays.records?.[0]?.status);

const storeCollections = await request("/store/collection-links", { headers: auth });
console.log("门店收款记录:", storeCollections.records?.length ?? 0);

const storePays = await request("/store/payment-orders", { headers: auth });
console.log("门店支付记录:", storePays.records?.length ?? 0);

const refund = await request("/pay/refunds", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    payNo: adminPays.records?.[0]?.payNo,
    amount: 10,
    reason: "自测退款"
  })
});
console.log("退款申请:", refund.refundNo, refund.status);

const storeRefunds = await request("/store/refund-orders", { headers: auth });
console.log("门店退款记录:", storeRefunds.records?.length ?? 0, storeRefunds.records?.[0]?.refundNo);

const adminRefunds = await request("/admin/refund-orders", { headers: auth });
console.log("后台退款记录:", adminRefunds.records?.length ?? 0, adminRefunds.records?.[0]?.refundNo);

const dailySales = await request("/admin/reports/daily-sales", { headers: auth });
console.log("日报销售:", dailySales.length ?? 0, dailySales[0]?.date);

const orderStats = await request("/admin/reports/order-stats", { headers: auth });
console.log("订单状态分布:", orderStats.map((o) => `${o.status}:${o.count}`).join(", "));

const storePerf = await request("/admin/reports/store-performance", { headers: auth });
console.log("门店业绩:", storePerf[0]?.storeName, storePerf[0]?.totalSales);

const storeDash = await request("/store/dashboard", { headers: auth });
  console.log("门店工作台:", storeDash.todayOrderCount, storeDash.todaySalesAmount);

  const storeDailySales = await request("/store/daily-sales", { headers: auth });
  console.log("门店日报销售:", storeDailySales.length ?? 0, storeDailySales[0]?.date);

  const storeAlerts = await request("/store/inventory/alerts", { headers: auth });
  console.log("门店库存预警:", storeAlerts.length ?? 0, storeAlerts[0]?.availableQty);

const invBalances = await request("/admin/inventory/balances", { headers: auth });
console.log("后台库存总览:", invBalances.records?.length ?? 0, invBalances.records?.[0]?.storeName);

const alerts = await request("/admin/inventory/alerts", { headers: auth });
console.log("库存预警:", alerts.length ?? 0, alerts[0]?.availableQty);

const lastOrderNo = miniOrder.orderNo;
if (lastOrderNo) {
  const adminOrderDetail = await request(`/admin/orders/${lastOrderNo}`, { headers: auth });
  console.log("后台订单详情:", adminOrderDetail.orderNo, adminOrderDetail.items?.length ?? 0);
  const storeOrderDetail = await request(`/store/orders/${lastOrderNo}`, { headers: auth });
  console.log("门店订单详情:", storeOrderDetail.orderNo, storeOrderDetail.items?.length ?? 0);
  const miniOrderDetail = await request(`/miniapp/orders/${lastOrderNo}`);
  console.log("小程序订单详情:", miniOrderDetail.orderNo, miniOrderDetail.items?.length ?? 0);
  const adminSearch = await request("/admin/orders?keyword=DD&page=1&pageSize=5", { headers: auth });
  console.log("后台订单搜索:", adminSearch.records?.length ?? 0, "共", adminSearch.total);
  const today = new Date().toISOString().slice(0, 10);
  const adminDateSearch = await request(`/admin/orders?dateStart=${today}&dateEnd=${today}&page=1&pageSize=5`, { headers: auth });
  console.log("后台订单日期筛选:", adminDateSearch.records?.length ?? 0, "共", adminDateSearch.total);
  const csvRes = await fetch(`${base}/admin/orders/export.csv?keyword=DD&dateStart=${today}&dateEnd=${today}`, {
    headers: auth
  });
  const csvText = await csvRes.text();
  if (!csvRes.ok || !csvText.includes("订单号")) {
    throw new Error(`/admin/orders/export.csv failed: ${csvRes.status} ${csvText.slice(0, 80)}`);
  }
  console.log("后台订单CSV导出:", csvText.split("\n").length, "行");
}

console.log("SELF_TEST_PASS");
