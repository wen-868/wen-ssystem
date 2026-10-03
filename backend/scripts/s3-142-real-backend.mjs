/**
 * S3-142 真库真后端证据（补充判据；主判据另见 s3-142-admin-product-guard.mjs）
 *
 * 只在**本机私有 MariaDB**（默认 127.0.0.1:3399 root/空密码）的专用库 s3142_verify 上跑，
 * 由 PowerShell 包装脚本负责 build / 起停真实后端。
 *
 * 覆盖本机 MariaDB 能跑到的三项：
 *   ① 无令牌 ⇒ 401；
 *   ② 无 goods:create（无角色用户）⇒ 403 + 点名 goods:create，且**真库零写入**；
 *   ③ 配额满（真 SQL：t_subscription_plan.max_products + COUNT(t_product_spu)）⇒
 *      400 + 业务码 1001 + 中文文案，且**落库前后 COUNT 相同**。
 * 未覆盖（环境限制，如实记录）："配额足够 ⇒ 200 且 COUNT +1 / limit=null ⇒ 200" 需走
 * createProduct 的 INSERT（`CAST(? AS JSON)` 是 MySQL 8 语法，MariaDB 11.4 解析失败），
 * 该项由等价最小运行装置 s3-142-admin-product-guard.mjs 给出原始输出。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import mysql from "mysql2/promise";

const require = createRequire(import.meta.url);
const PORT = Number(process.env.S3_142_PORT || 18142);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = {
  host: process.env.S3_142_DB_HOST || "127.0.0.1",
  port: Number(process.env.S3_142_DB_PORT || 3399),
  user: process.env.S3_142_DB_USER || "root",
  password: process.env.S3_142_DB_PASSWORD ?? "",
  name: process.env.S3_142_DB_NAME || "s3142_verify",
};
const ADMIN_PASSWORD = "Admin@2026";
const NO_PERM_USER = "s3142_norole";
const EVIDENCE_DIR = process.env.S3_142_EVIDENCE_DIR || join(tmpdir(), "s3-142-evidence");
const PLAN_CODE = "S3142QUOTA";
const PHASE = (process.argv[2] || "verify").toLowerCase();

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
function finish() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, "harness-real-backend.log"), logLines.join("\n"), "utf-8");
  say(`\n小结：${passed} passed / ${failed} failed`);
  say(`EXIT=${failed === 0 ? 0 : 1}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

const conn = () =>
  mysql.createConnection({ host: DB.host, port: DB.port, user: DB.user, password: DB.password, database: DB.name, multipleStatements: true });

/** reset 阶段：重建专用空库（不连后端） */
async function phaseReset() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const root = await mysql.createConnection({ host: DB.host, port: DB.port, user: DB.user, password: DB.password });
  await root.query(`DROP DATABASE IF EXISTS \`${DB.name}\``);
  await root.query(`CREATE DATABASE \`${DB.name}\` CHARACTER SET utf8mb4`);
  const [[row]] = await root.query(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [DB.name]
  );
  await root.end();
  say(`【reset】已重建专用空库 ${DB.name}@${DB.host}:${DB.port}，现有表数=${row.c}（期望 0）`);
  report("reset 空库已就绪", Number(row.c) === 0, `tables=${row.c}`);
  finish();
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
    /* 非 JSON 保留原文 */
  }
  say(`  → ${method} ${path} ⇒ ${res.status} ${text.length > 500 ? `${text.slice(0, 500)}…` : text}`);
  return { status: res.status, json, text };
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

const productBody = () => ({
  name: "S3-142 真库建品",
  categoryId: 1,
  saleChannels: ["STORE", "MINIAPP"],
  skus: [
    { skuName: "500ml", boxRatio: 1, temperature: "NORMAL", traceEnabled: false, warningThreshold: 0, costPrice: 10, retailPrice: 20 },
  ],
});

if (PHASE === "reset" || PHASE === "recreate") {
  await phaseReset();
} else {
  await phaseVerify();
}

