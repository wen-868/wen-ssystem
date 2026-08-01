const base = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const mergedHeaders = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  const bodyString = options.body && typeof options.body === "string" ? options.body : (options.body ? JSON.stringify(options.body) : undefined);
  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers: mergedHeaders,
    body: bodyString
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
// 写操作需携带 x-csrf-token（auto-routes csrfMiddleware 契约）
const auth = { Authorization: `Bearer ${login.token}`, "X-CSRF-Token": login.csrfToken };

const miniProducts = await request("/miniapp/products?storeId=1", { headers: auth });
const miniProductList = miniProducts.records ?? miniProducts;
if (typeof miniProductList[0]?.availableQty !== "number" || Number.isNaN(miniProductList[0].availableQty)) {
  throw new Error(`小程序 availableQty 应为数字，实际为 ${miniProductList[0]?.availableQty}`);
}

const miniOrder = await request("/miniapp/orders", {
  method: "POST",
  headers: { ...auth, "x-customer-type": "RETAIL" },
  body: JSON.stringify({
    storeId: 1,
    fulfillmentType: "PICKUP",
    receiverName: "QA买家",
    receiverMobile: "13900001111",
    items: [{ skuId: 1, quantity: 1 }]
  })
});
if (!miniOrder.orderNo) throw new Error("quantity 字段下单失败");

const storeDashboard = await request("/store/dashboard?storeId=1", { headers: auth });
if (storeDashboard.pendingOrderCount < 1) {
  throw new Error(`门店 pendingOrderCount 应大于 0，实际为 ${storeDashboard.pendingOrderCount}`);
}

const filteredOrders = await request("/admin/orders?status=ACCEPTED", { headers: auth });
if (filteredOrders.total !== filteredOrders.records.length) {
  throw new Error(`订单 total 与 records 不一致：${filteredOrders.total} vs ${filteredOrders.records.length}`);
}

const offlineInventory = await request("/store/inventory?storeId=1", { headers: auth });
const offlineRows = Array.isArray(offlineInventory) ? offlineInventory : offlineInventory.records;
const offlineSku = offlineRows.find((row) => Number(row.skuId) === 1 && row.stockType === "OFFLINE");
if (Number(offlineSku?.availableQty ?? 0) < 1) {
  await request("/store/inventory/adjust", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ storeId: 1, skuId: 1, stockType: "OFFLINE", change: 5, remark: "QA回归补足测试库存" })
  });
}

const saleBill = await request("/store/sale-bills", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    storeId: 1,
    customerName: "QA客户",
    items: [{ skuId: 1, boxQty: 0, bottleQty: 1, totalBottleQty: 1 }]
  })
});
const currentProducts = await request("/admin/products", { headers: auth });
const expectedStorePrice = Number(currentProducts.records?.[0]?.storePrice ?? currentProducts.records?.[0]?.retailPrice);
if (saleBill.items?.[0]?.unitPrice !== expectedStorePrice) {
  throw new Error(`销售单默认单价应为当前门店价/零售价 ${expectedStorePrice}，实际为 ${saleBill.items?.[0]?.unitPrice}`);
}

await request(`/store/sale-bills/${saleBill.billNo}/offline-payment`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ amount: 50, paymentMethod: "CASH" })
});
const saleBillDetail = await request(`/store/sale-bills/${saleBill.billNo}`, { headers: auth });
const expectedUnreceived = expectedStorePrice - 50;
if (Number(saleBillDetail.receivedAmount) !== 50 || Number(saleBillDetail.unreceivedAmount) !== expectedUnreceived) {
  throw new Error(`离线收款金额未更新：received=${saleBillDetail.receivedAmount}, unreceived=${saleBillDetail.unreceivedAmount}`);
}
if (saleBillDetail.collectionStatus !== "PARTIAL") {
  throw new Error(`离线收款状态应为 PARTIAL，实际为 ${saleBillDetail.collectionStatus}`);
}

async function testWholesaleOrderReservation() {
  const res = await request("/miniapp/orders", {
    method: "POST",
    headers: {
      ...auth,
      "x-customer-type": "WHOLESALE"
    },
    body: JSON.stringify({
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "批发客户",
      receiverMobile: "13900000001",
      receiverAddress: "批发客户仓库",
      items: [{ skuId: 1, qty: 100 }]
    })
  });
  if (res.orderStatus !== "WAIT_DELIVERY") throw new Error("批发订单应直接进入待配送，实际为 " + res.orderStatus);
  if (res.payStatus !== "UNPAID") throw new Error("批发订单默认未付款，实际为 " + res.payStatus);
  if (typeof res.items?.[0]?.reservedQty !== "number") throw new Error("批发订单应返回已占用数量");
  if (typeof res.items?.[0]?.unreservedQty !== "number") throw new Error("批发订单应返回未占用数量");
}

