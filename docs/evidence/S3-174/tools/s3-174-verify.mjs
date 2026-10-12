#!/usr/bin/env node
/**
 * S3-174-F1 验证装置（可复跑，真实 MySQL/MariaDB）
 *
 * 被测对象：docs/migrations/197_演示租户隔离.sql（判红重做版）+ backend/src/services/admin/auth.service.ts
 *
 * ── 为什么要有这个装置 ─────────────────────────────────────────────
 * 判红卡（docs/tasks/cards/R101-S3-174-凌舟验收-判红.md 三④）要求：
 *   · 正向：demo 租户存在 ∧ 演示账号 tenant_id='demo' ∧ 角色绑定 >=1 且全在 demo
 *           ∧ demo 菜单数 > 0 ∧ 演示登录 roles 非空
 *   · 反向：把 ① 的 NOT NULL 列去掉任一 ⇒ 迁移**必须报错停下**（不得静默跳过）
 *   · 幂等：连跑两遍零错误码、无重复菜单/绑定
 *   · 零损：default 租户 t_sale_bill 前后仍为 524
 * 这三件事只在**真实库**上才有意义（上一版之所以判红，就是因为只在小库/空库想过）。
 *
 * ── 夹具为"生产同构"的取证依据（每一处都指着仓库里的原文）──────────
 *   · t_tenant ← docs/migrations/016_phase9_tenant_subscription.sql 第 10~40 行的建表定义：
 *     company_name / contact_person / contact_mobile NOT NULL（无默认值）、
 *     tenant_code VARCHAR(32) NOT NULL UNIQUE、status TINYINT NOT NULL DEFAULT 1
 *     —— 这正是判红卡 §二.1 列出的四个 NOT NULL 列。
 *   · t_sys_user_role ← docs/init_database.sql 第 315~318 行：
 *     UNIQUE KEY uk_sys_user_role (user_id, role_id)（不含 tenant_id）—— 判红卡 §二.2。
 *   · t_sys_menu ← docs/migrations/079_权限矩阵.sql 的建表 + 13 条菜单 INSERT：
 *     UNIQUE KEY uk_sys_menu_code_tenant (menu_code, tenant_id)，行落在 tenant_id='default'
 *     —— 判红卡 §二.3（生产 default 89 行 / demo 0 行，本夹具复现"default 有、demo 无"）。
 *   · 业务数据 ← t_sale_bill 在 tenant_id='default' 造 524 行，复现判红卡的生产读数（524）。
 * 夹具**只操作自建库**（DROP/CREATE DATABASE s3174_*），不连生产、不碰任何既有库。
 *
 * ── 用法 ──────────────────────────────────────────────────────────
 *   DB_HOST=127.0.0.1 DB_PORT=3410 DB_USER=root DB_PASSWORD= DB_NAME=s3174_prod \
 *     node docs/evidence/S3-174/tools/s3-174-verify.mjs <mode>
 *   mode：
 *     setup      只建"生产同构"夹具并打印基线读数（可单独核对判红三处前提）
 *     shape      静态形状断言（与 backend/src/__tests__/shared/migration-197-demo-tenant.test.ts 同口径）
 *     pos        正向：夹具 → 跑迁移 → 逐条断言 → 再跑一遍（幂等）→ 断言 default 524 未变
 *     neg-notnull 反向①：删掉建租户语句里的 company_name ⇒ 必须报错停下（1364）
 *     neg-binding 反向②：退回上一版"先 INSERT IGNORE 再 DELETE" ⇒ 角色绑定必须归零
 *     neg-menu   反向③：跳过菜单克隆 ⇒ demo 租户菜单必须为 0
 *     all        连跑 shape + pos + 三个反向（默认）
 * 退出码：0 = 全部断言通过；1 = 有断言失败。
 * 每个反向用例都**先重建夹具**，互不污染；正向用例结束时库里状态 = 迁移后态。
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const MIGRATION_FILE = join(REPO_ROOT, "docs", "migrations", "197_演示租户隔离.sql");
const MIGRATION_DIR = join(REPO_ROOT, "docs", "migrations");
const INIT_SQL = join(REPO_ROOT, "docs", "init_database.sql");
const MIG_016 = join(MIGRATION_DIR, "016_phase9_tenant_subscription.sql");
const MIG_079 = join(MIGRATION_DIR, "079_权限矩阵.sql");

const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3410),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "s3174_prod",
};
/** 基线库名：正向用例用它，各反向用例各用一个后缀库，互不干扰（可并行/乱序复跑） */
const DB_BASE = DB.database;

