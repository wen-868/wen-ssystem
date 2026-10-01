#!/usr/bin/env node
/**
 * S3-138 自检 / 反测脚本（纯 node 直跑，无需 vitest）
 *
 * 为什么需要它：
 *   本沙箱**跑不了 vitest**（esbuild `spawn EPERM`，子进程被拒；见 `docs/踩坑日志.md`[143]
 *   与 `backend/scripts/s3-125-selfcheck.mjs` 的同类说明），而 S3-138 的验收要求给出
 *   「同一组请求的原始输出」。本脚本用**同进程**（typescript 编译器 API 转译，不 spawn 子进程）
 *   加载**真实 controller / service / 路由 / 鉴权 / errorHandler**，只把 DB 访问换成内存桩，
 *   因此断言的是端点级真实行为，不是 mock 自证。
 *
 * 判据（对应派单卡 S3-138 二.① / 二.③ 与四.①②③）：
 *   ① `PUT  /api/platform/admins/abc/status`          ⇒ 400「管理员 ID 不合法」（修复前 500），且不落库
 *   ② `POST /api/platform/admins/abc/reset-password`  ⇒ 400（对照，保持）
 *   ③ `PUT  /api/platform/admins/999999/status`       ⇒ 404「管理员不存在」
 *   ④ 列表（读）与启停（写）两条路径的 status 都是字符串 'ACTIVE'/'DISABLED'（同形）
 *   ⑤ 列表筛选 status=ACTIVE ⇒ 参数化为 TINYINT 1；非法取值 ⇒ 400（不静默兜底）
 *   ⑥ 根因留痕：Number("abc")=NaN，经 mysql2 转义后是 SQL 字面量 NaN（MySQL 语法错误 ⇒ 500）
 *
 * 用法：`node backend/scripts/s3-138-selfcheck.cjs`（任意工作目录）
 * 退出码：0 = 全部 PASS；1 = 有 FAIL；2 = 脚本自身异常
 * 红线：**不连任何数据库**（全部走桩）、不写文件、不 spawn 子进程。
 *
 * 反测模式（门禁铁律：必须证明「没有修复就会红」）：
 *   `S3_138_NEGATIVE_TEST=1 node backend/scripts/s3-138-selfcheck.cjs`
 *   该模式下**只在内存里**把 controller 的那道 id 校验改成 `if (false)`（不改磁盘文件），
 *   并用 DB 桩如实模拟 mysql2/MySQL 对 `NaN` 字面量的报错（ER_PARSE_ERROR / 1064），
 *   预期 `PUT /admins/abc/status ⇒ 500` —— 即「不修就是 500」这条断言确实会红。
 */
const path = require("path");
const fs = require("fs");

const BACKEND_DIR = path.resolve(__dirname, "..");
const SRC = path.join(BACKEND_DIR, "src");
const ROOT_DIR = path.resolve(BACKEND_DIR, "..");
const NODE_MODULES = path.join(ROOT_DIR, "node_modules");

process.env.JWT_SECRET = process.env.JWT_SECRET || "s3-138-selfcheck-secret";
process.env.NODE_ENV = "development";
process.env.USE_MOCK_DB = "true";

// ── 1) 同进程 TS 加载器：typescript 编译器 API 转译（纯 JS，不 spawn 子进程） ──
const ts = require(path.join(NODE_MODULES, "typescript"));
/** 反测模式：内存里打掉控制器的 id 校验（磁盘文件不动），证明「不修就是 500」 */
const NEGATIVE = process.env.S3_138_NEGATIVE_TEST === "1";
require.extensions[".ts"] = function (mod, filename) {
  let source = fs.readFileSync(filename, "utf8");
  if (NEGATIVE && filename.endsWith(path.join("controllers", "platform", "platform.controller.ts"))) {
    const before = source;
    source = source.replace(
      "if (!Number.isInteger(adminId) || adminId <= 0) {",
      "if (false) {"
    );
    if (source === before) {
      console.error("反测模式：未能在 platform.controller.ts 里打掉 id 校验（源码形状已变）");
      process.exit(2);
    }
  }
  const out = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
      resolveJsonModule: true
    }
  }).outputText;
  mod._compile(out, filename);
};

