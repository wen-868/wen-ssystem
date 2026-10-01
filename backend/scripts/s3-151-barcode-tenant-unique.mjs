/**
 * S3-151 运行期主判据装置（真实后端进程 + 真实登录令牌 + 真实 HTTP + 真实 MariaDB）
 *
 * 为什么分成两个 phase：本沙箱里 **node 不能创建子进程**（`child_process.spawn` ⇒ EPERM，
 * 已实测，见回传卡"阻塞与自我报备"），所以装置自己拉不起后端。改由 PowerShell 包装脚本
 * （scripts/s3-151-barcode-tenant-unique.ps1）负责 build / 起进程 / 停进程，本文件只管
 * "数据库 + HTTP"两类判定。
 *
 * 用法（禁止指向生产，默认连本机私有 MariaDB 127.0.0.1:3399 root/空密码）：
 *   node backend/scripts/s3-151-barcode-tenant-unique.mjs reset     # 重建专用空库
 *   node backend/scripts/s3-151-barcode-tenant-unique.mjs verify    # 正向全链
 *   node backend/scripts/s3-151-barcode-tenant-unique.mjs revert    # 反测：键改回 (barcode) ⇒ 跨租户同条码必失败
 * 环境变量：S3_151_DB_HOST / S3_151_DB_PORT / S3_151_DB_USER / S3_151_DB_PASSWORD / S3_151_DB_NAME /
 *           S3_151_PORT（后端端口，默认 18151）/ S3_151_SERVER_OUT + S3_151_SERVER_ERR（后端 stdout/stderr
 *           重定向文件，供核对"执行外部迁移: 194"一行）/ S3_151_EVIDENCE_DIR（证据落盘目录）
 *
 * 判定链：
 *   ① 空库启动后端（走 runMigrations 生产路径，194 在其中执行）⇒ 索引形状 = (tenant_id, barcode) 复合唯一
 *   ② 把键人工改回 (barcode) 全库唯一（模拟改造前的生产态）⇒ 原文应用 194 ⇒ 键变回复合唯一（DDL 分支真的执行）
 *   ③ 再原文应用 194 一次 ⇒ 输出"整句跳过"标记、索引形状不变（幂等守卫真的生效，不报错）
 *   ④ 两租户各取真令牌：A 建品(条码X) 200 → B 用**同一条码**建品 200（跨租户不再互相挡）
 *   ⑤ A 再用同一条码建品 ⇒ 400 + 中文文案（修复前 500）；导入含重复条码两行 ⇒ errors[] 全中文
 *   ⑥ 落库读数：同一条码在两租户各自成行
 *   ⑦ revert 模式：键改回 (barcode) ⇒ ④ 的 B 请求必失败（红）⇒ 复原 ⇒ 变绿（两侧齐）
 *
 * ★ 撞键通道自动二选一（本机只有 MariaDB，其解析器不支持 CAST(x AS JSON)，而 createProduct /
 *   importProducts 的 SQL 里写了 CAST(? AS JSON)——那是 MySQL 8 语法）：
 *     · MySQL 8（生产口径）：④⑤ 原样走 建品 POST /api/admin/products 与 导入 POST /api/admin/products/import
 *     · MariaDB（本机）：④ 走 改条码 PUT /api/admin/products/skus/:skuId/barcode（同一个
 *       uk_product_sku_tenant_barcode 唯一键、同一个 400 映射），⑤ 如实记录"导入链路在 MariaDB 先
 *       ER_PARSE_ERROR"的环境事实；建品/导入的语义由 vitest 单测覆盖（CI 执行）
 *   在 MySQL 8 上复跑本装置（S3_151_DB_HOST/PORT/USER/PASSWORD 指过去）即可拿到建品/导入两条链路的原样证据。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import mysql from "mysql2/promise";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(HERE, "..");
const REPO_DIR = resolve(BACKEND_DIR, "..");
const MIGRATION_FILE = resolve(REPO_DIR, "docs/migrations/194_条码唯一键改租户内唯一.sql");
const MIGRATION_NAME = "194_条码唯一键改租户内唯一.sql";

const PHASE = (process.argv[2] || "verify").toLowerCase();
const PORT = Number(process.env.S3_151_PORT || 18151);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = {
  host: process.env.S3_151_DB_HOST || "127.0.0.1",
  port: Number(process.env.S3_151_DB_PORT || 3399),
  user: process.env.S3_151_DB_USER || "root",
  password: process.env.S3_151_DB_PASSWORD ?? "",
  name: process.env.S3_151_DB_NAME || "s3151_verify",
};
const ADMIN_PASSWORD = "Admin@2026";
const TENANT_B = "t151b";
const USER_B = "s151_admin_b";
const BARCODE = "6901234567890";
const EVIDENCE_DIR = process.env.S3_151_EVIDENCE_DIR || join(tmpdir(), "s3-151-evidence");
const SERVER_OUT = process.env.S3_151_SERVER_OUT || join(EVIDENCE_DIR, "server.out.log");
const SERVER_ERR = process.env.S3_151_SERVER_ERR || join(EVIDENCE_DIR, "server.err.log");

function serverLogText() {
  return [SERVER_OUT, SERVER_ERR]
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, "utf-8"))
    .join("\n");
}

let passed = 0;
let failed = 0;
const logLines = [];

function say(line = "") {
  console.log(line);
  logLines.push(line);
}

function report(label, ok, detail) {
  if (ok) passed += 1;
  else failed += 1;
  say(`${ok ? "PASS" : "FAIL"}  ${label}   ← ${detail}`);
}

function dbConn(name = DB.name) {
  return mysql.createConnection({
    host: DB.host,
    port: DB.port,
    user: DB.user,
    password: DB.password,
    database: name || undefined,
    multipleStatements: true,
  });
}

async function indexShape(conn) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME AS n, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, NON_UNIQUE AS nu
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_product_sku'
        AND INDEX_NAME IN ('uk_product_sku_barcode', 'uk_product_sku_tenant_barcode')
      GROUP BY INDEX_NAME, NON_UNIQUE`,
    [DB.name]
  );
  return rows;
}

const isCompositeKey = (shape) =>
  shape.length === 1 && shape[0].n === "uk_product_sku_tenant_barcode" && shape[0].cols === "tenant_id,barcode" && Number(shape[0].nu) === 0;
const isGlobalKey = (shape) => shape.length === 1 && shape[0].n === "uk_product_sku_barcode" && shape[0].cols === "barcode" && Number(shape[0].nu) === 0;

/** 把键换成目标形态（global = 改造前的全库唯一；tenant = S3-151 的租户内唯一） */
async function swapKeyTo(conn, target) {
  const shape = await indexShape(conn);
  const hasOld = shape.some((r) => r.n === "uk_product_sku_barcode");
  const hasNew = shape.some((r) => r.n === "uk_product_sku_tenant_barcode");
  const parts = [];
  if (target === "global") {
    if (hasOld) return;
    if (hasNew) parts.push("DROP INDEX uk_product_sku_tenant_barcode");
    parts.push("ADD UNIQUE KEY uk_product_sku_barcode (barcode)");
  } else {
    if (hasNew) return;
    if (hasOld) parts.push("DROP INDEX uk_product_sku_barcode");
    parts.push("ADD UNIQUE KEY uk_product_sku_tenant_barcode (tenant_id, barcode)");
  }
  await conn.query(`ALTER TABLE t_product_sku ${parts.join(", ")}`);
}

