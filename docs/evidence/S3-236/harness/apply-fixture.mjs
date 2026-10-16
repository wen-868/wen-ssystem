#!/usr/bin/env node
/**
 * S3-236 真库夹具装置：把 `harness/fixture-before-207.sql` 喂进夹具库，并打印**前置/后置读数**。
 *
 * 用法（仓库根执行，需 `.env` 指向夹具库；本文件**不打印任何连接凭据**）：
 *   node docs/evidence/S3-236/harness/apply-fixture.mjs [before|readings|reset-codes]
 *     before        —— 建最小形状 + 两个租户的 4 个父行 + 2 个角色（跑 207 之前）
 *     readings      —— 只读读数（38 码命中 / 重复行 / 角色授权命中）
 *     reset-codes   —— 只删本批 38 码的菜单行（复位用，明确 WHERE）
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(resolve(process.cwd(), "package.json"));
const mysql = require("mysql2/promise");

/** 读 .env（与 scripts/run-migration.mjs 同口径；不打印值） */
const envPath = resolve(process.cwd(), ".env");
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

const mode = process.argv[2] ?? "before";
const conn = await mysql.createConnection({
  host: env.DB_HOST ?? "127.0.0.1",
  port: Number(env.DB_PORT ?? 3306),
  user: env.DB_USER ?? "root",
  password: env.DB_PASSWORD ?? "",
  database: env.DB_NAME ?? "liquor_inventory",
  multipleStatements: true,
  connectTimeout: 10000,
});

try {
  if (mode === "before") {
    const sql = readFileSync(
      resolve(process.cwd(), "docs/evidence/S3-236/harness/fixture-before-207.sql"),
      "utf-8",
    );
    const [results] = await conn.query(sql);
    const sets = Array.isArray(results) ? results : [results];
    const last = sets[sets.length - 1];
    if (Array.isArray(last) && last[0]) console.log(last[0].result ?? JSON.stringify(last[0]));
    console.log("夹具已就位");
  } else if (mode === "reset-codes") {
    const [res] = await conn.query(
      `DELETE FROM t_sys_menu WHERE menu_code IN (
         'report:custom:create','report:custom:edit','report:custom:delete','report:custom:generate',
         'report:schedule:create','report:schedule:edit','report:schedule:delete','report:schedule:toggle',
         'report:schedule:run','report:permission:edit','report:export',
         'system:print-record:create','system:print-record:reprint','system:print-template:create',
         'system:print-template:edit','system:print-template:delete','system:print-template:reset',
         'system:print-template:set-default','store:hardware:config-edit','store:hardware:config-test',
         'store:hardware:announce','store:hardware:box-pay','store:hardware:box-config-edit',
         'store:hardware:box-config-test','store:hardware:unionpay-test',
         'miniapp:config:edit','miniapp:package:upload-key','miniapp:package:build','miniapp:package:publish',
         'miniapp:order-sync:retry','dashboard:todo:create','dashboard:todo:complete','dashboard:todo:dismiss',
         'dashboard:todo:delete','dashboard:quick-entry:create','dashboard:quick-entry:sort',
         'dashboard:quick-entry:edit','dashboard:quick-entry:delete')`,
    );
    console.log(`已删除本批 38 码的菜单行：affectedRows=${res.affectedRows}`);
  } else {
    const [rows] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM t_sys_menu WHERE menu_code IN (
            'report:custom:create','report:custom:edit','report:custom:delete','report:custom:generate',
            'report:schedule:create','report:schedule:edit','report:schedule:delete','report:schedule:toggle',
            'report:schedule:run','report:permission:edit','report:export',
            'system:print-record:create','system:print-record:reprint','system:print-template:create',
            'system:print-template:edit','system:print-template:delete','system:print-template:reset',
            'system:print-template:set-default','store:hardware:config-edit','store:hardware:config-test',
            'store:hardware:announce','store:hardware:box-pay','store:hardware:box-config-edit',
            'store:hardware:box-config-test','store:hardware:unionpay-test',
            'miniapp:config:edit','miniapp:package:upload-key','miniapp:package:build','miniapp:package:publish',
            'miniapp:order-sync:retry','dashboard:todo:create','dashboard:todo:complete','dashboard:todo:dismiss',
            'dashboard:todo:delete','dashboard:quick-entry:create','dashboard:quick-entry:sort',
            'dashboard:quick-entry:edit','dashboard:quick-entry:delete')) AS total_38codes,
         (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'default' AND menu_code LIKE 'report:%') AS default_report,
         (SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id = 'demo' AND menu_code LIKE 'report:%') AS demo_report,
         (SELECT COUNT(*) FROM (
            SELECT menu_code, tenant_id FROM t_sys_menu GROUP BY menu_code, tenant_id HAVING COUNT(*) > 1
          ) dup) AS duplicate_pairs,
         (SELECT COUNT(*) FROM t_sys_menu WHERE parent_id IS NULL) AS orphans_suspect_parents,
         (SELECT COUNT(*) FROM t_sys_menu b WHERE b.menu_type = 'BUTTON'
            AND b.menu_code IN (SELECT menu_code FROM t_sys_menu)) AS button_rows,
         (SELECT COUNT(*) FROM t_sys_role
            WHERE permissions IS NOT NULL AND JSON_VALID(permissions) = 1
              AND JSON_OVERLAPS(permissions, CAST('["report:custom:create","report:custom:edit","report:custom:delete","report:custom:generate","report:schedule:create","report:schedule:edit","report:schedule:delete","report:schedule:toggle","report:schedule:run","report:permission:edit","report:export","system:print-record:create","system:print-record:reprint","system:print-template:create","system:print-template:edit","system:print-template:delete","system:print-template:reset","system:print-template:set-default","store:hardware:config-edit","store:hardware:config-test","store:hardware:announce","store:hardware:box-pay","store:hardware:box-config-edit","store:hardware:box-config-test","store:hardware:unionpay-test","miniapp:config:edit","miniapp:package:upload-key","miniapp:package:build","miniapp:package:publish","miniapp:order-sync:retry","dashboard:todo:create","dashboard:todo:complete","dashboard:todo:dismiss","dashboard:todo:delete","dashboard:quick-entry:create","dashboard:quick-entry:sort","dashboard:quick-entry:edit","dashboard:quick-entry:delete"]' AS JSON)) = 1) AS roles_holding_new_codes`,
      );
    console.log(JSON.stringify(rows[0], null, 2));
  }
} finally {
  await conn.end();
}
