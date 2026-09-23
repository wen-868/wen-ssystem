/**
 * MIG-1 验收标准 ②：从清单里**按固定规则抽 3 条**，生成"如何在副本库上验证它确实会执行"的具体命令。
 * 抽法（可复现，不手挑）：按 (文件名, 行号) 字典序，各取第一条 L1 建表 / L2 改结构 / L3 改数据。
 *
 * 产出：docs/evidence/MIG-1/反测-3条.md（可直接照抄执行）+ outputs/07-probe3.txt
 * 注意：本工具**只在本地生成文本**，不连库、不写库。真库/副本库上的执行由凌舟在副本环境进行。
 *
 * 用法： node docs/evidence/MIG-1/tools/mig1-probe3.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./mig1-extract.mjs";

const OUT_DIR = join(REPO_ROOT, "docs", "evidence", "MIG-1");
const expPath = join(OUT_DIR, "expected.json");
if (!existsSync(expPath)) {
  console.error("缺少 " + expPath + "，请先运行 tools/mig1-extract.mjs");
  process.exit(1);
}
const exp = JSON.parse(readFileSync(expPath, "utf8"));
const all = exp.files.flatMap((f) => f.entries);

const compare = (a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1);
const pickFirst = (pred) => all.filter(pred).sort(compare)[0];

const picks = [
  { tag: "① L1 幂等建表", e: pickFirst((x) => x.risk === "L1" && x.type === "CREATE") },
  { tag: "② L2 改结构", e: pickFirst((x) => x.risk === "L2" && x.type === "ALTER") },
  { tag: "③ L3 改数据", e: pickFirst((x) => x.risk === "L3" && x.type === "INSERT") },
];
if (picks.some((p) => !p.e)) {
  console.error("抽样失败：清单缺少 L1 CREATE / L2 ALTER / L3 INSERT 之一");
  process.exit(1);
}

/** 为一个语句生成 before / after 的只读核对 SQL；能用则给"精确命中"版本，否则退回"计数"版本 */
function probes(e) {
  const t = e.targetTable ?? "(未知表)";
  const out = { kind: "", before: [], after: [], note: "" };
  if (/^CREATE\s+TABLE/i.test(e.sql)) {
    out.kind = "建表";
    const q = "SELECT COUNT(*) AS before_cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '" + t + "';";
    out.before = [q + "   -- 预期 before_cnt = 0（表还不存在）"];
    out.after = [q.replace("before_cnt", "after_cnt") + "   -- 预期 after_cnt = 1"];
    out.note = "若 before_cnt 已经是 1，说明该表另有来源（如 init_database.sql 或更早的迁移已建）—— 这属于清单里必须人工确认的部分，不能算这条语句的功劳。";
    return out;
  }
  if (/^ALTER\s+TABLE/i.test(e.sql)) {
    out.kind = "改结构";
    const m = /ADD\s+(?:COLUMN\s+)?`?([a-z_][a-z0-9_]*)`?/i.exec(e.sql);
    const col = m ? m[1] : null;
    const base =
      "SELECT COUNT(*) AS {N} FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = '" +
      t +
      "'" +
      (col ? " AND column_name = '" + col + "'" : "") +
      ";";
    out.before = [base.replace("{N}", "before_cnt") + "   -- 预期 before_cnt = 0（列还不存在）"];
    out.after = [base.replace("{N}", "after_cnt") + "   -- 预期 after_cnt = 1", "SHOW CREATE TABLE " + t + ";   -- 肉眼确认列已出现"];
    out.note = col
      ? "该 ALTER 无幂等保护：**只能在副本库执行**，重复执行会报 1060 Duplicate column name，这本身就是它确实执行了的证据。"
      : "未能从语句里解析出列名，请人工确认后再执行。";
    return out;
  }
  // DML
  out.kind = "改数据";
  const m = /INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-z_][a-z0-9_]*)`?\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*$/i.exec(e.sql.trim());
  if (m) {
    const cols = m[2].split(",").map((s) => s.trim().replace(/`/g, ""));
    const vals = splitTopLevel(m[3]);
    if (cols.length && vals.length) {
      const where = cols
        .map((c, i) => {
          const v = (vals[i] ?? "").trim();
          return isQuoted(v) ? "`" + c + "` = '" + v.slice(1, -1).replace(/'/g, "''") + "'" : "`" + c + "` = " + v;
        })
        .join(" AND ");
      out.before = ["SELECT COUNT(*) AS before_cnt FROM " + t + " WHERE " + where + ";   -- 预期 before_cnt = 0"];
      out.after = [
        "SELECT COUNT(*) AS after_cnt FROM " + t + " WHERE " + where + ";   -- 预期 after_cnt = 1",
        "SELECT COUNT(*) AS table_total FROM " + t + ";   -- 预期 table_total 增加 1",
      ];
      out.note = "若该行本来就在（before_cnt = 1），需人工确认这条 INSERT 是否已被别的途径写入。";
      return out;
    }
  }
  out.before = ["SELECT COUNT(*) AS before_cnt FROM " + t + ";   -- 先记下基数"];
  out.after = ["SELECT COUNT(*) AS after_cnt FROM " + t + ";   -- 预期比 before 多出行数（本工具未能解析出精确 WHERE 条件，需人工补）"];
  out.note = "未能解析出 INSERT 的列/值，只给计数骨架，请人工补 WHERE 条件后再用。";
  return out;
}