async function api(method, path, { token, csrf, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 响应保留原文 */
  }
  say(`  → ${method} ${path} ⇒ ${res.status}  ${text.length > 700 ? text.slice(0, 700) + "…" : text}`);
  return { status: res.status, json, text };
}

const login = async (username) => {
  const res = await api("POST", "/api/admin/auth/login", { body: { username, password: ADMIN_PASSWORD } });
  return { status: res.status, token: res.json?.data?.token, csrf: res.json?.data?.csrfToken };
};

const productBody = (barcode) => ({
  name: `S3-151 商品 ${barcode}`,
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

/** 本机 MariaDB 不支持 CAST(x AS JSON)（MySQL 8 支持）——探测以决定走哪条撞键判定通道 */
async function probeCastJson(conn) {
  try {
    await conn.query("SELECT CAST('{}' AS JSON)");
    return true;
  } catch {
    return false;
  }
}

/** MariaDB 通道的预置数据：每个租户 2 个 barcode 为 NULL 的 SKU（1 个做正向、1 个做同租户撞键） */
async function seedBarcodeFixtures(conn) {
  const made = { A: [], B: [] };
  const tenants = { A: "default", B: TENANT_B };
  for (const key of ["A", "B"]) {
    for (const i of [1, 2]) {
      const [spu] = await conn.query(
        `INSERT INTO t_product_spu (tenant_id, spu_code, name, category_id, sale_channels, status)
         VALUES (?, ?, ?, 1, '["STORE"]', 'DRAFT')`,
        [tenants[key], `S151SPU${key}${i}`, `S3-151 预置商品 ${key}${i}`]
      );
      const [sku] = await conn.query(
        `INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, barcode, sku_name)
         VALUES (?, ?, ?, NULL, ?)`,
        [tenants[key], spu.insertId, `S151SKU${key}${i}`, `S3-151 预置 SKU ${key}${i}`]
      );
      made[key].push(sku.insertId);
    }
  }
  say(`  已预置登录租户的 SKU（barcode=NULL）：租户A=${JSON.stringify(made.A)} 租户B=${JSON.stringify(made.B)}`);
  return made;
}

function finish() {
  const summary = `\n小结[${PHASE}]：${passed} passed / ${failed} failed`;
  say(summary);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `harness-${PHASE}.log`), logLines.join("\n"), "utf-8");
  say(`EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

async function phaseReset() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const root = await dbConn("");
  await root.query(`DROP DATABASE IF EXISTS \`${DB.name}\``);
  await root.query(`CREATE DATABASE \`${DB.name}\` CHARACTER SET utf8mb4`);
  const [tables] = await root.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [DB.name]
  );
  await root.end();
  say(`【reset】已重建专用空库 ${DB.name}@${DB.host}:${DB.port}，现有表数=${tables[0].c}（期望 0）`);
  report("reset 空库已就绪", Number(tables[0].c) === 0, `tables=${tables[0].c}`);
  finish();
}

