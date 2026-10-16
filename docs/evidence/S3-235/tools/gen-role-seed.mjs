#!/usr/bin/env node
/**
 * S3-235 工具：程序化生成 `docs/migrations/205_角色权限种子.sql`
 *
 * 为什么必须程序化生成（不许手抄）：
 *   唯一数据源是生产只读底稿 `docs/evidence/_shared/prod-roles-20261016.txt` §一
 *   （12 个商家角色 × 权限码）。12 条 JSON 串手抄必然出错，且日后无法复核"生成物 = 底稿"。
 *   `--check` 模式用于证明"当前 205 文件逐字节等于由底稿重新生成的结果"（可复跑证据）。
 *
 * 生成物的语义（非破坏 + 幂等）：
 *   ① 角色行缺失 ⇒ 按底稿插入（角色名/权限串取底稿；description/data_scope 见下）；
 *   ② 角色行存在但 permissions 为 NULL / 非法 JSON / JSON null / 空数组 ⇒ 补写底稿权限串；
 *   ③ 角色行存在且 permissions 非空 ⇒ **本单一条写语句都不命中**（不覆盖线上调整）；
 *   ④ 全程只增不减：不删除任何既有权限码，不改 role_name / status / data_scope。
 *
 * description / data_scope 的来源（不臆造，逐条给出处）：
 *   · 10 个角色沿用仓库既有语料 `docs/migrations/128_fix_roles_binding.sql`（避免两处口径分叉）；
 *   · `SALESMAN` / `STORE_ADMIN` 沿用 `docs/migrations/099_seed_data.sql:37/38`。
 *   底稿 §一 只给"角色码 + 角色名 + 权限串"，故除这三项外一律按上述既有语料取值，不自行发明。
 *
 * 用法（仓库根执行）：
 *   node docs/evidence/S3-235/tools/gen-role-seed.mjs           # 生成/覆盖 205
 *   node docs/evidence/S3-235/tools/gen-role-seed.mjs --check   # 只比对不写文件（不一致 exit 1）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const DRAFT = resolve(ROOT, "docs/evidence/_shared/prod-roles-20261016.txt");
const OUT = resolve(ROOT, "docs/migrations/205_角色权限种子.sql");
const CHECK = process.argv.includes("--check");

/** description / data_scope 的既有语料取值（出处见文件头注释） */
const ROLE_META = {
  SUPER_ADMIN: { scope: "ALL", desc: "拥有系统全部权限，可管理所有租户和门店" },
  OPERATION_ADMIN: { scope: "ALL", desc: "平台运营管理（001 角色，代码 ADMIN_ROLES 引用）" },
  STORE_MANAGER: { scope: "STORE", desc: "管理本门店的销售、库存、客户、员工" },
  STORE_OPERATOR: { scope: "STORE", desc: "门店日常开单与库存查询" },
  SALES_STAFF: { scope: "SELF", desc: "负责线下销售开单、客户管理、客户拜访" },
  PURCHASE_STAFF: { scope: "SELF", desc: "负责采购订单、供应商管理、采购入库" },
  WAREHOUSE_STAFF: { scope: "STORE", desc: "负责库存管理、出入库、盘点、调拨" },
  FINANCE_STAFF: { scope: "ALL", desc: "负责收款、付款、对账、财务报表" },
  CUSTOMER_SERVICE: { scope: "STORE", desc: "负责客户服务、售后处理、小程序订单" },
  READONLY: { scope: "ALL", desc: "仅查看权限，不可编辑任何数据" },
  SALESMAN: { scope: "SELF", desc: "销售相关权限，可管理订单和客户（旧码体系角色）" },
  STORE_ADMIN: { scope: "STORE", desc: "门店管理权限，可查看商品、管理订单和库存（旧码体系角色）" },
};

/** 从底稿 §一 的代码块解析"角色码 / 角色名 / 权限码数组" */
function parseDraft(text) {
  const start = text.indexOf("## 一、");
  if (start < 0) throw new Error("底稿缺少 §一 段落（生产只读底稿第 10 行）");
  const fenceStart = text.indexOf("```", start);
  if (fenceStart < 0) throw new Error("底稿缺少 §一 代码块起始围栏");
  const fenceEnd = text.indexOf("```", fenceStart + 3);
  if (fenceEnd < 0) throw new Error("底稿缺少 §一 代码块结束围栏");
  const block = text.slice(fenceStart + 3, fenceEnd);

  const roles = [];
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("\t").map((s) => s.trim());
    if (parts.length !== 3) throw new Error(`底稿行不是"制表符三列"：${line}`);
    const [code, name, jsonText] = parts;
    let codes;
    try {
      codes = JSON.parse(jsonText);
    } catch (e) {
      throw new Error(`底稿权限串不是合法 JSON（${code}）：${jsonText}`);
    }
    if (!Array.isArray(codes) || codes.some((c) => typeof c !== "string")) {
      throw new Error(`底稿权限串不是字符串数组（${code}）：${jsonText}`);
    }
    if (!ROLE_META[code]) throw new Error(`角色 ${code} 缺少 description/data_scope 出处映射`);
    roles.push({ code, name, codes });
  }
  if (roles.length !== 12) throw new Error(`底稿角色数 = ${roles.length}，期望 12`);
  return roles;
}

/** JSON 数组 → SQL 单引号字符串里的 JSON 文本（双引号不转义；角色名不含单引号） */
function jsonLiteral(codes) {
  return JSON.stringify(codes);
}

