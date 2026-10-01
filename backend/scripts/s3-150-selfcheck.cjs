#!/usr/bin/env node
/**
 * S3-150 自检 / 反测脚本（纯 node 直跑，无需 vitest）
 *
 * 为什么需要它：
 *   本沙箱跑不了 vitest（esbuild `spawn EPERM`，见 `docs/踩坑日志.md`[143] 与
 *   `backend/scripts/s3-138-selfcheck.cjs` 的同类说明），而 S3-150 的验收要求给出
 *   「启停两向的原始请求/响应 + 落库读数」与「去掉映射必报 1366」两组原始输出。
 *   本脚本用**同进程**（typescript 编译器 API 转译，不 spawn 子进程）加载**真实 controller /
 *   路由 / 平台鉴权 / errorHandler**，DB 走**真库**（私有 MariaDB，端口由 S3_150_DB_PORT 指定），
 *   因此断言的是端点级真实行为 + 真实 MySQL 语义，不是 mock 自证。
 *
 * 源码来源（本会话沙箱拒写 backend/src/services/**，见 S3-150-待落盘/evidence/）：
 *   · 仓库内文件已是修复版 ⇒ 直接用仓库内文件；
 *   · 否则用 `S3-150-待落盘/backend/src/**` 的暂存版（内容与将要落盘的一致）。
 *   两种情况下**加载的都是修复版源码**，脚本自身会打印用的是哪一份。
 *
 * 判据（对应派单卡 S3-150 二.①②③ 与四.①②③）：
 *   · 启停 ACTIVE ⇒ DB status=1 且响应 status='ACTIVE'；DISABLED ⇒ 0/'DISABLED'
 *   · UUID 型 id 能定位（不再被 Number() 成 NaN）
 *   · 未知 id（数字型 '123' 与非 UUID 字符串）⇒ 404（不是 500、不是静默成功）
 *   · 列表/详情出口 status 统一字符串；审批建租户后 tenant_name 非空
 *   · 反测：把 status 映射去掉（直接写字符串）⇒ 私有 MySQL（STRICT_TRANS_TABLES）报 1366
 *
 * 用法：由 `backend/scripts/s3-150-selfcheck.ps1` 起私有实例后调用；
 *      反测：`$env:S3_150_NEGATIVE_TEST="1"; node backend/scripts/s3-150-selfcheck.cjs --db-port 3399`
 * 退出码：0 = 全部 PASS；1 = 有 FAIL；2 = 脚本自身异常
 * 红线：只连**私有临时实例**（脚本自建 schema），不连生产库、不写仓库文件。
 */
const path = require("path");
const fs = require("fs");

const BACKEND_DIR = path.resolve(__dirname, "..");
const SRC = path.join(BACKEND_DIR, "src");
const ROOT_DIR = path.resolve(BACKEND_DIR, "..");
const NODE_MODULES = path.join(ROOT_DIR, "node_modules");
const STAGE_DIR = path.join(ROOT_DIR, "S3-150-待落盘");

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const NEGATIVE = process.env.S3_150_NEGATIVE_TEST === "1";
const DB_PORT = String(argOf("--db-port", process.env.S3_150_DB_PORT || "3399"));
const DB_NAME = argOf("--db-name", "s3_150_probe");

process.env.NODE_ENV = "development";
process.env.USE_MOCK_DB = "false";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = DB_PORT;
process.env.DB_USER = "root";
process.env.DB_PASSWORD = "";
process.env.DB_NAME = DB_NAME;
process.env.JWT_SECRET = process.env.JWT_SECRET || "s3-150-selfcheck-secret";

// ── 1) 同进程 TS 加载器 + 修复版源码选择 ───────────────────────────────────
const ts = require(path.join(NODE_MODULES, "typescript"));

