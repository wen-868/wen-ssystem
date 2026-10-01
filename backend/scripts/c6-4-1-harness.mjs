#!/usr/bin/env node
/**
 * R101-C6-4-1 端点语义装置（可直跑的最小运行时，补充证据工具）
 *
 * 为什么需要它：本沙箱 vitest 起不来（esbuild spawn EPERM），而派单卡「验收标准②③」要求
 * 幂等/配额/权限/404 四类语义 + 反测两条的**可复跑原始输出**。
 * 本装置跑的是**真实链路**：真实 express 路由（routes/admin-library.routes.ts、
 * routes/platform-library.routes.ts）+ 真实控制器（zod 校验 + 1001 业务码）+ 真实服务
 * （SQL 拼装/事务顺序/配额联动/幂等判据）+ 真实 requireAuthWithTenant/requirePermission/
 * requirePlatformAuth，只把 shared/db 换成可编程的**内存迷你库**（按 SQL 关键字分发）。
 *
 * 与单测的关系：权威形态是 backend/src/__tests__ 下本单新增的 5 个 vitest 文件
 *   （services/admin/library-copy.service.test.ts、controllers/admin/library-copy.controller.test.ts、
 *    services/platform/library-call-log.service.test.ts、routes/library-copy-c6-4-1.test.ts、
 *    shared/migration-c6-4-1.test.ts），凌舟本机 `npx vitest run` 可跑；
 *   本装置是"在无 vitest 的沙箱里也能真跑一遍"的等价最小运行时，判绿权仍归凌舟。
 *
 * 用法（仓库根执行）：node backend/scripts/c6-4-1-harness.mjs [repoRoot]
 * 前置：Node ≥ 22.6（原生 TS 类型擦除）、backend/node_modules 可解析（express/supertest/zod 在根 node_modules）。
 *
 * 边界（诚实标注，不当成已验收）：
 *   ① shared/db 被换成内存迷你库，**未过真实 MySQL**（真实建表/索引/唯一键由凌舟在生产执行迁移后核对）；
 *   ② 未过 nginx / 真实租户令牌签发服务（令牌由本装置用同一 JWT_SECRET 本地签）；
 *   ③ "档案可见"验到"三张档案表按租户落行 + 响应回传 spuId + 租户可查自己的调取记录"，
 *      不另跑 admin-product 详情端点（不同模块的验收面）。
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
const stubPath = path.join(os.tmpdir(), `c641-db-stub-${process.pid}.mjs`);
fs.writeFileSync(
  stubPath,
  [
    `export * from ${JSON.stringify(realDbUrl)};`,
    `const g = () => globalThis.__C641;`,
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
const mockStubPath = path.join(os.tmpdir(), `c641-mockdb-stub-${process.pid}.mjs`);
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

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!/\.[cm]?[jt]s$/.test(specifier) && /(^|\/)shared\/db$/.test(specifier)) {
      return { url: stubUrl, shortCircuit: true };
    }
    if (!/\.[cm]?[jt]s$/.test(specifier) && /(^|\/)mocks\/mock-db$/.test(specifier)) {
      return { url: mockStubUrl, shortCircuit: true };
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

/* ───────── 内存迷你库 ───────── */
const today = new Date().toISOString().slice(0, 10);
const db = {
  librarySpus: [
    { id: 123, spu_code: "SPU20260101001", name: "茅台 飞天 53度", brand_id: 7, specs: "500ml×6瓶/箱", unit: "瓶", main_image: "https://x/m.jpg", image_urls: '["https://x/1.jpg"]', description: "简介", detail: "<p>详情</p>", suggested_retail_price: "1299.00", status: "APPROVED", created_at: `${today} 09:00:00` },
    { id: 124, spu_code: "SPU20260101002", name: "待审商品", brand_id: 7, specs: "500ml", unit: "瓶", main_image: null, image_urls: null, description: null, detail: null, suggested_retail_price: "88.00", status: "PENDING", created_at: `${today} 09:10:00` },
  ],
  librarySkus: [
    { id: 5, spu_id: 123, sku_code: "LSKU1", barcode: "6901234567890", sku_name: "500ml 光瓶", volume: "500ml", packaging: "光瓶", base_unit: "瓶", box_unit: "箱", box_ratio: 6, sku_image: "", status: "APPROVED" },
    { id: 6, spu_id: 123, sku_code: "LSKU2", barcode: "6901234567891", sku_name: "500ml 礼盒", volume: "500ml", packaging: "礼盒", base_unit: "瓶", box_unit: "箱", box_ratio: 6, sku_image: "", status: "APPROVED" },
    { id: 7, spu_id: 124, sku_code: "LSKU3", barcode: "6901234567892", sku_name: "待审SKU", volume: "500ml", packaging: "光瓶", base_unit: "瓶", box_unit: "箱", box_ratio: 6, sku_image: "", status: "PENDING" },
  ],
  libraryBrands: [{ id: 7, name: "贵州茅台" }],
  tenants: [{ id: "t-001", name: "甲商户" }, { id: "t-002", name: "乙商户" }],
  plans: { "t-001": 100, "t-002": 100 },
  callLog: [],
  copies: [],
  productSpus: [],
  productSkus: [],
  productPrices: [],
  usedBarcodes: new Set(),
  rolePerms: {
    9001: ["*:view"],
    9002: ["*"],
    9003: ["sale:create", "sale:view"],
    9004: ["store:*", "inventory:*", "library:view", "library:copy"],
  },
  hitCount: 0,
};
let seq = 9000;
const unknownSql = [];

