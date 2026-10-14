/**
 * S3-196 · 「真实客户端产物」证据装置
 *
 * 目的：证明端到端读数不是"手写头"造出来的，而是**老 miniapp 客户端代码自己产生的头**。
 * 做法：用最小 wx/App 桩加载 `miniapp/app.js`，调用它自己的 `request()`（统一封装），
 *       取回它组装的 header，再用这份 header 打真实后端（fixed 实例）。
 */
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKTREE = join(HERE, "..", "..", "..");
const FIXED = process.env.FIXED_BASE_URL || "http://127.0.0.1:18096";
const JWT_SECRET = process.env.E2E_JWT_SECRET || "s3196-e2e-jwt-secret";
const CSRF_SECRET = process.env.E2E_CSRF_SECRET || "s3196-e2e-csrf-secret";
const WX_USER_ID = Number(process.env.E2E_WX_USER_ID || 9001);
const OPENID = process.env.E2E_OPENID || "openid-s196";
const TENANT = process.env.E2E_TENANT || "default";

const b64url = (v) => Buffer.from(v).toString("base64url");
const wxToken = (() => {
  const data = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ wxUserId: WX_USER_ID, openid: OPENID, iat: Math.floor(Date.now() / 1000) })
  )}`;
  return `${data}.${createHmac("sha256", JWT_SECRET).update(data).digest("base64url")}`;
})();
const csrfToken = createHmac("sha256", CSRF_SECRET).update(String(WX_USER_ID)).digest("hex");

// ── 最小微信小程序运行时桩：只实现 app.js 用到的那几个 API ──
const store = { miniapp_token: wxToken, miniapp_csrf_token: csrfToken };
let captured = null;
globalThis.wx = {
  getStorageSync: (k) => store[k] || "",
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  removeStorageSync: (k) => {
    delete store[k];
  },
  login: () => {},
  request: (options) => {
    captured = options; // 拦住客户端真正发出的请求
    options.success && options.success({ statusCode: 200, data: { code: "0", msg: "ok", data: {} } });
  },
};
let appInstance = null;
globalThis.App = (obj) => {
  appInstance = obj;
};
globalThis.Page = () => {};
globalThis.getApp = () => appInstance;

const require = createRequire(import.meta.url);
require(join(WORKTREE, "miniapp", "app.js"));
appInstance.globalData.token = wxToken;
appInstance.globalData.csrfToken = csrfToken;

const results = [];
async function probe(label, method, path, data = {}) {
  captured = null;
  appInstance.request({ url: `${appInstance.globalData.apiBase}${path.replace(/^\/api/, "")}`, method, data });
  const clientHeaders = captured?.header || null;
  const res = await fetch(`${FIXED}${path}`, {
    method,
    headers: { ...clientHeaders, "X-Tenant-Id": TENANT },
    ...(method === "GET" ? {} : { body: JSON.stringify(data) }),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  results.push({
    label,
    endpoint: `${method} ${path}`,
    clientHeaders,
    status: res.status,
    code: body?.code ?? null,
    msg: body?.msg ?? body?.message ?? null,
  });
}

await probe("营销券-领取（老端 coupons 页）", "POST", "/api/miniapp/marketing/coupons/1/claim", {});
await probe("营销券-我的（老端 coupons 页）", "GET", "/api/miniapp/marketing/coupons/my");
await probe("通知-标记已读（老端 notifications 页）", "PUT", "/api/miniapp/notifications/1/read");
await probe("通知-全部已读", "POST", "/api/miniapp/notifications/read-all");
await probe("购物车-加入（老端 home 页）", "POST", "/api/miniapp/cart/add", { skuId: 1, quantity: 1 });

const bad = results.filter((r) => r.status === 401 || r.status === 403);
const report = {
  note: "头由 miniapp/app.js 的 request() 统一封装产生（非手写），再用它打真实后端 fixed 实例",
  wxUserId: WX_USER_ID,
  openid: OPENID,
  tenant: TENANT,
  results,
  blocked: bad.length,
};
writeFileSync(join(HERE, "client-harness.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(bad.length === 0 ? "HARNESS_OK" : `HARNESS_BLOCKED=${bad.length}`);