function buildSql(roles, draftHash) {
  const parts = [];
  parts.push(
    "-- ============================================",
    "-- 迁移编号：205",
    "-- 单号：S3-235（收口总清单第 72 项：权限种子落库）",
    "-- 描述：把生产底稿 §一（12 个商家角色 × 权限码）落成「新库/灾备库可用」的幂等、非破坏种子",
    "-- 执行方：阿坚（后端 / 权限）｜依据卡：docs/tasks/inbox/ACTIVE-S3-235.md｜日期：2026-10-16",
    "-- ============================================",
    "--",
    "-- 一、语义（硬要求，逐条可复跑核对）",
    "--   ① 角色行缺失 ⇒ 按底稿插入；",
    "--   ② 行存在但 permissions 为 NULL / 非法 JSON / JSON null / 空数组 ⇒ 补写底稿权限串；",
    "--   ③ 行存在且 permissions 非空 ⇒ 本文件一条写语句都不命中（不覆盖线上调整、不删任何码）；",
    "--   ④ 只作用于 tenant_id='default'（底稿 §一 的口径）；其它租户的角色派生由 197/198 负责，不在本单范围。",
    "--",
    "-- 二、数据源与生成方式",
    "--   底稿：docs/evidence/_shared/prod-roles-20261016.txt §一（12 行，制表符三列）",
    `--   底稿 sha256：${draftHash}`,
    "--   生成器：node docs/evidence/S3-235/tools/gen-role-seed.mjs（--check 可证明本文件逐字节等于重新生成的结果）",
    "--   description / data_scope：10 个角色取 128_fix_roles_binding.sql，SALESMAN / STORE_ADMIN 取 099_seed_data.sql:37/38（不臆造）",
    "--",
    "-- 三、怎么跑（两种通道）",
    "--   ① 部署/启动链（本项目后端启动时按文件名顺序执行 docs/migrations/*.sql）——**注意写闸门**：",
    "--      默认 MIGRATION_WRITE_GATE=block 会跳过本文件全部 INSERT/UPDATE ⇒ 新库/灾备库仍无权限。",
    "--      灾备/新库重建必须显式放行：MIGRATION_WRITE_GATE=allow（另见本单回传卡「风险与自我报备」）。",
    "--   ② 单独补跑：node scripts/run-migration.mjs docs/migrations/205_角色权限种子.sql（该脚本无写闸门）",
    "--",
    "-- 四、幂等证据形态：连跑两遍，第二遍全部语句 affectedRows=0 / changedRows=0（见 docs/evidence/S3-235/README.md）",
    "--",
    ""
  );

  for (const role of roles) {
    const meta = ROLE_META[role.code];
    const json = jsonLiteral(role.codes).replace(/'/g, "''");
    parts.push(
      `-- ${role.code}（${role.name}）· 底稿权限码 ${role.codes.length} 个`,
      "INSERT INTO t_sys_role (role_code, role_name, description, data_scope, permissions, status, tenant_id)",
      `SELECT '${role.code}', '${role.name}', '${meta.desc}', '${meta.scope}', CAST('${json}' AS JSON), 'ACTIVE', 'default'`,
      `WHERE NOT EXISTS (SELECT 1 FROM t_sys_role WHERE role_code = '${role.code}' AND tenant_id = 'default');`,
      "",
      "UPDATE t_sys_role",
      `SET permissions = CAST('${json}' AS JSON)`,
      `WHERE role_code = '${role.code}' AND tenant_id = 'default'`,
      "  AND (permissions IS NULL",
      "       OR JSON_VALID(permissions) = 0",
      "       OR JSON_TYPE(permissions) = 'NULL'",
      "       OR JSON_LENGTH(permissions) = 0);",
      ""
    );
  }

  const codeList = roles.map((r) => `'${r.code}'`).join(", ");
  parts.push(
    "-- ============================================",
    "-- 五、跑完自报家门：12 个底稿角色里 permissions 非空的行数（期望 12）+ 空/缺失清单",
    "-- ============================================",
    "SELECT CONCAT(",
    "  '205 核对：底稿 12 角色 permissions 非空 = ',",
    "  (SELECT COUNT(*) FROM t_sys_role WHERE tenant_id = 'default'",
    `     AND role_code IN (${codeList})`,
    "     AND permissions IS NOT NULL AND JSON_VALID(permissions) = 1",
    "     AND JSON_TYPE(permissions) <> 'NULL' AND JSON_LENGTH(permissions) > 0),",
    "  ' / 12；缺失或空权限的角色 = ', IFNULL((",
    "    SELECT GROUP_CONCAT(role_code ORDER BY role_code) FROM t_sys_role WHERE tenant_id = 'default'",
    `      AND role_code IN (${codeList})`,
    "      AND (permissions IS NULL OR JSON_VALID(permissions) = 0 OR JSON_TYPE(permissions) = 'NULL' OR JSON_LENGTH(permissions) = 0)",
    "  ), '无')",
    ") AS result;",
    ""
  );
  return parts.join("\n");
}

const draftText = readFileSync(DRAFT, "utf-8");
const draftHash = createHash("sha256").update(draftText).digest("hex");
const roles = parseDraft(draftText);
const sql = buildSql(roles, draftHash);

if (CHECK) {
  const current = readFileSync(OUT, "utf-8");
  const same = current === sql;
  console.log(`底稿 sha256 = ${draftHash}`);
  console.log(`角色数 = ${roles.length}；生成物字符数 = ${sql.length}；现有文件字符数 = ${current.length}`);
  console.log(same ? "判定：现有 205 文件与重新生成的结果逐字节一致（生成式可复跑）" : "判定：不一致（现有文件已被手改或底稿已变）");
  process.exit(same ? 0 : 1);
}

writeFileSync(OUT, sql, "utf-8");
console.log(`已生成 ${OUT}`);
console.log(`底稿 sha256 = ${draftHash}`);
console.log(`角色数 = ${roles.length}；写语句 = ${roles.length * 2} 条（INSERT 12 + UPDATE 12）+ 1 条核对 SELECT`);