function num(value) {
  return Number(value ?? 0);
}

/** 平台 SPU 行 → 服务层 SELECT 的别名形状（spuCode/imageUrls 等 camelCase） */
function asSourceSpu(row) {
  return {
    id: row.id,
    spuCode: row.spu_code,
    name: row.name,
    brandId: row.brand_id,
    specs: row.specs,
    unit: row.unit,
    mainImage: row.main_image,
    imageUrls: row.image_urls,
    description: row.description,
    detail: row.detail,
    suggestedRetailPrice: row.suggested_retail_price,
    status: row.status,
  };
}

/** 平台 SKU 行 → 服务层 SELECT 的别名形状 */
function asSku(row) {
  return {
    id: row.id,
    spuId: row.spu_id,
    skuCode: row.sku_code,
    barcode: row.barcode,
    skuName: row.sku_name,
    volume: row.volume,
    packaging: row.packaging,
    baseUnit: row.base_unit,
    boxUnit: row.box_unit,
    boxRatio: row.box_ratio,
    skuImage: row.sku_image,
  };
}

/** 平台调取流水的筛选视图（条件顺序与 library-call-log.service 的 SQL 拼装顺序一致） */
function platformLogFilter(sql, filterParams = []) {
  let index = 0;
  let rows = db.callLog.slice();
  if (sql.includes("l.tenant_id = ?")) {
    const value = filterParams[index++];
    rows = rows.filter((row) => row.tenant_id === String(value));
  }
  if (sql.includes("l.library_spu_id = ?")) {
    const value = filterParams[index++];
    rows = rows.filter((row) => row.library_spu_id === Number(value));
  }
  if (sql.includes("l.created_at >= ?")) index += 1;
  if (sql.includes("l.created_at < DATE_ADD")) index += 1;
  return rows;
}

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

  /* ── 平台主数据（只读） ── */
  if (has("FROM t_library_spu") && has("id IN (?)")) {
    const ids = (p[0] ?? []).map(Number);
    return db.librarySpus.filter((row) => ids.includes(row.id) && row.status === "APPROVED").map(asSourceSpu);
  }
  if (has("FROM t_library_brand WHERE id IN (?)")) {
    const ids = (p[0] ?? []).map(Number);
    return db.libraryBrands.filter((row) => ids.includes(row.id));
  }
  if (/COUNT\(\*\) AS total\s+FROM t_library_spu/.test(sql)) {
    return { total: db.librarySpus.filter((row) => row.status === "APPROVED").length };
  }
  if (has("FROM t_library_spu s") && has("WHERE s.id = ?")) {
    const row = db.librarySpus.find((r) => r.id === Number(p[0]) && r.status === "APPROVED");
    if (!row) return null;
    return [
      {
        ...asSourceSpu(row),
        brandName: db.libraryBrands.find((b) => b.id === row.brand_id)?.name ?? null,
        createdAt: row.created_at,
      },
    ];
  }
  if (has("FROM t_library_spu s")) {
    const tenantId = String(p[0]);
    return db.librarySpus
      .filter((row) => row.status === "APPROVED")
      .map((row) => {
        const copy = db.copies.find((c) => c.tenant_id === tenantId && c.library_spu_id === row.id);
        return {
          id: row.id,
          spuCode: row.spu_code,
          name: row.name,
          brandId: row.brand_id,
          brandName: "贵州茅台",
          specs: row.specs,
          unit: row.unit,
          mainImage: row.main_image,
          suggestedRetailPrice: row.suggested_retail_price,
          status: row.status,
          createdAt: row.created_at,
          copied: copy ? 1 : 0,
          copiedSpuId: copy ? copy.spu_id : null,
        };
      })
      .slice(Number(p.at(-1) ?? 0), Number(p.at(-1) ?? 0) + Number(p.at(-2) ?? 20));
  }
  if (has("FROM t_library_sku")) {
    const spuId = Number(p[0]);
    return db.librarySkus.filter((row) => row.spu_id === spuId && row.status === "APPROVED").map(asSku);
  }

  /* ── 幂等映射 / 配额 ── */
  if (has("FROM t_tenant_library_copy")) {
    const row = db.copies.find((c) => c.tenant_id === String(p[0]) && c.library_spu_id === Number(p[1]));
    return row ? { id: row.id, spu_id: row.spu_id } : null;
  }
  if (has("JOIN t_subscription_plan")) {
    return { maxProducts: db.plans[String(p[0])] ?? null };
  }
  if (has("COUNT(*) AS total FROM t_product_spu")) {
    return { total: db.productSpus.filter((row) => row.tenant_id === String(p[0])).length };
  }

  /* ── 调取流水（写入 + 平台/租户读） ── */
  if (/INSERT INTO t_library_call_log/i.test(sql)) {
    const row = {
      id: seq++,
      tenant_id: p[0],
      library_spu_id: p[1],
      library_spu_code: p[2],
      library_spu_name: p[3],
      spu_id: p[4],
      sku_count: p[5],
      call_type: p[6],
      operator_id: p[7],
      operator_name: p[8],
      created_at: `${today} 10:00:00`,
    };
    db.callLog.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (has("COUNT(*) AS total FROM t_library_call_log l")) {
    return { total: platformLogFilter(sql, p.slice(0, -2)).length };
  }
  if (has("COUNT(*) AS total FROM t_library_call_log WHERE tenant_id = ?")) {
    return { total: db.callLog.filter((row) => row.tenant_id === String(p[0])).length };
  }
  if (has("COUNT(*) AS total FROM t_library_call_log")) return { total: db.callLog.length };
  if (has("GROUP BY l.tenant_id")) {
    const byTenant = new Map();
    for (const row of db.callLog) byTenant.set(row.tenant_id, (byTenant.get(row.tenant_id) ?? 0) + 1);
    return [...byTenant.entries()]
      .map(([tenantId, count]) => ({
        tenantId,
        tenantDisplayName: db.tenants.find((t) => t.id === tenantId)?.name ?? null,
        callCount: count,
      }))
      .sort((a, b) => b.callCount - a.callCount);
  }
  if (has("GROUP BY DATE(created_at)")) {
    return db.callLog.length === 0 ? [] : [{ date: today, count: db.callLog.length }];
  }
  if (has("FROM t_library_call_log l")) {
    const [pageSize, offset] = [Number(p.at(-2) ?? 20), Number(p.at(-1) ?? 0)];
    return platformLogFilter(sql, p.slice(0, -2))
      .map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        tenantDisplayName: db.tenants.find((t) => t.id === row.tenant_id)?.name ?? null,
        librarySpuId: row.library_spu_id,
        librarySpuCode: row.library_spu_code,
        librarySpuName: row.library_spu_name,
        spuId: row.spu_id,
        skuCount: row.sku_count,
        callType: row.call_type,
        operatorName: row.operator_name,
        createdAt: row.created_at,
      }))
      .reverse()
      .slice(offset, offset + pageSize);
  }
  if (has("FROM t_library_call_log")) {
    return db.callLog
      .filter((row) => row.tenant_id === String(p[0]))
      .map((row) => ({
        id: row.id,
        librarySpuId: row.library_spu_id,
        librarySpuCode: row.library_spu_code,
        librarySpuName: row.library_spu_name,
        spuId: row.spu_id,
        skuCount: row.sku_count,
        callType: row.call_type,
        operatorName: row.operator_name,
        createdAt: row.created_at,
      }))
      .reverse();
  }

  /* ── 租户私有档案写入 ── */
  if (/INSERT INTO t_product_spu/i.test(sql)) {
    const row = {
      id: seq++,
      tenant_id: p[10],
      spu_code: p[0],
      name: p[1],
      category_id: 0,
      brand: p[2],
      unit: p[3],
      specs: p[4],
      main_image: p[5],
      image_urls: p[6],
      description: p[7],
      detail: p[8],
      status: p[9],
    };
    db.productSpus.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (/INSERT INTO t_product_sku/i.test(sql)) {
    const barcodeIndex = sql.includes("NULL") ? null : 2;
    const barcode = barcodeIndex === null ? null : p[barcodeIndex];
    if (barcode && db.usedBarcodes.has(barcode)) {
      const err = new Error(`Duplicate entry '${barcode}' for key 'uk_product_sku_barcode'`);
      err.code = "ER_DUP_ENTRY";
      err.errno = 1062;
      throw err;
    }
    if (barcode) db.usedBarcodes.add(barcode);
    const row = {
      id: seq++,
      spu_id: barcodeIndex === null ? p[0] : p[0],
      sku_code: barcodeIndex === null ? p[1] : p[1],
      barcode,
      sku_name: p[barcodeIndex === null ? 2 : 3],
    };
    db.productSkus.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (/INSERT INTO t_product_price/i.test(sql)) {
    const row = { id: seq++, sku_id: num(p[0]), retail_price: p[1], tenant_id: p[2] };
    db.productPrices.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }
  if (/INSERT INTO t_tenant_library_copy/i.test(sql)) {
    const exists = db.copies.find((c) => c.tenant_id === String(p[0]) && c.library_spu_id === Number(p[1]));
    if (exists) {
      const err = new Error("Duplicate entry for key 'uk_tenant_library'");
      err.code = "ER_DUP_ENTRY";
      err.errno = 1062;
      throw err;
    }
    const row = { id: seq++, tenant_id: String(p[0]), library_spu_id: Number(p[1]), spu_id: Number(p[2]) };
    db.copies.push(row);
    return { insertId: row.id, affectedRows: 1 };
  }

  unknownSql.push(sql.replace(/\s+/g, " ").slice(0, 120));
  return /^(SELECT|WITH)/i.test(sql.trim()) ? [] : { insertId: 0, affectedRows: 0 };
}

globalThis.__C641 = {
  query: async (sql, params) => dispatch(sql, params),
  queryOne: async (sql, params) => {
    const rows = dispatch(sql, params);
    return Array.isArray(rows) ? rows[0] ?? null : rows;
  },
  transaction: async (runner) => runner({}),
  connExecute: async (sql, params) => {
    const result = dispatch(sql, params);
    return [result, undefined];
  },
};

/* ───────── 真实路由 + 真实认证链 ───────── */
const { getAuthMiddlewares } = await import(pathToFileURL(path.join(ROOT, "backend/src/shared/auto-routes.ts")).href);
const { errorHandler } = await import(pathToFileURL(path.join(ROOT, "backend/src/middleware/error-handler.ts")).href);
const { generateCsrfToken } = await import(pathToFileURL(path.join(ROOT, "backend/src/middleware/csrf.ts")).href);
const { routeConfig: tenantRoute } = await import(
  pathToFileURL(path.join(ROOT, "backend/src/routes/admin-library.routes.ts")).href
);
const { routeConfig: platformRoute } = await import(
  pathToFileURL(path.join(ROOT, "backend/src/routes/platform-library.routes.ts")).href
);

function buildApp(prefix, router, authMode) {
  const app = express();
  app.use(express.json());
  app.use(prefix, ...getAuthMiddlewares(authMode), router);
  app.use(errorHandler);
  return app;
}

const tenantApp = buildApp(tenantRoute.prefix, tenantRoute.router, tenantRoute.auth);
const platformApp = buildApp(platformRoute.prefix, platformRoute.router, platformRoute.auth);

function tenantToken(uid, tenantId) {
  const perms = db.rolePerms[uid] ?? [];
  return jwt.sign({ id: uid, username: `u${uid}`, realName: `用户${uid}`, roles: ["STORE_MANAGER"], tenantId, perms }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    issuer: "zhixiang-system",
    audience: "zhixiang-client",
    expiresIn: "1h",
  });
}

