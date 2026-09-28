/**
 * R101-C6-3-1 端点语义装置（补充证据工具，随本单入库；形态对齐同目录的 c6-3-0-reverse-test.mjs）
 *
 * 为什么需要它：本沙箱 vitest 起不来（esbuild spawn EPERM），而验收标准③要求
 * 「未知 code/dictType ⇒ 404、重复 itemCode ⇒ 400、无变更 ⇒ 400」的**可复跑证据**。
 * 本装置用真实链路跑这 5 条端点：真实 express 路由（platform-config.routes.ts）
 * + 真实控制器（zod 校验）+ 真实服务（SQL 拼装/业务码），只把 shared/db 换成可编程桩。
 *
 * 与单测的关系：权威形态是 backend/src/__tests__ 下本单新增的 3 个 vitest 文件
 *   （routes/platform-config-c6-3-1.test.ts、services/platform/platform-dict.service.test.ts、
 *    services/platform/platform-feature-switch.service.test.ts），凌舟本机 `npx vitest run` 可跑；
 *   本装置是"在无 vitest 的沙箱里也能真跑一遍"的等价最小运行时，判绿权仍归凌舟。
 *
 * 用法（在仓库根执行）：node saas-admin/tools/c6-3-1-route-harness.mjs .
 * 前置：Node ≥ 22.6（原生 TS 类型擦除）、backend/node_modules 可解析（express/supertest/zod）。
 * 边界（诚实标注）：① shared/db 被换成桩，未过真实 MySQL；② 未过 nginx / CSRF / requirePlatformAuth 的真实令牌校验
 *   （仅验证"无令牌 ⇒ 401"这一分支）；③ 未覆盖真实浏览器渲染。判绿权归凌舟，CI 的 build-and-test 为终审。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.argv[2] ?? ".");
const require = createRequire(path.join(ROOT, "backend", "package.json"));
const express = require("express");
const supertest = require("supertest");

process.env.USE_MOCK_DB = "true";
process.env.JWT_SECRET = "harness-secret";

/* ── shared/db 桩：整面转发真实模块，只覆盖需要编程控制的 5 个函数 ── */
const realDbUrl = pathToFileURL(path.join(ROOT, "backend/src/shared/db.ts")).href;
const stubPath = path.join(os.tmpdir(), `c631-db-stub-${process.pid}.mjs`);
fs.writeFileSync(
  stubPath,
  [
    `export * from ${JSON.stringify(realDbUrl)};`,
    `const g = () => globalThis.__C631;`,
    `export const query = (sql, params = []) => g().query(sql, params);`,
    `export const queryOne = (sql, params = []) => g().queryOne(sql, params);`,
    `export const transaction = (runner) => g().transaction(runner);`,
    `export const connExecute = (conn, sql, params = []) => g().connExecute(conn, sql, params);`,
    `export const connQueryOne = (conn, sql, params = []) => g().connQueryOne(conn, sql, params);`,
    `export const connQuery = (conn, sql, params = []) => g().connQuery(conn, sql, params);`,
    `export const queryWithTenant = (sql, params = []) => g().query(sql, params);`,
    `export const queryOneWithTenant = (sql, params = []) => g().queryOne(sql, params);`,
    `export const executeWithTenant = () => Promise.resolve();`,
  ].join("\n"),
  "utf8"
);
const stubUrl = pathToFileURL(stubPath).href;

/* ── base 层 mock-db 桩：真实 mock-db.ts 里 `import { Row }` 是 TS 类型当值导入，
 *    node 类型擦除不会删掉它 ⇒ ESM 解析报错；本装置已全面接管 shared/db，故直接替换为惰性桩 ── */
const mockStubPath = path.join(os.tmpdir(), `c631-mockdb-stub-${process.pid}.mjs`);
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

