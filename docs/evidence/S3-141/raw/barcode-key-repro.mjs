#!/usr/bin/env node
/**
 * S3-141 评估单 · 反例复现装置（本机可复跑；产物在 .mimosa/ 属 .gitignore，不入库）
 *
 * 用法（仓库根执行）：node .mimosa/s3-141/barcode-key-repro.mjs [repoRoot]
 * 依赖：Node ≥ 22（实测 v24.18.0）+ backend/node_modules 可解析。
 *
 * 覆盖两段证据，全部可复跑：
 *   证据一 · 唯一键语义（node:sqlite 真实 SQL 引擎）
 *     A) 现键 UNIQUE(barcode)：t-001 与 t-002 用同一条码 ⇒ 第 2 条被拒
 *     B) 拟改键 UNIQUE(tenant_id, barcode)：同条码跨租户可共存；同租户重复仍被拒；NULL 可重复
 *   证据二 · 真实服务代码路径（backend/src/services/admin/product.service.ts，db 层换成内存迷你库）
 *     现键语义下：
 *       a3) t-002 改条码 updateSkuBarcode → 捕获 ER_DUP_ENTRY ⇒ 经真实 errorHandler = HTTP 400
 *       a4) t-002 建品 createProduct   → 未捕获 ER_DUP_ENTRY ⇒ 经真实 errorHandler = HTTP 500
 *       a5) 同租户重复条码 → 同样 500（现状即如此，与租户无关）
 *     拟改键语义下：a3/a4 成功（跨租户不再互斥），a5 仍被拒（租户内唯一性保留）
 *
 * 边界（诚实标注）：db 层是本进程内存迷你库，未过真实 MySQL；真实 MySQL 侧的 1062 断言
 * 由 backend/scripts/c6-4-1-harness.mjs（真实 express 路由 + 真实服务）覆盖，本装置与之互补。
 */
import { registerHooks } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(process.argv[2] ?? ".");

// 真实模块（shared/env）在加载期校验环境变量；这里给最小可跑取值，不连任何真实外部服务。
process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "s3-141-eval-local-only";
process.env.NODE_ENV = "test";

const OUT = [];
const log = (line = "") => {
  OUT.push(line);
  console.log(line);
};

/* ══════════════════════ 证据一：唯一键语义（真实 SQL 引擎） ══════════════════════ */

function sqliteKeyShape(label, ddl) {
  const db = new DatabaseSync(":memory:");
  db.exec(ddl);
  const ins = db.prepare("INSERT INTO t_product_sku (tenant_id, sku_code, barcode) VALUES (?, ?, ?)");
  const results = [];
  const attempt = (tenant, code, barcode) => {
    try {
      ins.run(tenant, code, barcode);
      results.push(`   ${tenant} + ${barcode} ⇒ 写入成功`);
    } catch (err) {
      results.push(`   ${tenant} + ${barcode} ⇒ 被拒：${err.message}`);
    }
  };
  attempt("t-001", "S1", "6900000000017");
  attempt("t-002", "S2", "6900000000017"); // 跨租户同条码
  attempt("t-002", "S3", "6900000000017"); // 同租户重复
  attempt("t-002", "S4", null); // NULL
  attempt("t-002", "S5", null); // NULL 再来一条
  db.close();
  log(`【证据一 · ${label}】`);
  results.forEach(log);
  log("");
}

log("════════ 证据一：node:sqlite 真实 UNIQUE 约束语义（与 MySQL UNIQUE 在本组情形一致） ════════");
sqliteKeyShape(
  "现键 UNIQUE(barcode)（= 生产 uk_product_sku_barcode）",
  `CREATE TABLE t_product_sku (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id TEXT NOT NULL,
     sku_code TEXT NOT NULL,
     barcode TEXT,
     UNIQUE (barcode)
   )`
);
sqliteKeyShape(
  "拟改键 UNIQUE(tenant_id, barcode)",
  `CREATE TABLE t_product_sku (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     tenant_id TEXT NOT NULL,
     sku_code TEXT NOT NULL,
     barcode TEXT,
     UNIQUE (tenant_id, barcode)
   )`
);

/* ═════════════════ 证据二：真实 product.service 代码路径（内存迷你库） ═════════════════ */

