/**
 * MIG-2 行为变更影响面扫描：修复 `addTablePrefix`（支持反引号表名）后，
 * **哪些此前被改坏 / 被跳过的语句会变为可执行**。
 *
 * 口径复用 MIG-1：`docs/evidence/MIG-1/tools/mig1-extract.mjs` 的
 *   simulateRunner（去 USE / DELIMITER 行 → 按 `;` 切 → 丢注释开头块 → 跳存储过程 → 跳 DROP TABLE）
 *   stmtType / riskOf 原样 import。
 * 唯一的自定义：`mig2-lib.mjs:extractTableNames`——取表正则族抄自 MIG-1 `extractTables`，
 *   但**不再二次加前缀**（这里要看的正是「旧结果表名 vs 新结果表名」的差异）。
 *
 * 用法：node docs/evidence/MIG-2/tools/mig2-impact.mjs
 * 退出码：0 = 生成成功（且 174/175 三张表在 diff 里可点名）；1 = 否则。
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  simulateRunner,
  stmtType,
  riskOf,
  buildCleaned,
  splitChunks,
  lineOfOffset,
  analyzeChunk,
} from "../../MIG-1/tools/mig1-extract.mjs";
import { loadAddTablePrefix, extractTableNames } from "./mig2-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..", "..");
const OUTDIR = join(REPO_ROOT, "docs", "evidence", "MIG-2");
const MIGRATIONS_DIR = join(REPO_ROOT, "docs", "migrations");
const NEW_FILE = join(REPO_ROOT, "backend", "src", "shared", "migration.ts");
const OLD_FILE = join(OUTDIR, "outputs", "00-old-migration.ts.txt");

/** 旧版本"把表名改坏"的指纹：名字组抓到关键字后补成 t_关键字 */
const BROKEN_TOKEN = /\bt_(IF|NOT|EXISTS|SELECT|INTO|FROM|JOIN|UPDATE|DELETE|TABLE|WHERE|SET)\b/;

function classify(oldOut, newOut) {
  if (BROKEN_TOKEN.test(oldOut) && !BROKEN_TOKEN.test(newOut)) {
    return "A 旧版本改坏成语法错误（ER_PARSE_ERROR，被 safeExec 跳过 ⇒ 语句从未生效）";
  }
  const ot = extractTableNames(oldOut);
  const nt = extractTableNames(newOut);
  if (ot.length === 0 || ot.some((t) => !t.startsWith("t_")) || JSON.stringify(ot) !== JSON.stringify(nt)) {
    return "B 旧版本漏改反引号表名（未加前缀 ⇒ 打到不存在的表/系统库，被跳过），新版本已加前缀";
  }
  return "C 其它名称差异（需人工核对，理论应为 0 条）";
}

/**
 * 统计被 runner **显式跳过**的块（存储过程 / DROP TABLE）与"非空且未跳过"的块数。
 * 为什么不用 simulateRunner：它只返回 executed / dropped，被显式跳过的块两边都不在；
 * MIG-1 的工具体积不允许改（文件域红线），故这里用它的**导出原语**按其内联谓词重算，
 * 谓词逐字对齐 migrate.ts:900-928：includes("CREATE PROCEDURE") / includes("DROP PROCEDURE") / /DROP\s+TABLE/i。
 */
function runnerSkipStats(sql) {
  const { cleaned, offsets } = buildCleaned(sql);
  let procedure = 0;
  let dropTable = 0;
  let nonEmpty = 0;
  for (const c of splitChunks(cleaned)) {
    const text = c.text.trim();
    if (!text) continue;
    const lead = c.text.length - c.text.trimStart().length;
    const info = analyzeChunk(text, lineOfOffset(offsets, c.start + lead), "B");
    if (!info.realSql) continue;
    if (info.startsWithDashComment) continue; // 被「注释开头整块丢弃」吞掉，MIG-1 已单独立单
    nonEmpty += 1;
    if (info.realSql.includes("CREATE PROCEDURE") || info.realSql.includes("DROP PROCEDURE")) procedure += 1;
    else if (/DROP\s+TABLE/i.test(info.realSql)) dropTable += 1;
  }
  return { procedure, dropTable, nonEmpty };
}