/** 在指定后缀的库上跑一段逻辑（跑完恢复基线库名） */
async function withScopedDb(suffix, fn) {
  const previous = DB.database;
  DB.database = `${DB_BASE}_${suffix}`;
  try {
    return await fn();
  } finally {
    DB.database = previous;
  }
}

/** 判红卡生产读数：default 租户的 t_sale_bill 行数（本单红线：前后一致） */
const PROD_DEFAULT_BILLS = Number(process.env.S3_174_DEFAULT_BILLS || 524);
/** 演示账号用户名（与 backend/src/services/admin/auth.service.ts 的 DEMO_USERNAME 同值） */
const DEMO_USERNAME = "demo";
/** 演示租户（与 auth.service.ts 的 DEMO_TENANT 同值） */
const DEMO_TENANT = "demo";

const failures = [];
/** 本次运行的全部输出（同时落盘到 docs/evidence/S3-174/raw/，便于复核时不用重跑） */
const logLines = [];
const originalLog = console.log.bind(console);
console.log = (...args) => {
  logLines.push(args.map((a) => String(a)).join(" "));
  originalLog(...args);
};

const pass = (m) => console.log(`PASS  ${m}`);
const fail = (m) => {
  failures.push(m);
  console.log(`FAIL  ${m}`);
};
const check = (cond, m) => (cond ? pass(m) : fail(m));
const section = (t) => console.log(`\n── ${t} ──`);

/* ───────────────────────── 基础设施 ───────────────────────── */

async function connect(withDatabase = true) {
  return mysql.createConnection({
    host: DB.host,
    port: DB.port,
    user: DB.user,
    password: DB.password,
    ...(withDatabase ? { database: DB.database } : {}),
    multipleStatements: true,
    connectTimeout: 10000,
  });
}

async function withDb(fn) {
  const conn = await connect(true);
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

/**
 * 把真实 backend/src/shared/migration.ts 变成"本进程内可加载"的模块：
 * 读真实源码 → typescript.transpileModule 转译 → 外部依赖换桩 → 临时文件 import()。
 * 不复刻任何被测函数：splitSqlStatements / addTablePrefix / firstKeyword / isDataWriteStatement
 * 全部来自真实源码（与运行时第 8 步同管线）。
 */
async function loadMigrationModule() {
  const src = readFileSync(join(REPO_ROOT, "backend", "src", "shared", "migration.ts"), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rewrites = [
    ['from "fs"', 'from "./stub-fs.mjs"'],
    ['from "mysql2/promise"', 'from "./stub-mysql.mjs"'],
    ['from "./env"', 'from "./stub-env.mjs"'],
    ['from "./logger"', 'from "./stub-logger.mjs"'],
    ['from "./seed-data"', 'from "./stub-seed-data.mjs"'],
  ];
  for (const [a, b] of rewrites) js = js.split(a).join(b);
  const dir = join(process.env.TEMP || process.env.TMP || "/tmp", "s3-174-f1-shape");
  if (!existsSync(dir)) {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "stub-fs.mjs"), "export const readFileSync=()=>'';\nexport const readdirSync=()=>[];\nexport const existsSync=()=>false;\n");
    writeFileSync(join(dir, "stub-mysql.mjs"), "export default { createConnection: async () => ({ query: async () => [[]], end: async () => {} }) };\n");
    writeFileSync(join(dir, "stub-env.mjs"), "export const env = { USE_MOCK_DB:false, DB_HOST:'x', DB_PORT:3306, DB_USER:'x', DB_PASSWORD:'x', DB_NAME:'x' };\n");
    writeFileSync(join(dir, "stub-logger.mjs"), "export default { info(){}, warn(){}, error(){}, debug(){} };\n");
    writeFileSync(join(dir, "stub-seed-data.mjs"), "export async function seedData() {}\n");
  }
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(dir, "migration.mjs"), js);
  return import(pathToFileURL(join(dir, "migration.mjs")).href + `?t=${Date.now()}`);
}

/** 读 SQL 文件并切成语句（静默去掉 USE 行，与测试同口径） */
function readStatements(mod, file) {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const cleaned = raw
    .split("\n")
    .filter((line) => !line.trim().toUpperCase().startsWith("USE "))
    .join("\n");
  return { raw, statements: mod.splitSqlStatements(cleaned) };
}