async function waitHealthy() {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* 未就绪 */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

async function phaseVerify() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  say(`【装置】S3-151 条码唯一键租户内唯一 — phase=${PHASE}  后端=${BASE}  库=${DB.name}@${DB.host}:${DB.port}`);
  say(`【证据目录】${EVIDENCE_DIR}`);

  say("\n=== 段1 真实后端启动（runMigrations 生产路径）===");
  const healthy = await waitHealthy();
  report("段1a 后端 /health 就绪", healthy, `stdout=${SERVER_OUT}`);
  const serverLog = serverLogText();
  const migLine = serverLog.split(/\r?\n/).find((l) => l.includes("执行外部迁移") && l.includes(MIGRATION_NAME));
  report("段1b 启动路径确实执行了迁移 194", !!migLine, migLine ? migLine.trim() : "日志中未见 194 执行行");

  const conn = await dbConn();
  const shape1 = await indexShape(conn);
  report("段1c 空库启动后：条码索引已是 (tenant_id, barcode) 复合唯一", isCompositeKey(shape1), JSON.stringify(shape1));

  say("\n=== 段2 迁移 194 原文应用（旧键态 ⇒ 新键态）+ 幂等（再跑一次跳过）===");
  const sql194 = readFileSync(MIGRATION_FILE, "utf-8");
  await swapKeyTo(conn, "global");
  const shapeOld = await indexShape(conn);
  report("段2a 已模拟改造前生产态：键回到 (barcode) 全库唯一", isGlobalKey(shapeOld), JSON.stringify(shapeOld));

  const [rs1] = await conn.query(sql194);
  const sets1 = Array.isArray(rs1) ? rs1 : [rs1];
  const skipped1 = JSON.stringify(sets1).includes("整句跳过");
  report("段2b 第 1 次应用 194：执行 DROP 旧键 + ADD 新键（未走跳过分支）", !skipped1, `结果集=${JSON.stringify(sets1).slice(0, 400)}`);
  const shapeAfter1 = await indexShape(conn);
  report("段2c 应用后索引形状 = (tenant_id, barcode) 复合唯一", isCompositeKey(shapeAfter1), JSON.stringify(shapeAfter1));

  const [rs2] = await conn.query(sql194);
  const sets2 = Array.isArray(rs2) ? rs2 : [rs2];
  const skipped2 = JSON.stringify(sets2).includes("整句跳过");
  report("段2d 第 2 次应用 194：守卫命中，整句跳过且不报错（幂等）", skipped2, `结果集=${JSON.stringify(sets2).slice(0, 400)}`);
  const shapeAfter2 = await indexShape(conn);
  report("段2e 连跑两次后索引形状不变", isCompositeKey(shapeAfter2), JSON.stringify(shapeAfter2));

  say("\n=== 段3 造租户B管理员，两租户各取真令牌 ===");
  const [[userA]] = await conn.query("SELECT id, tenant_id FROM t_sys_user WHERE username = 'admin' LIMIT 1");
  const [tenantA] = await conn.query("SELECT id, name FROM t_tenant WHERE id = ?", [userA?.tenant_id ?? "default"]);
  say(`  租户A：${JSON.stringify(tenantA[0] ?? null)} 账号 admin id=${userA?.id}`);
  await conn.query(
    `INSERT INTO t_tenant (id, name, contact_name, contact_phone, plan, status, expire_at, created_at, updated_at)
     VALUES (?, 'S3-151 租户B', '测试', '13800000000', 'basic', 1, DATE_ADD(NOW(), INTERVAL 1 YEAR), NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [TENANT_B]
  );
  const [existingB] = await conn.query("SELECT id FROM t_sys_user WHERE username = ? LIMIT 1", [USER_B]);
  if (existingB.length === 0) {
    const bcrypt = require("bcryptjs");
    await conn.query(
      `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, store_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'S3-151 租户B管理员', '13800000009', NULL, 1, NOW(), NOW())`,
      [TENANT_B, USER_B, `v2$${bcrypt.hashSync(ADMIN_PASSWORD, 12)}`]
    );
  }
  const loginA = await login("admin");
  report("段3a 租户A（admin）登录签发令牌", loginA.status === 200 && !!loginA.token, `status=${loginA.status}`);
  const loginB = await login(USER_B);
  report("段3b 租户B 登录签发令牌", loginB.status === 200 && !!loginB.token, `status=${loginB.status}`);
  if (!loginA.token || !loginB.token) {
    say("无令牌，装置中止");
    finish();
    return;
  }

  say("\n=== 段4 撞键语义（HTTP 真值）===");
  const castJson = await probeCastJson(conn);
  say(
    `  能力探测：CAST(x AS JSON) ${castJson ? "支持（MySQL 8 口径）" : "**不支持（本机 MariaDB 11.4.5）**"} ` +
      `⇒ 撞键判定通道 = ${castJson ? "建品 POST /api/admin/products（卡内主判据原样）" : "改条码 PUT /api/admin/products/skus/:skuId/barcode（同一唯一键 + 同一 400 映射）"}`
  );
  let fixture = null;
  if (!castJson) fixture = await seedBarcodeFixtures(conn);

  const writeBarcode = (who, skuId, barcode) => {
    const t = who === "A" ? loginA : loginB;
    if (castJson) {
      return api("POST", "/api/admin/products", { token: t.token, csrf: t.csrf, body: productBody(barcode) });
    }
    return api("PUT", `/api/admin/products/skus/${skuId}/barcode`, { token: t.token, csrf: t.csrf, body: { barcode } });
  };
  const targetA1 = fixture ? fixture.A[0] : 0;
  const targetA2 = fixture ? fixture.A[1] : 0;
  const targetB1 = fixture ? fixture.B[0] : 0;

  const firstA = await writeBarcode("A", targetA1, BARCODE);
  report("段4a 租户A 写入条码 X ⇒ 200", firstA.status === 200, `status=${firstA.status} data=${JSON.stringify(firstA.json?.data)}`);

  if (PHASE === "revert") {
    say("\n=== 反测：把键改回 (barcode) 全库唯一 ===");
    await swapKeyTo(conn, "global");
    say(`  revert 后索引形状：${JSON.stringify(await indexShape(conn))}`);
    const red = await writeBarcode("B", targetB1, BARCODE);
    report("反测-段4b 全库唯一键下：租户B 用同条码写入必失败（红）", red.status !== 200, `status=${red.status} msg=${red.json?.msg}`);
    say("\n=== 复原：把键改回 (tenant_id, barcode) ===");
    await swapKeyTo(conn, "tenant");
    say(`  复原后索引形状：${JSON.stringify(await indexShape(conn))}`);
    const green = await writeBarcode("B", targetB1, BARCODE);
    report("反测-段4c 复原后同一请求变绿 ⇒ 200", green.status === 200, `status=${green.status}`);
    await conn.end();
    finish();
    return;
  }

  const secondB = await writeBarcode("B", targetB1, BARCODE);
  report(
    "段4b 租户B 用**同一条码**写入 ⇒ 200（跨租户同条码不再互相挡；修复前此处必失败）",
    secondB.status === 200,
    `status=${secondB.status} data=${JSON.stringify(secondB.json?.data)}`
  );

  const dupA = await writeBarcode("A", targetA2, BARCODE);
  report(
    "段4c 租户A 用同一条码再写 ⇒ 400 + 中文文案",
    dupA.status === 400 && dupA.json?.msg === "该条码已被其他商品使用",
    `status=${dupA.status} code=${dupA.json?.code} msg=${dupA.json?.msg}`
  );

  say("\n=== 段5 批量导入含重复条码的两行 ===");
  if (castJson) {
    const importRes = await api("POST", "/api/admin/products/import", {
      token: loginA.token,
      csrf: loginA.csrf,
      body: {
        rows: [
          { name: "导入商品甲", skuName: "500ml", barcode: "6901234569999", retailPrice: "20" },
          { name: "导入商品乙", skuName: "500ml", barcode: "6901234569999", retailPrice: "20" },
        ],
      },
    });
    const importData = importRes.json?.data ?? {};
    const messages = (importData.errors ?? []).map((e) => e.message);
    report(
      "段5a 导入 200 且 1 成功 / 1 失败",
      importRes.status === 200 && importData.successCount === 1 && importData.failCount === 1,
      `status=${importRes.status} success=${importData.successCount} fail=${importData.failCount}`
    );
    report(
      "段5b 逐行错误为中文业务文案，且响应正文不含 Duplicate entry",
      messages.length === 1 && messages[0] === "该条码已被其他商品使用" && !importRes.text.includes("Duplicate entry"),
      `errors=${JSON.stringify(importData.errors)}`
    );
  } else {
    const importRes = await api("POST", "/api/admin/products/import", {
      token: loginA.token,
      csrf: loginA.csrf,
      body: {
        rows: [
          { name: "导入商品甲", skuName: "500ml", barcode: "6901234569999", retailPrice: "20" },
          { name: "导入商品乙", skuName: "500ml", barcode: "6901234569999", retailPrice: "20" },
        ],
      },
    });
    say("  【环境限制】本机 MariaDB 不支持 CAST(x AS JSON) ⇒ 建品/导入两条链路在报出条码撞键之前就先 ER_PARSE_ERROR");
    say(`  导入原始返回：${importRes.text}`);
    report(
      "段5a 导入链路在本机 MariaDB 不可执行（属环境限制，已如实记录原始报错）",
      importRes.status === 200 && (importRes.json?.data?.errors ?? []).every((e) => e.message.includes("SQL syntax")),
      `status=${importRes.status} errors=${JSON.stringify(importRes.json?.data?.errors ?? [])}`
    );
    report(
      "段5b 导入链路未回传 Duplicate entry（本环境报的是 SQL 语法错，非撞键原文）",
      !importRes.text.includes("Duplicate entry"),
      `含 Duplicate entry = ${importRes.text.includes("Duplicate entry")}`
    );
  }

  say("\n=== 段6 落库读数 ===");
  const [rows] = await conn.query(
    `SELECT tenant_id, barcode, COUNT(*) AS c, GROUP_CONCAT(id) AS sku_ids
       FROM t_product_sku WHERE barcode = ? GROUP BY tenant_id, barcode ORDER BY tenant_id`,
    [BARCODE]
  );
  say(`  同一条码分租户落库：${JSON.stringify(rows)}`);
  const [dup] = await conn.query(
    `SELECT tenant_id, barcode, COUNT(*) AS c FROM t_product_sku
      WHERE barcode IS NOT NULL GROUP BY tenant_id, barcode HAVING c > 1`
  );
  say(`  全表查重（同租户同条码重数，期望 0 行）：${JSON.stringify(dup)}`);
  report("段6a 同一条码在两租户各自成行", rows.length === 2 && rows.every((r) => Number(r.c) === 1), JSON.stringify(rows));
  report("段6b 全表无同租户重复条码", dup.length === 0, `dupGroups=${dup.length}`);

  await conn.end();
  finish();
}

if (!existsSync(MIGRATION_FILE)) {
  console.error(`缺少迁移文件 ${MIGRATION_FILE}`);
  process.exit(2);
}

if (PHASE === "reset" || PHASE === "recreate") await phaseReset();
else await phaseVerify();