/* ── 可编程桩状态 ── */
const state = {
  queryRows: [],
  queryOneRow: null,
  calls: [],
};
globalThis.__C631 = {
  query: async (sql, params) => {
    state.calls.push({ fn: "query", sql: String(sql), params });
    return state.queryRows;
  },
  queryOne: async (sql, params) => {
    state.calls.push({ fn: "queryOne", sql: String(sql), params });
    return state.queryOneRow;
  },
  transaction: async (runner) => {
    state.calls.push({ fn: "transaction" });
    return runner({});
  },
  connExecute: async (_conn, sql, params) => {
    state.calls.push({ fn: "connExecute", sql: String(sql), params });
    return [{ affectedRows: 1, insertId: 1 }, undefined];
  },
  connQueryOne: async (_conn, sql, params) => {
    state.calls.push({ fn: "connQueryOne", sql: String(sql), params });
    return { id: 7 };
  },
  connQuery: async () => [],
};

function reset({ queryRows = [], queryOneRow = null } = {}) {
  state.queryRows = queryRows;
  state.queryOneRow = queryOneRow;
  state.calls = [];
}

const { routeConfig } = await import(
  pathToFileURL(path.join(ROOT, "backend/src/routes/platform-config.routes.ts")).href
);
const { requirePlatformAuth } = await import(
  pathToFileURL(path.join(ROOT, "backend/src/middleware/auth.ts")).href
);

function buildApp(withAuth) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (!withAuth) req.user = { id: 42 };
    next();
  });
  app.use(routeConfig.prefix, withAuth ? requirePlatformAuth : (_req, _res, next) => next(), routeConfig.router);
  app.use((err, _req, res, _next) => {
    // 注意：本装置里 zod 被解析成两份实例（CJS require 与 ESM import），instanceof 会假阴性 ⇒ 用鸭子类型
    if (err?.name === "ZodError" || Array.isArray(err?.errors)) {
      res.status(400).json({ code: "400", msg: err.errors[0]?.message ?? "参数校验失败" });
      return;
    }
    res.status(err?.statusCode || 500).json({ code: String(err?.statusCode || 500), msg: err?.message });
  });
  return app;
}

const app = buildApp(false);
const authApp = buildApp(true);
const request = supertest;

let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS · ${label}${detail ? ` · ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL · ${label}${detail ? ` · ${detail}` : ""}`);
  }
}

const sqls = () => state.calls.filter((c) => c.sql).map((c) => c.sql);

/* ① GET 功能开关：TINYINT ⇒ boolean 归一走真实服务 */
reset({
  queryRows: [
    { featureCode: "multi_warehouse", featureName: "多仓库", enabled: 1, defaultForNewTenant: 0, remark: null },
  ],
});
let res = await request(app).get("/api/platform/config/feature-switches");
check(
  "①-a GET feature-switches 有行 ⇒ 200 且 enabled/defaultForNewTenant 归一为 boolean",
  res.status === 200 &&
    res.body.code === "0" &&
    res.body.data.items[0].enabled === true &&
    res.body.data.items[0].defaultForNewTenant === false,
  `status=${res.status} body=${JSON.stringify(res.body.data)}`
);
check(
  "①-b GET 只查 t_platform_feature_switch（未碰 t_platform_config / t_subscription_plan）",
  sqls().every((s) => s.includes("t_platform_feature_switch")),
  sqls().join(" | ")
);

reset({ queryRows: [] });
res = await request(app).get("/api/platform/config/feature-switches");
check("①-c 空表 ⇒ items: []（诚实空态）", res.status === 200 && Array.isArray(res.body.data.items) && res.body.data.items.length === 0, `status=${res.status}`);

/* ② PUT 功能开关 */
reset({
  queryOneRow: {
    featureCode: "multi_warehouse",
    featureName: "多仓库",
    enabled: 0,
    defaultForNewTenant: 0,
    remark: null,
  },
});
res = await request(app).put("/api/platform/config/feature-switches/multi_warehouse").send({ enabled: true });
check(
  "②-a PUT {enabled:true} ⇒ 200 {featureCode,changedFields:['enabled']}，UPDATE 只带 enabled+updated_by",
  res.status === 200 &&
    JSON.stringify(res.body.data) === JSON.stringify({ featureCode: "multi_warehouse", changedFields: ["enabled"] }) &&
    sqls().some((s) => s.includes("UPDATE t_platform_feature_switch") && s.includes("enabled = ?") && s.includes("updated_by = ?")),
  `status=${res.status} body=${JSON.stringify(res.body.data)} sql=${sqls().join(" | ")}`
);

