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
const auth = { Authorization: `Bearer ${login.token}` };

const miniProducts = await request("/miniapp/products?storeId=1");
if (typeof miniProducts[0]?.availableQty !== "number" || Number.isNaN(miniProducts[0].availableQty)) {
  throw new Error(`小程序 availableQty 应为数字，实际为 ${miniProducts[0]?.availableQty}`);
}

const miniOrder = await request("/miniapp/orders", {
  method: "POST",
  headers: { "x-customer-type": "RETAIL" },
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

console.log("QA_REGRESSION_PASS");
