#!/usr/bin/env node
/**
 * S3-174-F2 反测与幂等读数装置
 *
 * 定位：**凌舟的验收装置（s3174-demo-tenant-verify.mjs）不做反测**，本装置只补它的缺口，
 * 不重复它已覆盖的正向/幂等计数。三项用途：
 *   1. neg-role-clone   —— 反向①：把 197 第 2 条"克隆角色行"整段剔除，**仍用凌舟的装置**跑，
 *                          断言 B（getUserPermissions 形状）与 C（getUserMenus 形状）必须红。
 *   2. demo-login-limit —— 反向②：197 跑完（两遍）后，按 auth.service.ts 的 demoLogin() 真实写路径
 *                          执行一次"角色查询 + 缺失才插"，对比"限定 demo 租户"与"去掉限定"两种查询；
 *                          记录两种查询各自落库的绑定行、B/C 读数，以及随后重跑 197 的结果。
 *   3. idem-rows        —— 逐条语句读数：第二遍每条写语句 changedRows 必须全 0（零行变更的原始证据）。
 *   4. source-shape     —— 静态读数：从 auth.service.ts 抽出超管查询原文（断言含 tenant_id = ?），
 *                          并列出 197 的语句流。
 *
 * 依赖：S3174_VERIFY_DIR（含 ddl*.txt / fixtures.txt 的生产只读导出，与凌舟装置同一套）；
 *      本地 MariaDB 127.0.0.1:3307（与凌舟装置同一实例）；库名 s3174f2_*（与凌舟装置的 s3174v 隔离）。
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const mysql = require("mysql2/promise");

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.S3174_VERIFY_DIR || "D:\\Users\\ZXQL\\_hygiene-quarantine-20261007\\s3174-verify";
const MIG = process.env.S3174_MIGRATION || "D:\\Users\\ZXQL\\wt-agents\\issue-279\\docs\\migrations\\197_演示租户隔离.sql";
const DEVICE = process.env.S3174_DEVICE || "D:\\Users\\ZXQL\\ZXQL-MS\\wen-ssystem\\docs\\evidence\\S3-174-F1-凌舟复核\\tools\\s3174-demo-tenant-verify.mjs";
const SRC = process.env.S3174_AUTH_SRC || "D:\\Users\\ZXQL\\wt-agents\\issue-279\\backend\\src\\services\\admin\\auth.service.ts";
const VARIANT_DIR = process.env.S3174_VARIANT_DIR || join(process.env.TEMP || ".", "s3174f2-variant");

const mode = process.argv[2] || "help";
const results = [];
const check = (name, cond, detail = "") => {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  <- ${detail}` : ""}`);
};

// ── 夹具装载：与凌舟装置逐字同源（同一份 ddl*.txt / fixtures.txt，同一套解析口径）──
const ddlRaw = readdirSync(DIR)
  .filter((f) => /^ddl(-.*)?\.txt$/.test(f))
  .flatMap((f) => readFileSync(resolve(DIR, f), "utf8").split(/\r?\n/))
  .filter(Boolean);
const fx = readFileSync(resolve(DIR, "fixtures.txt"), "utf8").split(/\r?\n/);
const migration = readFileSync(MIG, "utf8");

function prodDdl(name) {
  const row = ddlRaw.find((l) => l.split("\t")[0] === name);
  if (!row) throw new Error(`ddl.txt 缺 ${name}`);
  return row.split("\t")[1].replaceAll("\\n", "\n").replaceAll("utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci");
}

const menus = fx.slice(0, 89).map((l) => l.split("\t"));
const demoUser = fx[89].split("\t");
const roleBindings = fx.slice(90, 98).map((l) => l.split("\t"));
const superRole = fx[98].split("\t");

/** 建库 + 生产同构 DDL + 生产夹具（与凌舟装置同口径；另建一套库以免与 s3174v 互相干扰） */
async function buildDb(db) {
  const conn = await mysql.createConnection({
    host: "127.0.0.1", port: 3307, user: "root", password: "", multipleStatements: true,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${db}\``);
  await conn.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);
  for (const t of ["t_tenant", "t_sys_menu", "t_sys_user", "t_sys_user_role", "t_sys_role"]) {
    await conn.query(prodDdl(t));
  }
  await conn.query(
    "INSERT INTO t_tenant (id,name,company_name,tenant_code,contact_person,contact_mobile,plan,status) VALUES " +
      "('default','默认租户','智享全链商行','','张伟','13800138000','basic',1)," +
      "('f0cbfe78-9f74-4966-9d1e-95aff8402d1c','13410954557','13410954557','T2026090895839','13410954557','13410954557','basic',1)"
  );
  await conn.query("INSERT INTO t_sys_role (id, role_code, role_name, permissions, tenant_id) VALUES (?,?,?,?,?)", [
    Number(superRole[0]), superRole[1], "超级管理员", '["*"]', "default",
  ]);
  await conn.query("INSERT INTO t_sys_role (id, role_code, role_name, permissions, tenant_id) VALUES (?,?,?,?,?)", [
    6964, "STORE_OPERATOR", "门店操作员", '["sale:order:view"]', "default",
  ]);
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
  return conn;
}

