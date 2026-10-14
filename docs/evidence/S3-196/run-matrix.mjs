/**
 * S3-196 · 消费者端身份/CSRF 端到端矩阵（真产物 + 真库）
 *
 * 对每个消费者端写端点跑 4 条腿，全部用**老 miniapp 的真实请求形状**
 * （Authorization: Bearer <微信令牌> + X-Tenant-Id + x-csrf-token，见 miniapp/app.js request()）：
 *   base+无CSRF   = 改造前的老端行为（裸 wx.request：不带 x-csrf-token）
 *   base+有CSRF   = 改造前的统一封装行为（令牌对，但身份层仍要商家 JWT）
 *   fixed+无CSRF  = 改造后摘掉令牌（反测①：应 403）
 *   fixed+有CSRF  = 改造后老端真行为（应越过 401/403 门，得到 200/业务码）
 *
 * 判定口径：pass = HTTP ≠ 401/403（即已越过身份与 CSRF 两道门，落到业务码）。
 */
import { createHmac, createSign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXED = process.env.FIXED_BASE_URL || "http://127.0.0.1:18096";
const BASE = process.env.BASE_BASE_URL || "http://127.0.0.1:18097";
const JWT_SECRET = process.env.E2E_JWT_SECRET || "s3196-e2e-jwt-secret";
const CSRF_SECRET = process.env.E2E_CSRF_SECRET || "s3196-e2e-csrf-secret";
const WX_USER_ID = Number(process.env.E2E_WX_USER_ID || 9001);
const OPENID = process.env.E2E_OPENID || "openid-s196";
const TENANT = process.env.E2E_TENANT || "default";
const MEMBER_ID = Number(process.env.E2E_MEMBER_ID || 4);

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/** 与 middleware/wechat-auth.ts signWxToken 同形：payload 只有 wxUserId/openid（HS256） */
function wxToken() {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ wxUserId: WX_USER_ID, openid: OPENID, iat: Math.floor(Date.now() / 1000) })
  );
  const signer = createSign("RSA-SHA256");
  // HS256 需要 HMAC，这里直接用 createHmac 手写（避免额外依赖）
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  void signer;
  return `${data}.${sig}`;
}

const csrf = (id) => createHmac("sha256", CSRF_SECRET).update(String(id)).digest("hex");

const WRITE = [
  ["POST", "/api/miniapp/cart", "miniapp"],
  ["PUT", "/api/miniapp/cart/1", "miniapp"],
  ["DELETE", "/api/miniapp/cart/1", "miniapp"],
  ["DELETE", "/api/miniapp/cart", "miniapp"],
  ["POST", "/api/miniapp/orders", "miniapp"],
  ["POST", "/api/miniapp/orders/S196NO/pay", "miniapp"],
  ["POST", "/api/miniapp/orders/S196NO/cancel", "miniapp"],
  ["POST", "/api/miniapp/orders/S196NO/confirm-receive", "miniapp"],
  ["PUT", "/api/miniapp/orders/S196NO/delete", "miniapp"],
  ["POST", "/api/miniapp/stored-card/recharge", "miniapp"],
  ["PUT", "/api/miniapp/user/profile", "miniapp"],
  ["POST", "/api/miniapp/user/addresses", "miniapp"],
  ["PUT", "/api/miniapp/user/addresses/1", "miniapp"],
  ["DELETE", "/api/miniapp/user/addresses/1", "miniapp"],
  ["POST", "/api/miniapp/user/addresses/1/default", "miniapp"],
  ["POST", "/api/miniapp/coupons/1/use", "miniapp"],
  ["POST", "/api/miniapp/member/coupons/1/receive", "miniapp"],
  ["PUT", "/api/miniapp/user/profile-update", "miniapp"],
  ["POST", "/api/miniapp/user/change-password", "miniapp"],
  ["POST", "/api/miniapp/wholesale/cart", "miniapp"],
  ["PUT", "/api/miniapp/wholesale/cart/1", "miniapp"],
  ["DELETE", "/api/miniapp/wholesale/cart/1", "miniapp"],
  ["POST", "/api/miniapp/wholesale/orders", "miniapp"],
  ["POST", "/api/miniapp/wholesale/cart/delete", "miniapp"],
  ["PUT", "/api/miniapp/wholesale/cart/1/select", "miniapp"],
  ["PUT", "/api/miniapp/wholesale/cart/select-all", "miniapp"],
  ["POST", "/api/miniapp/wholesale/orders/S196NO/cancel", "miniapp"],
  ["POST", "/api/miniapp/wholesale/orders/S196NO/confirm-receive", "miniapp"],
  ["POST", "/api/miniapp/wholesale/orders/buy-now", "miniapp"],
  ["POST", "/api/miniapp/cart/add", "miniapp"],
  ["PUT", "/api/miniapp/cart/items/1", "miniapp"],
  ["DELETE", "/api/miniapp/cart/items/1", "miniapp"],
  ["POST", "/api/miniapp/cart/clear", "miniapp"],
  ["POST", "/api/miniapp/cart/checkout/preview", "miniapp"],
  ["POST", "/api/miniapp/cart/checkout/create", "miniapp"],
  ["POST", "/api/miniapp/marketing/coupons/1/claim", "miniapp"],
  ["POST", "/api/miniapp/marketing/flash-sale/1/buy", "miniapp"],
  ["POST", "/api/miniapp/marketing/group-buy/1/join", "miniapp"],
  ["POST", "/api/miniapp/marketing/calculate", "miniapp"],
  ["POST", "/api/miniapp/aftersales", "miniapp"],
  ["POST", "/api/miniapp/aftersales/S196NO/cancel", "miniapp"],
  ["POST", "/api/miniapp/aftersales/S196NO/return-logistics", "miniapp"],
  ["POST", "/api/miniapp/aftersales/S196NO/rate", "miniapp"],
  ["PUT", "/api/miniapp/notifications/1/read", "miniapp"],
  ["POST", "/api/miniapp/notifications/read-all", "miniapp"],
  ["POST", "/api/miniapp/wechat/auth/decrypt-phone", "wechat"],
  ["PUT", "/api/miniapp/wechat/auth/profile", "wechat"],
  ["POST", "/api/miniapp/wechat/auth/bind", "wechat"],
  ["POST", "/api/miniapp/wechat/auth/unbind", "wechat"],
];

