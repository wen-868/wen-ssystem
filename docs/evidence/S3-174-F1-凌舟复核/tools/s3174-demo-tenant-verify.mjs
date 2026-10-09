#!/usr/bin/env node
/**
 * S3-174-F1 验收装置 · 演示租户隔离迁移（197）—— **生产同构**库上跑，不靠自述
 *
 * 保真模型（为什么这样建表）：
 *   · `t_tenant` / `t_sys_menu`：用**生产真实 DDL**（含 `company_name` / `contact_person` /
 *     `contact_mobile` / `tenant_code`(UNIQUE) 这类"NOT NULL 且无默认值"的列，以及
 *     `uk_sys_menu_code_tenant (menu_code, tenant_id)`）——197 对这两张表是 **INSERT**，
 *     NOT NULL 陷阱只会在这里出现，所以必须同构。
 *   · `t_sys_user` / `t_sys_user_role`：用"只含被测字段"的最小表，但**带上生产真实唯一键
 *     `uk_sys_user_role (user_id, role_id)`**（不含 tenant_id）——197 对前者是 UPDATE、
 *     对后者是 UPDATE + INSERT(user_id, role_id, tenant_id)，唯一键口径是失败点，必须同构。
 *
 * 数据来源：`ddl.txt` / `fixtures.txt` 由生产**只读**导出，命令：
 *   SHOW CREATE TABLE t_tenant; SHOW CREATE TABLE t_sys_user;
 *   SHOW CREATE TABLE t_sys_user_role; SHOW CREATE TABLE t_sys_menu;
 *   SELECT id, parent_id, menu_code, menu_name, menu_type, path, component, icon, sort_no, visible, status
 *     FROM t_sys_menu WHERE tenant_id='default' ORDER BY id;   -- 89 行
 *   SELECT id, username, tenant_id, status FROM t_sys_user WHERE username='demo';
 *   SELECT user_id, role_id, tenant_id FROM t_sys_user_role;
 *   SELECT id, role_code FROM t_sys_role WHERE role_code='SUPER_ADMIN';
 *
 * 运行：S3174_VERIFY_DIR=<含 ddl.txt/fixtures.txt 的目录> \
 *       S3174_MIGRATION=<197 迁移 sql 路径> \
 *       node backend/scripts/s3174-demo-tenant-verify.mjs
 *   退出码 0 = 全绿；1 = 有断言失败（含反测应红而未红）。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");

const DIR = process.env.S3174_VERIFY_DIR || "D:\\Users\\ZXQL\\_hygiene-quarantine-20261007\\s3174-verify";
const MIG = process.env.S3174_MIGRATION || "D:\\Users\\ZXQL\\wt-agents\\issue-279\\docs\\migrations\\197_演示租户隔离.sql";
const DB = "s3174v";

// ddl.txt 是生产只读导出（SHOW CREATE TABLE，mysql 批处理已把换行转义为 \n）。
// 允许追加 ddl-<表名>.txt 存放后续补导的表 DDL，避免改写已导出的证据文件（证据文件一经导出不再改）。
const ddlRaw = readdirSync(DIR)
  .filter((f) => /^ddl(-.*)?\.txt$/.test(f))
  .flatMap((f) => readFileSync(resolve(DIR, f), "utf8").split(/\r?\n/))
  .filter(Boolean);
const fx = readFileSync(resolve(DIR, "fixtures.txt"), "utf8").split(/\r?\n/);
const migration = readFileSync(MIG, "utf8");

// 生产 DDL：取第 2 列（CREATE 语句），把 MySQL8 专有 collation 换成 MariaDB 可用的等价项
// （只影响本地复刻；与 197 的逻辑——NOT NULL / 唯一键 / 关联映射——无关）
function prodDdl(name) {
  const row = ddlRaw.find((l) => l.split("\t")[0] === name);
  if (!row) throw new Error(`ddl.txt 缺 ${name}`);
  return row
    .split("\t")[1]
    .replaceAll("\\n", "\n")
    .replaceAll("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci");
}

const menus = fx.slice(0, 89).map((l) => l.split("\t"));
const demoUser = fx[89].split("\t");            // id, username, tenant_id, status
const roleBindings = fx.slice(90, 98).map((l) => l.split("\t")); // user_id, role_id, tenant_id
const superRole = fx[98].split("\t");           // id, role_code

const results = [];
function check(name, cond, detail = "") {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  <- ${detail}` : ""}`);
}

const conn = await mysql.createConnection({
  host: "127.0.0.1", port: 3307, user: "root", password: "", multipleStatements: true,
});

await conn.query(`DROP DATABASE IF EXISTS \`${DB}\``);
await conn.query(`CREATE DATABASE \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.query(`USE \`${DB}\``);

// ── 建表：197 会写到的四张表**全部生产同构**（t_tenant/t_sys_menu/t_sys_user/t_sys_user_role）──
//   ⚠️ 保真教训（2026-10-10 首跑暴露）：本装置初版对 t_sys_user / t_sys_user_role 用了"只含被测字段"的
//   最小表，结果 t_sys_user 缺 `updated_at` —— 197 第 2 条 UPDATE 会写 `updated_at`，本装置当场 1054
//   Unknown column 崩掉。生产 `t_sys_user` **确有** `updated_at`（SHOW CREATE 原文见 ddl.txt），
//   所以这是**装置保真缺口**而非迁移缺陷：用最小表模拟"被 UPDATE 的表"本身就会漏掉迁移真正写到的列。
//   修正：凡 197 写到的表一律直接用生产 DDL，唯一键/列集合/可空性不再由人脑裁剪。
await conn.query(prodDdl("t_tenant"));
await conn.query(prodDdl("t_sys_menu"));
await conn.query(prodDdl("t_sys_user"));
await conn.query(prodDdl("t_sys_user_role"));
// t_sys_role 也是读路径 JOIN 的目标（A/B/C 三条断言），故同样用生产 DDL（含 uk_role_code_tenant
// 这一"角色按租户定义"的关键唯一键）。
await conn.query(prodDdl("t_sys_role"));

// ── 种夹具（生产实况：default 租户 + 另一个租户；demo 用户在 default，含 SUPER_ADMIN 绑定） ──
// ⚠️ 夹具保真纠错（2026-10-10 二跑暴露）：default 行的 tenant_code 在生产是**空串**（只读核对原文：
// `default []`），而 t_tenant 上有两个 UNIQUE 键都落在 tenant_code 上（tenant_code / uk_tenant_code）。
// 这正是判红①"旧版 INSERT IGNORE 建租户被静默跳过"的真实成因：旧版漏写 tenant_code ⇒ 取隐式默认 ''
// ⇒ 与 default 行撞唯一键 ⇒ IGNORE 把整行跳过 ⇒ 演示租户根本建不出来。
// 本装置初版把 default 的 tenant_code 误写成 'T-DEFAULT'，**恰好掩盖了该成因**（首跑旧版竟"建成"了）。
// 教训：反测装置"该红不红"往往不是被测对象没问题，而是夹具与生产不同构 —— 夹具值必须逐列对生产真值。
await conn.query(
  "INSERT INTO t_tenant (id,name,company_name,tenant_code,contact_person,contact_mobile,plan,status) VALUES " +
    "('default','默认租户','智享全链商行','','张伟','13800138000','basic',1)," +
    "('f0cbfe78-9f74-4966-9d1e-95aff8402d1c','13410954557','13410954557','T2026090895839','13410954557','13410954557','basic',1)"
);
// 生产 DDL 下 role_name 为 NOT NULL 且无默认值；permissions 用占位 JSON（断言只要求"非空行"）。
// 角色租户 = 'default'，与生产实况一致（生产 12 个角色行全在 default）。
await conn.query(
  "INSERT INTO t_sys_role (id, role_code, role_name, permissions, tenant_id) VALUES (?,?,?,?,?)",
  [Number(superRole[0]), superRole[1], "超级管理员", '["*"]', "default"]
);
await conn.query(
  "INSERT INTO t_sys_role (id, role_code, role_name, permissions, tenant_id) VALUES (?,?,?,?,?)",
  [6964, "STORE_OPERATOR", "门店操作员", '["sale:order:view"]', "default"]
);
// 生产 DDL 下 t_sys_user.password_hash 是 NOT NULL 且无默认值 ⇒ 种夹具必须显式给值（占位 hash，不参与断言）
await conn.query("INSERT INTO t_sys_user (id, username, password_hash, tenant_id, status) VALUES (?,?,?,?,?)", [
  Number(demoUser[0]), demoUser[1], "$2b$10$verifydeviceplaceholderhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", demoUser[2], Number(demoUser[3]),
]);
for (const [uid, rid, t] of roleBindings) {
  await conn.query("INSERT INTO t_sys_user_role (user_id, role_id, tenant_id) VALUES (?,?,?)", [Number(uid), Number(rid), t]);
}
for (const m of menus) {
  await conn.query(
    "INSERT INTO t_sys_menu (id,parent_id,menu_code,menu_name,menu_type,path,component,icon,sort_no,visible,status,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,'default')",
    [Number(m[0]), m[1] ? Number(m[1]) : null, m[2], m[3], m[4], m[5] || null, m[6] || null, m[7] || null, Number(m[8]), Number(m[9]), Number(m[10])]
  );
}

const q = async (sql) => (await conn.query(sql))[0];
const snapshot = async () => {
  const [r] = await q(
    "SELECT (SELECT COUNT(*) FROM t_tenant WHERE id='demo') demo_tenant," +
    " (SELECT COUNT(*) FROM t_sys_user WHERE username='demo' AND tenant_id='demo') user_in_demo," +
    " (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id=ur.user_id WHERE u.username='demo' AND ur.tenant_id='demo') bind_demo," +
    " (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id=ur.user_id WHERE u.username='demo' AND ur.tenant_id<>'demo') bind_out," +
    " (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id='demo') menus_demo," +
    " (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id='default') menus_default"
  );
  return r;
};

console.log("=== 迁移前基线 ===");
const before = await snapshot();
console.log(JSON.stringify(before));
check("基线：demo 用户在 default、无 demo 租户、无 demo 菜单",
  before.demo_tenant === 0 && before.user_in_demo === 0 && before.bind_demo === 0 && before.bind_out >= 1 && before.menus_demo === 0,
  JSON.stringify(before));

console.log("\n=== 跑 197（第一遍）===");
await conn.query(migration);
const after1 = await snapshot();
console.log(JSON.stringify(after1));
check("197 建成 demo 租户", after1.demo_tenant === 1, `demo_tenant=${after1.demo_tenant}`);
check("197 把 demo 用户迁到 demo 租户", after1.user_in_demo === 1, `user_in_demo=${after1.user_in_demo}`);
check("197 后 demo 用户在 demo 租户**有角色绑定**（不是归零）", after1.bind_demo >= 1, `bind_demo=${after1.bind_demo}`);
check("197 后 demo 用户在其它租户**无残留绑定**", after1.bind_out === 0, `bind_out=${after1.bind_out}`);
check("197 克隆了菜单（demo 菜单数 = default 菜单数）", after1.menus_demo === after1.menus_default && after1.menus_demo > 0,
  `demo=${after1.menus_demo} default=${after1.menus_default}`);

console.log("\n=== 跑 197（第二遍，幂等）===");
await conn.query(migration);
const after2 = await snapshot();
console.log(JSON.stringify(after2));
check("幂等：第二遍后各计数与第一遍一致", JSON.stringify(after1) === JSON.stringify(after2), `${JSON.stringify(after1)} vs ${JSON.stringify(after2)}`);

console.log("\n=== 功能可用性：按生产真实 SQL 形状复算演示账号的 角色/权限/菜单 ===");
// 只数"绑定行/菜单行"会漏掉一个致命点：行数对了，但**读路径的 JOIN 条件命不中**，
// 接口照样返回空。下面三条 SQL 逐字取自生产代码，仅把参数换成该演示账号与 'demo' 租户：
//   A. auth.service.ts:207-214  issueLoginResult → JWT 里的 roles
//   B. auth.service.ts:119-126  getUserPermissions → 登录返回的 permissions
//   C. menu-permission.service.ts:89-96 getUserMenus → 能否判定超管（否则 /admin/menus/user 返回空，
//      前端 stores/menu.ts 会按"空集=隐藏全部"处置 ⇒ 手机端功能中心整屏消失且不报错）
const DEMO_UID = Number(demoUser[0]);
const [rowsA] = await conn.query(
  "SELECT r.role_code FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id " +
  "WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1')",
  [DEMO_UID, "demo"]
);
check("A. JWT roles 含 SUPER_ADMIN（issueLoginResult 形状）",
  rowsA.some((r) => r.role_code === "SUPER_ADMIN"), JSON.stringify(rowsA.map((r) => r.role_code)));

const [rowsB] = await conn.query(
  "SELECT r.permissions FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id " +
  "WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1')",
  [DEMO_UID, "demo"]
);
check("B. permissions 非空（getUserPermissions 形状）", rowsB.length > 0, `rows=${rowsB.length}`);

const [rowsC] = await conn.query(
  "SELECT r.id AS roleId, r.role_code AS roleCode FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id " +
  "WHERE ur.user_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1') AND r.tenant_id = ?",
  [DEMO_UID, "demo"]
);
check("C. getUserMenus 能识别超管（否则菜单接口返回空 ⇒ 手机端功能中心整屏消失）",
  rowsC.some((r) => r.roleCode === "SUPER_ADMIN"), JSON.stringify(rowsC.map((r) => r.roleCode)));

console.log("\n=== 反测：去掉任一 NOT NULL 列 ⇒ 必须报错停下（不得静默跳过）===");
let reverseErr = null;
try {
  await conn.query("INSERT INTO t_tenant (id,name,plan,status) SELECT 'demo2','无company_name','basic',1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM t_tenant WHERE id='demo2')");
} catch (e) { reverseErr = e; }
check("缺 company_name 的 INSERT 报错（证明无 INSERT IGNORE 掩盖）", !!reverseErr, reverseErr ? `${reverseErr.code} / ${String(reverseErr.message).slice(0, 70)}` : "未报错");

const failed = results.filter((x) => !x).length;
console.log(`\n小结：${results.length - failed} passed / ${failed} failed`);
await conn.end();
process.exit(failed === 0 ? 0 : 1);