/** 197 语句流：与 runner 同口径——按 `;` 切块 + 去掉块首 `--` 注释（纯注释块丢弃） */
function splitStatements(sql) {
  return sql
    .split(";")
    .map((chunk) => chunk.replace(/^(\s*--[^\n]*(\n|$))+/, "").trim())
    .filter((chunk) => chunk.length > 0);
}

const DEMO_UID = () => Number(demoUser[0]);

/** A/B/C 三条断言：SQL 逐字取自凌舟装置 s3174-demo-tenant-verify.mjs 第 173-194 行 */
async function assertABC(conn, label) {
  const uid = DEMO_UID();
  const [rowsA] = await conn.query(
    "SELECT r.role_code FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id " +
      "WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1')",
    [uid, "demo"]
  );
  const [rowsB] = await conn.query(
    "SELECT r.permissions FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id AND r.tenant_id = ur.tenant_id " +
      "WHERE ur.user_id = ? AND ur.tenant_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1')",
    [uid, "demo"]
  );
  const [rowsC] = await conn.query(
    "SELECT r.id AS roleId, r.role_code AS roleCode FROM t_sys_user_role ur JOIN t_sys_role r ON r.id = ur.role_id " +
      "WHERE ur.user_id = ? AND (r.status='ACTIVE' OR r.status=1 OR r.status='1') AND r.tenant_id = ?",
    [uid, "demo"]
  );
  const a = rowsA.some((r) => r.role_code === "SUPER_ADMIN");
  const b = rowsB.length > 0;
  const c = rowsC.some((r) => r.roleCode === "SUPER_ADMIN");
  console.log(`--- ${label} ---`);
  console.log(`A. JWT roles 含 SUPER_ADMIN      -> ${a ? "PASS" : "FAIL"} ${JSON.stringify(rowsA.map((r) => r.role_code))}`);
  console.log(`B. permissions 非空             -> ${b ? "PASS" : "FAIL"} rows=${rowsB.length}`);
  console.log(`C. getUserMenus 能识别超管      -> ${c ? "PASS" : "FAIL"} ${JSON.stringify(rowsC.map((r) => r.roleCode))}`);
  return { a, b, c };
}