async function phaseVerify() {
say(`【装置】S3-142 真库真后端  后端=${BASE}  库=${DB.name}@${DB.host}:${DB.port}`);
const healthy = await waitHealthy();
report("段0a 真实后端 /health 就绪", healthy, `stdout 见 PowerShell 包装脚本`);
if (!healthy) {
  await api("GET", "/health");
  finish();
} else {
  const db = await conn();

  say("\n=== 段1 无令牌 ⇒ 401 ===");
  {
    const res = await api("POST", "/api/admin/products", { body: productBody() });
    report("段1a 无令牌 ⇒ 401 + code 401", res.status === 401 && res.json?.code === "401", `status=${res.status} body=${JSON.stringify(res.json)}`);
  }

  say("\n=== 段2 准备两把真令牌（默认租户管理员 / 无角色用户）===");
  const login = async (username) => {
    const res = await api("POST", "/api/admin/auth/login", { body: { username, password: ADMIN_PASSWORD } });
    return { status: res.status, token: res.json?.data?.token, csrf: res.json?.data?.csrfToken };
  };
  const [[admin]] = await db.query("SELECT id, username, tenant_id FROM t_sys_user WHERE username = 'admin' LIMIT 1");
  say(`  默认租户管理员：id=${admin?.id} tenant=${admin?.tenant_id}`);
  const adminLogin = await login("admin");
  report("段2a 管理员登录签发令牌", adminLogin.status === 200 && !!adminLogin.token, `status=${adminLogin.status}`);

  const bcrypt = require("bcryptjs");
  const [[existing]] = await db.query("SELECT id FROM t_sys_user WHERE username = ? LIMIT 1", [NO_PERM_USER]);
  if (!existing) {
    await db.query(
      `INSERT INTO t_sys_user (tenant_id, username, password_hash, real_name, mobile, store_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'S3-142 无角色用户', '13800000142', NULL, 1, NOW(), NOW())`,
      [admin?.tenant_id ?? "default", NO_PERM_USER, `v2$${bcrypt.hashSync(ADMIN_PASSWORD, 12)}`]
    );
  }
  const noPermLogin = await login(NO_PERM_USER);
  report("段2b 无角色用户登录签发令牌", noPermLogin.status === 200 && !!noPermLogin.token, `status=${noPermLogin.status}`);

  say("\n=== 段3 无 goods:create ⇒ 403（真库零写入）===");
  {
    const [[before]] = await db.query("SELECT COUNT(*) AS c FROM t_product_spu WHERE tenant_id = ?", [admin?.tenant_id ?? "default"]);
    const res = await api("POST", "/api/admin/products", { token: noPermLogin.token, csrf: noPermLogin.csrf, body: productBody() });
    const [[after]] = await db.query("SELECT COUNT(*) AS c FROM t_product_spu WHERE tenant_id = ?", [admin?.tenant_id ?? "default"]);
    report(
      "段3a 无权限 ⇒ 403 + code 403 + 点名 goods:create",
      res.status === 403 && res.json?.code === "403" && res.json?.msg === "无权限执行此操作，需要权限: goods:create",
      `status=${res.status} body=${JSON.stringify(res.json)}`
    );
    report("段3b 被拦下后真库 COUNT 不变（未到达业务层）", Number(before.c) === Number(after.c), `before=${before.c} after=${after.c}`);
  }

  say("\n=== 段4 配额满（真 SQL 计数）⇒ 400 + 1001 且 COUNT 不变 ===");
  const tenant = admin?.tenant_id ?? "default";
  {
    const [[usedRow]] = await db.query("SELECT COUNT(*) AS c FROM t_product_spu WHERE tenant_id = ?", [tenant]);
    const used = Number(usedRow.c);
    await db.query(
      `INSERT INTO t_subscription_plan (plan_code, plan_name, plan_type, price, duration_days, max_users, max_stores, max_customers, max_products, max_storage_mb, status)
       VALUES (?, 'S3-142 配额测试套餐', 'MONTHLY', 0, 30, 5, 1, 1000, ?, 1024, 'ACTIVE')
       ON DUPLICATE KEY UPDATE max_products = VALUES(max_products), status = 'ACTIVE'`,
      [PLAN_CODE, used]
    );
    const [[plan]] = await db.query("SELECT id, max_products FROM t_subscription_plan WHERE plan_code = ?", [PLAN_CODE]);
    await db.query(
      `INSERT INTO t_subscription (subscription_no, tenant_id, plan_id, plan_name, plan_type, start_date, end_date, duration_days, price, status)
       VALUES (?, ?, ?, 'S3-142 配额测试套餐', 'MONTHLY', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 365 DAY), 365, 0, 'ACTIVE')
       ON DUPLICATE KEY UPDATE plan_id = VALUES(plan_id), status = 'ACTIVE'`,
      [`SUB3142${Date.now()}`, tenant, plan.id]
    );
    say(`  套餐上限已设为 max_products=${plan.max_products}（与当前 COUNT=${used} 相等 ⇒ 恰好"已满"）`);

    const [[before]] = await db.query("SELECT COUNT(*) AS c FROM t_product_spu WHERE tenant_id = ?", [tenant]);
    const res = await api("POST", "/api/admin/products", { token: adminLogin.token, csrf: adminLogin.csrf, body: productBody() });
    const [[after]] = await db.query("SELECT COUNT(*) AS c FROM t_product_spu WHERE tenant_id = ?", [tenant]);
    report(
      "段4a 配额满 ⇒ HTTP 400 + 业务码 1001 + 中文文案带已用/上限",
      res.status === 400 && res.json?.code === "1001" && new RegExp(`已用 ${used} 个 / 上限 ${used} 个`).test(res.json?.msg ?? ""),
      `status=${res.status} code=${res.json?.code} msg=${res.json?.msg}`
    );
    report("段4b 被拒不落库：真库 COUNT 前后相同", Number(before.c) === Number(after.c), `before=${before.c} after=${after.c}`);

    // 收尾：把上限抬到 used+1，证明"上限一放开就能建"（本机 MariaDB 会在 INSERT 处报 CAST JSON 语法错，
    // 属环境限制，如实记录原始返回，不当作失败）
    await db.query("UPDATE t_subscription_plan SET max_products = ? WHERE plan_code = ?", [used + 1, PLAN_CODE]);
    const lift = await api("POST", "/api/admin/products", { token: adminLogin.token, csrf: adminLogin.csrf, body: productBody() });
    say(`  【环境限制】上限放开后建品：status=${lift.status} msg=${lift.json?.msg ?? ""}（MariaDB 不支持 CAST(x AS JSON) ⇒ 走到 INSERT 才报错，属环境限制）`);
  }

  await db.end();
  finish();
}
}