const realDbUrl = pathToFileURL(path.join(ROOT, "backend/src/shared/db.ts")).href;
const stubPath = path.join(os.tmpdir(), `s3141-db-stub-${process.pid}.mjs`);
fs.writeFileSync(
  stubPath,
  [
    `export * from ${JSON.stringify(realDbUrl)};`,
    `const g = () => globalThis.__S3141;`,
    `export const query = (sql, params = []) => g().query(sql, params, null);`,
    `export const queryOne = (sql, params = []) => g().queryOne(sql, params, null);`,
    `export const queryWithTenant = (sql, params = [], tenantId) => g().query(sql, params, tenantId);`,
    `export const queryOneWithTenant = (sql, params = [], tenantId) => g().queryOne(sql, params, tenantId);`,
    `export const executeWithTenant = (sql, params = [], tenantId) => g().query(sql, params, tenantId);`,
    `export const transaction = (runner) => g().transaction(runner);`,
    `export const connQuery = (conn, sql, params = []) => g().query(sql, params, null);`,
    `export const connQueryOne = (conn, sql, params = []) => g().queryOne(sql, params, null);`,
    `export const connExecute = (conn, sql, params = []) => g().query(sql, params, null);`,
  ].join("\n"),
  "utf8"
);
const stubUrl = pathToFileURL(stubPath).href;

const mockStubPath = path.join(os.tmpdir(), `s3141-mockdb-stub-${process.pid}.mjs`);
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

/** 内存迷你库：按 SQL 关键字分发；唯一性判定完全由 store.keyShape 驱动 */
const store = { keyShape: "global", skus: [], spus: [], prices: [], seq: 500 };

function duplicateEntryError(barcode) {
  const err = new Error(`Duplicate entry '${barcode}' for key 'uk_product_sku_barcode'`);
  err.code = "ER_DUP_ENTRY";
  err.errno = 1062;
  return err;
}

/** 与生产唯一键同构的判定：global = UNIQUE(barcode)；tenant = UNIQUE(tenant_id, barcode) */
function assertBarcodeFree(barcode, tenantId, excludeId = null) {
  if (barcode === null || barcode === undefined || barcode === "") return;
  const hit = store.skus.find((row) => {
    if (row.id === excludeId) return false;
    if (row.barcode !== barcode) return false;
    return store.keyShape === "global" ? true : row.tenant_id === tenantId;
  });
  if (hit) throw duplicateEntryError(barcode);
}

function query(sql, params = [], tenantId = null) {
  const s = String(sql).replace(/\s+/g, " ").trim();

  if (/^INSERT INTO t_product_spu/i.test(s)) {
    const row = { id: ++store.seq, tenant_id: tenantId ?? params[params.length - 1] };
    store.spus.push(row);
    return [{ insertId: row.id, affectedRows: 1 }];
  }
  if (/^INSERT INTO t_product_sku/i.test(s)) {
    // createProduct 的 INSERT 列序：spu_id, sku_code, barcode, ... , tenant_id
    const barcode = params[2] ?? null;
    const insertTenant = params[params.length - 1];
    assertBarcodeFree(barcode, insertTenant);
    const row = { id: ++store.seq, tenant_id: insertTenant, spu_id: params[0], sku_code: params[1], barcode };
    store.skus.push(row);
    return [{ insertId: row.id, affectedRows: 1 }];
  }
  if (/^INSERT INTO t_product_price/i.test(s)) {
    store.prices.push({ id: ++store.seq });
    return [{ insertId: store.seq, affectedRows: 1 }];
  }
  if (/^UPDATE t_product_sku SET barcode\s*=/i.test(s)) {
    const barcode = params[0] ?? null;
    const skuId = params[1];
    const row = store.skus.find((r) => r.id === Number(skuId));
    if (!row) return [{ insertId: 0, affectedRows: 0 }];
    if (tenantId && row.tenant_id !== tenantId) return [{ insertId: 0, affectedRows: 0 }];
    assertBarcodeFree(barcode, row.tenant_id, row.id);
    row.barcode = barcode;
    return [{ insertId: 0, affectedRows: 1 }];
  }
  if (/^INSERT INTO t_inventory_balance/i.test(s)) return [{ insertId: 0, affectedRows: 1 }];
  return [];
}

globalThis.__S3141 = {
  query,
  queryOne: (sql, params, tenantId) => query(sql, params, tenantId)[0] ?? null,
  transaction: async (runner) => runner({ query: (sql, params) => Promise.resolve(query(sql, params, null)) }),
};

const productService = await import(
  pathToFileURL(path.join(ROOT, "backend/src/services/admin/product.service.ts")).href
);
const { errorHandler } = await import(
  pathToFileURL(path.join(ROOT, "backend/src/middleware/error-handler.ts")).href
);