const READS = [
  ["GET", "/api/miniapp/marketing/coupons/my"],
  ["GET", "/api/miniapp/marketing/points/my"],
  ["GET", "/api/miniapp/notifications"],
  ["GET", "/api/miniapp/orders"],
];

const BODIES = {
  "/api/miniapp/wechat/auth/bind": { username: "s196-nobody", password: "P@ssw0rd", bindingType: "CONSUMER" },
  "/api/miniapp/wechat/auth/unbind": { systemUserId: 1 },
};

async function call(baseUrl, method, path, { withCsrf }) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${wxToken()}`,
    "X-Tenant-Id": TENANT,
    ...(withCsrf ? { "x-csrf-token": csrf(WX_USER_ID) } : {}),
  };
  const init = { method, headers };
  if (method !== "GET" && method !== "DELETE") {
    init.body = JSON.stringify(BODIES[path] ?? {});
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, init);
    const text = await res.text();
    let code = null;
    let msg = null;
    try {
      const parsed = JSON.parse(text);
      code = parsed.code ?? null;
      msg = parsed.msg ?? parsed.message ?? null;
    } catch {
      msg = text.slice(0, 80);
    }
    return { status: res.status, code, msg: msg ? String(msg).slice(0, 80) : null };
  } catch (err) {
    return { status: 0, code: null, msg: `FETCH_ERROR ${err.message}` };
  }
}

const pass = (r) => r.status !== 401 && r.status !== 403;

/** 商家端 JWT（改造前消费者端唯一被接受的载体）：用于证明 500 类读数在改造前就存在 */
function merchantToken() {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      id: 1,
      username: "s196-merchant",
      roles: [],
      storeId: null,
      tenantId: TENANT,
      iss: "zhixiang-system",
      aud: "zhixiang-client",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const data = `${header}.${payload}`;
  return `${data}.${createHmac("sha256", JWT_SECRET).update(data).digest("base64url")}`;
}

async function callMerchant(baseUrl, method, path) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${merchantToken()}`,
    "x-csrf-token": csrf(1),
  };
  const init = { method, headers };
  if (method !== "GET" && method !== "DELETE") init.body = JSON.stringify(BODIES[path] ?? {});
  try {
    const res = await fetch(`${baseUrl}${path}`, init);
    const text = await res.text();
    let code = null;
    let msg = null;
    try {
      const parsed = JSON.parse(text);
      code = parsed.code ?? null;
      msg = parsed.msg ?? parsed.message ?? null;
    } catch {
      msg = text.slice(0, 80);
    }
    return { status: res.status, code, msg: msg ? String(msg).slice(0, 120) : null };
  } catch (err) {
    return { status: 0, code: null, msg: `FETCH_ERROR ${err.message}` };
  }
}