reset({ queryOneRow: null });
res = await request(app).put("/api/platform/config/feature-switches/nope").send({ enabled: true });
check(
  "②-b 未知 code ⇒ 404「功能开关不存在：nope」且不执行 UPDATE",
  res.status === 404 && res.body.msg === "功能开关不存在：nope" && !sqls().some((s) => s.startsWith("UPDATE")),
  `status=${res.status} msg=${res.body.msg}`
);

reset({
  queryOneRow: { featureCode: "m", featureName: "M", enabled: 0, defaultForNewTenant: 0, remark: null },
});
res = await request(app).put("/api/platform/config/feature-switches/multi_warehouse").send({});
check(
  "②-c body 无任何可变更字段 ⇒ 400（zod 反射，且未到服务层）",
  res.status === 400 && state.calls.length === 0,
  `status=${res.status} msg=${res.body.msg} calls=${state.calls.length}`
);

reset({
  queryOneRow: { featureCode: "m", featureName: "M", enabled: 0, defaultForNewTenant: 0, remark: null },
});
res = await request(app).put("/api/platform/config/feature-switches/multi_warehouse").send({ enabled: false });
check(
  "②-d 提交值与现值一致（无变更）⇒ 400 + 中文说明，不静默成功",
  res.status === 400 && res.body.msg === "提交内容与当前配置一致，无字段变更",
  `status=${res.status} msg=${res.body.msg}`
);

reset({ queryOneRow: { featureCode: "m", featureName: "M", enabled: 0, defaultForNewTenant: 0, remark: null } });
res = await request(app).put("/api/platform/config/feature-switches/multi_warehouse").send({ enabled: "maybe" });
check("②-e enabled 非法取值 ⇒ 400（zod）", res.status === 400 && state.calls.length === 0, `status=${res.status} msg=${res.body.msg}`);

/* ③ GET 数据字典 */
reset({ queryRows: [{ dictType: "unit", dictName: "计量单位", remark: null, status: "ACTIVE", itemCount: "4" }] });
res = await request(app).get("/api/platform/config/data-dict");
check(
  "③-a GET data-dict ⇒ 200 且 itemCount 归一为 number",
  res.status === 200 && res.body.data.items[0].itemCount === 4 && res.body.data.items[0].dictType === "unit",
  `status=${res.status} body=${JSON.stringify(res.body.data)}`
);

reset({ queryRows: [] });
res = await request(app).get("/api/platform/config/data-dict/unit/items");
check(
  "③-b 合法类型未落库 ⇒ 200 {dictType:'unit', items: []}",
  res.status === 200 && res.body.data.dictType === "unit" && res.body.data.items.length === 0,
  `status=${res.status} body=${JSON.stringify(res.body.data)}`
);

reset({});
res = await request(app).get("/api/platform/config/data-dict/nope/items");
check(
  "③-c 未知 dictType ⇒ 404「未知字典类型：nope」且不查库",
  res.status === 404 && res.body.msg === "未知字典类型：nope" && state.calls.length === 0,
  `status=${res.status} msg=${res.body.msg} calls=${state.calls.length}`
);

reset({});
res = await request(app).get("/api/platform/config/data-dict/unit");
check("③-d 自拟路径 /data-dict/:dictType（无 /items）⇒ 404（路由未放宽）", res.status === 404, `status=${res.status}`);

/* ④ PUT 数据字典（整包替换） */
reset({});
res = await request(app)
  .put("/api/platform/config/data-dict/unit")
  .send({
    items: [
      { itemCode: "bottle", itemName: "瓶", sortNo: 1 },
      { itemCode: "box", itemName: "箱", sortNo: 2, status: "DISABLED", remark: "整箱" },
    ],
  });
