/**
 * S3-144 运行期端到端装置（私有一次性 MariaDB，真实库真跑）
 *
 * 目标：在打上 S3-144 补丁的代码上，跑通「带邀请码注册 → 审批通过 → 归因 +1 且 t_tenant.source 合规」，
 * 并给出 A 项（createTenant）与反测（400 / 409 / 旧实现失败）的真实读数。
 *
 * 用法（cwd 必须是打补丁后的 scratch 树根，S3144_SCRATCH 指向该目录）：
 *   node <scratch>/s3144-e2e.mjs
 * 环境：DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME/JWT_SECRET/NODE_ENV=production
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import mysql from "mysql2/promise";

const root = process.env.S3144_SCRATCH;
if (!root) {
  console.error("缺少 S3144_SCRATCH（指向 scratch 树根）");
  process.exit(2);
}
// fresh：只跑"全新库（仅 migration.ts 口径）"能覆盖的 A 项与反测；full：再加邀请码注册→审批→归因端到端
const fullMode = (process.env.S3144_MODE || "full") === "full";
const mod = (rel) => pathToFileURL(join(root, "backend", "dist", rel)).href;

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name} | ${detail}`);
}

const pool = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: false,
});

try {
  // ---------- 0) 全新库跑全量迁移 ----------
  const { runMigrations } = await import(mod("shared/migration.js"));
  await runMigrations();
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant'
        AND COLUMN_NAME IN ('tenant_code','company_name','contact_person','source')`
  );
  check(
    "迁移 192：全新库 t_tenant 补齐缺列",
    cols.length === 4,
    `命中列 = ${cols.map((c) => c.COLUMN_NAME).sort().join(",")}`
  );
  const [appCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 't_tenant_register_application'
        AND COLUMN_NAME IN ('promo_code','agent_id')`
  );
  check(
    "迁移 192：t_tenant_register_application 增 promo_code/agent_id",
    appCols.length === 2,
    `命中列 = ${appCols.map((c) => c.COLUMN_NAME).sort().join(",")}`
  );

  // ---------- 1) 反测：原实现 INSERT 在真实库上必然失败（id VARCHAR(36) 主键无默认值 ⇒ 1364） ----------
  try {
    await pool.query(
      `INSERT INTO t_tenant (tenant_name, contact_name, contact_mobile, contact_email, status, expire_at)
       VALUES ('旧实现租户', '张三', '13900000009', '', 'ACTIVE', NULL)`
    );
    check("反测：原实现 INSERT 应失败", false, "未报错（原缺陷未被复现）");
  } catch (e) {
    check("反测：原实现 INSERT 复现失败", true, `${e.code} ${e.message}`);
  }

  // ---------- 2) 反证：VARCHAR 主键下 MySQL 的 insertId 恒为 0（原实现取 id 的根因） ----------
  const probeId = "11111111-2222-3333-4444-555555555555";
  await pool.query("DELETE FROM t_tenant WHERE id = ?", [probeId]);
  const [probe] = await pool.query("INSERT INTO t_tenant (id, name) VALUES (?, 'insertId 探针')", [probeId]);
  check("反证：VARCHAR 主键 INSERT 的 insertId 恒为 0", Number(probe.insertId) === 0, `insertId=${probe.insertId}`);
  await pool.query("DELETE FROM t_tenant WHERE id = ?", [probeId]);

  // ---------- 3) 归因要求：平台侧开租户不是归因宿主（source=MANUAL，无归因行） ----------
  const { createTenant } = await import(mod("services/platform-tenant.service.js"));
  const tenantId2 = await createTenant({
    tenantName: "S3144 平台建租户",
    contactName: "李四",
    contactMobile: "13900000002",
    adminUsername: "s3144padmin",
    adminPassword: "Pass@1234",
  });
  check(
    "A 项：createTenant 返回真实 UUID（非 0）",
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tenantId2),
    `tenantId=${tenantId2}`
  );
  const [row2] = await pool.query("SELECT id, tenant_code, name, company_name, source, status FROM t_tenant WHERE id = ?", [tenantId2]);
  check(
    "A 项：建租户落库（tenant_code 非空 / source=MANUAL / status=1）",
    row2.length === 1 && !!row2[0].tenant_code && row2[0].source === "MANUAL" && Number(row2[0].status) === 1,
    JSON.stringify(row2[0])
  );
  const [attr2] = await pool.query("SELECT COUNT(*) AS c FROM t_tenant_attribution WHERE tenant_id = ?", [tenantId2]);
  check("A 项：平台侧开租户不写归因", Number(attr2[0].c) === 0, `attribution rows=${attr2[0].c}`);

  // ---------- 4) A 项反测：控制器缺必填 ⇒ 400（不是 1364 / 脏写） ----------
  const controller = await import(mod("controllers/platform/tenant.controller.js"));
  let statusCode = null;
  let body = null;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { body = b; return this; },
  };
  await controller.createPlatformTenant({ body: { tenantName: "缺字段租户" } }, res);
  check(
    "A 项反测：缺必填 ⇒ 400 且不落库",
    statusCode === 400 && body?.code === "400",
    `status=${statusCode} body=${JSON.stringify(body)}`
  );

  if (fullMode) {
  // ---------- 5) 种子：一张有效推广码（码值 PCABCDEFGH） ----------
  await pool.query("DELETE FROM t_promo_code WHERE promo_code = ?", ["PCABCDEFGH"]);
  const [promoIns] = await pool.query(
    `INSERT INTO t_promo_code (promo_code, channel_type, channel_name, status)
     VALUES ('PCABCDEFGH', '地推', 'S3144 测试渠道', 'ACTIVE')`
  );
  const promoId = Number(promoIns.insertId);

  // ---------- 6) 端到端：带邀请码注册 → 审批通过 → 归因 +1 且 source 合规 ----------
  const { applyTenantRegister, approveTenantApplication } = await import(mod("services/tenant-register.service.js"));
  const before = await pool.query("SELECT COUNT(*) AS c FROM t_tenant_attribution");
  const apply = await applyTenantRegister({
    company_name: "S3144 邀请码注册公司",
    contact_person: "王五",
    contact_mobile: "13900000001",
    admin_username: "s3144invited",
    admin_password: "Pass@1234",
    admin_real_name: "王五",
    promo_code: "PCABCDEFGH",
  });
  check("B 项：带邀请码注册申请落库", Number(apply.applicationId) > 0, `applicationId=${apply.applicationId}`);

  const approved = await approveTenantApplication(apply.applicationId, 1);
  check("B 项：审批通过返回真实 tenant_id（UUID）", !!approved.tenantId && approved.tenantId !== "default", `tenantId=${approved.tenantId}`);

  const [tenantRows] = await pool.query(
    "SELECT id, tenant_code, name, company_name, contact_person, contact_mobile, source FROM t_tenant WHERE id = ?",
    [approved.tenantId]
  );
  check(
    "B 项：t_tenant.source 合规（既有三取值之一，邀请码 ⇒ INVITATION）",
    tenantRows.length === 1 && ["MANUAL", "SELF_REGISTER", "INVITATION"].includes(tenantRows[0].source) && tenantRows[0].source === "INVITATION",
    JSON.stringify(tenantRows[0])
  );
  check(
    "B 项：联系人/手机号落库未串位（原实现把 contact_person/contact_mobile 传反）",
    tenantRows.length === 1 && tenantRows[0].contact_person === "王五" && tenantRows[0].contact_mobile === "13900000001",
    `contact_person=${tenantRows[0]?.contact_person} contact_mobile=${tenantRows[0]?.contact_mobile}`
  );

  const after = await pool.query("SELECT COUNT(*) AS c FROM t_tenant_attribution");
  const [attrRows] = await pool.query(
    "SELECT tenant_id, promo_code_id, agent_id, attribution_type, attributed_at FROM t_tenant_attribution WHERE tenant_id = ?",
    [approved.tenantId]
  );
  check(
    "D 项：归因 +1（t_tenant_attribution 新增 1 行且指向该租户）",
    Number(after[0][0].c) === Number(before[0][0].c) + 1 && attrRows.length === 1 && Number(attrRows[0].promo_code_id) === promoId,
    `${JSON.stringify(attrRows[0])}；总数 ${before[0][0].c} → ${after[0][0].c}`
  );

  // ---------- 7) 反测：邀请码不存在 ⇒ 400 且不建租户（不产生半成品） ----------
  const beforeTenants = await pool.query("SELECT COUNT(*) AS c FROM t_tenant");
  const badApply = await applyTenantRegister({
    company_name: "S3144 坏码公司",
    contact_person: "赵六",
    contact_mobile: "13900000003",
    admin_username: "s3144bad",
    admin_password: "Pass@1234",
    admin_real_name: "赵六",
    promo_code: "PCNOTEXIST",
  });
  let badErr = null;
  try {
    await approveTenantApplication(badApply.applicationId, 1);
  } catch (e) {
    badErr = e;
  }
  const afterTenants = await pool.query("SELECT COUNT(*) AS c FROM t_tenant");
  check(
    "反测：坏邀请码 ⇒ 400 且不建租户",
    !!badErr && Number(badErr.statusCode) === 400 && Number(afterTenants[0][0].c) === Number(beforeTenants[0][0].c),
    `err=${badErr?.message}；租户数 ${beforeTenants[0][0].c} → ${afterTenants[0][0].c}`
  );

  // ---------- 8) 幂等：同租户二次归因 ⇒ 409（唯一写入口） ----------
  const { writeTenantAttribution } = await import(mod("services/platform/platform-tenant-attribution.service.js"));
  let dupErr = null;
  try {
    await writeTenantAttribution({
      tenantId: approved.tenantId,
      attributionType: "PROMO",
      promoCodeId: promoId,
      agentId: null,
    });
  } catch (e) {
    dupErr = e;
  }
  check(
    "D 项反测：一租户一条归因，二次写 ⇒ 409 + 明确文案",
    !!dupErr && Number(dupErr.statusCode) === 409 && String(dupErr.message).includes("已存在归因记录"),
    `err=${dupErr?.message}`
  );
  }
} finally {
  await pool.end().catch(() => {});
}

const failed = checks.filter((c) => !c.ok);
console.log(`\nS3144_E2E_SUMMARY total=${checks.length} passed=${checks.length - failed.length} failed=${failed.length}`);
process.exit(failed.length === 0 ? 0 : 1);
