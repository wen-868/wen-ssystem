/**
 * MIG-5 影响面：把 `addTablePrefix` 的"同族收口"（REFERENCES 补充 + 通用 INTO 收窄）
 * 对**全部 docs/migrations/*.sql** 的实际改写差异逐条算出来（用真实源码文本，不复刻）。
 *
 * 目的：回答两个必须回答的问题（技术债铁律第 2 条：同族必须一次清干净、影响面要数字）
 *   ① 收窄 INTO 之后，**是否有语句失去了本应有的前缀**（覆盖减少）？—— 若有，逐条列出。
 *   ② 新增 REFERENCES 之后，**哪些语句首次获得前缀**（行为变更）？—— 逐条列出。
 *
 * 口径：与 runner 第 8 步一致 = 先剔除 USE / DELIMITER 行 → splitSqlStatements 切块 → 对每条块跑 addTablePrefix。
 *
 * 用法：node docs/evidence/MIG-5/tools/mig5-impact.mjs
 * 退出码：0 = 已产出完整清单（不判定"通过/失败"，差异需人工/凌舟裁定）；1 = 运行出错。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  REPO_ROOT,
  readMigrationSource,
  normalizeSource,
  loadMigrationModule,
  makePrefixFamilyRevertedSource,
} from "./mig5-lib.mjs";

const MIGRATIONS_DIR = resolve(REPO_ROOT, "docs", "migrations");
const TMP = mkdtempSync(join(tmpdir(), "mig5-impact-"));

function line(text = "") {
  process.stdout.write(text + "\n");
}

const rawSource = readMigrationSource();
const normal = await loadMigrationModule(join(TMP, "normal"), normalizeSource(rawSource), "normal");
const old = await loadMigrationModule(join(TMP, "old"), makePrefixFamilyRevertedSource(rawSource).source, "old");

/** 与 runner 第 8 步同口径的预处理 */
function splitLikeRunner(sql) {
  const cleaned = sql
    .split("\n")
    .filter((line) => {
      const t = line.trim().toUpperCase();
      return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
    })
    .join("\n");
  return normal.mod.splitSqlStatements(cleaned);
}

/** 在原始文件里找该语句首个非空、非注释行的行号（近似定位用） */
function locateLine(rawSql, stmt) {
  const head = stmt
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("--"));
  if (!head) return -1;
  const needle = head.slice(0, 60);
  const lines = rawSql.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(needle)) return i + 1;
  }
  return -1;
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
  .sort();

const onlyNew = []; // 只有新版本加前缀（REFERENCES 等新增覆盖）
const onlyOld = []; // 只有旧版本加前缀（收窄 INTO 后的"覆盖减少"，必须逐条解释）
let stmtTotal = 0;
let identical = 0;

for (const file of files) {
  const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  for (const stmt of splitLikeRunner(raw)) {
    stmtTotal += 1;
    const newOut = normal.mod.addTablePrefix(stmt);
    const oldOut = old.mod.addTablePrefix(stmt);
    if (newOut === oldOut) {
      identical += 1;
      continue;
    }
    const rec = {
      file,
      line: locateLine(raw, stmt),
      snippet: stmt.replace(/\s+/g, " ").slice(0, 110),
      oldOut: oldOut.replace(/\s+/g, " ").slice(0, 110),
      newOut: newOut.replace(/\s+/g, " ").slice(0, 110),
    };
    if (oldOut === stmt && newOut !== stmt) onlyNew.push(rec);
    else if (newOut === stmt && oldOut !== stmt) onlyOld.push(rec);
    else onlyNew.push({ ...rec, bothChanged: true });
  }
}

line("=".repeat(96));
line("MIG-5 影响面：addTablePrefix 同族收口（REFERENCES 补充 + INTO 收窄）对全部迁移文件的改写差异");
line("=".repeat(96));
line(`迁移文件数（.sql，排除 add_tenant_id.sql）= ${files.length}`);
line(`切块后语句总数（runner 同口径）= ${stmtTotal}`);
line(`新旧改写完全一致 = ${identical}`);
line(`仅新版本加前缀（首次获得覆盖）= ${onlyNew.length}`);
line(`仅旧版本加前缀（收窄 INTO 后的"覆盖减少"，必须逐条解释）= ${onlyOld.length}`);
line("");

line("-".repeat(96));
line(`① 仅新版本加前缀（REFERENCES 等）—— 逐条 ${onlyNew.length} 条`);
line("-".repeat(96));
for (const r of onlyNew) line(`  · ${r.file}:${r.line} | ${r.snippet}`);
line("");

line("-".repeat(96));
line(`② 仅旧版本加前缀（覆盖减少）—— 逐条 ${onlyOld.length} 条`);
line("-".repeat(96));
for (const r of onlyOld) {
  line(`  · ${r.file}:${r.line} | 语句：${r.snippet}`);
  line(`      旧：${r.oldOut}`);
  line(`      新：${r.newOut}`);
}
line("");
line(files.length > 0 && stmtTotal > 0 ? "结论：清单已产出（差异归类见上，是否接受由凌舟裁定）" : "结论：扫描异常，未产出清单");
line("=".repeat(96));

rmSync(TMP, { recursive: true, force: true });
process.exit(0);
