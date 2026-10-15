#!/usr/bin/env node
/**
 * 生产部署验收（接口层）
 *
 * S3-205（收口总清单第 23 项）：**面向生产却内置默认凭据 / 默认地址** ⇒ 一律改为 env 注入。
 * 必需项缺任何一项即打印缺项清单并 **exit 1**，不再回落到任何内置默认值。
 * 必需项（env 名沿用本脚本既有约定）：
 *   API_BASE（例 https://api.onepan.cn/api）／ ADMIN_URL（例 https://admin.onepan.cn）
 *   ADMIN_USERNAME ／ ADMIN_PASSWORD（旧名 DEMO_PASSWORD 亦可，二者等价、ADMIN_PASSWORD 优先）
 */
const REQUIRED_ENV = [
  ["API_BASE"],
  ["ADMIN_URL"],
  ["ADMIN_USERNAME"],
  ["ADMIN_PASSWORD", "DEMO_PASSWORD"],
];

const missingEnv = REQUIRED_ENV
  .filter((names) => !names.some((n) => (process.env[n] ?? "").trim() !== ""))
  .map((names) => names.join(" | "));
if (missingEnv.length > 0) {
  console.error(
    `[验收·生产] 缺少必需环境变量 ${missingEnv.length} 项：${missingEnv.join(" / ")} ⇒ 不回落内置默认值，退出`
  );
  process.exit(1);
}

const API_BASE = process.env.API_BASE;
const ADMIN_URL = process.env.ADMIN_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
// S3-205：旧名 DEMO_PASSWORD 仍受支持（本脚本 S3-175 起的既有约定）；两者都未设置时已在上面 exit 1。
const ADMIN_PASSWORD =
  (process.env.ADMIN_PASSWORD ?? "").trim() !== "" ? process.env.ADMIN_PASSWORD : process.env.DEMO_PASSWORD;

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
