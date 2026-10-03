#!/usr/bin/env node
/**
 * S3-142 运行期装置：手工建品（POST /api/admin/products）的两道门
 *   ① 权限点 goods:create 接线；② 商品配额校验（口径与 COPY 调取一致）
 *
 * 为什么需要它：本沙箱 vitest 起不来（esbuild spawn ⇒ EPERM，已实测），而派单卡要求
 * "逐段原始请求/响应"的可复跑原始输出。本装置跑的是**真实链路**：
 *   真实 express 路由（routes/admin-product.routes.ts）+ 真实认证/授权中间件
 *   （requireAuth → tenantMiddleware → csrf → requirePermission）+ 真实控制器（zod + 业务码 1001）
 *   + 真实服务（事务顺序 + getProductQuota 计数），只把 shared/db 换成可编程的**内存迷你库**。
 *
 * 用法（仓库根执行）：node backend/scripts/s3-142-admin-product-guard.mjs [repoRoot]
 * 前置：Node ≥ 22.6（原生 TS 类型擦除）、backend/node_modules 可解析（express/supertest/zod/jsonwebtoken 在根 node_modules）。
 *
 * 边界（诚实标注，不当成已验收）：
 *   · shared/db 被换成内存迷你库 ⇒ **未过真实 MySQL**（真实建表/索引/唯一键由凌舟在生产执行后核对）；
 *   · 未过 nginx / 真实登录服务（令牌由本装置用同一 JWT_SECRET 本地签）；
 *   · 真库上"配额足够 ⇒ 200 且 COUNT +1"受本机 MariaDB 不支持 `CAST(x AS JSON)` 限制
 *     （createProduct 的 INSERT 用了 MySQL 8 语法），故该项由本装置给出等价最小运行时的原始输出。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2] ?? ".");
const require = createRequire(path.join(ROOT, "backend", "package.json"));
const express = require("express");
const supertest = require("supertest");
const jwt = require("jsonwebtoken");

process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "harness-secret";
process.env.NODE_ENV = "test";

/* ───────── shared/db 桩：整面转发真实模块，只覆盖被本装置接管的函数 ───────── */
const realDbUrl = pathToFileURL(path.join(ROOT, "backend/src/shared/db.ts")).href;
const stubPath = path.join(os.tmpdir(), `s3142-db-stub-${process.pid}.mjs`);
fs.writeFileSync(
  stubPath,
  [
    `export * from ${JSON.stringify(realDbUrl)};`,
    `const g = () => globalThis.__S3142;`,
    `export const query = (sql, params = []) => g().query(sql, params);`,
    `export const queryOne = (sql, params = []) => g().queryOne(sql, params);`,
    `export const queryWithTenant = (sql, params = []) => g().query(sql, params);`,
    `export const queryOneWithTenant = (sql, params = []) => g().queryOne(sql, params);`,
    `export const executeWithTenant = () => Promise.resolve();`,
    `export const transaction = (runner) => g().transaction(runner);`,
    `export const connQuery = (conn, sql, params = []) => g().query(sql, params);`,
    `export const connQueryOne = (conn, sql, params = []) => g().queryOne(sql, params);`,
    `export const connExecute = (conn, sql, params = []) => g().connExecute(sql, params);`,
  ].join("\n"),
  "utf8"
);
const stubUrl = pathToFileURL(stubPath).href;

/* ───────── base 层 mock-db 桩（真实 mock-db.ts 有 TS 类型当值导入，node 擦除后会解析失败） ───────── */
const mockStubPath = path.join(os.tmpdir(), `s3142-mockdb-stub-${process.pid}.mjs`);
fs.writeFileSync(
  mockStubPath,
  [
    `export const mockConn = { query: async () => [[]], execute: async () => [[], []] };`,
    `export const mockQuery = async () => [];`,
    `export const mockExecute = async () => [[], []];`,
    `export const mockState = {};`,
  ].join("\n"),
  "utf8"
);
const mockStubUrl = pathToFileURL(mockStubPath).href;

/* ───────── middleware/price-guard 桩 ─────────
 * 该文件用 `import { Request, Response, NextFunction } from "express"`（值导入 types），
 * node 的类型擦除不消除它 ⇒ 直接 import 会 SyntaxError。本单两道门与价格字段过滤无关，
 * 且建品响应体（id/spuId/skuId/spuCode）不含价格字段 ⇒ 用等价直通桩（行为等同原实现）。
 */