const putSqls = sqls();
check(
  "④-a PUT 整包替换 ⇒ 200 {dictType:'unit',saved:2}，且事务内顺序 = 父表 upsert → 取 id → DELETE → 2×INSERT",
  res.status === 200 &&
    JSON.stringify(res.body.data) === JSON.stringify({ dictType: "unit", saved: 2 }) &&
    putSqls.length === 5 &&
    putSqls[0].includes("INSERT INTO t_platform_dict") &&
    putSqls[0].includes("ON DUPLICATE KEY UPDATE") &&
    putSqls[1].includes("SELECT id FROM t_platform_dict") &&
    putSqls[2].includes("DELETE FROM t_platform_dict_item") &&
    putSqls[3].includes("INSERT INTO t_platform_dict_item") &&
    putSqls[4].includes("INSERT INTO t_platform_dict_item"),
  `status=${res.status} body=${JSON.stringify(res.body.data)} sqls=${putSqls.length}`
);
check(
  "④-b 未传 status/remark 归一为 ACTIVE/null（不用空串冒充未填写）",
  JSON.stringify(state.calls[4]?.params) === JSON.stringify([7, "bottle", "瓶", 1, "ACTIVE", null]),
  `calls=${JSON.stringify(state.calls.map((c) => c.fn))} insert1Params=${JSON.stringify(state.calls[4]?.params)}`
);

reset({});
res = await request(app)
  .put("/api/platform/config/data-dict/unit")
  .send({ items: [{ itemCode: "bottle", itemName: "瓶" }, { itemCode: "bottle", itemName: "瓶2" }] });
check(
  "④-c itemCode 重复 ⇒ 400「字典项编码重复：bottle」且未开事务",
  res.status === 400 && res.body.msg === "字典项编码重复：bottle" && !state.calls.some((c) => c.fn === "transaction"),
  `status=${res.status} msg=${res.body.msg}`
);

reset({});
res = await request(app).put("/api/platform/config/data-dict/nope").send({ items: [] });
check(
  "④-d 未知 dictType ⇒ 404（写侧同样判）",
  res.status === 404 && res.body.msg === "未知字典类型：nope",
  `status=${res.status} msg=${res.body.msg}`
);

reset({});
res = await request(app).put("/api/platform/config/data-dict/unit").send({ items: { itemCode: "bottle" } });
check("④-e items 非数组 ⇒ 400（zod）且未开事务", res.status === 400 && !state.calls.some((c) => c.fn === "transaction"), `status=${res.status}`);

reset({});
res = await request(app).put("/api/platform/config/data-dict/unit").send({ items: [] });
check(
  "④-f 空数组 ⇒ 200 saved:0（清空该类型，幂等），仍需 DELETE",
  res.status === 200 && res.body.data.saved === 0 && sqls().some((s) => s.includes("DELETE FROM t_platform_dict_item")),
  `status=${res.status} body=${JSON.stringify(res.body.data)}`
);

/* ⑤ 鉴权：无令牌 ⇒ 401（真实 requirePlatformAuth） */
const authResults = await Promise.all([
  request(authApp).get("/api/platform/config/feature-switches"),
  request(authApp).put("/api/platform/config/feature-switches/multi_warehouse").send({ enabled: true }),
  request(authApp).get("/api/platform/config/data-dict"),
  request(authApp).get("/api/platform/config/data-dict/unit/items"),
  request(authApp).put("/api/platform/config/data-dict/unit").send({ items: [] }),
]);
check(
  "⑤ 无令牌访问 5 条新端点 ⇒ 全 401",
  authResults.every((r) => r.status === 401),
  `statuses=${JSON.stringify(authResults.map((r) => r.status))}`
);

fs.unlinkSync(stubPath);
fs.unlinkSync(mockStubPath);
console.log(`\n合计 ${pass + fail} 项，PASS ${pass} / FAIL ${fail} / EXIT=${fail ? 1 : 0}`);
// 本装置加载了真实后端模块（mysql 连接池 / pino 等会挂住事件循环）⇒ 显式退出，避免命令不返回
process.exit(fail ? 1 : 0);