/** 逐条执行（跳过重复/已存在类错误，与迁移 runner 的 safeExec 同口径） */
async function execStatements(conn, statements, { skipKnown = true } = {}) {
  let ok = 0;
  const skipped = [];
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok += 1;
    } catch (e) {
      const msg = String(e.message || e);
      const known = /already exists|duplicate|doesn't exist|unknown table|Unknown column/i.test(msg);
      if (skipKnown && known) {
        skipped.push(msg.slice(0, 120));
        continue;
      }
      throw e;
    }
  }
  return { ok, skipped };
}

/* ───────────────────────── 夹具（生产同构） ───────────────────────── */

async function setupFixture(mod, { verbose = true } = {}) {
  const admin = await connect(false);
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${DB.database}\``);
    await admin.query(`CREATE DATABASE \`${DB.database}\` DEFAULT CHARACTER SET utf8mb4`);
  } finally {
    await admin.end();
  }

  const conn = await connect(true);
  try {
    // ① 基础业务表（62 张，docs/init_database.sql）
    const init = readStatements(mod, INIT_SQL);
    const initRes = await execStatements(conn, init.statements);
    // ② t_tenant 换成生产形态（016 的建表定义：4 个 NOT NULL 无默认值列）
    await conn.query("DROP TABLE IF EXISTS t_tenant");
    const mig016 = readStatements(mod, MIG_016);
    const tenantDdl = mig016.statements.find((s) => /CREATE TABLE IF NOT EXISTS t_tenant\b/i.test(s));
    if (!tenantDdl) throw new Error("016 里找不到 t_tenant 建表语句，夹具无法组装");
    await conn.query(tenantDdl);
    // 生产 t_tenant = 016 建表形态 + 后端启动期"修复缺列"补上的 name/contact_name/contact_phone/plan
    // （backend/src/shared/migration.ts 第 547~561 行的 tenantColumns 循环；016 没有 name 列，
    //  而判红 §二.1 里那条 `INSERT IGNORE INTO t_tenant (id, name, plan, status)` 能走到 1364
    //  （而不是 1054 unknown column），正说明生产这两套列同时存在）。
    for (const ddl of [
      "ALTER TABLE t_tenant ADD COLUMN `name` VARCHAR(100) NOT NULL COMMENT '租户名称'",
      "ALTER TABLE t_tenant ADD COLUMN `contact_name` VARCHAR(50) COMMENT '联系人'",
      "ALTER TABLE t_tenant ADD COLUMN `contact_phone` VARCHAR(20) COMMENT '联系电话'",
      "ALTER TABLE t_tenant ADD COLUMN `plan` VARCHAR(20) DEFAULT 'basic' COMMENT '套餐'",
    ]) {
      await execStatements(conn, [ddl]);
    }
    // ③ 菜单表（079 的建表 + 菜单 INSERT，全部落在 tenant_id='default'）
    const mig079 = readStatements(mod, MIG_079);
    const menuStatements = mig079.statements.filter((s) => /\bt_sys_menu\b/i.test(s));
    // 079 内部同一 id 有多组 INSERT（生产按"丢块修复"后逐条 safeExec 也会跳重复键），
    // 故此处与迁移 runner 的 safeExec 同口径：重复键跳过。
    const menuRes = await execStatements(conn, menuStatements);
    // ④ 角色（生产 default 租户的 SUPER_ADMIN / STORE_OPERATOR）
    await conn.query(
      `INSERT INTO t_sys_role (id, tenant_id, role_code, role_name, description, data_scope, permissions, status)
       VALUES (1, 'default', 'SUPER_ADMIN', '超级管理员', '拥有系统全部权限', 'ALL', '["*"]', 'ACTIVE'),
              (2, 'default', 'STORE_OPERATOR', '门店操作员', '门店日常开单与库存查询', 'STORE', '["sale:create","sale:view"]', 'ACTIVE')`
    );
    // ⑤ 演示账号：判红实测的形态（username='demo'，tenant_id='default'，两条绑定）
    await conn.query(
      `INSERT INTO t_sys_user (id, username, password_hash, real_name, store_id, status, tenant_id)
       VALUES (3, '${DEMO_USERNAME}', 'demo-hash-placeholder', '演示账号', NULL, 1, 'default')`
    );
    await conn.query(
      `INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (3, 1, 'default'), (3, 2, 'default')`
    );
    // ⑥ 业务数据：default 租户 524 行销售单（复现判红读数）
    const rows = [];
    for (let i = 1; i <= PROD_DEFAULT_BILLS; i += 1) {
      rows.push(`('default', 'FIX${String(i).padStart(6, "0")}', 1, 3, '演示客户', 'COMPLETED', 'PAID')`);
    }
    await conn.query(
      `INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, operator_id, customer_name, business_status, collection_status) VALUES ${rows.join(",")}`
    );
    if (verbose) {
      console.log(
        `夹具就绪：init 建表 ${initRes.ok} 条（跳过 ${initRes.skipped.length}）、菜单语句 ${menuRes.ok} 条、` +
          `default 菜单 ${await count(conn, "t_sys_menu", "tenant_id = 'default'")} 行、` +
          `demo 菜单 ${await count(conn, "t_sys_menu", "tenant_id = 'demo'")} 行、` +
          `default 销售单 ${await count(conn, "t_sale_bill", "tenant_id = 'default'")} 行`
      );
    }
  } finally {
    await conn.end();
  }
}