function platformToken() {
  return jwt.sign({ type: "platform_admin", id: 42, username: "lingzhou" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    issuer: "zhixiang-platform",
    audience: "zhixiang-platform-client",
    expiresIn: "1h",
  });
}

function tenantReq(method, url, uid, tenantId = "t-001") {
  const req = supertest(tenantApp)[method](url).set("Authorization", `Bearer ${tenantToken(uid, tenantId)}`);
  if (method !== "get") req.set("x-csrf-token", generateCsrfToken(uid));
  return req;
}

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

const DUPLICATE_ENTRY_BARCODE = "6901234567890";

/* ═══ 反测①：配额已满 ⇒ 400 + 1001，且不生成档案、不写流水 ═══ */
{
  db.plans["t-001"] = 0; // 上限 0 ⇒ 已用 0 >= 上限 0 ⇒ 必须拒绝
  const before = { spu: db.productSpus.length, log: db.callLog.length, copy: db.copies.length };
  const res = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [123] });
  const after = { spu: db.productSpus.length, log: db.callLog.length, copy: db.copies.length };
  check(
    "①-a 配额已满 ⇒ HTTP 400 + 业务码 1001（带已用/上限与升级指引）",
    res.status === 400 && res.body.code === "1001" && /已用 0 个 \/ 上限 0 个/.test(res.body.msg),
    `status=${res.status} code=${res.body.code} msg=${res.body.msg}`
  );
  check(
    "①-b 被拒不写任何行：t_product_spu/t_product_sku/t_library_call_log/t_tenant_library_copy 增量全 0",
    JSON.stringify(before) === JSON.stringify(after),
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
  );
  db.plans["t-001"] = 100;
}

