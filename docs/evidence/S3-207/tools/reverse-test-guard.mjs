/**
 * S3-207 门禁反测（可复跑）：证明 `guard-tenant-injection.mjs` **会红**，而且红在该红的地方。
 *
 * 为什么要有这个脚本（门禁铁律）："步骤是 success" 不等于"它能失败"——必须故意造出该门禁应当捕获的失败、
 * 断言它 failure，再复原断言它 success。本脚本把这件事做成**离线夹具**（不动产品源码）：
 *   夹具 1：合规 SQL（显式 `tenant_id = ?`）⇒ 期望 EXIT=0
 *   夹具 2：违规 SQL（`JOIN … AND a.tenant_id = b.tenant_id`，WHERE 无值谓词）⇒ 期望 EXIT=1 且点名该文件
 *   夹具 3：带显式标记但未登记 ⇒ 期望 EXIT=1（标记不能随手撒）
 *   夹具 4：复原成合规 ⇒ 期望 EXIT=0
 *
 * 用法：node docs/evidence/S3-207/tools/reverse-test-guard.mjs
 * 退出码：0 = 四夹具全部符合预期
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// tools → S3-207 → evidence → docs → 仓库根
const REPO = resolve(HERE, "..", "..", "..", "..");
const GUARD = join(REPO, "backend", "scripts", "guard-tenant-injection.mjs");

const GOOD = [
  'import { queryWithTenant } from "../shared/db";',
  "export async function listBills(tenantId: string, storeId: number) {",
  "  return queryWithTenant(",
  "    `SELECT sb.bill_no AS billNo FROM t_sale_bill sb",
  "     JOIN t_store s ON s.id = sb.store_id AND s.tenant_id = sb.tenant_id",
  "     WHERE sb.tenant_id = ? AND sb.store_id = ?`,",
  "    [tenantId, storeId],",
  "    tenantId",
  "  );",
  "}",
  "",
].join("\n");

const BAD = [
  'import { queryWithTenant } from "../shared/db";',
  "export async function listBills(tenantId: string, storeId: number) {",
  "  return queryWithTenant(",
  "    `SELECT sb.bill_no AS billNo FROM t_sale_bill sb",
  "     JOIN t_store s ON s.id = sb.store_id AND s.tenant_id = sb.tenant_id",
  "     WHERE sb.store_id = ?`,",
  "    [storeId],",
  "    tenantId",
  "  );",
  "}",
  "",
].join("\n");

const MARKER_UNREGISTERED = [
  'import { queryWithTenant } from "../shared/db";',
  "export async function listAll(tenantId: string) {",
  "  return queryWithTenant(",
  "    \"SELECT DISTINCT tenant_id FROM t_sale_bill WHERE business_status = 'CREATED' /* tenant-scope:platform */\",",
  "    [],",
  "    tenantId",
  "  );",
  "}",
  "",
].join("\n");

const results = [];
function run(root) {
  try {
    const out = execFileSync(process.execPath, [GUARD, root], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  :: ${JSON.stringify(detail)}`}`);
  if (!ok) console.log(`  --- 门禁原始输出（便于定位） ---\n${String(detail?.out || "").split("\n").slice(0, 25).join("\n")}`);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "s3207-fixture-"));
try {
  const srcDir = join(fixtureRoot, "backend", "src", "services");
  mkdirSync(srcDir, { recursive: true });
  const target = join(srcDir, "fixture.service.ts");

  writeFileSync(target, GOOD, "utf8");
  const okRun = run(fixtureRoot);
  check("夹具1 合规 SQL ⇒ 门禁 EXIT=0（不误伤）", okRun.code === 0, { code: okRun.code, out: okRun.out });

  writeFileSync(target, BAD, "utf8");
  const badRun = run(fixtureRoot);
  check(
    "夹具2 违规 SQL（JOIN 列对列、WHERE 无值谓词）⇒ 门禁 EXIT=1 且点名 fixture.service.ts",
    badRun.code === 1 && badRun.out.includes("fixture.service.ts"),
    { code: badRun.code, 命中: /RED 阻塞项[\s\S]*fixture\.service\.ts/.test(badRun.out), out: badRun.out }
  );

  writeFileSync(target, MARKER_UNREGISTERED, "utf8");
  const markerRun = run(fixtureRoot);
  check(
    "夹具3 未登记的显式标记 ⇒ 门禁 EXIT=1",
    markerRun.code === 1 && markerRun.out.includes("未登记的显式标记"),
    { code: markerRun.code, out: markerRun.out }
  );

  writeFileSync(target, GOOD, "utf8");
  const restoreRun = run(fixtureRoot);
  check("夹具4 复原合规 ⇒ 门禁 EXIT=0", restoreRun.code === 0, { code: restoreRun.code, out: restoreRun.out });
} finally {
  // 只删本脚本自己 mkdtemp 出来的目录（校验前缀后再删，防误删）
  if (fixtureRoot.startsWith(tmpdir()) && fixtureRoot.includes("s3207-fixture-")) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n==== 反测结束：PASS ${results.length - failed} / FAIL ${failed} ====`);
process.exit(failed === 0 ? 0 : 1);
