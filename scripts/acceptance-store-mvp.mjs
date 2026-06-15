const API_BASE = process.env.API_BASE || "http://localhost:8080/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body.code === "500") {
    throw new Error(`${options.method || "GET"} ${path} failed: ${res.status} ${text}`);
  }
  return body.data;
}

const login = await request("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "store_operator", password: "admin123" })
});

const auth = { Authorization: `Bearer ${login.token}` };
const dashboard = await request("/store/dashboard", { headers: auth });
if (!dashboard) throw new Error("门店工作台无数据");

const inventory = await request("/store/inventory", { headers: auth });
const inventoryRecords = Array.isArray(inventory) ? inventory : inventory.records;
if (!Array.isArray(inventoryRecords)) throw new Error("库存列表没有 records");

const products = await request("/store/products?keyword=示例", { headers: auth });
if (!Array.isArray(products.records) || products.records.length === 0) throw new Error("门店商品搜索无结果");

const members = await request("/store/members?keyword=批发", { headers: auth });
if (!Array.isArray(members.records) || members.records.length === 0) throw new Error("门店客户搜索无结果");

const sku = products.records[0];
const member = members.records[0];
const beforeRow = inventoryRecords.find((row) => Number(row.skuId) === Number(sku.skuId) && row.stockType === "OFFLINE");
const beforeQty = Number(beforeRow?.availableQty ?? 0);

const saleBill = await request("/store/sale-bills", {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    storeId: 1,
    customerId: member.memberId,
    customerName: member.name,
    customerMobile: member.mobile,
    items: [{ skuId: sku.skuId, quantity: 1, unitPrice: Number(sku.storePrice || sku.retailPrice) }]
  })
});

await request(`/store/sale-bills/${saleBill.billNo}/offline-payment`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ amount: saleBill.receivableAmount, paymentMethod: "CASH" })
});

const afterInventory = await request("/store/inventory", { headers: auth });
const afterRecords = Array.isArray(afterInventory) ? afterInventory : afterInventory.records;
const afterRow = afterRecords.find((row) => Number(row.skuId) === Number(sku.skuId) && row.stockType === "OFFLINE");
const afterQty = Number(afterRow?.availableQty ?? 0);
if (afterQty !== beforeQty - 1) {
  throw new Error(`线下收款后库存未扣减：before=${beforeQty}, after=${afterQty}`);
}

console.log("ACCEPTANCE_STORE_MVP_PASS");