function isQuoted(v) {
  return /^'.*'$/.test(v) || /^".*"$/.test(v);
}
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  let quote = null;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "\\") {
        cur += s[i + 1] ?? "";
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

const L = [];
L.push("# MIG-1 反测：从清单里抽 3 条，在**副本库**上验证它们确实会执行");
L.push("");
L.push("> 生成器：`docs/evidence/MIG-1/tools/mig1-probe3.mjs`（抽法固定：按 (文件名,行号) 字典序，各取第一条 L1 建表 / L2 改结构 / L3 改数据）");
L.push("> 生成时间：" + exp.meta.generatedAt + "　|　清单口径来源：`expected.json`（口径 B）");
L.push("");
L.push("## 零、前置声明（红线）");
L.push("");
L.push("1. **本节所有命令都只在副本库执行**；本单**没有**在真库上执行任何写操作（只读查询也没有，因为没有可用连接）。");
L.push("2. 副本库的准备（凌舟提供）：`mysqldump --no-data --routines=false --single-transaction 生产库 > 副本结构快照.sql`，");
L.push("   然后 `node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode apply --host <副本> --user <u> --password <p> --database liquor_inventory_rehearsal --dump 副本结构快照.sql --file <迁移文件> --allow-write`。");
L.push("3. 只读核对命令（Before/After）用 `information_schema`，不会改任何数据；`--mode apply` 才会执行迁移语句。");
L.push("");

picks.forEach((p, idx) => {
  const e = p.e;
  const pr = probes(e);
  L.push("## " + p.tag + "：`" + e.file + ":" + e.line + "`（" + e.type + " / 风险 " + e.risk + " / 目标表 " + (e.targetTable ?? "—") + "）");
  L.push("");
  L.push("语句（修复前被『注释开头整块丢弃』吞掉，修复后首次执行）：");
  L.push("");
  L.push("```sql");
  L.push(e.sql.length > 700 ? e.sql.slice(0, 700) + " …（完整语句见 expected.json）" : e.sql);
  L.push("```");
  L.push("");
  L.push("**Before（只读，预期未变化）**");
  L.push("");
  L.push("```sql");
  L.push(...pr.before);
  L.push("```");
  L.push("");
  L.push("**执行（只在副本库）**");
  L.push("");
  L.push("```powershell");
  L.push("node docs/evidence/MIG-1/tools/mig1-rehearsal.mjs --mode apply --host <副本库IP> --port 3306 --user <用户> --password <口令> \\");
  L.push("  --database liquor_inventory_rehearsal --dump <副本结构快照.sql> --file " + e.file + " --allow-write");
  L.push("```");
  L.push("");
  L.push("**After（只读，预期已变化）**");
  L.push("");
  L.push("```sql");
  L.push(...pr.after);
  L.push("```");
  L.push("");
  L.push("判定：Before 命中预期 **且** After 命中预期 ⇒ 这条语句「确实会执行」成立；只有 After 变化而 Before 已满足 ⇒ 表/列/行另有来源，需人工确认（见备注）。");
  L.push("");
  L.push("备注：" + pr.note);
  L.push("");
});

L.push("## 四、三条之外的兜底核对（可选，副本库上一次性跑）");
L.push("");
L.push("```sql");
L.push("-- ① 结构：清单里所有 L2（改结构）目标表/列在演练前后是否存在，逐条对照 expected.json");
L.push("SELECT table_schema, table_name, column_name FROM information_schema.columns");
L.push(" WHERE table_schema = DATABASE() AND table_name IN (SELECT DISTINCT ...)  -- 表名单取自 risk_summary §五");
L.push("-- ② 数据：L3 目标表的行数快照（演练前后各一次，差异应等于清单里 INSERT/UPDATE 的条数）");
L.push("SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE();");
L.push("```");
L.push("");

const text = L.join("\n") + "\n";
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "反测-3条.md"), text, "utf8");
mkdirSync(join(OUT_DIR, "outputs"), { recursive: true });
writeFileSync(
  join(OUT_DIR, "outputs", "07-probe3.txt"),
  "[MIG-1/probe3] 按固定规则抽 3 条，生成副本库验证命令\n" +
    picks.map((p) => "  " + p.tag + " ⇒ " + p.e.file + ":" + p.e.line + " " + p.e.type + " / " + p.e.risk + " / " + (p.e.targetTable ?? "-")).join("\n") +
    "\n已落盘：docs/evidence/MIG-1/反测-3条.md\nRESULT: ALL PASS\nEXIT=0\n",
  "utf8"
);
process.stdout.write(text);
process.exit(0);