const SERVICE_FILES = [
  ["backend/src/services/platform-tenant.service.ts", "toTenantStatusValue"],
  ["backend/src/services/tenant-register.service.ts", "name, tenant_name, company_name"],
];
const overrideSource = new Map(); // 归一化绝对路径 -> 修复版源码
for (const [rel, marker] of SERVICE_FILES) {
  const abs = path.join(ROOT_DIR, rel);
  const repoText = fs.readFileSync(abs, "utf8");
  if (repoText.includes(marker)) {
    console.log(`[源码] 仓库内已是修复版：${rel}`);
    continue;
  }
  const stageAbs = path.join(STAGE_DIR, rel);
  if (!fs.existsSync(stageAbs)) {
    console.error(`[FAIL] 仓库内未落盘且找不到暂存版：${rel}`);
    process.exit(2);
  }
  console.log(`[源码] 仓库内未落盘（沙箱拒写），本次使用暂存版：S3-150-待落盘/${rel}`);
  overrideSource.set(abs.toLowerCase(), fs.readFileSync(stageAbs, "utf8"));
}

require.extensions[".ts"] = function (mod, filename) {
  const key = path.resolve(filename).toLowerCase();
  let source = overrideSource.has(key) ? overrideSource.get(key) : fs.readFileSync(filename, "utf8");
  if (NEGATIVE && key === path.join(SRC, "services", "platform-tenant.service.ts").toLowerCase()) {
    const before = source;
    source = source.replace("[statusValue, id]", "[status, id]");
    if (source === before) {
      console.error("反测模式：未能在 platform-tenant.service.ts 里打掉 status 映射（源码形状已变）");
      process.exit(2);
    }
  }
  const out = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  mod._compile(out, filename);
};

