const ADMIN_URL = process.env.ADMIN_URL || "https://admin.onepan.cn";
const STORE_URL = process.env.STORE_URL || "https://store.onepan.cn";
const API_BASE = process.env.API_BASE || "https://api.onepan.cn/api";

async function mustFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

async function api(path, options = {}) {
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
    throw new Error(`${path} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data;
}

const adminHtml = await mustFetch(`${ADMIN_URL}/`);
const storeHtml = await mustFetch(`${STORE_URL}/`);
await mustFetch(`${API_BASE.replace(/\/api$/, "")}/health`);

for (const html of [adminHtml, storeHtml]) {
  if (html.includes("localhost:8080")) throw new Error("线上 HTML 包含 localhost");
}

const adminLogin = await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "admin", password: "admin123" })
});

const adminAuth = { Authorization: `Bearer ${adminLogin.token}` };
const adminProducts = await api("/admin/products", { headers: adminAuth });
if (!Array.isArray(adminProducts.records)) throw new Error("生产后台商品列表异常");

const storeLogin = await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: "store_operator", password: "admin123" })
});

const storeAuth = { Authorization: `Bearer ${storeLogin.token}` };
const storeInventory = await api("/store/inventory", { headers: storeAuth });
const storeInventoryRecords = Array.isArray(storeInventory) ? storeInventory : storeInventory.records;
if (!Array.isArray(storeInventoryRecords)) throw new Error("生产门店库存列表异常");

console.log("ACCEPTANCE_PRODUCTION_PASS");
