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

console.log("ACCEPTANCE_STORE_MVP_PASS");