await testWholesaleOrderReservation();

async function testWholesaleDeliveryLifecycle() {
  const order = await request("/miniapp/orders", {
    method: "POST",
    headers: {
      ...auth,
      "x-customer-type": "WHOLESALE",
      "x-settlement-type": "ACCOUNT"
    },
    body: JSON.stringify({
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "账期批发客户",
      receiverMobile: "13900000001",
      receiverAddress: "客户仓库",
      items: [{ skuId: 1, qty: 1 }]
    })
  });
  const orderNo = order.orderNo;

  const delivering = await request(`/store/orders/${orderNo}/start-delivery`, {
    method: "POST",
    headers: auth
  });
  if (delivering.status !== "DELIVERING") throw new Error("订单应进入配送中，实际为 " + delivering.status);

  const completed = await request(`/store/orders/${orderNo}/complete-delivery`, {
    method: "POST",
    headers: auth
  });
  if (completed.status !== "COMPLETED") throw new Error("订单应完成，实际为 " + completed.status);
  if (!completed.receivableNo) throw new Error("账期批发订单完成后应生成应收");
}

await testWholesaleDeliveryLifecycle();

async function testReceivableCollection() {
  // 先创建一个账期批发订单并完成配送以生成应收
  const order = await request("/miniapp/orders", {
    method: "POST",
    headers: {
      ...auth,
      "x-customer-type": "WHOLESALE",
      "x-settlement-type": "ACCOUNT"
    },
    body: JSON.stringify({
      storeId: 1,
      fulfillmentType: "DELIVERY",
      receiverName: "账期批发客户",
      receiverMobile: "13900000001",
      receiverAddress: "客户仓库",
      items: [{ skuId: 1, qty: 1 }]
    })
  });
  const orderNo = order.orderNo;

  // 开始配送
  await request(`/store/orders/${orderNo}/start-delivery`, {
    method: "POST",
    headers: auth
  });

  // 完成配送（账期批发应生成应收）
  const completed = await request(`/store/orders/${orderNo}/complete-delivery`, {
    method: "POST",
    headers: auth
  });
  if (!completed.receivableNo) throw new Error("账期批发订单完成后应生成应收");

  // 查询应收列表
  const list = await request("/store/receivables", { headers: auth });
  if (!Array.isArray(list.records)) throw new Error("应收列表应返回 records 数组");

  // 找到刚生成的应收
  const first = list.records.find((r) => r.receivableNo === completed.receivableNo);
  if (!first) throw new Error("应收列表应包含刚生成的应收记录");
  if (Number(first.receivableAmount) <= 0) throw new Error("应收金额应大于0");

  // 登记收款
  const paid = await request(`/store/receivables/${first.receivableNo}/payment`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ amount: 10, paymentMethod: "TRANSFER", remark: "测试收款" })
  });
  if (Number(paid.unreceivedAmount) < 0) throw new Error("剩余未收金额不应为负数");
}

await testReceivableCollection();

// === merchant-mobile 相关断言 ===

// 验证商家端登录接口可用
const storeLogin = await request("/store/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "store_manager", password: "admin123" })
});
if (!storeLogin.token) throw new Error("商家端登录应返回 token");
const storeAuth = { Authorization: `Bearer ${storeLogin.token}` };

// 验证商家端 dashboard 接口可用
const merchantDashboard = await request("/store/dashboard", { headers: storeAuth });
if (typeof merchantDashboard !== "object") throw new Error("商家端 dashboard 应返回对象");

// 验证商家端订单列表接口可用
const merchantOrders = await request("/store/orders", { headers: storeAuth, qs: { page: 1, pageSize: 10 } });
if (!Array.isArray(merchantOrders.records)) throw new Error("商家端订单列表应返回 records 数组");

// 验证商家端库存接口可用
const merchantInventory = await request("/store/inventory", { headers: storeAuth, qs: { keyword: "" } });
if (!Array.isArray(merchantInventory) && !Array.isArray(merchantInventory.records)) throw new Error("商家端库存应返回数组");

// 验证商家端客户接口可用
const merchantMembers = await request("/store/members", { headers: storeAuth, qs: { keyword: "" } });
if (!Array.isArray(merchantMembers.records)) throw new Error("商家端客户列表应返回 records 数组");

// 验证商家端应收接口可用
const merchantReceivables = await request("/store/receivables", { headers: storeAuth, qs: { page: 1, pageSize: 10 } });
if (!Array.isArray(merchantReceivables.records)) throw new Error("商家端应收列表应返回 records 数组");

console.log("QA_REGRESSION_PASS");