/** 演示账号的绑定行明细（看 role_id 指向哪个租户的角色行） */
async function showBindings(conn, label) {
  const [rows] = await conn.query(
    "SELECT ur.id, ur.role_id, ur.tenant_id AS bind_tenant, r.role_code, r.tenant_id AS role_tenant " +
      "FROM t_sys_user_role ur LEFT JOIN t_sys_role r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY ur.id",
    [DEMO_UID()]
  );
  console.log(`--- ${label}：演示账号绑定行明细 ---`);
  for (const r of rows) {
    console.log(
      `  ur.id=${r.id} role_id=${r.role_id} role_code=${r.role_code ?? "(缺失)"} 绑定租户=${r.bind_tenant} 角色行租户=${r.role_tenant ?? "(缺失)"}`
    );
  }
  const cross = rows.filter((r) => r.role_tenant !== r.bind_tenant);
  console.log(`  跨租户绑定（绑定租户 ≠ 角色行租户）条数 = ${cross.length}`);
  return { rows, cross };
}

async function counts(conn) {
  const [rows] = await conn.query(
    "SELECT (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id='demo') demo_role_rows," +
      " (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id='default') default_role_rows," +
      " (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id=ur.user_id WHERE u.username='demo' AND ur.tenant_id='demo') bind_demo," +
      " (SELECT COUNT(*) FROM t_sys_user_role ur JOIN t_sys_user u ON u.id=ur.user_id WHERE u.username='demo' AND ur.tenant_id<>'demo') bind_out," +
      " (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id='demo') menus_demo"
  );
  return rows[0];
}