function main() {
  mkdirSync(join(OUTDIR, "outputs"), { recursive: true });
  const n = loadAddTablePrefix(readFileSync(NEW_FILE, "utf8"));
  const o = loadAddTablePrefix(readFileSync(OLD_FILE, "utf8"));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
    .sort();

  const diffs = [];
  const byType = {};
  const byLevel = {};
  const byClass = {};
  const filesWithDiff = new Set();
  let stmtTotal = 0;
  let stmtExecuted = 0;
  let stmtNonEmpty = 0;
  let backtickKeywordStatements = 0;
  let backtickPrefixedStatements = 0;
  const runnerSkipped = { procedure: 0, drop_table: 0 };
  const droppedCommentBlocks = {};

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const sim = simulateRunner(sql, "B");
    const st = runnerSkipStats(sql);
    runnerSkipped.procedure += st.procedure;
    runnerSkipped.drop_table += st.dropTable;
    stmtNonEmpty += st.nonEmpty;
    for (const d of sim.dropped) {
      if (d.hasReal) droppedCommentBlocks[file] = (droppedCommentBlocks[file] ?? 0) + 1;
    }
    for (const s of sim.executed) {
      stmtExecuted += 1;
      if (/(?:TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+|INSERT\s+INTO\s+|INTO\s+|FROM\s+|JOIN\s+|UPDATE\s+|DELETE\s+FROM\s+)`[a-z_]/i.test(s.text)) {
        backtickKeywordStatements += 1;
        if (/`(?:t_[a-z0-9_]*|mysql|information_schema)`/i.test(s.text)) backtickPrefixedStatements += 1;
      }
      const oldOut = o.fn(s.text);
      const newOut = n.fn(s.text);
      if (oldOut === newOut) continue;
      const type = stmtType(s.text);
      const risk = riskOf(s.text);
      const cls = classify(oldOut, newOut);
      byType[type] = (byType[type] ?? 0) + 1;
      byLevel[risk.level] = (byLevel[risk.level] ?? 0) + 1;
      byClass[cls.slice(0, 1)] = (byClass[cls.slice(0, 1)] ?? 0) + 1;
      filesWithDiff.add(file);
      const oldTables = extractTableNames(oldOut);
      const newTables = extractTableNames(newOut);
      diffs.push({
        file,
        line: s.realLine,
        blockStartLine: s.blockStartLine,
        type,
        risk: risk.level,
        riskWhy: risk.why,
        class: cls,
        needConfirm: risk.level === "L1" ? "否" : "是",
        oldTable: oldTables[0] ?? null,
        newTable: newTables[0] ?? null,
        oldTables,
        newTables,
        oldLine: oldOut.trim().split("\n")[0],
        newLine: newOut.trim().split("\n")[0],
      });
    }
  }
  // 语句总数（含被 runner 跳过的 + 注释开头被丢的块）——用于自证扫描范围
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    stmtTotal += sql.split(";").filter((s) => s.trim().length > 0).length;
  }

  const dataWrites = diffs.filter((d) => ["INSERT", "UPDATE", "DELETE"].includes(d.type));
  const structureChanges = diffs.filter((d) => d.type === "ALTER");
  const creates = diffs.filter((d) => d.type === "CREATE");
  const targetTables = [...new Set(diffs.map((d) => d.newTable).filter(Boolean))].sort();
  const expectedTables = ["t_open_api_call_daily", "t_open_webhook", "t_open_webhook_delivery"];
  const named = expectedTables.filter((t) => targetTables.includes(t));

  const crossCheck =
    stmtNonEmpty - (runnerSkipped.procedure ?? 0) - (runnerSkipped.drop_table ?? 0) === stmtExecuted;
  const L = [];
  L.push("[MIG-2/impact] addTablePrefix 修复（反引号表名）行为变更影响面");
  L.push("  扫描目录：" + MIGRATIONS_DIR);
  L.push("  新函数块 SHA256 " + n.sha256);
  L.push("  旧函数块 SHA256 " + o.sha256);
  L.push("");
  L.push("== 扫描范围自证 ==");
  L.push("  SQL 文件数（排除 add_tenant_id.sql，与 runner 口径一致）：" + files.length);
  L.push("  文件内分号切分语句总数（含注释开头块、含被 runner 跳过的）：" + stmtTotal);
  L.push("  runner 流水后非空语句块：" + stmtNonEmpty);
  L.push("  其中 runner 显式跳过：存储过程 " + (runnerSkipped.procedure ?? 0) + " / DROP TABLE " + (runnerSkipped.drop_table ?? 0));
  L.push("  实际进入 addTablePrefix 的语句：" + stmtExecuted);
  L.push(
    "  其中「关键字后紧跟反引号表名」的语句（本次修复的作用面）：" +
      backtickKeywordStatements +
      " 条；其中反引号内已是 t_ 前缀/系统库（修复前后都不动）：" +
      backtickPrefixedStatements +
      " 条（注意：这批语句**本应被『已加 t_ 前缀则跳过』规则放行**，旧版本仍因关键字误抓把它们改坏）"
  );
  L.push(
    "  交叉校验：非空块 − 显式跳过 = " +
      (stmtNonEmpty - (runnerSkipped.procedure ?? 0) - (runnerSkipped.drop_table ?? 0)) +
      "，应等于进入 addTablePrefix 的语句数（" +
      stmtExecuted +
      "）⇒ " +
      (crossCheck ? "一致" : "不一致")
  );
  const droppedTotal = Object.values(droppedCommentBlocks).reduce((a, b) => a + b, 0);
  L.push("  另：被「注释开头整块丢弃」缺陷吞掉的含真实内容块 " + droppedTotal + " 个，分布在 " + Object.keys(droppedCommentBlocks).length + " 个文件（MIG-1 已单独立单，不在本单）");
  L.push("");
  L.push("== 新旧 addTablePrefix 结果差异 ==");
  L.push("  差异语句总数：" + diffs.length + "（涉及文件 " + filesWithDiff.size + " 个）");
  L.push("  按语句类型：" + (Object.entries(byType).map(([k, v]) => k + " " + v).join(" / ") || "无"));
  L.push("  按风险等级：" + (Object.entries(byLevel).map(([k, v]) => k + " " + v).join(" / ") || "无"));
  L.push("  按差异成因：" + (Object.entries(byClass).sort().map(([k, v]) => k + " " + v).join(" / ") || "无"));
  L.push("");
  L.push("== 关键分节：会改数据的语句（INSERT / UPDATE / DELETE） ==");
  if (dataWrites.length === 0) L.push("  0 条——修复不改变任何数据写入语句的目标表名");
  for (const d of dataWrites) L.push("  " + d.file + ":" + d.line + " [" + d.type + "/" + d.risk + "] 旧=" + d.oldLine + " | 新=" + d.newLine);
  L.push("");
  L.push("== 关键分节：会改结构的语句（ALTER TABLE） ==");
  if (structureChanges.length === 0) L.push("  0 条——修复不改变任何 ALTER TABLE 的目标表名");
  for (const d of structureChanges) L.push("  " + d.file + ":" + d.line + " [" + d.type + "/" + d.risk + "] 旧=" + d.oldLine + " | 新=" + d.newLine);
  L.push("");
  L.push("== 建表语句（CREATE）：修复后首次可执行的表 ==");
  for (const d of creates) {
    L.push("  " + d.file + ":" + d.line + " [" + d.risk + "] 旧=" + d.oldLine + " | 新=" + d.newLine);
    L.push("     成因：" + d.class);
  }
  L.push("");
  L.push("== 目标表清单（去重） ==");
  L.push("  " + (targetTables.join(", ") || "无"));
  L.push("  点名核对（生产缺失的 3 张表）：" + expectedTables.map((t) => t + (named.includes(t) ? " ✔在列" : " ✘缺")).join(" / "));
  L.push("");
  L.push("== 逐条差异明细 ==");
  for (const d of diffs) {
    L.push("  " + d.file + ":" + d.line + " | " + d.type + " | " + d.risk + " | 需人工确认:" + d.needConfirm + " | 旧表=" + d.oldTable + " → 新表=" + d.newTable);
    L.push("      旧：" + d.oldLine);
    L.push("      新：" + d.newLine);
  }
  L.push("");
  const ok = diffs.length > 0 && named.length === 3 && byClass.C === undefined && crossCheck;
  L.push("RESULT: " + (ok ? "ALL PASS" : "FAILURES"));
  L.push("EXIT=" + (ok ? 0 : 1));

  const json = {
    generatedAt: new Date().toISOString(),
    migrationsDir: MIGRATIONS_DIR,
    pipeline: "复用 docs/evidence/MIG-1/tools/mig1-extract.mjs:simulateRunner（口径 B）",
    sha256: { newBlock: n.sha256, oldBlock: o.sha256 },
    scope: {
      files: files.length,
      statementsBySemicolon: stmtTotal,
      nonEmptyBlocks: stmtNonEmpty,
      runnerSkipped,
      statementsPrefixed: stmtExecuted,
      backtickKeywordStatements,
      backtickPrefixedStatements,
      crossCheck,
      commentLeadingDroppedBlocks: droppedTotal,
    },
    diffCount: diffs.length,
    filesWithDiff: [...filesWithDiff].sort(),
    byType,
    byLevel,
    byClass,
    dataWrites,
    structureChanges,
    creates,
    targetTables,
    expectedTablesNamed: named,
    diffs,
  };
  const text = L.join("\n") + "\n";
  writeFileSync(join(OUTDIR, "outputs", "04-impact.txt"), text, "utf8");
  writeFileSync(join(OUTDIR, "impacts.json"), JSON.stringify(json, null, 2), "utf8");
  process.stdout.write(text);
  process.exit(ok ? 0 : 1);
}

main();