/* ═══ 反测②：调取成功 ⇒ 流水 +1 且档案可见 ═══ */
{
  const before = { log: db.callLog.length, copy: db.copies.length };
  const res = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [123] });
  const created = res.body?.data?.items?.[0] ?? {};
  const spuRow = db.productSpus.find((row) => row.id === Number(created.spuId));
  const skuRows = db.productSkus.filter((row) => row.spu_id === Number(created.spuId));
  const priceRows = db.productPrices.filter((row) => skuRows.some((s) => s.id === row.sku_id));
  check(
    "②-a 调取成功 ⇒ CREATED + 回传 spuId/skuCount",
    res.status === 200 && created.result === "CREATED" && created.skuCount === 2,
    `status=${res.status} item=${JSON.stringify(created)}`
  );
  check(
    "②-b 流水 +1 且映射 +1（t_library_call_log / t_tenant_library_copy）",
    db.callLog.length === before.log + 1 && db.copies.length === before.copy + 1,
    `log=${before.log}⇒${db.callLog.length} copy=${before.copy}⇒${db.copies.length}`
  );
  const lastLog = db.callLog.at(-1) ?? {};
  check(
    "②-c 流水逐列（租户/SPU 快照/生成 spuId/sku_count/call_type/操作人快照）",
    JSON.stringify(lastLog) ===
      JSON.stringify({
        id: lastLog.id,
        tenant_id: "t-001",
        library_spu_id: 123,
        library_spu_code: "SPU20260101001",
        library_spu_name: "茅台 飞天 53度",
        spu_id: created.spuId,
        sku_count: 2,
        call_type: "COPY",
        operator_id: 9004,
        operator_name: "用户9004",
        created_at: `${today} 10:00:00`,
      }),
    JSON.stringify(lastLog)
  );
  check(
    "②-d 档案可见：租户私有 SPU/SKU/价格三表按本租户落行（草稿态，等商家确认价格再上架）",
    !!spuRow && spuRow.tenant_id === "t-001" && spuRow.status === "DRAFT" && skuRows.length === 2 && priceRows.length === 2,
    `spu=${JSON.stringify(spuRow)} skus=${skuRows.length} prices=${priceRows.length}`
  );

  const mine = await tenantReq("get", "/api/admin/library/copies", 9004);
  check(
    "②-e 我的调取记录（T4）能查到刚写入的这行，且 spuId 与档案一致",
    mine.status === 200 && mine.body.data.total === 1 && mine.body.data.records[0].spuId === Number(created.spuId),
    `total=${mine.body.data?.total} first=${JSON.stringify(mine.body.data?.records?.[0])}`
  );
}