async function count(conn, table, where = "1 = 1") {
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`);
  return Number(rows[0].c);
}

async function snapshot(conn) {
  const [tenant] = await conn.query(
    "SELECT id, company_name, contact_person, contact_mobile, tenant_code, status FROM t_tenant WHERE id = 'demo'"
  );
  const [users] = await conn.query(
    "SELECT id, username, tenant_id FROM t_sys_user WHERE username = 'demo'"
  );
  const [bindings] = await conn.query(
    `SELECT ur.tenant_id, r.role_code FROM t_sys_user_role ur
     JOIN t_sys_user u ON u.id = ur.user_id
     LEFT JOIN t_sys_role r ON r.id = ur.role_id
     WHERE u.username = 'demo' ORDER BY ur.tenant_id, r.role_code`
  );
  const [demoMenus] = await conn.query("SELECT COUNT(*) AS c FROM t_sys_menu WHERE tenant_id = 'demo'");
  const [defaultMenus] = await conn.query("SELECT COUNT(*) AS c FROM t_sys_menu WHERE tenant_id = 'default'");
  const [bills] = await conn.query(
    "SELECT tenant_id, COUNT(*) AS c FROM t_sale_bill GROUP BY tenant_id ORDER BY tenant_id"
  );
  return {
    tenant,
    users,
    bindings,
    demoMenus: Number(demoMenus[0].c),
    defaultMenus: Number(defaultMenus[0].c),
    bills,
  };
}

function printSnapshot(s) {
  console.log(`  t_tenant id='demo'      : ${JSON.stringify(s.tenant)}`);
  console.log(`  t_sys_user username=demo: ${JSON.stringify(s.users)}`);
  console.log(`  角色绑定                : ${JSON.stringify(s.bindings)}`);
  console.log(`  菜单 demo / default     : ${s.demoMenus} / ${s.defaultMenus}`);
  console.log(`  t_sale_bill 按租户      : ${JSON.stringify(s.bills)}`);
}

/* ───────────────────────── 形状断言（与 vitest 同口径） ───────────────────────── */

async function runShape() {
  section("shape：迁移 197 形状断言（真实 splitSqlStatements / addTablePrefix）");
  const mod = await loadMigrationModule();
  const { raw, statements } = readStatements(mod, MIGRATION_FILE);
  const prepared = statements.map((s) => mod.addTablePrefix(s));
  const joined = prepared.join("\n");
  /** 可执行语句流（不含注释块文本）：红线断言只针对真正会被执行的 SQL */
  const sqlOnly = statements.join("\n");
  const writes = statements.filter((s) => mod.isDataWriteStatement(s));

  statements.forEach((s, i) => {
    console.log(`  [${i}] ${mod.firstKeyword(s).padEnd(7)} 写=${mod.isDataWriteStatement(s)} ${s.split("\n")[0].slice(0, 70)}`);
  });

  check(statements.length === 8, `切块后 8 条语句（实际 ${statements.length}）`);
  check(writes.length === 6, `其中 6 条数据写语句（实际 ${writes.length}）`);
  check(statements.filter((s) => mod.firstKeyword(s) === "SELECT").length === 2, "2 条跑后核对 SELECT");
  check(!/INSERT\s+IGNORE/i.test(sqlOnly), "红线：可执行语句里无 INSERT IGNORE（判红 ① 的根因）");
  check(/^INSERT INTO t_tenant \(/.test(statements[0]), "第 1 条 = 建演示租户（显式列清单，非 IGNORE）");
  for (const col of ["company_name", "contact_person", "contact_mobile", "tenant_code"]) {
    check(statements[0].includes(col), `第 1 条显式写入 NOT NULL 列 ${col}`);
  }
  check(statements[0].includes("WHERE NOT EXISTS (SELECT 1 FROM t_tenant WHERE id = 'demo')"), "存在性判定用 WHERE NOT EXISTS（幂等）");
  check(!/FROM\s+DUAL/i.test(sqlOnly) && !/t_DUAL/i.test(joined), "不用 FROM DUAL（addTablePrefix 会改写成 t_DUAL）");
  const bindingUpdate = writes.find((s) => mod.firstKeyword(s) === "UPDATE" && /UPDATE t_sys_user_role/i.test(s));
  check(!!bindingUpdate && bindingUpdate.includes("SET tenant_id = 'demo'"), "判红②：角色绑定是 UPDATE 原地改租户");
  check(
    writes.filter((s) => mod.firstKeyword(s) === "DELETE").length === 0 && !/DELETE\s+(FROM|src)/i.test(sqlOnly),
    "判红②：可执行语句里无 DELETE（禁止先插后删）"
  );
  const menuClones = writes.filter((s) => mod.firstKeyword(s) === "INSERT" && /INSERT INTO t_sys_menu/i.test(s));
  check(menuClones.length === 2, `判红③：菜单克隆 2 条（顶级 + 子级），实际 ${menuClones.length}`);
  check(menuClones.every((s) => s.includes("WHERE m.tenant_id = 'default'")), "菜单克隆源 = default 租户");
  check(menuClones[1] && menuClones[1].includes("p.menu_code = sp.menu_code"), "子菜单 parent_id 重指向 demo 自己的父行");
  const businessTables = ["t_sale_bill", "t_member", "t_product_spu", "t_purchase_order", "t_store"];
  for (const t of businessTables) check(!joined.includes(t), `零业务数据搬迁：语句流不出现 ${t}`);
  // 只取"表位"上的名字（FROM / JOIN / INTO / UPDATE / TABLE 之后），避免把 tenant_id 这类列名误当表名
  const distinctTables = [
    ...new Set([...joined.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(t_[a-z0-9_]+)/gi)].map((m) => m[1])),
  ].sort();
  check(
    JSON.stringify(distinctTables) ===
      JSON.stringify(["t_sys_menu", "t_sys_role", "t_sys_user", "t_sys_user_role", "t_tenant"]),
    `只碰四张系统表（实际 ${JSON.stringify(distinctTables)}）`
  );
  check(!joined.includes("t_t_"), "addTablePrefix 不产生 t_t_ 前缀污染");
  const commentLines = raw.split("\n").filter((l) => l.trim().startsWith("--"));
  check(commentLines.length > 20, `注释块存在（${commentLines.length} 行）`);
  check(commentLines.every((l) => !l.includes(";")), "注释文字内无 ASCII 分号（规避踩坑[63] 丢块）");
  check(raw.includes("MIGRATION_WRITE_GATE") && raw.includes("run-migration.mjs"), "含写闸门警告与正确执行方式");
  check(
    mod.firstKeyword(statements[6]) === "SELECT" &&
      statements[6].includes("demo_tenant_rows") &&
      mod.firstKeyword(statements[7]) === "SELECT" &&
      statements[7].includes("AS result"),
    "末两条 = 跑后核对 SELECT（demo_tenant_rows）+ result 摘要（run-migration.mjs 的完成标志）"
  );
  const files = readdirSync(MIGRATION_DIR).filter((n) => n.endsWith(".sql"));
  check(files.filter((n) => n.startsWith("197_")).length === 1, "docs/migrations 下 197 唯一");
}

/* ───────────────────────── 迁移执行 ───────────────────────── */

/** 与 scripts/run-migration.mjs 同口径：整文件一次性 multiStatements 执行 */
async function runMigrationFile(conn, sqlText) {
  await conn.query(sqlText);
}

function migrationSql() {
  return readFileSync(MIGRATION_FILE, "utf8").replace(/\r\n/g, "\n");
}

/** 正向断言（判红三④ 的"正向"那一列，逐条） */
async function assertIsolated(conn, { label }) {
  const s = await snapshot(conn);
  printSnapshot(s);
  const tenant = s.tenant[0];
  const inDemo = s.users.filter((u) => u.tenant_id === DEMO_TENANT);
  const outside = s.users.filter((u) => u.tenant_id !== DEMO_TENANT);
  const demoBindings = s.bindings.filter((b) => b.tenant_id === DEMO_TENANT);
  const outsideBindings = s.bindings.filter((b) => b.tenant_id !== DEMO_TENANT);
  const defaultBills = Number(s.bills.find((b) => b.tenant_id === "default")?.c ?? 0);

  check(!!tenant, `${label}：demo 租户存在` + (tenant ? `（company_name=${tenant.company_name} / tenant_code=${tenant.tenant_code}）` : ""));
  if (tenant) {
    for (const col of ["company_name", "contact_person", "contact_mobile", "tenant_code"]) {
      check(tenant[col] !== null && tenant[col] !== "", `${label}：demo 租户 ${col} 已写值（NOT NULL 无默认值列全部命中）`);
    }
  }
  check(inDemo.length === 1 && outside.length === 0, `${label}：演示账号归属 = demo（且不在其它租户）`);
  check(demoBindings.length >= 1, `${label}：demo 租户内角色绑定 >= 1（实际 ${demoBindings.length}）`);
  check(outsideBindings.length === 0, `${label}：其它租户无残留绑定`);
  check(demoBindings.some((b) => b.role_code === "SUPER_ADMIN"), `${label}：demo 租户下仍是 SUPER_ADMIN`);
  check(s.demoMenus > 0, `${label}：demo 租户菜单数 > 0（实际 ${s.demoMenus}）`);
  check(s.demoMenus === s.defaultMenus, `${label}：demo 菜单数与 default 一致（${s.demoMenus} = ${s.defaultMenus}）`);
  check(defaultBills === PROD_DEFAULT_BILLS, `${label}：default 租户业务数据零损（t_sale_bill = ${defaultBills}，期望 ${PROD_DEFAULT_BILLS}）`);
  return s;
}

/** 演示登录的 roles 判定（与 auth.service.ts demoLogin() 的 roles 查询同口径） */
async function demoLoginRoles(conn) {
  const [rows] = await conn.query(
    `SELECT r.role_code FROM t_sys_user_role ur
     JOIN t_sys_role r ON r.id = ur.role_id
     JOIN t_sys_user u ON u.id = ur.user_id
     WHERE u.username = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
    [DEMO_USERNAME]
  );
  return rows.map((r) => r.role_code);
}