// ───────────────────────── mode: source-shape ─────────────────────────
function sourceShape() {
  const src = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const m = src.match(/SELECT id, role_code FROM t_sys_role WHERE role_code = 'SUPER_ADMIN'[^`"]*/);
  check("auth.service.ts 里能抽到超管角色查询原文", !!m, m ? JSON.stringify(m[0]) : "未抽到");
  check(
    "③ 修复在位：该查询已限定租户（含 tenant_id = ?）",
    !!m && /AND tenant_id = \?/.test(m[0]),
    m ? JSON.stringify(m[0]) : ""
  );
  const stmts = splitStatements(migration.replace(/\r\n/g, "\n"));
  console.log("--- 197 语句流 ---");
  stmts.forEach((s, i) => {
    const kw = (s.match(/^[A-Za-z]+/g) || [""])[0];
    console.log(`  [${i}] ${kw.toUpperCase().padEnd(6)} ${s.replace(/\s+/g, " ").slice(0, 96)}`);
  });
  check("语句流 9 条（7 写 + 2 核对 SELECT）", stmts.length === 9, `实际 ${stmts.length}`);
  check("第 2 条 = 克隆角色行", /^INSERT INTO t_sys_role/i.test(stmts[1]), stmts[1].slice(0, 60));
  check("第 4 条 = 绑定 UPDATE 原地改角色指向", /^UPDATE t_sys_user_role/i.test(stmts[3]), stmts[3].replace(/\s+/g, " ").slice(0, 80));
}

// ───────────────────────── mode: neg-role-clone（反向①）─────────────────────────
function negRoleClone() {
  const norm = migration.replace(/\r\n/g, "\n");
  const stmtRe = /INSERT\s+INTO\s+t_sys_role[\s\S]*?;/;
  const hit = norm.match(stmtRe);
  check("能定位到第 2 条“克隆角色行”整段", !!hit, hit ? hit[0].replace(/\s+/g, " ").slice(0, 90) : "未命中");
  if (!hit) return;
  // 连同该语句上方的注释行一并剔除（代表"整段去掉"），其余语句逐字不动
  const before = norm.slice(0, hit.index).replace(/(\n--[^\n]*)+$/, "\n");
  const variant = before + norm.slice(hit.index + hit[0].length);
  mkdirSync(VARIANT_DIR, { recursive: true });
  const variantPath = join(VARIANT_DIR, "197-no-role-clone.sql");
  writeFileSync(variantPath, variant, "utf8");
  check(
    "剔除后变体里不再有克隆角色行语句",
    !/INSERT\s+INTO\s+t_sys_role/i.test(variant),
    `变体：${variantPath}`
  );
  console.log(`\n=== 用凌舟的装置跑"去掉克隆角色行"的 197 变体 ===\n装置：${DEVICE}\n变体：${variantPath}\n`);
  const run = spawnSync(process.execPath, [DEVICE], {
    env: { ...process.env, S3174_MIGRATION: variantPath, S3174_VERIFY_DIR: DIR },
    encoding: "utf8",
  });
  const out = `${run.stdout || ""}${run.stderr || ""}`;
  console.log(out.trim());
  console.log(`\n装置退出码 EXIT=${run.status}`);
  check("反向①：B（permissions）必须红", /^FAIL\s+B\./m.test(out), (out.match(/^.*B\. .*$/m) || [""])[0].trim());
  check("反向①：C（getUserMenus 超管）必须红", /^FAIL\s+C\./m.test(out), (out.match(/^.*C\. .*$/m) || [""])[0].trim());
  check("反向①：装置整体非 0 退出（断言有分辨力）", run.status !== 0, `EXIT=${run.status}`);
}

// ───────────────────────── mode: demo-login-limit（反向②）─────────────────────────
async function demoLoginLimit() {
  const src = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const q = src.match(/SELECT id, role_code FROM t_sys_role WHERE role_code = 'SUPER_ADMIN'[^`"]*/);
  check("从源码抽到超管角色查询", !!q, q ? JSON.stringify(q[0]) : "");
  const fixedQuery = q ? q[0].trim() : "";
  const unlimitedQuery = fixedQuery.replace(" AND tenant_id = ?", "");
  check("源码里的查询已限定租户（③ 在位）", /AND tenant_id = \?/.test(fixedQuery), JSON.stringify(fixedQuery));
  check("去掉限定后的变体（反向②用）", !/tenant_id = \?/.test(unlimitedQuery), JSON.stringify(unlimitedQuery));
  const lines = src.split("\n");
  const startLine = lines.findIndex((l) => l.includes("确保绑定 SUPER_ADMIN 角色")) + 1;
  console.log(`\n--- auth.service.ts 第 ${startLine}-${startLine + 13} 行（本次要复算的真实写路径）---`);
  lines.slice(startLine - 1, startLine + 13).forEach((l, i) => console.log(`  ${startLine + i}: ${l}`));

  // 登录路径的"缺失才插"语句：逐字取自 auth.service.ts（INSERT ... WHERE NOT EXISTS）
  const insertSql =
    "INSERT INTO t_sys_user_role (user_id, role_id, tenant_id)\n" +
    "       SELECT ?, ?, ? FROM (SELECT 1 AS whether_to_bind) AS bind_probe\n" +
    "       WHERE NOT EXISTS (SELECT 1 FROM t_sys_user_role WHERE user_id = ? AND role_id = ?)";
  check("源码含该 INSERT 的判据片段（防止本装置与源码形状漂移）", src.includes("whether_to_bind"), "");

  const runVariant = async (db, query, params, label) => {
    console.log(`\n########## ${label} ##########`);
    const conn = await buildDb(db);
    for (const s of splitStatements(migration)) await conn.query(s);
    console.log(`197 跑完一遍：${JSON.stringify(await counts(conn))}`);
    const abc0 = await assertABC(conn, "197 后（登录前）基线");
    await showBindings(conn, "197 后（登录前）");

    // demoLogin() 的真实写路径：① 归属自愈（仅当 account.tenant_id ≠ 'demo'）② 超管查询 ③ 缺失才插
    const [acc] = await conn.query("SELECT id, tenant_id FROM t_sys_user WHERE username = 'demo' LIMIT 1");
    console.log(`登录路径第 1 步：account.tenant_id = ${acc[0].tenant_id} ⇒ 归属自愈${acc[0].tenant_id === "demo" ? "跳过" : "执行"}`);
    if (acc[0].tenant_id !== "demo") {
      await conn.query("UPDATE t_sys_user SET tenant_id = ?, updated_at = NOW() WHERE id = ?", ["demo", acc[0].id]);
      await conn.query("UPDATE t_sys_user_role SET tenant_id = ? WHERE user_id = ? AND tenant_id <> ?", ["demo", acc[0].id, "demo"]);
    }
    console.log(`登录路径第 2 步：执行超管查询 ${JSON.stringify(query)}`);
    const [roleRows] = await conn.query(query, params);
    const roleId = roleRows.length ? roleRows[0].id : null;
    const roleTenant = roleRows.length
      ? (await conn.query("SELECT tenant_id FROM t_sys_role WHERE id = ?", [roleId]))[0][0].tenant_id
      : null;
    console.log(`  -> 命中 role id=${roleId}（该角色行 tenant_id=${roleTenant}）`);
    if (roleId !== null) {
      const [ins] = await conn.query(insertSql, [acc[0].id, roleId, "demo", acc[0].id, roleId]);
      console.log(`登录路径第 3 步：缺失才插 affectedRows=${ins.affectedRows}（0 = 已有同 (user_id, role_id) 绑定，未新增）`);
    }
    const after = await showBindings(conn, "登录一次后");
    const abc1 = await assertABC(conn, "登录一次后");
    console.log(`计数：${JSON.stringify(await counts(conn))}`);
    console.log(
      `读数小结：B/C 在登录后 ${abc1.b && abc1.c ? "仍为 PASS（登录路径是「缺失才插」的追加式写入，不覆盖已修好的绑定）" : "变红"}；` +
        `跨租户绑定 ${after.cross.length} 条`
    );
    return { conn, after, abc0, abc1, roleId, roleTenant };
  };

  const rev = await runVariant("s3174f2_rev", unlimitedQuery, [], "反向②：去掉 DEMO_TENANT 限定");
  check(
    "反向②：去掉限定 ⇒ 超管查询命中 **default** 租户的角色行（③ 必须存在）",
    rev.roleTenant === "default",
    `role_id=${rev.roleId} role.Tenant=${rev.roleTenant}`
  );
  check(
    "反向②：登录一次后，该账号多出一条跨租户绑定（指向 default 的角色行）",
    rev.after.cross.length >= 1,
    `跨租户绑定 ${rev.after.cross.length} 条`
  );
  console.log("\n--- 反向② 后果：再跑一遍 197（凌舟装置的幂等断言正是「连跑两遍」）---");
  let rerunErr = null;
  try {
    for (const s of splitStatements(migration)) await rev.conn.query(s);
  } catch (e) {
    rerunErr = e;
  }
  if (rerunErr) {
    console.log(`  重跑 197 报错停下：code=${rerunErr.code} message=${String(rerunErr.message).slice(0, 160)}`);
  } else {
    console.log("  重跑 197 未报错");
  }
  check("反向② 后果：登录留下的跨租户绑定会让重跑 197 撞唯一键报错（红）", !!rerunErr, rerunErr ? `${rerunErr.code}` : "未报错");

  const fix = await runVariant("s3174f2_fix", fixedQuery, ["demo"], "对照组：限定 DEMO_TENANT（③ 已修）");
  check(
    "对照组：限定租户 ⇒ 超管查询命中 **demo** 租户的角色行",
    fix.roleTenant === "demo",
    `role_id=${fix.roleId} role.Tenant=${fix.roleTenant}`
  );
  check("对照组：登录后不新增任何跨租户绑定", fix.after.cross.length === 0, `跨租户绑定 ${fix.after.cross.length} 条`);
  let fixRerunErr = null;
  try {
    for (const s of splitStatements(migration)) await fix.conn.query(s);
  } catch (e) {
    fixRerunErr = e;
  }
  check("对照组：登录后重跑 197 不报错（幂等保持）", !fixRerunErr, fixRerunErr ? `${fixRerunErr.code}` : "无错误");
  await rev.conn.end();
  await fix.conn.end();
}

// ───────────────────────── mode: idem-rows ─────────────────────────
async function idemRows() {
  const conn = await buildDb("s3174f2_idem");
  const stmts = splitStatements(migration);
  const runOnce = async (round) => {
    const rows = [];
    for (const s of stmts) {
      const [res] = await conn.query(s);
      if (Array.isArray(res)) continue; // SELECT
      rows.push({ head: s.replace(/\s+/g, " ").slice(0, 46), affectedRows: res.affectedRows, changedRows: res.changedRows });
    }
    console.log(`--- 第 ${round} 遍：每条写语句 affectedRows / changedRows ---`);
    rows.forEach((r) => console.log(`  ${String(r.affectedRows).padStart(3)} / ${String(r.changedRows).padStart(3)}  ${r.head}`));
    return rows;
  };
  const r1 = await runOnce(1);
  console.log(`第 1 遍后计数：${JSON.stringify(await counts(conn))}`);
  const r2 = await runOnce(2);
  console.log(`第 2 遍后计数：${JSON.stringify(await counts(conn))}`);
  check("第二遍每条写语句 changedRows 全 0（零行变更）", r2.every((r) => r.changedRows === 0), JSON.stringify(r2.map((r) => r.changedRows)));
  check(
    "第 1 遍真实写入（不是恒 0 的空跑）：角色行克隆 2 行 / 绑定重指向 2 行 / 兜底补绑定 0 行",
    r1[1].affectedRows === 2 && r1[3].changedRows === 2 && r1[4].affectedRows === 0,
    JSON.stringify(r1.map((r) => `${r.affectedRows}/${r.changedRows}`))
  );
  const c = await counts(conn);
  check("demo 角色行 = default 角色行（2 = 2）", c.demo_role_rows === c.default_role_rows && c.demo_role_rows > 0, JSON.stringify(c));
  check("绑定无残留：演示账号绑定全在 demo（bind_out = 0）", c.bind_out === 0, JSON.stringify(c));
  await showBindings(conn, "幂等两遍后");
  await conn.end();
}

/** 只建库+夹具，供"官方执行载体"（scripts/run-migration.mjs）单独跑（库名由 S3174_DB 指定） */
async function seed() {
  const db = process.env.S3174_DB || "s3174f2_seed";
  const conn = await buildDb(db);
  const c = await counts(conn);
  console.log(`已建库 ${db}（生产同构 DDL + 夹具）：${JSON.stringify(c)}`);
  check("迁移前基线：demo 租户 0 行、demo 菜单 0 行、demo 角色行 0 行", c.menus_demo === 0 && c.demo_role_rows === 0, JSON.stringify(c));
  await conn.end();
}

/** 只读某库（不重建）的跑后读数：用于核对"官方执行载体 scripts/run-migration.mjs"的结果 */
async function state() {
  const db = process.env.S3174_DB || "s3174f2_runner";
  const conn = await mysql.createConnection({
    host: "127.0.0.1", port: 3307, user: "root", password: "", database: db, multipleStatements: true,
  });
  const c = await counts(conn);
  console.log(`库 ${db} 跑后读数：${JSON.stringify(c)}`);
  await assertABC(conn, "官方执行载体（scripts/run-migration.mjs）跑后 A/B/C");
  await showBindings(conn, "跑后");
  check("demo 角色行 > 0（角色行克隆生效）", c.demo_role_rows > 0, `demo_role_rows=${c.demo_role_rows}`);
  check("绑定全在 demo 且命中本租户角色（bind_out = 0）", c.bind_out === 0, JSON.stringify(c));
  await conn.end();
}

const modes = {
  "neg-role-clone": negRoleClone,
  "demo-login-limit": demoLoginLimit,
  "idem-rows": idemRows,
  "source-shape": sourceShape,
  seed,
  state,
};
if (!modes[mode]) {
  console.log(`用法：node ${HERE}\\s3174-f2-reverse.mjs <${Object.keys(modes).join("|")}>`);
  process.exit(2);
}
await modes[mode]();
const failed = results.filter((x) => !x).length;
console.log(`\n小结（本装置自身断言）：${results.length - failed} passed / ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