/** 把真实 errorHandler 跑一遍，返回它最终决定的 HTTP 状态码与响应体 */
async function viaErrorHandler(err, url, method) {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await new Promise((resolve) => {
    errorHandler(err, { originalUrl: url, method, body: {}, headers: {} }, res, () => resolve());
    setTimeout(resolve, 150);
  });
  return { statusCode: res.statusCode, body: res.body };
}

function newProductPayload(name, barcode) {
  return {
    name,
    categoryId: 1,
    saleChannels: ["MINIAPP", "STORE"],
    imageUrls: [],
    skus: [
      {
        skuName: `${name} 500ml`,
        barcode,
        boxRatio: 6,
        temperature: "NORMAL",
        traceEnabled: false,
        warningThreshold: 0,
        costPrice: 1,
        retailPrice: 10,
      },
    ],
  };
}

const BARCODE = "6900000000017";

/** 跑一遍四步场景，返回每步的结论（文字） */
async function scenario(keyShape) {
  store.keyShape = keyShape;
  store.skus = [];
  store.spus = [];
  store.prices = [];
  store.seq = 500;
  const lines = [];

  // a1：t-001 建品（带条码）—— 两方案都应成功
  const a1 = await productService.createProduct(newProductPayload("甲租户商品", BARCODE), "t-001", {});
  lines.push(`a1 t-001 建品(条码 ${BARCODE}) ⇒ 成功 skuId=${a1.skuId}`);

  // a2：t-002 建品（不带条码）—— 两方案都应成功，拿到一个可改条码的 SKU
  const a2 = await productService.createProduct(newProductPayload("乙租户商品", undefined), "t-002", {});
  lines.push(`a2 t-002 建品(无条码)          ⇒ 成功 skuId=${a2.skuId}`);

  // a3：t-002 给自家 SKU 补录同一条码（改品）—— 现键 400 / 拟改键成功
  try {
    const r = await productService.updateSkuBarcode(a2.skuId, BARCODE, "t-002");
    lines.push(`a3 t-002 改条码 → ${BARCODE}       ⇒ 成功 ${JSON.stringify(r)}`);
  } catch (err) {
    const out = await viaErrorHandler(err, "/api/admin/products/skus/1/barcode", "PUT");
    lines.push(`a3 t-002 改条码 → ${BARCODE}       ⇒ 被拒 HTTP ${out.statusCode} ${JSON.stringify(out.body)}`);
  }

  // a4：另一个租户 t-003 建品并用同一条码（跨租户）—— 现键 500 / 拟改键成功
  try {
    const r = await productService.createProduct(newProductPayload("丙租户撞码商品", BARCODE), "t-003", {});
    lines.push(`a4 t-003 建品(跨租户同条码)    ⇒ 成功 skuId=${r.skuId}`);
  } catch (err) {
    const out = await viaErrorHandler(err, "/api/admin/products", "POST");
    lines.push(`a4 t-003 建品(跨租户同条码)    ⇒ 被拒 HTTP ${out.statusCode} ${JSON.stringify(out.body)}`);
  }

  // a5：t-002 再次建品用同一条码（租户内重复）—— 两方案都应被拒
  try {
    const r = await productService.createProduct(newProductPayload("乙租户重复商品", BARCODE), "t-002", {});
    lines.push(`a5 t-002 同租户重复条码        ⇒ 成功 skuId=${r.skuId}（租户内唯一性未生效！）`);
  } catch (err) {
    const out = await viaErrorHandler(err, "/api/admin/products", "POST");
    lines.push(`a5 t-002 同租户重复条码        ⇒ 被拒 HTTP ${out.statusCode} ${JSON.stringify(out.body)}`);
  }

  return lines;
}

log("════════ 证据二：真实 product.service 代码路径（db 层 = 内存迷你库，错误处理 = 真实 errorHandler） ════════");
log("【场景 A · 现键语义 UNIQUE(barcode)】");
(await scenario("global")).forEach(log);
log("");
log("【场景 B · 拟改键语义 UNIQUE(tenant_id, barcode)】");
(await scenario("tenant")).forEach(log);
log("");

log("════════ 结论摘要 ════════");
log("· 现键：跨租户同条码 ⇒ 改品路径 HTTP 400（「该条码已被其他商品使用」虽是别家租户）；建品路径未捕获 ⇒ HTTP 500。");
log("· 拟改键：跨租户同条码不再互斥；同租户内重复仍被拒（a5）。");
log("· 建品路径的 500 属错误处理缺陷，与键的形状无关，改键后仍在（a5），建议另行立项。");

fs.unlinkSync(stubPath);
fs.unlinkSync(mockStubPath);
process.exit(0);