/* ═══ 幂等：同一 SPU 二次调取 ⇒ SKIPPED，零新增 ═══ */
{
  const before = { spu: db.productSpus.length, log: db.callLog.length, copy: db.copies.length };
  const res = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [123] });
  const item = res.body?.data?.items?.[0] ?? {};
  check(
    "③-a 二次调取同一 SPU ⇒ SKIPPED + 回既有 spuId（P200：清空档案后再调取也仍是 SKIPPED —— 映射行保留）",
    res.status === 200 && item.result === "SKIPPED" && !!item.spuId && item.reason === "已调取过",
    `status=${res.status} item=${JSON.stringify(item)}`
  );
  check(
    "③-b SKIPPED 零写入（不新建档案、不写流水、不占配额）",
    before.spu === db.productSpus.length && before.log === db.callLog.length && before.copy === db.copies.length,
    `before=${JSON.stringify(before)} after=${JSON.stringify({ spu: db.productSpus.length, log: db.callLog.length, copy: db.copies.length })}`
  );

  // Q4 反测：把租户档案标成已删除（软删）后再次调取，仍必须 SKIPPED
  const archive = db.productSpus.find((row) => row.tenant_id === "t-001");
  archive.status = "DELETED";
  const afterSoftDelete = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [123] });
  check(
    "③-c 软删档案后再调取 ⇒ 仍 SKIPPED（裁定 Q4 ①：不允许「删-调」循环绕过配额）",
    afterSoftDelete.body?.data?.items?.[0]?.result === "SKIPPED",
    JSON.stringify(afterSoftDelete.body?.data?.items?.[0])
  );
  archive.status = "DRAFT";
}

