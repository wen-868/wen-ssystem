/**
 * S3-210 台账生成器：把 CI（3358a9e0 合并树）报出的 40 项，
 * 逐条映射到「当前 main 树（9dea3e39）」的处置与证据。
 *
 * 输入（全部是已落盘的原始读数，不联网）：
 *   raw/03-ci-3358a9e0-guard-section.txt  —— CI 侧 21 阻塞 + 19 未登记 的原始清单
 *   raw/01-guard-main-head.txt            —— 当前树跑同一门禁的原始输出
 *   backend/scripts/fixtures/tenant-injection-exemptions.json —— 登记表
 * 输出：raw/06-ledger-40.txt（逐条台账）+ 控制台摘要
 *
 * 用法：在仓库根 `node docs/evidence/S3-210/tools/audit-40-items.mjs`
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const CI_SECTION = resolve(ROOT, "docs/evidence/S3-210/raw/03-ci-3358a9e0-guard-section.txt");
const CUR_GUARD = resolve(ROOT, "docs/evidence/S3-210/raw/01-guard-main-head.txt");
const REGISTRY = resolve(ROOT, "backend/scripts/fixtures/tenant-injection-exemptions.json");

for (const p of [CI_SECTION, CUR_GUARD, REGISTRY]) {
  if (!existsSync(p)) {
    console.error(`缺少输入文件：${p}`);
    process.exit(2);
  }
}

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const split = (t) => t.split("\n");

// ---------- 1. 解析 CI 清单 ----------
const ciLines = split(read(CI_SECTION));
const blocks = [];
const unregistered = [];
let mode = null;
for (const raw of ciLines) {
  if (/RED 阻塞项/.test(raw)) { mode = "block"; continue; }
  if (/RED 未登记的非字面量/.test(raw)) { mode = "unreg"; continue; }
  if (/^\s*(显式标记|WARN|已登记的插值|已登记的单表)/.test(raw)) { mode = null; continue; }
  const m = raw.match(/^\s+((?:services|config|shared|jobs)\/[\w./-]+\.ts):(\d+)(.*)$/);
  if (!m) continue;
  const [, file, srcLine, rest] = m;
  if (mode === "block") {
    const sm = rest.match(/\[(\w+)\]\s+(.*)$/);
    blocks.push({ file, ciLine: Number(srcLine), kind: sm ? sm[1] : "?", stmt: sm ? sm[2].trim() : rest.trim() });
  } else if (mode === "unreg") {
    const im = rest.match(/kind=(\w+)\s+interps=(\d+)/);
    unregistered.push({ file, ciLine: Number(srcLine), kind: im ? im[1] : "?", interps: im ? Number(im[2]) : null });
  }
}

// ---------- 2. 当前门禁读数（整体级别） ----------
const curGuard = read(CUR_GUARD);
const counts = (curGuard.match(/调用点：(\d+)｜(.*)/) || [])[1]
  ? curGuard.match(/调用点：(\d+)｜(.*)/)[0].trim()
  : "(未解析到)";
const greenNow = /GREEN 无阻塞项/.test(curGuard);
const curRegistered = new Set();
for (const raw of split(curGuard)) {
  const m = raw.match(/^\s+((?:services|config|shared|jobs)\/[\w./-]+\.ts):(\d+).*verdict=(\S+)/);
  if (m) curRegistered.add(`${m[1]}:${m[2]}|${m[3]}`);
}
const curRegisteredFiles = new Set([...curRegistered].map((k) => k.split("|")[0].split(":")[0]));
// 当前门禁仍列为「调用点」的文件 → 行号集合（用于判断某个 CI 项是否仍被门禁关注）
const curFlaggedByFile = new Map();
for (const k of curRegistered) {
  const [site] = k.split("|");
  const [file, line] = site.split(":");
  if (!curFlaggedByFile.has(file)) curFlaggedByFile.set(file, []);
  curFlaggedByFile.get(file).push(Number(line));
}
const stillFlaggedNear = (file, ciLine, tol = 10) =>
  (curFlaggedByFile.get(file) || []).some((l) => Math.abs(l - ciLine) <= tol);

// ---------- 3. 登记表 ----------
const registry = JSON.parse(read(REGISTRY));
const near = (hay, needle, window = 6000) => {
  const key = needle.slice(0, 40).replace(/\s+/g, " ").trim();
  const idx = hay.indexOf(key);
  if (idx < 0) return null;
  return { idx, text: hay.slice(Math.max(0, idx - window), idx + window) };
};

// ---------- 4. 逐条定性 ----------
const ledger = [];
const problems = [];

function sourceOf(file) {
  const p = resolve(ROOT, "backend/src", file);
  return existsSync(p) ? read(p) : null;
}

function linesOf(file, needle) {
  const s = sourceOf(file);
  if (!s) return null;
  // 把源码按「空白折叠」归一化（CI 日志里的 SQL 是折行后的单行文本，直接 indexOf 会因换行漏匹配），
  // 同时保留每个字符 → 行号的映射，用于回报「当前行」。
  const normChars = [];
  const normLine = [];
  let lineNo = 1;
  let prevWs = false;
  for (const ch of s) {
    if (ch === "\n") { lineNo++; }
    if (/\s/.test(ch)) {
      if (!prevWs) { normChars.push(" "); normLine.push(lineNo); prevWs = true; }
      continue;
    }
    normChars.push(ch);
    normLine.push(lineNo);
    prevWs = false;
  }
  const norm = normChars.join("");
  const key = needle.slice(0, 40).replace(/\s+/g, " ").trim();
  const out = [];
  let from = 0;
  for (;;) {
    const i = norm.indexOf(key, from);
    if (i < 0) break;
    out.push(normLine[i]);
    from = i + key.length;
  }
  return out.length ? out : null;
}

function registryHit(kind, item) {
  const table = registry[kind] || [];
  return table.filter((e) => e.file === item.file).map((e) => e.reason || e.verdict || "");
}

// 21 条阻塞项：按「语句当前形态」判定处置
for (const item of blocks) {
  const s = sourceOf(item.file);
  let verdict, evidence, curLine = null;
  if (!s) {
    verdict = "文件不存在";
    evidence = "—";
  } else {
    const all = linesOf(item.file, item.stmt);
    curLine = all ? all.join("/") : null;
    const key = item.stmt.slice(0, 40).replace(/\s+/g, " ").trim();
    if (!all) {
      verdict = "语句已改写（精确形态已不存在）";
      evidence = `原句前 40 字：${key}`;
    } else {
      const lines = s.split("\n");
      const win = all
        .map((l) => lines.slice(Math.max(0, l - 4), l + 30).join("\n"))
        .join("\n---\n");
      if (/tenant-scope:platform/.test(win)) {
        verdict = "平台级 ⇒ 显式标记 tenant-scope:platform";
        const reasons = registryHit("markers", item);
        evidence = reasons.length ? reasons[0] : "（登记表未命中）";
      } else if (/tenant_id\s*=\s*\?/.test(win)) {
        verdict = "补显式租户值谓词 tenant_id = ?";
        evidence = win.split("\n").filter((l) => /tenant_id\s*=\s*\?/.test(l))[0]?.trim() || "—";
      } else {
        const st = registryHit("singleTable", item);
        if (st.length) {
          verdict = "单表查询 ⇒ 登记（注入补的正是正确谓词）";
          evidence = st[0];
        } else {
          verdict = "⚠️ 未识别处置";
          evidence = key;
          problems.push(`${item.file}:${item.ciLine} 未识别处置`);
        }
      }
    }
  }
  ledger.push({ rule: "BLOCK-MISSING-TENANT-CONDITION", ...item, curLine, verdict, evidence });
}

// 19 条未登记非字面量：登记表登记 / 已被前置修复消解
for (const item of unregistered) {
  const s = sourceOf(item.file);
  const ind = registryHit("indirect", item);
  const stillFlagged = stillFlaggedNear(item.file, item.ciLine);
  let verdict, evidence;
  if (stillFlagged && ind.length) {
    verdict = "已登记（登记表 indirect）";
    evidence = ind[0];
  } else if (stillFlagged && !ind.length) {
    verdict = "⚠️ 当前仍被门禁列为调用点但登记表未命中";
    evidence = "—";
    problems.push(`${item.file}:${item.ciLine} 仍被列为调用点却无登记`);
  } else {
    const lines = s ? s.split("\n") : [];
    const win = lines.slice(Math.max(0, item.ciLine - 20), item.ciLine + 30).join("\n");
    const markerLine = win.split("\n").find((l) => /tenant-scope:platform/.test(l));
    const why = markerLine
      ? "已补平台显式标记 tenant-scope:platform"
      : /tenant_id\s*=\s*\?/.test(win)
        ? "已补显式租户值谓词 tenant_id = ?"
        : "语句已改写（不再被门禁列为 INDIRECT）";
    verdict = `已消解：${why}`;
    evidence = (markerLine ||
      win.split("\n").find((l) => /tenant_id\s*=\s*\?/.test(l)) ||
      "—").trim();
  }
  ledger.push({ rule: "INDIRECT-UNREGISTERED", ...item, verdict, evidence });
}

// ---------- 5. 输出 ----------
const out = [];
out.push("# S3-210 台账：CI 报出的 40 项 → 当前处置（机械生成，可复跑）");
out.push("");
out.push(`生成命令：node docs/evidence/S3-210/tools/audit-40-items.mjs`);
out.push(`CI 侧读数：run 38730257760（headSha 3358a9e0，合并树 3358a9e0 + main 2fe8f109）`);
out.push(`当前树读数：origin/main 9dea3e39｜门禁整体：${counts}｜GREEN=${greenNow}`);
out.push("");
out.push("## 一、21 条阻塞（BLOCK-MISSING-TENANT-CONDITION）");
out.push("");
out.push("| # | 文件:CI 行 | 当前行 | 处置 | 证据/理由 |");
out.push("|:--:|:--|:--:|:--|:--|");
ledger.filter((r) => r.rule.startsWith("BLOCK")).forEach((r, i) => {
  out.push(`| ${i + 1} | ${r.file}:${r.ciLine} | ${r.curLine ?? "—"} | ${r.verdict} | ${String(r.evidence).replace(/\|/g, "\\|").slice(0, 200)} |`);
});
out.push("");
out.push("## 二、19 条未登记非字面量（INDIRECT-UNREGISTERED）");
out.push("");
out.push("| # | 文件:CI 行 | 形态 | 处置 | 理由 |");
out.push("|:--:|:--|:--|:--|:--|");
ledger.filter((r) => r.rule.startsWith("INDIRECT")).forEach((r, i) => {
  out.push(`| ${i + 1} | ${r.file}:${r.ciLine} | ${r.kind} interps=${r.interps} | ${r.verdict} | ${String(r.evidence).replace(/\|/g, "\\|").slice(0, 200)} |`);
});
out.push("");
out.push(`## 三、统计`);
out.push("");
out.push(`- 阻塞项 ${blocks.length} 条 / 未登记项 ${unregistered.length} 条 / 合计 ${ledger.length} 条`);
const byVerdict = {};
for (const r of ledger) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
for (const [k, v] of Object.entries(byVerdict)) out.push(`- ${k}：${v} 条`);
out.push("");
out.push(problems.length ? `## 四、未识别/异常（${problems.length} 条）\n\n${problems.map((p) => `- ${p}`).join("\n")}` : "## 四、未识别/异常：无");
out.push("");

const text = out.join("\n");
const outPath = resolve(ROOT, "docs/evidence/S3-210/raw/06-ledger-40.txt");
writeFileSync(outPath, text, "utf8");
console.log(text);
console.log(`\n[写出] ${outPath}`);
if (problems.length) process.exitCode = 1;