const stub = (rel, exportsObj) => {
  const abs = require.resolve(path.join(SRC, rel.replace(/\//g, path.sep)));
  require.cache[abs] = { id: abs, filename: abs, loaded: true, exports: exportsObj };
};

// ── 2) 桩：DB / 日志 / 错误上报 / 飞书（不连生产库、不写外部系统） ──
const dbState = { rows: [], one: null, calls: [] };
/**
 * 与 mysql2/MySQL 真实行为同构：`NaN` 会被转义成 SQL 字面量 `NaN`（见上方 ⑥ 的 format 输出），
 * MySQL 解析失败 ⇒ ER_PARSE_ERROR(1064)。修复前 `Number("abc")=NaN` 正是这样落到 500 的。
 */
const assertNoNaN = (sql, params) => {
  for (const p of params || []) {
    if (typeof p === "number" && !Number.isFinite(p)) {
      const err = new Error(
        "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version near 'NaN'"
      );
      err.code = "ER_PARSE_ERROR";
      err.errno = 1064;
      err.sqlState = "42000";
      err.sql = sql;
      throw err;
    }
  }
};
stub("shared/db.ts", {
  query: async (sql, params) => {
    dbState.calls.push({ sql: String(sql), params: params || [] });
    assertNoNaN(String(sql), params);
    return dbState.rows;
  },
  queryOne: async (sql, params) => {
    dbState.calls.push({ sql: String(sql), params: params || [] });
    assertNoNaN(String(sql), params);
    return dbState.one;
  },
  queryWithTenant: async () => [],
  connQuery: async () => [],
  connQueryOne: async () => null,
  connExecute: async () => [{}, {}],
  transaction: async (fn) => fn({})
});
const noop = () => {};
stub("shared/logger.ts", {
  default: { error: noop, warn: noop, info: noop, debug: noop },
  __esModule: true
});
stub("services/admin/error-log.service.ts", { insertErrorLog: async () => 1 });
stub("shared/feishu-report.ts", { reportToLingZhou: async () => {} });

const express = require(path.join(NODE_MODULES, "express"));
const request = require(path.join(NODE_MODULES, "supertest"));
const jwt = require(path.join(NODE_MODULES, "jsonwebtoken"));
const mysql2 = require(path.join(NODE_MODULES, "mysql2"));

const { platformRouter } = require(path.join(SRC, "routes", "platform.routes.ts"));
const { requirePlatformAuth, PLATFORM_JWT_ISSUER, PLATFORM_JWT_AUDIENCE } = require(
  path.join(SRC, "middleware", "auth.ts")
);
const { errorHandler } = require(path.join(SRC, "middleware", "error-handler.ts"));
const { env } = require(path.join(SRC, "config", "env.ts"));

// 与生产同构的小 app：真实鉴权 + 真实路由 + 真实 errorHandler
const app = express();
app.use(express.json());
app.use("/api/platform", requirePlatformAuth, platformRouter);
app.use(errorHandler);

const TOKEN = jwt.sign(
  { type: "platform_admin", id: 1, username: "admin", realName: "凌舟" },
  env.JWT_SECRET,
  {
    algorithm: "HS256",
    issuer: PLATFORM_JWT_ISSUER,
    audience: PLATFORM_JWT_AUDIENCE,
    expiresIn: "1h"
  }
);

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

(async () => {
  // ⑥ 根因留痕（修复前 500 的机制）
  const nanId = Number("abc");
  const escaped = mysql2.format("SELECT id FROM t_platform_admin WHERE id = ?", [nanId]);
  console.log(`根因：Number("abc")=${String(nanId)} | mysql2 转义后 SQL=${escaped}`);

  // ── 反测模式：证明「没有这道校验，同一请求就是 500」 ──
  if (NEGATIVE) {
    console.log("反测模式：已在内存中把 updateAdminStatus 的 id 校验改成 if (false)（磁盘文件未改）");
    dbState.one = null;
    dbState.rows = [];
    dbState.calls = [];
    const res = await request(app)
      .put("/api/platform/admins/abc/status")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ status: "DISABLED" });
    check(
      "反测① PUT /admins/abc/status 去掉校验 ⇒ 500（证明「应为 400」这条断言会红）",
      { status: res.status, msg: res.body.msg, dbCalls: dbState.calls.length },
      { status: 500, msg: "服务器内部错误", dbCalls: 1 }
    );
    // 注意：JSON.stringify(NaN) 会输出 null，故这里用 String() 如实显示 NaN
    console.log("反测② 落到 SQL 的参数 =", String(dbState.calls[0] && dbState.calls[0].params));
    console.log(`\nSUMMARY: ${total - failed}/${total} PASS`);
    process.exit(failed === 0 ? 0 : 1);
  }

  // ① 非数字 id（修复前 500）
  dbState.one = null;
  dbState.rows = [];
  dbState.calls = [];
  const resAbc = await request(app)
    .put("/api/platform/admins/abc/status")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "DISABLED" });
  check(
    "① PUT /admins/abc/status ⇒ 400 且不落库",
    { status: resAbc.status, msg: resAbc.body.msg, dbCalls: dbState.calls.length },
    { status: 400, msg: "管理员 ID 不合法", dbCalls: 0 }
  );

  // ② 对照端点
  const resAbcReset = await request(app)
    .post("/api/platform/admins/abc/reset-password")
    .set("Authorization", `Bearer ${TOKEN}`);
  check(
    "② POST /admins/abc/reset-password ⇒ 400（对照）",
    { status: resAbcReset.status, msg: resAbcReset.body.msg },
    { status: 400, msg: "管理员 ID 不合法" }
  );

  // ③ 合法但不存在
  dbState.one = null;
  dbState.rows = [];
  const resMissing = await request(app)
    .put("/api/platform/admins/999999/status")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "ACTIVE" });
  check(
    "③ PUT /admins/999999/status ⇒ 404",
    { status: resMissing.status, msg: resMissing.body.msg },
    { status: 404, msg: "管理员不存在" }
  );

  const resMissingReset = await request(app)
    .post("/api/platform/admins/999999/reset-password")
    .set("Authorization", `Bearer ${TOKEN}`);
  check("③b POST /admins/999999/reset-password ⇒ 404（两端点一致）", resMissingReset.status, 404);

  // ④a 列表（读）口径
  dbState.rows = [
    { id: 1, username: "admin", realName: "超管", role: "SUPER_ADMIN", status: 1 },
    { id: 2, username: "ops", realName: "运营", role: "ADMIN", status: 0 }
  ];
  dbState.one = { total: 2 };
  const resList = await request(app)
    .get("/api/platform/admins?page=1&pageSize=20")
    .set("Authorization", `Bearer ${TOKEN}`);
  check(
    "④a GET /admins 列表 status 为字符串",
    { status: resList.status, kinds: resList.body.data.records.map((r) => r.status) },
    { status: 200, kinds: ["ACTIVE", "DISABLED"] }
  );

  // ④b 启停（写）口径
  dbState.one = { id: 7 };
  dbState.rows = { affectedRows: 1 };
  dbState.calls = [];
  const resUpdate = await request(app)
    .put("/api/platform/admins/7/status")
    .set("Authorization", `Bearer ${TOKEN}`)
    .send({ status: "DISABLED" });
  const updateCall = dbState.calls.find((c) =>
    c.sql.includes("UPDATE t_platform_admin SET status")
  );
  check(
    "④b PUT /admins/7/status 响应为字符串且 DB 仍是 TINYINT",
    {
      status: resUpdate.status,
      bodyStatus: resUpdate.body.data.status,
      dbValue: updateCall && updateCall.params[0]
    },
    { status: 200, bodyStatus: "DISABLED", dbValue: 0 }
  );

  // ⑤ 列表筛选入参口径
  dbState.rows = [];
  dbState.one = { total: 0 };
  dbState.calls = [];
  const resFilter = await request(app)
    .get("/api/platform/admins?status=ACTIVE")
    .set("Authorization", `Bearer ${TOKEN}`);
  check(
    "⑤ GET /admins?status=ACTIVE ⇒ 参数化为 TINYINT 1",
    { status: resFilter.status, param: dbState.calls[0] && dbState.calls[0].params[0] },
    { status: 200, param: 1 }
  );

  const resBadFilter = await request(app)
    .get("/api/platform/admins?status=UNKNOWN")
    .set("Authorization", `Bearer ${TOKEN}`);
  check("⑤b GET /admins?status=UNKNOWN ⇒ 400（不静默兜底）", resBadFilter.status, 400);

  const resNoAuth = await request(app).put("/api/platform/admins/abc/status").send({
    status: "DISABLED"
  });
  check("⑥ 无令牌 ⇒ 401（端点不是裸奔的）", resNoAuth.status, 401);

  console.log(`\nSUMMARY: ${total - failed}/${total} PASS`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error("SELFCHECK ERROR", err);
  process.exit(2);
});