async function runPos() {
  section("pos：正向 —— 生产同构夹具 → 跑迁移 → 逐条断言 → 再跑一遍（幂等）");
  const mod = await loadMigrationModule();
  await setupFixture(mod);
  await withDb(async (conn) => {
    const before = await snapshot(conn);
    check(before.tenant.length === 0, "迁移前：demo 租户不存在（反测前置）");
    check(before.users[0]?.tenant_id === "default", "迁移前：演示账号仍在真实租户 default（判红实测形态）");
    check(before.demoMenus === 0, "迁移前：demo 租户菜单 0 行（判红 §二.3）");

    await runMigrationFile(conn, migrationSql());
    pass("迁移 197 执行成功（EXIT 0 口径：本句未抛错）");
    const after = await assertIsolated(conn, { label: "跑完一遍" });
    const roles = await demoLoginRoles(conn);
    console.log(`  演示登录 roles = ${JSON.stringify(roles)}`);
    check(roles.length >= 1 && roles.includes("SUPER_ADMIN"), "演示登录 roles 非空且含 SUPER_ADMIN");

    // 幂等：记录写语句 affectedRows（第二遍必须 0 变更）
    const mod2 = await loadMigrationModule();
    const { statements } = readStatements(mod2, MIGRATION_FILE);
    const writes = statements.filter((s) => mod2.isDataWriteStatement(s));
    const writes2 = [];
    for (const stmt of writes) {
      const [res] = await conn.query(stmt);
      writes2.push(Number(res?.affectedRows ?? res?.info?.match(/Rows matched: (\d+)/)?.[1] ?? 0));
    }
    console.log(`  第二遍 6 条写语句 affectedRows = ${JSON.stringify(writes2)}`);
    check(writes2.every((n) => n === 0), "幂等：第二遍 6 条写语句全部 0 行变更");

    const again = await assertIsolated(conn, { label: "连跑两遍后" });
    check(again.demoMenus === after.demoMenus, `幂等：菜单无重复（两次都是 ${again.demoMenus}）`);
    check(again.bindings.length === after.bindings.length, `幂等：角色绑定无重复（两次都是 ${again.bindings.length} 条）`);

    // 附注：把范围之外但同族的租户口径差异记录下来（供凌舟裁定，不作为本单结论）
    const [permRows] = await conn.query(
      `SELECT r.permissions FROM t_sys_user_role ur
       JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id
       WHERE ur.user_id = 3 AND ur.tenant_id = ? AND (r.status = 'ACTIVE' OR r.status = 1 OR r.status = '1')`,
      [DEMO_TENANT]
    );
    const [menuRows] = await conn.query(
      `SELECT r.id FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id
       WHERE ur.user_id = 3 AND r.tenant_id = ?`,
      [DEMO_TENANT]
    );
    console.log(
      `  旁证（不算本单验收项）：getUserPermissions 的 r.tenant_id = ur.tenant_id 连接命中 ${permRows.length} 行、` +
        `getUserMenus 的 r.tenant_id = '<tenant>' 过滤命中 ${menuRows.length} 行 ` +
        `⇒ 角色的 tenant_id 仍是 'default'，见回传卡「风险与自我报备」`
    );
  });
}