/* ═══ 未知 id ⇒ 404（带令牌，踩坑[155]口径） ═══ */
{
  const res = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [999999] });
  check(
    "④-a 未知 id ⇒ 业务级 404（带令牌打不存在资源，非 401 冒充）",
    res.status === 404 && res.body.code === "404" && String(res.body.msg).includes("999999"),
    `status=${res.status} msg=${res.body.msg}`
  );
  const pending = await tenantReq("post", "/api/admin/library/copies", 9004).send({ librarySpuIds: [124] });
  check(
    "④-b 非 APPROVED（PENDING）⇒ 同样 404（「下架后不可调取」口径）",
    pending.status === 404,
    `status=${pending.status} msg=${pending.body.msg}`
  );
  const bogus = await tenantReq("get", "/api/admin/library/__c641_not_exist__", 9004);
  check(
    "④-c 不存在的资源路径 ⇒ 404（证明 404 来自路由匹配，而不是被认证前置拦截）",
    bogus.status === 404,
    `status=${bogus.status}`
  );
}

/* ═══ 权限：无 library:copy ⇒ 403；无 library:view ⇒ 403；只读角色能看不能调 ═══ */
{
  const write = await tenantReq("post", "/api/admin/library/copies", 9003).send({ librarySpuIds: [123] });
  check(
    "⑤-a 无 library:copy（SALES_STAFF）⇒ 403 + code 403",
    write.status === 403 && write.body.code === "403",
    `status=${write.status} msg=${write.body.msg}`
  );
  const read = await tenantReq("get", "/api/admin/library/spus", 9003);
  check("⑤-b 无 library:view（SALES_STAFF）⇒ 403", read.status === 403, `status=${read.status}`);

  const readonlyRead = await tenantReq("get", "/api/admin/library/spus", 9001);
  const readonlyWrite = await tenantReq("post", "/api/admin/library/copies", 9001).send({ librarySpuIds: [123] });
  check(
    "⑤-c READONLY（*:view）⇒ 检索 200、调取 403（读写分离的机制证明）",
    readonlyRead.status === 200 && readonlyWrite.status === 403,
    `read=${readonlyRead.status} write=${readonlyWrite.status}`
  );
  const noToken = await supertest(tenantApp).post("/api/admin/library/copies").send({ librarySpuIds: [123] });
  check("⑤-d 无令牌 ⇒ 401（未登录，认证前置）", noToken.status === 401, `status=${noToken.status}`);
}

