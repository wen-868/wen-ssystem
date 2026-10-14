/**
 * S3-195：**跨租户真库夹具**（拿租户 A 的凭证打租户 B 的资源 id）
 *
 * 用法（在 backend 目录执行；先跑 sql/01-fixture.sql）：
 *   node ../docs/evidence/S3-195/harness/probe-tenant-isolation.mjs
 * 环境：本机私有 MariaDB 127.0.0.1:3406 的 s3195_full 库（结构由产品迁移管线建出）。
 *
 * 判据（期望）：跨租户 ⇒ **404** 且 B 的资源零变化；阳性对照（A 领自己的券）⇒ **200** 且真落库。
 * 反测（见回执 §四）：把编译产物里服务层的 `AND tenant_id = ?` 摘掉 ⇒ 跨租户用例变红（能领到 B 的券）。
 */
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3406";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "";
process.env.DB_NAME = process.env.DB_NAME || "s3195_full";
process.env.JWT_SECRET = process.env.JWT_SECRET || "s3195-local-secret";
process.env.CSRF_SECRET = process.env.CSRF_SECRET || "s3195-local-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.USE_MOCK_DB = "false";

const express = (await import("express")).default;
const request = (await import("supertest")).default;
const jwt = (await import("jsonwebtoken")).default;

const BASE = "../../../../backend/dist";
const { query } = await import(`${BASE}/shared/db.js`);
const { generateCsrfToken } = await import(`${BASE}/middleware/csrf.js`);
const { errorHandler } = await import(`${BASE}/middleware/error-handler.js`);
const { miniappMarketingRouter } = await import(`${BASE}/routes/marketing-miniapp.routes.js`);

const TENANT_A = "s3195-A";
const USER_A = 9501;
const TEMPLATE_B = 9001;
const TEMPLATE_A = 9002;
const FLASH_SALE_B = 9101;
const GROUP_TEAM_B = 9201;

/** 租户 A 的凭证：与 requireAuth 的校验口径逐字一致（HS256 / issuer / audience） */
const tokenA = jwt.sign(
  { id: USER_A, username: "s3195-a", realName: "探针用户A", roles: ["SUPER_ADMIN"], tenantId: TENANT_A },
  process.env.JWT_SECRET,
  { algorithm: "HS256", issuer: "zhixiang-system", audience: "zhixiang-client", expiresIn: "1h" }
);
const csrfA = generateCsrfToken(USER_A);

const app = express();
app.use(express.json());
app.use("/api/miniapp/marketing", miniappMarketingRouter);
app.use(errorHandler);

async function post(url, body) {
  const res = await request(app)
    .post(url)
    .set("Authorization", `Bearer ${tokenA}`)
    .set("x-csrf-token", csrfA)
    .send(body);
  return { status: res.status, body: res.body };
}

const snapshot = async () => ({
  bTemplate: await query("SELECT id, issued_quantity, used_quantity FROM t_coupon_template WHERE id = ?", [TEMPLATE_B]),
  aUserCoupons: await query("SELECT id, template_id, tenant_id, user_id, status FROM t_user_coupon WHERE user_id = ?", [USER_A]),
  bFlash: await query("SELECT id, sold_count FROM t_flash_sale WHERE id = ?", [FLASH_SALE_B]),
  bTeam: await query("SELECT id, current_size FROM t_group_buy_team WHERE id = ?", [GROUP_TEAM_B]),
});

const results = [];
const record = (label, expect, res, extra) => {
  const ok = res.status === expect;
  results.push({ label, expect, actual: res.status, ok, body: res.body, ...extra });
  console.log(`[S3-195] ${ok ? "✅" : "❌"} ${label}：期望 ${expect} ⇒ 实际 ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
};

console.log("[S3-195] ① 执行前快照（B 的资源必须零变化）");
console.log("   ", JSON.stringify(await snapshot()));

console.log("[S3-195] ② 跨租户写入探测（A 的凭证 + B 的资源 id）");
record("跨租户领券 POST /coupons/9001/claim（B 的模板）", 404, await post(`/api/miniapp/marketing/coupons/${TEMPLATE_B}/claim`, { userId: USER_A }));
record("跨租户秒杀 POST /flash-sale/9101/buy（B 的活动）", 404, await post(`/api/miniapp/marketing/flash-sale/${FLASH_SALE_B}/buy`, { userId: USER_A, quantity: 1 }));
record("跨租户拼团 POST /group-buy/9201/join（B 的团）", 404, await post(`/api/miniapp/marketing/group-buy/${GROUP_TEAM_B}/join`, { userId: USER_A, quantity: 1 }));

console.log("[S3-195] ③ 阳性对照（A 领自己的券 9002 ⇒ 证明夹具/JWT/CSRF/落库链路可用）");
record("A 领自己的券 POST /coupons/9002/claim", 200, await post(`/api/miniapp/marketing/coupons/${TEMPLATE_A}/claim`, { userId: USER_A }));

console.log("[S3-195] ④ 执行后快照（B 的券/秒杀/团必须与①逐字相同；A 的券必须新增 1 行）");
const after = await snapshot();
console.log("   ", JSON.stringify(after));

const before = JSON.parse(process.env.S3_195_PROBE_BEFORE ?? "null");
const out = process.env.S3_195_ISOLATION_OUT;
if (out) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(out, JSON.stringify({ tenantA: TENANT_A, userA: USER_A, results, after }, null, 1), "utf8");
}
process.exit(0);