/* ───────────────────────── 反向用例 ───────────────────────── */

/** 反向①：删掉建租户语句里的 NOT NULL 列 ⇒ 必须报错停下（不得静默跳过） */
async function runNegNotNull() {
  section("neg-notnull：反向① —— 去掉 company_name ⇒ 迁移必须报错停下");
  const mod = await loadMigrationModule();
  await withScopedDb("neg_notnull", async () => {
    await setupFixture(mod, { verbose: false });
    await withDb(async (conn) => {
    const original = migrationSql();
    const broken = original.replace(
      "INSERT INTO t_tenant (id, name, company_name, contact_person, contact_mobile, tenant_code, plan, status)",
      "INSERT INTO t_tenant (id, name, contact_person, contact_mobile, tenant_code, plan, status)"
    ).replace(
      "SELECT 'demo', '演示租户', '演示租户', '演示联系人', '13800000000', 'DEMO', 'basic', 1",
      "SELECT 'demo', '演示租户', '演示联系人', '13800000000', 'DEMO', 'basic', 1"
    );
    check(broken !== original, "反测样本已构造（company_name 从列清单与值清单同时去掉）");
    let error = null;
    try {
      await runMigrationFile(conn, broken);
    } catch (e) {
      error = e;
    }
    check(!!error, "迁移**报错停下**（不得静默跳过）");
    if (error) {
      console.log(`  原始错误：code=${error.code} message=${error.message}`);
      check(
        error.code === "ER_NO_DEFAULT_FOR_FIELD" || error.errno === 1364,
        `错误码为 1364 ER_NO_DEFAULT_FOR_FIELD（实际 code=${error.code} errno=${error.errno}）`
      );
    }
    const tenantRows = await count(conn, "t_tenant", "id = 'demo'");
    check(tenantRows === 0, "反测后 demo 租户仍未建出（0 行）—— 说明是「停下」而非「跳过继续」");
    const userTenant = await count(conn, "t_sys_user", "username = 'demo' AND tenant_id = 'default'");
    check(userTenant === 1, "反测后演示账号仍在 default（没有被半途改走）");
    });
  });
}