/* ═══ 检索（T1）：只返回 APPROVED + copied 标记（方案 B 左连，不靠猜） ═══ */
{
  const res = await tenantReq("get", "/api/admin/library/spus", 9004);
  const rows = res.body?.data?.records ?? [];
  check(
    "⑥-a T1 只返回 APPROVED（PENDING 的 124 不在结果里）+ copied/copiedSpuId 来自映射表",
    res.status === 200 && rows.length === 1 && rows[0].id === 123 && rows[0].copied === true && typeof rows[0].copiedSpuId === "number",
    `total=${res.body.data?.total} rows=${JSON.stringify(rows)}`
  );
  const other = await tenantReq("get", "/api/admin/library/spus", 9002, "t-002");
  check(
    "⑥-b 跨租户隔离：另一个租户看同一 SPU ⇒ copied=false（映射按 tenant_id 隔离）",
    other.body?.data?.records?.[0]?.copied === false,
    JSON.stringify(other.body?.data?.records?.[0])
  );
  const badPage = await tenantReq("get", "/api/admin/library/spus?pageSize=51", 9004);
  check("⑥-c pageSize > 50 ⇒ 显式 400（不静默截断）", badPage.status === 400, `status=${badPage.status} msg=${badPage.body.msg}`);

  const preview = await tenantReq("get", "/api/admin/library/spus/123", 9004);
  const previewData = preview.body?.data ?? {};
  check(
    "⑥-d T2 预览：SPU + SKU 明细 + copied/copiedSpuId + quota{used,limit,remaining}",
    preview.status === 200 &&
      previewData.id === 123 &&
      previewData.skus?.length === 2 &&
      previewData.copied === true &&
      typeof previewData.copiedSpuId === "number" &&
      previewData.quota?.used === 1 &&
      previewData.quota?.limit === 100 &&
      previewData.quota?.remaining === 99,
    JSON.stringify({ id: previewData.id, skus: previewData.skus?.length, copied: previewData.copied, copiedSpuId: previewData.copiedSpuId, quota: previewData.quota })
  );
  const previewMissing = await tenantReq("get", "/api/admin/library/spus/999999", 9004);
  check(
    "⑥-e T2 未知/未上架 id ⇒ 业务级 404（带令牌）",
    previewMissing.status === 404,
    `status=${previewMissing.status} msg=${previewMissing.body.msg}`
  );
}

