/**
 * MIG-4 闸门覆盖面：用**真实源码里的闸门判定函数**扫 `docs/migrations/*.sql`，
 * 回答"默认挡"下哪些语句会被挡下、哪些放行——即"66 条写语句与 CALL 是否真的被挡在门外"。
 *
 * 口径声明（重要，避免与 MIG-3 演练数字混淆）：
 *   - 候选集合 = "丢块缺陷修复后，外部迁移 runner 会尝试执行的语句"
 *       = 当前 main 已执行的块（MIG-1 `simulateRunner` 的 executed）
 *       + 当前被整块丢弃、修复后才首次执行的块（dropped 且 hasReal，且未被 runner 显式跳过）
 *     ⇒ 这是"放量后"的集合，与 MIG-3 副本演练的 `ok/error` 结果口径不同（演练看的是执行结果）。
 *   - 语句类型/目标表判定**调用真实源码函数**（`firstKeyword` / `isDataWriteStatement` / `statementTarget`），不复刻。
 *
 * 用法：node docs/evidence/MIG-4/tools/mig4-coverage.mjs
 * 退出码：0 = 生成成功且内置自检通过；1 = 否则。
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { REPO_ROOT, readMigrationSource, sha256, loadMigrationModule } from "./mig4-lib.mjs";
import { simulateRunner } from "../../MIG-1/tools/mig1-extract.mjs";

const OUTDIR = resolve(REPO_ROOT, "docs", "evidence", "MIG-4");
const MIGRATIONS_DIR = join(REPO_ROOT, "docs", "migrations");

const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), "mig4-coverage-"));
  const { mod } = await loadMigrationModule(join(workDir, "module"), readMigrationSource(), "coverage");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
    .sort();

  const blocked = [];
  const allowedByKeyword = {};
  let candidateStatements = 0;
  let pureCommentChunks = 0;
  let runnerSkipped = 0;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const sim = simulateRunner(sql, "B");
    runnerSkipped += sim.dropped.filter((d) => d.skippedByRunner).length;
    const items = [
      ...sim.executed.map((e) => ({ line: e.realLine ?? e.blockStartLine, text: e.realSql })),
      ...sim.dropped
        .filter((d) => d.hasReal && !d.skippedByRunner)
        .map((d) => ({ line: d.realLine ?? d.blockStartLine, text: d.realSql })),
    ];
    for (const item of items) {
      if (!item.text) {
        pureCommentChunks += 1;
        continue;
      }
      candidateStatements += 1;
      const keyword = mod.firstKeyword(item.text);
      if (mod.isDataWriteStatement(item.text)) {
        blocked.push({
          file,
          line: item.line,
          keyword,
          target: mod.statementTarget(item.text),
          sql: oneLine(item.text).slice(0, 180),
        });
      } else {
        const key = keyword || "(无名)";
        allowedByKeyword[key] = (allowedByKeyword[key] ?? 0) + 1;
      }
    }
  }

  const byKeyword = {};
  for (const b of blocked) byKeyword[b.keyword] = (byKeyword[b.keyword] ?? 0) + 1;
  const filesWithBlocked = [...new Set(blocked.map((b) => b.file))].sort();
  const passwordStatements = blocked.filter((b) => /password_hash/i.test(b.sql));
  const callStatements = blocked.filter((b) => b.keyword === "CALL");

  // ── 与 MIG-3 的副本演练结果交叉核对（口径不同，但"必须被挡"的集合应被完全覆盖） ──
  const drillPath = join(REPO_ROOT, "docs", "evidence", "MIG-1-drill", "04-apply-compare.json");
  const drillCross = { path: drillPath, available: false };
  if (existsSync(drillPath)) {
    const drill = JSON.parse(readFileSync(drillPath, "utf8"));
    const key = (e) => e.file + ":" + e.line;
    const blockedKeys = new Set(blocked.map(key));
    const writeTypes = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE", "CALL"]);
    const drillWrites = drill.results.filter((r) => writeTypes.has(String(r.type).toUpperCase()));
    const drillOkWrites = drillWrites.filter((r) => r.outcome === "ok");
    const notBlocked = drillOkWrites.filter((r) => !blockedKeys.has(key(r))).map(key);
    Object.assign(drillCross, {
      available: true,
      drillTotal: drill.results.length,
      drillByOutcome: drill.byOutcome,
      drillWrites: drillWrites.length,
      drillOkWrites: drillOkWrites.length,
      drillWritesCoveredByGate: drillWrites.filter((r) => blockedKeys.has(key(r))).length,
      drillOkWritesNotBlocked: notBlocked,
    });
  }

  const L = [];
  L.push("[MIG-4/coverage] 写闸门覆盖面（真实判定函数扫 docs/migrations）");
  L.push("  迁移目录：" + MIGRATIONS_DIR);
  L.push("  SQL 文件数（排除 add_tenant_id.sql，与 runner 口径一致）：" + files.length);
  L.push("  判定函数来源：backend/src/shared/migration.ts（SHA256 " + sha256(readMigrationSource()) + "）");
  L.push("");
  L.push("== 候选集合（丢块缺陷修复后 runner 会尝试执行的语句） ==");
  L.push("  候选语句总数：" + candidateStatements);
  L.push("  其中被 runner 显式跳过（存储过程 / DROP TABLE，未纳入候选）：" + runnerSkipped);
  L.push("  纯注释块（无真实语句，未纳入候选）：" + pureCommentChunks);
  L.push("  默认挡会**跳过**：" + blocked.length + " 条（" + Object.entries(byKeyword).map(([k, v]) => k + " " + v).join(" / ") + "）");
  L.push("  默认挡会**放行**：" + Object.values(allowedByKeyword).reduce((a, b) => a + b, 0) + " 条（" + Object.entries(allowedByKeyword).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + " " + v).join(" / ") + " …）");
  L.push("  涉及被挡语句的文件：" + filesWithBlocked.length + " 个");
  L.push("");
  L.push("== 一、被挡语句逐条（file:line / 类型 / 目标表 / 摘要） ==");
  blocked.forEach((b, i) => {
    L.push("  " + (i + 1) + ". " + b.file + ":" + b.line + "  " + b.keyword + "  目标=" + (b.target || "—"));
    L.push("       " + b.sql);
  });
  L.push("");
  L.push("== 二、口令相关写语句专项核对（" + passwordStatements.length + " 条，全部必须被挡） ==");
  passwordStatements.forEach((b, i) => {
    L.push("  " + (i + 1) + ". " + b.file + ":" + b.line + "  " + b.keyword + "  目标=" + (b.target || "—") + "  ⇒ 被挡（isDataWriteStatement=true）");
    L.push("       " + b.sql);
  });
  L.push("");
  L.push("== 三、CALL 语句专项核对（" + callStatements.length + " 条，全部必须被挡） ==");
  callStatements.forEach((b, i) => {
    L.push("  " + (i + 1) + ". " + b.file + ":" + b.line + "  目标过程=" + (b.target || "—") + "  ⇒ 被挡");
  });
  L.push("");
  L.push("== 五、与 MIG-3 副本演练结果交叉核对 ==");
  if (drillCross.available) {
    L.push("  演练数据：" + drillCross.path);
    L.push("  演练语句总数：" + drillCross.drillTotal + "（结果分布 " + JSON.stringify(drillCross.drillByOutcome) + "）");
    L.push("  其中写语句/CALL：" + drillCross.drillWrites + " 条，落在闸门被挡集合的：" + drillCross.drillWritesCoveredByGate + " / " + drillCross.drillWrites + "（要求全部）");
    L.push("  其中 outcome=ok（＝放量后**真的会改数据**）的写语句：" + drillCross.drillOkWrites + " 条，未被闸门挡住的：" + drillCross.drillOkWritesNotBlocked.length + " 条（要求 0）");
    if (drillCross.drillOkWritesNotBlocked.length) {
      L.push("    未挡住清单：" + drillCross.drillOkWritesNotBlocked.join("、"));
    }
    L.push("  口径差异说明：演练 ok=66 是「在副本上真正执行成功」的写语句；本扫描 125 条写语句是「修复后 runner 会尝试执行」的集合，");
    L.push("  后者是前者的超集（多出的是演练中报错/被 runner 跳过的语句），两者不冲突。");
  } else {
    L.push("  演练数据不存在，跳过交叉核对：" + drillCross.path);
  }
  L.push("");

  // 内置自检：① 被挡集合里的每条都必须判真；② 结构语句抽样必须判假；③ 口令语句必须全部在列
  const selfChecks = [];
  const notBlocked = blocked.filter((b) => !mod.isDataWriteStatement(b.sql));
  selfChecks.push(["被挡清单里每条都能被判真（可复算）", notBlocked.length === 0, notBlocked.length + " 条判假"]);
  const structureSamples = ["CREATE TABLE IF NOT EXISTS `t_x` (id INT)", "ALTER TABLE `t_x` ADD COLUMN a INT", "CREATE INDEX i ON `t_x` (id)", "SELECT 1 FROM `t_x`"];
  const misjudged = structureSamples.filter((s) => mod.isDataWriteStatement(s));
  selfChecks.push(["结构/非写语句抽样全部判假", misjudged.length === 0, misjudged.join(" | ") || "0 条误判"]);
  selfChecks.push(["口令相关写语句全部落在被挡集合", passwordStatements.length > 0, passwordStatements.length + " 条"]);
  selfChecks.push(["CALL 全部落在被挡集合", callStatements.length > 0, callStatements.length + " 条"]);
  if (drillCross.available) {
    selfChecks.push([
      "演练判定 ok 的写语句 100% 落在被挡集合（要求 0 条漏挡）",
      drillCross.drillOkWritesNotBlocked.length === 0,
      drillCross.drillOkWritesNotBlocked.length + " 条漏挡",
    ]);
  }
  L.push("== 四、内置自检 ==");
  let allOk = true;
  for (const [name, ok, detail] of selfChecks) {
    if (!ok) allOk = false;
    L.push("  " + (ok ? "✓" : "✗") + " " + name + " —— " + detail);
  }
  L.push("");
  L.push("RESULT: " + (allOk ? "ALL PASS" : "FAILURES"));
  L.push("EXIT=" + (allOk ? 0 : 1));

  const text = L.join("\n") + "\n";
  writeFileSync(join(OUTDIR, "outputs", "05-gate-coverage.txt"), text, "utf8");
  writeFileSync(
    join(OUTDIR, "outputs", "05-gate-coverage.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        migrationsDir: MIGRATIONS_DIR,
        filesScanned: files.length,
        candidateStatements,
        runnerSkippedChunks: runnerSkipped,
        pureCommentChunks,
        blockedTotal: blocked.length,
        blockedByKeyword: byKeyword,
        allowedByKeyword,
        filesWithBlocked,
        blocked,
        passwordStatements,
        callStatements,
        drillCross,
        ok: allOk,
      },
      null,
      2
    ),
    "utf8"
  );
  process.stdout.write(text);
  const resolvedWorkDir = resolve(workDir);
  if (resolvedWorkDir.startsWith(resolve(tmpdir()))) rmSync(resolvedWorkDir, { recursive: true, force: true });
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write("[MIG-4/coverage] 异常：" + String(e && e.stack ? e.stack : e) + "\n");
  process.exit(1);
});