/** 反向②：退回上一版"先 INSERT IGNORE 再 DELETE" ⇒ 角色绑定必须归零 */
async function runNegBinding() {
  section("neg-binding：反向② —— 退回「先插后删」 ⇒ 绑定必须归零（复现判红 §二.2）");
  const mod = await loadMigrationModule();
  await withScopedDb("neg_binding", async () => {
    await setupFixture(mod, { verbose: false });
    await withDb(async (conn) => {
    await conn.query(
      `INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id)
       SELECT u.id, src.role_id, 'demo' FROM t_sys_user u
       JOIN t_sys_user_role src ON src.user_id = u.id AND src.tenant_id <> 'demo'
       WHERE u.username = 'demo'`
    );
    await conn.query("UPDATE t_sys_user SET tenant_id = 'demo' WHERE username = 'demo'");
    await conn.query(
      `DELETE src FROM t_sys_user_role src JOIN t_sys_user u ON u.id = src.user_id
       WHERE u.username = 'demo' AND src.tenant_id <> 'demo'`
    );
    const total = await count(conn, "t_sys_user_role", "user_id = 3");
    const inDemo = await count(conn, "t_sys_user_role", "user_id = 3 AND tenant_id = 'demo'");
    console.log(`  旧写法执行后：该账号绑定总数 ${total} 条（其中 demo 租户内 ${inDemo} 条）`);
    check(total === 0, "旧写法确实把绑定清零（证明判红 §二.2 成立，本单的 UPDATE 写法是必要的）");
    });
  });
}

