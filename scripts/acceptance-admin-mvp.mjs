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
  body: JSON.stringify({ username: "admin", password: "admin123" })
});

const auth = { Authorization: `Bearer ${login.token}` };
const products = await request("/admin/products", { headers: auth });
if (!Array.isArray(products.records)) throw new Error("商品列表没有 records");

const stores = await request("/admin/stores", { headers: auth });
if (!Array.isArray(stores.records)) throw new Error("门店列表没有 records");

const members = await request("/admin/members", { headers: auth });
if (!Array.isArray(members.records)) throw new Error("客户列表没有 records");

const saleBills = await request("/admin/sale-bills", { headers: auth });
if (!Array.isArray(saleBills.records)) throw new Error("销售单列表没有 records");

const balances = await request("/admin/inventory/balances", { headers: auth });
if (!Array.isArray(balances.records) && !Array.isArray(balances)) throw new Error("库存总览没有 records");

const dashboard = await request("/admin/reports/dashboard", { headers: auth });
if (!dashboard) throw new Error("后台工作台无数据");

console.log("ACCEPTANCE_ADMIN_MVP_PASS");