const rows = [];
for (const [method, path, kind] of WRITE) {
  const baseNoCsrf = await call(BASE, method, path, { withCsrf: false });
  const baseCsrf = await call(BASE, method, path, { withCsrf: true });
  const fixedNoCsrf = await call(FIXED, method, path, { withCsrf: false });
  const fixedCsrf = await call(FIXED, method, path, { withCsrf: true });
  const baseMerchantCsrf = await callMerchant(BASE, method, path);
  rows.push({ method, path, kind, baseNoCsrf, baseCsrf, fixedNoCsrf, fixedCsrf, baseMerchantCsrf });
}
for (const [method, path] of READS) {
  const baseNoCsrf = await call(BASE, method, path, { withCsrf: false });
  const baseCsrf = await call(BASE, method, path, { withCsrf: true });
  const fixedNoCsrf = await call(FIXED, method, path, { withCsrf: false });
  const fixedCsrf = await call(FIXED, method, path, { withCsrf: true });
  rows.push({ method, path, kind: "read", baseNoCsrf, baseCsrf, fixedNoCsrf, fixedCsrf, baseMerchantCsrf: null });
}

const short = (r) => `${r.status}${r.code ? `/${r.code}` : ""}`;
let problems = 0;
const lines = [
  "# S3-196 · 端到端矩阵（真产物 + 真库）",
  "",
  `固定口径：微信用户 id=${WX_USER_ID}、openid=${OPENID}、租户=${TENANT}、会员 id=${MEMBER_ID}；`,
  `base=${BASE}（origin/main 未改动产物）、fixed=${FIXED}（本单产物）。`,
  "",
  "判定：`fixed+有CSRF` 必须 ≠401/403（越过身份与 CSRF 两道门）；`fixed+无CSRF` 必须 403（反测①）；",
  "`base+有CSRF`（miniapp 组）应为 401（改造前身份层要商家 JWT）；wechat 组在 base 上本就能用。",
  "",
  "| # | 端点 | 组 | base无CSRF | base有CSRF | base商家JWT | fixed无CSRF | fixed有CSRF | 判定 |",
  "|--:|:--|:--|:--|:--|:--|:--|:--|:--|",
];
rows.forEach((r, i) => {
  const okFixed = pass(r.fixedCsrf);
  // 写方法：摘掉 x-csrf-token 必须 403（反测①）；读方法（安全方法）不受 CSRF 约束
  const okNoCsrf = r.method === "GET" ? pass(r.fixedNoCsrf) : r.fixedNoCsrf.status === 403;
  const verdictOk = okFixed && okNoCsrf;
  if (!verdictOk) problems++;
  lines.push(
    `| ${i + 1} | \`${r.method} ${r.path}\` | ${r.kind} | ${short(r.baseNoCsrf)} | ${short(r.baseCsrf)} | ${
      r.baseMerchantCsrf ? short(r.baseMerchantCsrf) : "—"
    } | ${short(r.fixedNoCsrf)} | ${short(r.fixedCsrf)} | ${verdictOk ? "✅" : "❌"} |`
  );
});

const miniapp = rows.filter((r) => r.kind !== "wechat" && r.method !== "GET");
const merchantRows = rows.filter((r) => r.baseMerchantCsrf && r.baseMerchantCsrf.status === 500);
lines.push(
  "",
  "## 汇总",
  "",
  `- 写端点（CSRF 受控）总数：**${WRITE.length}**（miniapp 组 ${WRITE.filter((w) => w[2] !== "wechat").length} / wechat 组 ${
    WRITE.filter((w) => w[2] === "wechat").length
  }）`,
  `- fixed+有CSRF 越过 401/403 的比例：**${WRITE.filter((_, i) => pass(rows[i].fixedCsrf)).length}/${WRITE.length}**`,
  `- fixed+无CSRF 命中 403 的比例：**${WRITE.filter((_, i) => rows[i].fixedNoCsrf.status === 403).length}/${WRITE.length}**`,
  `- base 上 miniapp 写端点带令牌仍 401 的比例（改造前载体缺口）：**${
    miniapp.filter((r) => pass(r.baseCsrf) === false).length
  }/${miniapp.length}**`,
  `- 不符合判定的行数：**${problems}**`,
  `- 对照读数：base 上「商家 JWT + CSRF」（改造前的合法载体）同样 500 的端点数：**${merchantRows.length}**` +
    (merchantRows.length
      ? `（${merchantRows.map((r) => `${r.method} ${r.path}`).join("、")}）—— 说明这些 500 与本次身份改造无关，属存量业务缺陷`
      : ""),
  ""
);

writeFileSync(join(HERE, "matrix-raw.json"), JSON.stringify(rows, null, 2));
writeFileSync(join(HERE, "matrix-report.md"), lines.join("\n"));
console.log(lines.join("\n"));
console.log(problems === 0 ? "MATRIX_OK" : `MATRIX_PROBLEMS=${problems}`);