const stub = (rel, exportsObj) => {
  const abs = require.resolve(path.join(SRC, rel.replace(/\//g, path.sep)));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: exportsObj };
};
const noop = () => {};
stub("shared/logger.ts", { default: { error: noop, warn: noop, info: noop, debug: noop }, __esModule: true });
stub("services/admin/error-log.service.ts", { insertErrorLog: async () => 1 });
stub("shared/feishu-report.ts", { reportToLingZhou: async () => {} });

const mysql = require(path.join(NODE_MODULES, "mysql2/promise"));
const express = require(path.join(NODE_MODULES, "express"));
const request = require(path.join(NODE_MODULES, "supertest"));
const jwt = require(path.join(NODE_MODULES, "jsonwebtoken"));

const { platformTenantRouter } = require(path.join(SRC, "routes", "platform-tenant.routes.ts"));
const { requirePlatformAuth, PLATFORM_JWT_ISSUER, PLATFORM_JWT_AUDIENCE } = require(
  path.join(SRC, "middleware", "auth.ts")
);
const { errorHandler } = require(path.join(SRC, "middleware", "error-handler.ts"));
const { env } = require(path.join(SRC, "config", "env.ts"));
const registerService = require(path.join(SRC, "services", "tenant-register.service.ts"));

// 与生产同构的小 app：真实平台鉴权 + 真实路由 + 真实 errorHandler
const app = express();
app.use(express.json());
app.use("/api/platform/tenants", requirePlatformAuth, platformTenantRouter);
app.use(errorHandler);

const TOKEN = jwt.sign(
  { type: "platform_admin", id: 1, username: "admin", realName: "凌舟" },
  env.JWT_SECRET,
  {
    algorithm: "HS256",
    issuer: PLATFORM_JWT_ISSUER,
    audience: PLATFORM_JWT_AUDIENCE,
    expiresIn: "1h",
  }
);

const UUID_ROW = "11111111-1111-4111-8111-111111111111";

let total = 0;
let failed = 0;
const check = (label, actual, expected) => {
  total++;
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failed++;
  console.log(
    `${pass ? "PASS" : "FAIL"} | ${label} | actual=${JSON.stringify(actual)}` +
      (pass ? "" : ` expected=${JSON.stringify(expected)}`)
  );
};

const DDL = [
  `DROP TABLE IF EXISTS t_tenant`,
  `DROP TABLE IF EXISTS t_tenant_register_application`,
  `DROP TABLE IF EXISTS t_sys_user_role`,
  `DROP TABLE IF EXISTS t_sys_role`,
  `DROP TABLE IF EXISTS t_sys_user`,
  `DROP TABLE IF EXISTS t_tenant_admin`,
  `DROP TABLE IF EXISTS t_store`,
  `DROP TABLE IF EXISTS t_price_level`,
  `DROP TABLE IF EXISTS t_payment_method`,
  `CREATE TABLE t_tenant (
     id VARCHAR(36) NOT NULL PRIMARY KEY,
     tenant_code VARCHAR(64) DEFAULT NULL,
     name VARCHAR(128) NOT NULL,
     tenant_name VARCHAR(128) DEFAULT NULL COMMENT '租户名称(与company_name同义)',
     company_name VARCHAR(128) DEFAULT NULL,
     company_short_name VARCHAR(128) DEFAULT NULL,
     contact_name VARCHAR(64) DEFAULT NULL,
     contact_person VARCHAR(64) DEFAULT NULL,
     contact_mobile VARCHAR(32) DEFAULT NULL,
     contact_email VARCHAR(128) DEFAULT NULL,
     province VARCHAR(64) DEFAULT NULL, city VARCHAR(64) DEFAULT NULL,
     district VARCHAR(64) DEFAULT NULL, address VARCHAR(255) DEFAULT NULL,
     business_license VARCHAR(128) DEFAULT NULL, legal_person VARCHAR(64) DEFAULT NULL,
     industry VARCHAR(64) DEFAULT NULL, company_scale VARCHAR(32) DEFAULT NULL,
     source VARCHAR(32) DEFAULT NULL, review_status VARCHAR(32) DEFAULT NULL,
     reviewed_at DATETIME DEFAULT NULL, reviewed_by INT DEFAULT NULL,
     status TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
     expire_at DATETIME DEFAULT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_tenant_register_application (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     company_name VARCHAR(128) NOT NULL,
     company_short_name VARCHAR(128) DEFAULT NULL,
     contact_person VARCHAR(64) DEFAULT NULL,
     contact_mobile VARCHAR(32) DEFAULT NULL,
     contact_email VARCHAR(128) DEFAULT NULL,
     province VARCHAR(64) DEFAULT NULL, city VARCHAR(64) DEFAULT NULL,
     district VARCHAR(64) DEFAULT NULL, address VARCHAR(255) DEFAULT NULL,
     business_license VARCHAR(128) DEFAULT NULL, legal_person VARCHAR(64) DEFAULT NULL,
     industry VARCHAR(64) DEFAULT NULL, company_scale VARCHAR(32) DEFAULT NULL,
     admin_username VARCHAR(64) NOT NULL,
     admin_password_hash VARCHAR(255) NOT NULL,
     admin_real_name VARCHAR(64) DEFAULT NULL,
     status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
     reject_reason VARCHAR(255) DEFAULT NULL,
     reviewed_at DATETIME DEFAULT NULL, reviewed_by INT DEFAULT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_sys_user (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     tenant_id VARCHAR(36) NOT NULL,
     username VARCHAR(64) NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     real_name VARCHAR(64) DEFAULT NULL,
     mobile VARCHAR(32) DEFAULT NULL,
     status TINYINT NOT NULL DEFAULT 1
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_sys_role (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     role_code VARCHAR(64) NOT NULL,
     tenant_id VARCHAR(36) DEFAULT NULL,
     status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_sys_user_role (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL, role_id INT NOT NULL, tenant_id VARCHAR(36) DEFAULT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_tenant_admin (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     tenant_id VARCHAR(36) NOT NULL, user_id INT NOT NULL,
     role VARCHAR(32) NOT NULL, is_primary TINYINT NOT NULL DEFAULT 0
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_store (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     tenant_id VARCHAR(36) NOT NULL, store_code VARCHAR(32) NOT NULL, name VARCHAR(128) NOT NULL,
     address VARCHAR(255) DEFAULT NULL, contact VARCHAR(64) DEFAULT NULL, phone VARCHAR(32) DEFAULT NULL,
     delivery_radius DECIMAL(10,2) DEFAULT NULL, business_status VARCHAR(16) DEFAULT NULL,
     status VARCHAR(16) DEFAULT NULL, fulfillment_delivery_enabled TINYINT DEFAULT NULL,
     fulfillment_pickup_enabled TINYINT DEFAULT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_price_level (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     tenant_id VARCHAR(36) NOT NULL, level_code VARCHAR(32) NOT NULL, level_name VARCHAR(64) NOT NULL,
     discount_rate DECIMAL(6,4) DEFAULT NULL, min_order_amount DECIMAL(10,2) DEFAULT NULL,
     description VARCHAR(255) DEFAULT NULL, sort_order INT DEFAULT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE t_payment_method (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     tenant_id VARCHAR(36) NOT NULL, method_name VARCHAR(64) NOT NULL,
     method_code VARCHAR(32) NOT NULL, status VARCHAR(16) DEFAULT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const SEEDS = [
  `INSERT INTO t_tenant (id, tenant_code, name, tenant_name, contact_name, contact_mobile, contact_email, status)
   VALUES ('default', 'T000', '默认租户', '默认租户', '张三', '13800000000', 'a@b.c', 1)`,
  `INSERT INTO t_tenant (id, tenant_code, name, tenant_name, contact_name, contact_mobile, contact_email, status)
   VALUES ('${UUID_ROW}', 'T001', '酒行UUID', '酒行UUID', '李四', '13900000000', 'd@e.f', 1)`,
  `INSERT INTO t_sys_role (role_code, tenant_id, status) VALUES ('SUPER_ADMIN', 'default', 'ACTIVE')`,
];

(async () => {
  // 先确保私有库存在（脚本自建 schema；不触碰其它库）
  const bootstrap = await mysql.createConnection({
    host: "127.0.0.1",
    port: Number(DB_PORT),
    user: "root",
    password: "",
  });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4`);
  await bootstrap.end();

  const db = await mysql.createConnection({
    host: "127.0.0.1",
    port: Number(DB_PORT),
    user: "root",
    password: "",
    database: DB_NAME,
    multipleStatements: true,
  });
  const rows = async (sql, params = []) => (await db.query(sql, params))[0];
  const one = async (sql, params = []) => (await rows(sql, params))[0] ?? null;

  const modeRow = (await rows("SELECT VERSION() AS version, @@sql_mode AS sqlMode"))[0];
  console.log(`环境：${modeRow.version} | @@sql_mode=${modeRow.sqlMode}`);
  check("私有实例开启 STRICT_TRANS_TABLES（1366 的前提）", modeRow.sqlMode.includes("STRICT_TRANS_TABLES"), true);

  for (const stmt of DDL) await db.query(stmt);
  for (const stmt of SEEDS) await db.query(stmt);

  // ── 反测模式：证明「没有映射就会红」 ──────────────────────────────────────
  if (NEGATIVE) {
    console.log("反测模式：已在内存中把服务层 `SET status = ?` 的入参从映射值改回原始字符串（磁盘文件未改）");

    // ① 直接证 DB 列/严格模式语义：字符串写 TINYINT ⇒ 1366
    try {
      await db.query("UPDATE t_tenant SET status = 'ACTIVE' WHERE id = ?", [UUID_ROW]);
      check("反测① 直接写字符串 'ACTIVE' 到 TINYINT 列 ⇒ 必报 1366", "未报错（不符合预期）", "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD");
    } catch (e) {
      console.log(`      原始输出：code=${e.code} errno=${e.errno} sqlState=${e.sqlState} message=${e.message}`);
      check("反测① 直接写字符串 'ACTIVE' 到 TINYINT 列 ⇒ 必报 1366", { code: e.code, errno: e.errno }, { code: "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", errno: 1366 });
    }

    // ② 走端点（映射被打掉）⇒ 500，且错误原文是 1366
    const res = await request(app)
      .post(`/api/platform/tenants/${UUID_ROW}/toggle`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ status: "ACTIVE" });
    console.log(`      端点原始响应：HTTP ${res.status} body=${JSON.stringify(res.body)}`);
    check("反测② 去掉映射后 POST /:id/toggle ⇒ 500（证明「应为 200 且落库 1」这条断言会红）", res.status, 500);

    // ③ 直接调服务层（映射已打掉）⇒ 抛 MariaDB 1366 原始错误
    const tenantService = require(path.join(SRC, "services", "platform-tenant.service.ts"));
    try {
      await tenantService.toggleTenantStatus(UUID_ROW, "ACTIVE");
      check("反测③ 去掉映射后直接调 toggleTenantStatus ⇒ 抛 1366", "未报错（不符合预期）", "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD");
    } catch (e) {
      console.log(`      服务层原始错误：code=${e.code} errno=${e.errno} sqlState=${e.sqlState} message=${e.message}`);
      check(
        "反测③ 去掉映射后直接调 toggleTenantStatus ⇒ 抛 1366",
        { code: e.code, errno: e.errno },
        { code: "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD", errno: 1366 }
      );
    }

    await db.end();
    console.log(`SUMMARY: ${total - failed}/${total} PASS`);
    process.exit(failed ? 1 : 0);
  }

  // ── 正测：启停两向 ────────────────────────────────────────────────────────
  const before = await one("SELECT id, tenant_name, status FROM t_tenant WHERE id = ?", [UUID_ROW]);
  console.log(`起点读数：SELECT id, tenant_name, status FROM t_tenant WHERE id='${UUID_ROW}' ⇒ ${JSON.stringify(before)}`);

  const enable = await request(app)
    .post(`/api/platform/tenants/${UUID_ROW}/toggle`)
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "ACTIVE" });
  const afterEnable = await one("SELECT status FROM t_tenant WHERE id = ?", [UUID_ROW]);
  console.log(`原始请求：POST /api/platform/tenants/${UUID_ROW}/toggle {"status":"ACTIVE"} ⇒ HTTP ${enable.status} ${JSON.stringify(enable.body)}`);
  console.log(`落库读数：SELECT status FROM t_tenant WHERE id='${UUID_ROW}' ⇒ ${JSON.stringify(afterEnable)}`);
  check("①a 启停 ACTIVE：响应 status='ACTIVE'", enable.body?.data?.status, "ACTIVE");
  check("①b 启停 ACTIVE：DB status=1", Number(afterEnable?.status), 1);

  const disable = await request(app)
    .post(`/api/platform/tenants/${UUID_ROW}/toggle`)
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "DISABLED" });
  const afterDisable = await one("SELECT status FROM t_tenant WHERE id = ?", [UUID_ROW]);
  console.log(`原始请求：POST /api/platform/tenants/${UUID_ROW}/toggle {"status":"DISABLED"} ⇒ HTTP ${disable.status} ${JSON.stringify(disable.body)}`);
  console.log(`落库读数：SELECT status FROM t_tenant WHERE id='${UUID_ROW}' ⇒ ${JSON.stringify(afterDisable)}`);
  check("①c 启停 DISABLED：响应 status='DISABLED'", disable.body?.data?.status, "DISABLED");
  check("①d 启停 DISABLED：DB status=0", Number(afterDisable?.status), 0);

  // 复原为启用，便于后续读数
  await request(app)
    .post(`/api/platform/tenants/${UUID_ROW}/toggle`)
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "ACTIVE" });

  // ── 主键类型：UUID 型 id 可定位 ───────────────────────────────────────────
  const detail = await request(app)
    .get(`/api/platform/tenants/${UUID_ROW}`)
    .set("Authorization", `Bearer ${TOKEN}`);
  console.log(`原始请求：GET /api/platform/tenants/${UUID_ROW} ⇒ HTTP ${detail.status} ${JSON.stringify(detail.body?.data)}`);
  check("②a UUID 型 id 详情可定位（HTTP 200）", detail.status, 200);
  check("②b 详情 tenantName 非空", detail.body?.data?.tenantName, "酒行UUID");
  check("②c 详情 status 为字符串口径", detail.body?.data?.status, "ACTIVE");

  const list = await request(app)
    .get("/api/platform/tenants?page=1&pageSize=20")
    .set("Authorization", `Bearer ${TOKEN}`);
  const listKinds = [...new Set((list.body?.data?.records || []).map((r) => r.status))].sort();
  const listIds = (list.body?.data?.records || []).map((r) => r.id);
  console.log(`原始请求：GET /api/platform/tenants?page=1&pageSize=20 ⇒ HTTP ${list.status} records.id=${JSON.stringify(listIds)} records.status=${JSON.stringify(listKinds)}`);
  check("②d 列表出口 status 全为字符串口径", listKinds.every((k) => k === "ACTIVE" || k === "DISABLED"), true);
  check("②e 列表 id 原样为字符串（含 UUID）", listIds.includes(UUID_ROW), true);

  // ── 未知 id ⇒ 404（数字型与非数字型） ─────────────────────────────────────
  const unknownNumeric = await request(app)
    .post("/api/platform/tenants/123/toggle")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "ACTIVE" });
  console.log(`原始请求：POST /api/platform/tenants/123/toggle ⇒ HTTP ${unknownNumeric.status} ${JSON.stringify(unknownNumeric.body)}`);
  check("③a 未知数字型 id 启停 ⇒ 404", unknownNumeric.status, 404);

  const unknownText = await request(app)
    .post("/api/platform/tenants/not-exist-xyz/toggle")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "ACTIVE" });
  console.log(`原始请求：POST /api/platform/tenants/not-exist-xyz/toggle ⇒ HTTP ${unknownText.status} ${JSON.stringify(unknownText.body)}`);
  check("③b 未知非 UUID 字符串 id 启停 ⇒ 404", unknownText.status, 404);

  const unknownDetail = await request(app)
    .get("/api/platform/tenants/123")
    .set("Authorization", `Bearer ${TOKEN}`);
  check("③c 未知数字型 id 详情 ⇒ 404", unknownDetail.status, 404);

  const unknownUpdate = await request(app)
    .put("/api/platform/tenants/not-exist-xyz")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ tenantName: "改名" });
  check("③d 未知 id 更新 ⇒ 404", unknownUpdate.status, 404);

  const badStatus = await request(app)
    .post(`/api/platform/tenants/${UUID_ROW}/toggle`)
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "SUSPENDED" });
  check("③e 非法 status 值 ⇒ 400（不落库、不静默成功）", badStatus.status, 400);

  // ── 审批建租户 ⇒ tenant_name 非空 ────────────────────────────────────────
  await db.query(
    `INSERT INTO t_tenant_register_application
       (company_name, company_short_name, contact_person, contact_mobile, admin_username, admin_password_hash, admin_real_name, status)
     VALUES ('测试注册公司', '测试简称', '王五', '13700000000', 'reg_admin', 'hash', '王五', 'PENDING')`
  );
  const appRow = await one("SELECT id FROM t_tenant_register_application ORDER BY id DESC LIMIT 1");
  const approved = await registerService.approveTenantApplication(appRow.id, 99);
  const created = await one("SELECT id, name, tenant_name, status FROM t_tenant WHERE id = ?", [approved.tenantId]);
  console.log(`审批建租户：approveTenantApplication(applicationId=${appRow.id}) ⇒ tenantId=${approved.tenantId}`);
  console.log(`落库读数：SELECT id, name, tenant_name, status FROM t_tenant WHERE id='${approved.tenantId}' ⇒ ${JSON.stringify(created)}`);
  check("④a 审批建租户成功且返回 UUID 型 tenantId", typeof approved.tenantId === "string" && approved.tenantId.length === 36, true);
  check("④b 审批建租户后 tenant_name 非空（= name 同源展示名）", created?.tenant_name, "测试简称");

  const listAfter = await request(app)
    .get("/api/platform/tenants?page=1&pageSize=50&keyword=测试简称")
    .set("Authorization", `Bearer ${TOKEN}`);
  const hit = (listAfter.body?.data?.records || [])[0];
  console.log(`平台列表按新租户名检索：GET /api/platform/tenants?keyword=测试简称 ⇒ ${JSON.stringify(hit)}`);
  check("④c 平台租户列表按名称可检索到新租户（名称不再空白）", hit?.tenantName, "测试简称");

  await db.end();
  console.log(`SUMMARY: ${total - failed}/${total} PASS`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("脚本异常：", e);
  process.exit(2);
});