const priceGuardStubPath = path.join(os.tmpdir(), `s3142-price-guard-stub-${process.pid}.mjs`);
fs.writeFileSync(
  priceGuardStubPath,
  [
    `const passthrough = () => (_req, _res, next) => next();`,
    `export const priceResponseFilter = () => (_req, _res, next) => next();`,
    `export const requirePriceFieldAccess = passthrough;`,
    `export const requirePriceLevelAccess = passthrough;`,
    `export const requirePriceManagementAccess = passthrough;`,
    `export const requirePriceChangeLogAccess = passthrough;`,
    `export const filterPriceResponse = (_user, data) => data;`,
  ].join("\n"),
  "utf8"
);
const priceGuardStubUrl = pathToFileURL(priceGuardStubPath).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!/\.[cm]?[jt]s$/.test(specifier) && /(^|\/)shared\/db$/.test(specifier)) {
      return { url: stubUrl, shortCircuit: true };
    }
    if (!/\.[cm]?[jt]s$/.test(specifier) && /(^|\/)mocks\/mock-db$/.test(specifier)) {
      return { url: mockStubUrl, shortCircuit: true };
    }
    if (!/\.[cm]?[jt]s$/.test(specifier) && /(^|\/)middleware\/price-guard$/.test(specifier)) {
      return { url: priceGuardStubUrl, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

/* ───────── 内存迷你库（t_product_spu / t_product_sku / t_product_price / 订阅套餐 / 角色权限） ───────── */
const TENANT = "t-s3142";
const db = {
  /** tenantId → max_products（null = 无订阅 / 未配上限） */
  plans: { [TENANT]: null },
  spuRows: [],
  skuRows: [],
  priceRows: [],
  /** userId → 角色 permissions 数组（等价 t_sys_role.permissions） */
  rolePerms: {
    9001: ["*:view"],
    9002: ["*"],
    9003: ["sale:create", "sale:view"],
    9004: ["store:*", "goods:create", "goods:edit"],
  },
};
let seq = 900;
const unknownSql = [];

function dispatch(sqlRaw, params = []) {
  const sql = String(sqlRaw);
  const p = Array.isArray(params) ? params : [];
  const has = (needle) => sql.includes(needle);

  /* ── 权限：t_sys_user_role × t_sys_role（真实 rbac.service 的 SQL） ── */
  if (has("FROM t_sys_user_role ur") && has("JOIN t_sys_role r")) {
    const perms = db.rolePerms[Number(p[0])];
    return perms ? [{ permissions: JSON.stringify(perms) }] : [];
  }
  if (/INSERT INTO t_error_log/i.test(sql)) return [{ insertId: 1, affectedRows: 1 }];

  /* ── 商品配额：套餐上限 + 用量 COUNT（与 tenant-quota.service.getProductQuota 的 SQL 对齐） ── */
  if (has("JOIN t_subscription_plan")) {
    const tenant = String(p[0]);
    const limit = db.plans[tenant];
    return { maxProducts: limit === undefined || limit === null ? null : limit };
  }
  if (has("COUNT(*) AS total FROM t_product_spu")) {
    const tenant = String(p[0]);
    return { total: db.spuRows.filter((row) => row.tenant_id === tenant).length };
  }

  /* ── 手工建品落库（createProduct 事务内三条 INSERT） ── */
  if (/INSERT INTO t_product_spu/i.test(sql)) {
    const row = { id: seq++, tenant_id: p[p.length - 1], spu_code: p[0], name: p[1] };
    db.spuRows.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (/INSERT INTO t_product_sku/i.test(sql)) {
    const row = { id: seq++, tenant_id: p[p.length - 1], spu_id: p[0], sku_name: p[3] };
    db.skuRows.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (/INSERT INTO t_product_price/i.test(sql)) {
    const row = { id: seq++, tenant_id: p[p.length - 1], sku_id: p[0] };
    db.priceRows.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }

  unknownSql.push(sql.replace(/\s+/g, " ").slice(0, 120));
  return /^(SELECT|WITH)/i.test(sql.trim()) ? [] : { insertId: 0, affectedRows: 0 };
}

globalThis.__S3142 = {
  query: async (sql, params) => dispatch(sql, params),
  queryOne: async (sql, params) => {
    const rows = dispatch(sql, params);
    return Array.isArray(rows) ? rows[0] ?? null : rows;
  },
  // 真实 transaction 的等价物：runner 收到"事务连接"，计数与写入都落在这里
  // 注意：mysql2 的 conn.query 返回 [rows|ResultSetHeader, fields]，服务层用 `const [r] = await conn.query(...)`
  transaction: async (runner) => runner({ query: async (sql, params) => [dispatch(sql, params)] }),
  connExecute: async (sql, params) => [dispatch(sql, params), undefined],
};

/* ───────── 真实路由 + 真实认证链 ───────── */
const { getAuthMiddlewares } = await import(pathToFileURL(path.join(ROOT, "backend/src/shared/auto-routes.ts")).href);
const { errorHandler } = await import(pathToFileURL(path.join(ROOT, "backend/src/middleware/error-handler.ts")).href);
const { generateCsrfToken } = await import(pathToFileURL(path.join(ROOT, "backend/src/middleware/csrf.ts")).href);
const { routeConfig } = await import(pathToFileURL(path.join(ROOT, "backend/src/routes/admin-product.routes.ts")).href);

const app = express();
app.use(express.json());
app.use(routeConfig.prefix, ...getAuthMiddlewares(routeConfig.auth), routeConfig.router);
app.use(errorHandler);

function tenantToken(uid, tenantId = TENANT, roles = ["STORE_MANAGER"]) {
  return jwt.sign(
    { id: uid, username: `u${uid}`, realName: `用户${uid}`, roles, tenantId },
    process.env.JWT_SECRET,
    { algorithm: "HS256", issuer: "zhixiang-system", audience: "zhixiang-client", expiresIn: "1h" }
  );
}

const productBody = (barcode) => ({
  name: `S3-142 手工建品${barcode ? ` ${barcode}` : ""}`,
  categoryId: 1,
  saleChannels: ["STORE", "MINIAPP"],
  skus: [
    {
      skuName: "500ml",
      barcode,
      boxRatio: 1,
      temperature: "NORMAL",
      traceEnabled: false,
      warningThreshold: 0,
      costPrice: 10,
      retailPrice: 20,
    },
  ],
});

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

/** 逐段原始请求/响应（含 status / 响应体 / 落库读数） */
async function callCreate(uid, { token } = {}) {
  const req = supertest(app).post("/api/admin/products");
  const headers = [];
  if (token) {
    req.set("Authorization", `Bearer ${token}`);
    req.set("x-csrf-token", generateCsrfToken(uid));
    headers.push(`uid=${uid}`);
  } else {
    headers.push("无令牌");
  }
  const res = await req.send(productBody());
  const counts = `spu=${db.spuRows.length} sku=${db.skuRows.length} price=${db.priceRows.length}`;
  console.log(`  → POST /api/admin/products [${headers.join(" ")}] ⇒ ${res.status} ${JSON.stringify(res.body)}  | 落库 ${counts}`);
  return res;
}

console.log(`【装置】S3-142 手工建品两道门  仓库=${ROOT}`); 
console.log(`  迷你库租户=${TENANT}  套餐上限(初始)=${JSON.stringify(db.plans[TENANT])}（null = 无订阅/未配上限）`);

/* ═══ 段1 权限：无令牌 401 / 无 goods:create 403 / 持码放行 ═══ */
console.log("\n=== 段1 权限点 goods:create（POST /api/admin/products） ===");
{
  const noToken = await callCreate(0);
  check("段1a 无令牌 ⇒ 401（认证在路由匹配前）", noToken.status === 401 && noToken.body.code === "401", `status=${noToken.status}`);

  const before = db.spuRows.length;
  const sales = await callCreate(9003, { token: tenantToken(9003) });
  check(
    "段1b SALES_STAFF（无 goods:create）⇒ 403 + code 403 + 点名 goods:create，且零落库（未到达业务层）",
    sales.status === 403 && sales.body.code === "403" && sales.body.msg === "无权限执行此操作，需要权限: goods:create" && db.spuRows.length === before,
    `status=${sales.status} code=${sales.body.code} msg=${sales.body.msg}`
  );

  const readonly = await callCreate(9001, { token: tenantToken(9001, TENANT, ["READONLY"]) });
  check(
    "段1c READONLY（*:view）⇒ 403（*:view 不命中 goods:create），且零落库",
    readonly.status === 403 && readonly.body.msg === "无权限执行此操作，需要权限: goods:create" && db.spuRows.length === before,
    `status=${readonly.status} msg=${readonly.body.msg}`
  );
}

/* ═══ 段2 配额满 ⇒ 400 + 1001 且不落库 ═══ */
console.log("\n=== 段2 配额满（limit 非 null 且 used >= limit）===");
{
  db.plans[TENANT] = 1;
  db.spuRows.push({ id: seq++, tenant_id: TENANT, spu_code: "SEED1", name: "既有商品" });
  const before = { spu: db.spuRows.length, sku: db.skuRows.length, price: db.priceRows.length };

  const res = await callCreate(9004, { token: tenantToken(9004) });
  const after = { spu: db.spuRows.length, sku: db.skuRows.length, price: db.priceRows.length };
  check(
    "段2a 配额满（已用 1 / 上限 1）⇒ HTTP 400 + 业务码 1001 + 中文文案带已用/上限读数",
    res.status === 400 &&
      res.body.code === "1001" &&
      res.body.msg === "商品配额不足（已用 1 个 / 上限 1 个），请升级套餐或清理已有商品后重试",
    `status=${res.status} code=${res.body.code} msg=${res.body.msg}`
  );
  check(
    "段2b 被拒不落库：t_product_spu / t_product_sku / t_product_price 增量全 0（计数前后一致）",
    JSON.stringify(before) === JSON.stringify(after),
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
  );
}

/* ═══ 段3 配额足够 ⇒ 200 且 COUNT 自然 +1 ═══ */
console.log("\n=== 段3 配额足够（used < limit）===");
{
  db.plans[TENANT] = 5;
  const before = db.spuRows.length; // 1（段2 的种子行）
  const res = await callCreate(9004, { token: tenantToken(9004) });

  // 再读一次配额（同一口径 COUNT）看 used 是否自然 +1
  const { getProductQuota } = await import(
    pathToFileURL(path.join(ROOT, "backend/src/services/platform/tenant-quota.service.ts")).href
  );
  const quotaAfter = await getProductQuota(TENANT);

  check(
    "段3a 配额足够 ⇒ 200，回传 spuId/skuId/spuCode",
    res.status === 200 && !!res.body.data?.spuId && !!res.body.data?.spuCode,
    `status=${res.status} data=${JSON.stringify(res.body.data)}`
  );
  check(
    "段3b COUNT 自然 +1：t_product_spu 1 ⇒ 2（getProductQuota.used 同源读数 = 2）",
    db.spuRows.length === before + 1 && quotaAfter.used === db.spuRows.length,
    `count=${before}⇒${db.spuRows.length} quota.used=${quotaAfter.used} limit=${quotaAfter.limit}`
  );
  check(
    "段3c SKU / 价格同步落库各 +1（建品不是只写 SPU）",
    db.skuRows.length === 1 && db.priceRows.length === 1,
    `sku=${db.skuRows.length} price=${db.priceRows.length}`
  );
}

/* ═══ 段4 limit = null（无订阅 / 未配上限）⇒ 不拦 ═══ */
console.log("\n=== 段4 limit = null（无订阅 / 未配上限）===");
{
  db.plans[TENANT] = null;
  const before = db.spuRows.length;
  const res = await callCreate(9004, { token: tenantToken(9004) });
  check(
    "段4a limit=null ⇒ 不设上限、不拦（200 且落库 +1）",
    res.status === 200 && db.spuRows.length === before + 1,
    `status=${res.status} count=${before}⇒${db.spuRows.length}`
  );
}

/* ═══ 段5 SUPER_ADMIN 旁路（权限点对超管不设限）═══ */
console.log("\n=== 段5 SUPER_ADMIN（[\"*\"]）旁路 ===");
{
  db.plans[TENANT] = null;
  const res = await callCreate(9002, { token: tenantToken(9002, TENANT, ["SUPER_ADMIN"]) });
  check("段5a SUPER_ADMIN ⇒ 200（权限点旁路，且不读角色表）", res.status === 200, `status=${res.status}`);
}

fs.unlinkSync(stubPath);
fs.unlinkSync(mockStubPath);
fs.unlinkSync(priceGuardStubPath);
if (unknownSql.length > 0) {
  console.log(`\n—— 未被迷你库识别而返回空的 SQL（${unknownSql.length} 条，需人工核对是否影响结论） ——`);
  for (const sql of new Set(unknownSql)) console.log(`   ${sql}`);
}
console.log(`\n合计 ${pass + fail} 项，PASS ${pass} / FAIL ${fail} / EXIT=${fail ? 1 : 0}`);
process.exit(fail ? 1 : 0);