/* ═══ 平台侧：统计口径唯一（t_library_call_log），扫码 hit_count 不掺进来 ═══ */
{
  const stats = await supertest(platformApp).get("/api/platform/library/stats").set("Authorization", `Bearer ${platformToken()}`);
  db.hitCount += 99; // 模拟扫码命中激增（SCAN＝查询，与调取无关）
  const statsAfterScan = await supertest(platformApp).get("/api/platform/library/stats").set("Authorization", `Bearer ${platformToken()}`);
  check(
    "⑦-a 平台 stats.monthCallCount = 流水行数（1 行），且扫码 hit_count 增加后**不变**",
    stats.status === 200 && stats.body.data.monthCallCount === db.callLog.length && statsAfterScan.body.data.monthCallCount === stats.body.data.monthCallCount,
    `monthCallCount=${stats.body.data?.monthCallCount} logRows=${db.callLog.length} afterScan=${statsAfterScan.body.data?.monthCallCount}`
  );
  check(
    "⑦-b 无载体维度显式 unavailable（categoryDist，Q9 不造假图）",
    Array.isArray(stats.body.data.unavailable) && stats.body.data.unavailable.some((u) => u.key === "categoryDist"),
    JSON.stringify(stats.body.data?.unavailable)
  );
  const rank = await supertest(platformApp).get("/api/platform/library/stats/rank").set("Authorization", `Bearer ${platformToken()}`);
  check(
    "⑦-c 租户排行来自流水聚合（tenantDisplayName 左连 t_tenant）",
    rank.status === 200 && rank.body.data.items[0]?.tenantId === "t-001" && rank.body.data.items[0]?.tenantDisplayName === "甲商户",
    JSON.stringify(rank.body.data?.items)
  );
  const trend = await supertest(platformApp).get("/api/platform/library/stats/trend?days=7").set("Authorization", `Bearer ${platformToken()}`);
  check(
    "⑦-d 趋势端点在册且返回数组（空数据即空数组）",
    trend.status === 200 && Array.isArray(trend.body.data.items) && trend.body.data.days === 7,
    `status=${trend.status} body=${JSON.stringify(trend.body.data)}`
  );
  const p5 = await supertest(platformApp).get("/api/platform/library/stats/category-dist").set("Authorization", `Bearer ${platformToken()}`);
  check("⑦-e P5 类目分布未注册（Q9）⇒ 带令牌得 404", p5.status === 404, `status=${p5.status}`);
  const callLogs = await supertest(platformApp)
    .get("/api/platform/library/call-logs?librarySpuId=123")
    .set("Authorization", `Bearer ${platformToken()}`);
  check(
    "⑦-f 流水明细（传 librarySpuId = 某商品被哪些租户调取）⇒ 只有调取事实，无任何租户私有档案字段",
    callLogs.status === 200 &&
      callLogs.body?.data?.records?.length === 1 &&
      callLogs.body.data.records[0].tenantDisplayName === "甲商户" &&
      !Object.keys(callLogs.body.data.records[0]).some((k) => /price|cost|stock|inventory|qty/i.test(k)),
    JSON.stringify(callLogs.body.data?.records?.[0])
  );
  const noToken = await supertest(platformApp).get("/api/platform/library/call-logs");
  check("⑦-g 平台侧无令牌 ⇒ 401（认证在路由匹配前）", noToken.status === 401, `status=${noToken.status}`);
}

/* ═══ 条码冲突降级（Q2 裁定②）：撞全库唯一键 ⇒ 降级 NULL + 显式 warnings，不 500 ═══ */
{
  db.usedBarcodes.add(DUPLICATE_ENTRY_BARCODE); // 模拟别的租户已占用该条码
  const res = await tenantReq("post", "/api/admin/library/copies", 9002, "t-002").send({ librarySpuIds: [123] });
  const item = res.body?.data?.items?.[0] ?? {};
  const skus = db.productSkus.filter((row) => row.spu_id === Number(item.spuId));
  check(
    "⑧-a 条码撞全库唯一键 ⇒ 仍 CREATED（不 500），降级写 barcode=NULL",
    res.status === 200 && item.result === "CREATED" && skus.some((row) => row.barcode === null),
    `status=${res.status} item=${JSON.stringify(item)} skus=${JSON.stringify(skus)}`
  );
  check(
    "⑧-b 降级原因显式返回（warnings，不得静默）",
    Array.isArray(item.warnings) && item.warnings.some((w) => w.includes("降级为不带条码")),
    JSON.stringify(item.warnings)
  );
}

fs.unlinkSync(stubPath);
fs.unlinkSync(mockStubPath);
if (unknownSql.length > 0) {
  console.log(`\n—— 未被迷你库识别而返回空的 SQL（${unknownSql.length} 条，需人工核对是否影响结论） ——`);
  for (const sql of new Set(unknownSql)) console.log(`   ${sql}`);
}
console.log(`\n合计 ${pass + fail} 项，PASS ${pass} / FAIL ${fail} / EXIT=${fail ? 1 : 0}`);
process.exit(fail ? 1 : 0);