/** 反向③：跳过菜单克隆 ⇒ demo 菜单必须为 0 */
async function runNegMenu() {
  section("neg-menu：反向③ —— 不迁菜单 ⇒ demo 菜单必须为 0（复现判红 §二.3）");
  const mod = await loadMigrationModule();
  await withScopedDb("neg_menu", async () => {
    await setupFixture(mod, { verbose: false });
    await withDb(async (conn) => {
    // 只跑"账号侧"三条语句（建租户 / 改归属 / 搬绑定），跳过菜单克隆
    const { statements } = readStatements(mod, MIGRATION_FILE);
    const withoutMenu = statements.filter((s) => !/\bt_sys_menu\b/i.test(s));
    for (const stmt of withoutMenu) await conn.query(stmt);
    const demoMenus = await count(conn, "t_sys_menu", "tenant_id = 'demo'");
    console.log(`  不迁菜单时 demo 租户菜单 ${demoMenus} 行`);
    check(demoMenus === 0, "不迁菜单 ⇒ demo 菜单确实为 0（证明判红 §二.3 成立，菜单克隆是必要的）");
    const inDemo = await count(conn, "t_sys_user", "username = 'demo' AND tenant_id = 'demo'");
    check(inDemo === 1, "同一轮里账号侧仍然迁移成功（说明只是把菜单那两段拿掉做对照）");
    });
  });
}

/* ───────────────────────── main ───────────────────────── */

const runners = {
  setup: async () => {
    section("setup：建「生产同构」夹具");
    const mod = await loadMigrationModule();
    await setupFixture(mod);
    await withDb(async (conn) => printSnapshot(await snapshot(conn)));
  },
  shape: runShape,
  pos: runPos,
  /** 只做"迁移后状态"正向断言（不重建夹具）—— 用来配合 scripts/run-migration.mjs 的官方执行方式取证 */
  state: async () => {
    section("state：迁移后状态正向断言（不重建夹具）");
    await withDb(async (conn) => {
      await assertIsolated(conn, { label: "当前库" });
      const roles = await demoLoginRoles(conn);
      console.log(`  演示登录 roles = ${JSON.stringify(roles)}`);
      check(roles.length >= 1 && roles.includes("SUPER_ADMIN"), "演示登录 roles 非空且含 SUPER_ADMIN");
    });
  },
  "neg-notnull": runNegNotNull,
  "neg-binding": runNegBinding,
  "neg-menu": runNegMenu,
};

const mode = (process.argv[2] || "all").toLowerCase();
const plan =
  mode === "all"
    ? ["shape", "pos", "neg-notnull", "neg-binding", "neg-menu"]
    : [mode];

const run = async () => {
  console.log(`=== S3-174-F1 验证装置 · mode=${mode} · DB ${DB.user}@${DB.host}:${DB.port}/${DB.database} ===`);
  for (const m of plan) {
    const fn = runners[m];
    if (!fn) {
      console.error(`未知 mode：${m}（可用：${Object.keys(runners).join(" / ")} / all）`);
      process.exit(2);
    }
    await fn();
  }
};

try {
  await run();
} catch (e) {
  fail(`装置异常：${e.message}`);
  console.error(e);
}
console.log(failures.length === 0 ? `\nEXIT=0 ${mode} 全部断言通过` : `\nEXIT=1 ${mode} 有 ${failures.length} 条断言失败`);
failures.forEach((f) => console.log(`  - ${f}`));

// 原始输出落盘（与 docs/evidence/*/raw/*.txt 的既有惯例一致）
try {
  const outDir = join(REPO_ROOT, "docs", "evidence", "S3-174", "raw");
  mkdirSync(outDir, { recursive: true });
  // 与仓库工作区惯例一致：CRLF（core.autocrlf=true 下工作副本为 CRLF）
  writeFileSync(join(outDir, `run-${mode}.txt`), logLines.join("\r\n") + "\r\n", "utf8");
  originalLog(`原始输出已落盘：docs/evidence/S3-174/raw/run-${mode}.txt`);
} catch (e) {
  originalLog(`（原始输出落盘失败，不影响结论）${e.message}`);
}
process.exit(failures.length === 0 ? 0 : 1);
