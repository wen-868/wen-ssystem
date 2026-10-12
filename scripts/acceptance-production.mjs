const ADMIN_URL = process.env.ADMIN_URL || "https://admin.onepan.cn";
const API_BASE = process.env.API_BASE || "https://api.onepan.cn/api";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
// S3-175：默认口令不再写死弱口令；生产口令由 env 注入（ADMIN_PASSWORD / DEMO_PASSWORD）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.DEMO_PASSWORD || "Demo@2026";

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
await mustFetch(`${API_BASE.replace(/\/api$/, "")}/health`);

if (adminHtml.includes("localhost:8080")) throw new Error("线上 HTML 包含 localhost");

const adminLogin = await api("/admin/auth/login", {
  method: "POST",
  body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
});

const adminAuth = { Authorization: `Bearer ${adminLogin.token}` };
const adminProducts = await api("/admin/products", { headers: adminAuth });
if (!Array.isArray(adminProducts.records)) throw new Error("生产后台商品列表异常");

console.log("ACCEPTANCE_PRODUCTION_PASS");
