#!/usr/bin/env node
/*
 * verify-inventory.cjs — WB-REFACTOR-P0 四张矩阵的「合计 ↔ 明细」机读校验器
 *
 * 只读四张交付 markdown（可 --dir 指向副本），不写盘、不改业务代码。
 * 校验三类不变式：
 *   A. 数量守恒：每张表的明细行数必须等于文档自述的合计/脚本 stdout 读数；
 *   B. 状态闭环：矩阵20 每个状态的条数与行号集合，必须由明细列逐行重算得出，
 *      且各状态行号集合互斥并完整覆盖 #1…#19；
 *   C. 无空格子：明细行每一列都必须有内容（ref、`无`、`UNKNOWN`、`—` 均算有内容），
 *      对应派工卡硬验收「每条矩阵行必须有…明示，不得留空」。
 *
 * 用法：
 *   node docs/evidence/WB-REFACTOR-P0/scripts/verify-inventory.cjs [--dir <evidenceDir>] [--strict] [--json]
 *
 * --strict：任一 FAIL 则 EXIT=1（门禁口径，非仅打印）。
 * --selftest：把矩阵20 复制到临时目录后「抽掉一条能力」/「翻转一个状态」，
 *             跑同一套校验必须变红；复原后再跑必须变绿。用来证明本校验器不是假门禁。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const argv = process.argv.slice(2);
function flagVal(name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : dflt;
}
const STRICT = argv.includes("--strict");
const SELFTEST = argv.includes("--selftest");
const AS_JSON = argv.includes("--json");
const DIR = path.resolve(flagVal("--dir", path.resolve(__dirname, "..")));

const FILES = {
  m10: "10-route-menu-matrix.md",
  m20: "20-ai-feature-matrix.md",
  m30: "30-action-permission-matrix.md",
  l40: "40-page-quality-ledger.md",
};

const checks = [];
function check(id, ok, detail) {
  checks.push({ id, ok: !!ok, detail });
}

/* ---------- markdown pipe-table 解析（转义感知，与前一轮行号复核同一套切分） ---------- */

function splitRow(line) {
  const cells = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\") {
      const nx = line[i + 1];
      if (nx === "|" || nx === "\\") {
        cur += nx;
        i++;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  // 去掉首尾因 `| a | b |` 产生的空槽
  if (cells.length && cells[0] === "") cells.shift();
  if (cells.length && cells[cells.length - 1] === "") cells.pop();
  return cells;
}
function isTableLine(l) {
  return /^\s*\|/.test(l);
}
function isSeparator(l) {
  return /^\s*\|(\s*:?-{1,}:?\s*\|)+\s*$/.test(l);
}
/** 返回文件中所有连续 pipe 表块：{ startLine, header, rows[] } */
function tablesOf(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!isTableLine(lines[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && isTableLine(lines[j])) j++;
    const block = lines.slice(i, j);
    const cellsList = block.map(splitRow);
    const header = cellsList[0];
    let sepIdx = cellsList.findIndex((c, k) => k > 0 && c.every((x) => /^:?-{1,}:?$/.test(x.replace(/\s/g, "")) && x.length));
    const rows = cellsList.slice(sepIdx < 0 ? 1 : sepIdx + 1);
    out.push({ startLine: i + 1, header, rows, width: header.length });
    i = j;
  }
  return out;
}
/** 按表头某列文本定位表块 */
function findTable(tables, predicate) {
  return tables.find(predicate);
}
function colIndex(header, needle) {
  return header.findIndex((h) => h.includes(needle));
}

/* ---------- 通用：空格子扫描 ---------- */

function blankCellReport(file, tables, minRows) {
  const bad = [];
  for (const t of tables) {
    if (t.rows.length < minRows) continue;
    t.rows.forEach((r, k) => {
      if (r.length !== t.width) {
        bad.push(`${file}:${t.startLine + k + 1} 列数 ${r.length}≠表头 ${t.width}`);
        return;
      }
      r.forEach((c, ci) => {
        if (c === "") bad.push(`${file}:${t.startLine + k + 1} 第 ${ci + 1} 列（${t.header[ci]}）为空`);
      });
    });
  }
  return bad;
}

/* ---------- 矩阵 20 ---------- */

const STATUSES = ["LIVE", "PARTIAL", "PLANNED", "BLOCKED"];
function verifyM20(base) {
  const p = path.join(base, FILES.m20);
  if (!fs.existsSync(p)) return check("M20.file", false, `缺文件 ${p}`);
  const tables = tablesOf(fs.readFileSync(p, "utf8"));
  const detail = findTable(
    tables,
    (t) => t.rows.length >= 10 && colIndex(t.header, "#") === 0 && colIndex(t.header, "状态") >= 0
  );
  if (!detail) return check("M20.detailTable", false, "未找到明细表（表头含 # 与 状态）");
  const sIdx = colIndex(detail.header, "状态");

  const per = { LIVE: [], PARTIAL: [], PLANNED: [], BLOCKED: [] };
  const odd = [];
  for (const r of detail.rows) {
    const id = r[0].replace(/^#/, "").trim();
    const st = r[sIdx];
    if (STATUSES.includes(st)) per[st].push(id);
    else odd.push(`#${id}→「${st}」`);
  }
  check(
    "M20.明细行状态全部可枚举",
    odd.length === 0,
    odd.length ? `非枚举状态 ${odd.length} 处：${odd.join("、")}` : `19 行状态均 ∈ ${STATUSES.join("/")}`
  );

  const summary = findTable(tables, (t) => colIndex(t.header, "状态") === 0 && colIndex(t.header, "条数") > 0);
  if (!summary) return check("M20.summaryTable", false, "未找到合计表（表头含 状态/条数）");
  const cIdx = colIndex(summary.header, "条数");
  const rIdx = colIndex(summary.header, "行号");

  for (const st of STATUSES) {
    const row = summary.rows.find((r) => r[0].replace(/\*/g, "").trim() === st);
    if (!row) {
      check(`M20.合计含${st}`, false, "合计表缺该状态行");
      continue;
    }
    const declared = Number(row[cIdx].replace(/[^\d]/g, ""));
    const actual = per[st].length;
    check(`M20.${st} 条数`, declared === actual, `合计=${declared} 明细重算=${actual} 差异=${actual - declared}`);
    const ids = (row[rIdx] || "")
      .split(/[、,|]/)
      .map((s) => s.replace(/[^0-9]/g, ""))
      .filter(Boolean);
    const same = ids.length === actual && ids.slice().sort().join(",") === per[st].slice().sort().join(",");
    check(`M20.${st} 行号集合`, same, `合计行号=[${ids.join(",")}] 明细实际=[${per[st].join(",")}]`);
  }

  const totalRow = summary.rows.find((r) => r[0].includes("总数"));
  const declaredTotal = totalRow ? Number(totalRow[cIdx].replace(/[^\d]/g, "")) : NaN;
  const sumStatuses = STATUSES.reduce((a, s) => a + per[s].length, 0);
  check(
    "M20.总数=明细行数",
    declaredTotal === detail.rows.length && sumStatuses === detail.rows.length,
    `合计总数=${declaredTotal} 状态条数之和=${sumStatuses} 明细行数=${detail.rows.length}`
  );
  const allIds = STATUSES.flatMap((s) => per[s]).map(Number).sort((a, b) => a - b);
  const expectIds = Array.from({ length: detail.rows.length }, (_, i) => i + 1);
  check(
    "M20.行号无重无漏",
    allIds.length === expectIds.length && allIds.join(",") === expectIds.join(","),
    `状态行号并集=${allIds.join(",")}（应为 1…${detail.rows.length}）`
  );
  return tables;
}

/* ---------- 矩阵 30 ---------- */

function verifyM30(base) {
  const p = path.join(base, FILES.m30);
  if (!fs.existsSync(p)) return check("M30.file", false, `缺文件 ${p}`);
  const text = fs.readFileSync(p, "utf8");
  const tables = tablesOf(text);

  const stdout = {};
  for (const m of text.matchAll(/^([A-Z][A-Z0-9_]{3,})=(\d+)\s*$/gm)) if (!(m[1] in stdout)) stdout[m[1]] = Number(m[2]);

  const writeT = findTable(tables, (t) => colIndex(t.header, "actionId") === 0 && t.rows.length > 50);
  if (!writeT) return check("M30.writeTable", false, "未找到写动作矩阵");
  check(
    "M30.写动作行数=stdout WRITE_ACTIONS_VIEW_CALLED",
    writeT.rows.length === stdout.WRITE_ACTIONS_VIEW_CALLED,
    `表 ${writeT.rows.length} 行 vs stdout ${stdout.WRITE_ACTIONS_VIEW_CALLED}`
  );

  const readT = findTable(tables, (t) => colIndex(t.header, "域") === 0 && t.rows.length >= 60 && colIndex(t.header, "抽样") >= 0);
  if (readT)
    check(
      "M30.读域行数=stdout READ_DOMAINS",
      readT.rows.length === stdout.READ_DOMAINS,
      `表 ${readT.rows.length} 行 vs stdout ${stdout.READ_DOMAINS}`
    );

  const sub = findTable(
    tables,
    (t) => colIndex(t.header, "域") === 0 && t.rows.length >= 40 && t.rows.length < 100 && colIndex(t.header, "写动作数") > 0
  );
  if (sub) {
    const wIdx = colIndex(sub.header, "写动作数");
    const body = sub.rows.filter((r) => !/合计|总计|—/.test(r[0]));
    const totRow = sub.rows.find((r) => /合计|总计/.test(r[0]));
    const s = body.reduce((a, r) => a + (Number(r[wIdx]) || 0), 0);
    check(
      "M30.每域小计求和=写动作总数",
      s === writeT.rows.length,
      `66 域小计之和=${s} vs 写动作表行数=${writeT.rows.length}${totRow ? `；表内合计行=${totRow[wIdx]}` : ""}`
    );
    check("M30.每域小计行数", body.length === 66, `域行 ${body.length}（自述 66 个域）`);
    const nIdx = colIndex(sub.header, "无码数");
    const sNo = body.reduce((a, r) => a + (Number(r[nIdx]) || 0), 0);
    check(
      "M30.每域无码求和=stdout WRITE_ACTIONS_NO_PERM",
      sNo === stdout.WRITE_ACTIONS_NO_PERM,
      `小计无码之和=${sNo} vs stdout ${stdout.WRITE_ACTIONS_NO_PERM}`
    );
  }

  const auditMatch = text.match(/WRITE_ACTIONS_AUDIT_KINDS=无=(\d+)\s*\|\s*有=(\d+)\s*\|\s*UNKNOWN=(\d+)/);
  if (auditMatch) {
    const [, n, y, u] = auditMatch.map(Number);
    check("M30.审计三态求和=写动作总数", n + y + u === stdout.WRITE_ACTIONS_VIEW_CALLED, `无${n}+有${y}+UNKNOWN${u}=${n + y + u} vs 254`);
  }
  return tables;
}

/* ---------- 台账 40 ---------- */

function verifyL40(base) {
  const p = path.join(base, FILES.l40);
  if (!fs.existsSync(p)) return check("L40.file", false, `缺文件 ${p}`);
  const text = fs.readFileSync(p, "utf8");
  const tables = tablesOf(text);
  const detail = findTable(tables, (t) => colIndex(t.header, "#") === 0 && colIndex(t.header, "严重度") >= 0 && t.rows.length > 50);
  if (!detail) return check("L40.detailTable", false, "未找到逐页台账表");

  const sIdx = colIndex(detail.header, "严重度");
  const bucket = { P0: 0, P1: 0, P2: 0, P3: 0, UNKNOWN: 0, OTHER: [] };
  for (const r of detail.rows) {
    const v = r[sIdx];
    const k = /^P[0-3]/.test(v) ? v.slice(0, 2) : v.startsWith("UNKNOWN") ? "UNKNOWN" : null;
    if (k) bucket[k]++;
    else bucket.OTHER.push(`「${v}」`);
  }
  check("L40.严重度可枚举", bucket.OTHER.length === 0, bucket.OTHER.length ? `异常严重度 ${bucket.OTHER.length} 处` : "全部 ∈ P0/P1/P2/P3/UNKNOWN");

  const summaryT = findTable(tables, (t) => colIndex(t.header, "指标") === 0 && colIndex(t.header, "数值") > 0);
  if (!summaryT) return check("L40.summaryTable", false, "未找到摘要表");
  const look = (needle) => {
    const row = summaryT.rows.find((r) => r[0].includes(needle));
    return row ? Number(row[colIndex(summaryT.header, "数值")].replace(/[^\d]/g, "")) : NaN;
  };
  const total = look("总页数");
  check("L40.逐页行数=摘要总页数", detail.rows.length === total, `表 ${detail.rows.length} 行 vs 摘要 ${total}`);
  for (const [label, key] of [["P0 冒充 LIVE", "P0"], ["P1 部分假", "P1"], ["P2 纯占位", "P2"], ["P3 干净", "P3"], ["UNKNOWN", "UNKNOWN"]]) {
    const d = look(label);
    check(`L40.${label} 条数`, d === bucket[key], `摘要 ${d} vs 明细重算 ${bucket[key]} 差异=${bucket[key] - d}`);
  }
  const sum = bucket.P0 + bucket.P1 + bucket.P2 + bucket.P3 + bucket.UNKNOWN;
  check("L40.五档求和=总页数", sum === total, `${bucket.P0}+${bucket.P1}+${bucket.P2}+${bucket.P3}+${bucket.UNKNOWN}=${sum} vs ${total}`);

  const tsv = text.match(/```tsv\r?\n([\s\S]*?)```/);
  if (tsv) {
    const lines = tsv[1].split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("SEVERITY\t"));
    check("L40.TSV行数=逐页行数", lines.length === detail.rows.length, `TSV ${lines.length} 行 vs 表 ${detail.rows.length} 行`);
  } else check("L40.TSV存在", false, "未找到 tsv 代码块");

  const countsBlock = text.match(/### COUNTS（脚本 stdout 摘要原样）\r?\n\r?\n```json\r?\n([\s\S]*?)```/);
  if (!countsBlock) {
    check("L40.COUNTS块解析", false, "未匹配到 `### COUNTS` JSON 块");
    return tables;
  }
  let kv = {};
  try {
    kv = JSON.parse(countsBlock[1]);
  } catch (e) {
    check("L40.COUNTS块解析", false, `JSON 解析失败：${e.message}`);
    return tables;
  }
  check("L40.明细行数=COUNTS.TOTAL_PAGES", detail.rows.length === kv.TOTAL_PAGES, `明细 ${detail.rows.length} vs COUNTS ${kv.TOTAL_PAGES}`);
  check("L40.COUNTS.ROUTES_CSV_ROWS=矩阵10口径", kv.ROUTES_CSV_ROWS === 164, `CSV 输入路由行 ${kv.ROUTES_CSV_ROWS}（矩阵10 ROUTE_DECLARATIONS=164）`);
  for (const k of ["P0", "P1", "P2", "P3", "UNKNOWN"])
    check(`L40.明细${k}=COUNTS.${k}`, bucket[k] === kv[k], `明细 ${bucket[k]} vs COUNTS ${kv[k]}`);
  const cSum = ["P0", "P1", "P2", "P3", "UNKNOWN"].reduce((a, k) => a + (kv[k] || 0), 0);
  check("L40.COUNTS五档求和=TOTAL_PAGES", cSum === kv.TOTAL_PAGES, `${cSum} vs ${kv.TOTAL_PAGES}`);
  return tables;
}

/* ---------- 矩阵 10：文档内自述数量 + 与解析脚本对账 ---------- */

function verifyM10(base) {
  const p = path.join(base, FILES.m10);
  if (!fs.existsSync(p)) return check("M10.file", false, `缺文件 ${p}`);
  const text = fs.readFileSync(p, "utf8");
  const tables = tablesOf(text);

  const summaryJson = text.match(/### JSON:SUMMARY\r?\n\r?\n``?json?`?\r?\n([\s\S]*?)```/);
  const countsFromDoc = {};
  for (const m of text.matchAll(/^([A-Z][A-Z0-9_]{3,})=(\d+)\s*$/gm)) if (!(m[1] in countsFromDoc)) countsFromDoc[m[1]] = Number(m[2]);

  const routeT = findTable(tables, (t) => colIndex(t.header, "routeName") >= 0 && colIndex(t.header, "组件文件") >= 0 && t.rows.length > 100);
  if (routeT) {
    const declared = countsFromDoc.ROUTE_DECLARATIONS;
    check(
      "M10.路由表行数=ROUTE_DECLARATIONS",
      !Number.isNaN(declared) && routeT.rows.length === declared,
      `表 ${routeT.rows.length} 行 vs 文档自述 ROUTE_DECLARATIONS=${declared}`
    );
  } else check("M10.路由表", false, "未找到路由 pipe 表（可能仅以 CSV 块呈现）");

  const csvBlocks = [...text.matchAll(/### CSV:(TABLE_[A-Z0-9_]+)\r?\n\r?\n```(?:csv|json)\r?\n([\s\S]*?)```/g)];
  for (const [, tag, body] of csvBlocks) {
    const lines = body.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.length - 1;
    const expect = { TABLE_A: "ROUTE_DECLARATIONS", TABLE_B1: "PROTO_PAGES_TOTAL", TABLE_B2: "ADMIN_ONLY_PAGES" }[tag];
    if (expect && !Number.isNaN(countsFromDoc[expect]))
      check(`M10.${tag} 行数=${expect}`, rows === countsFromDoc[expect], `CSV ${rows} 行 vs ${expect}=${countsFromDoc[expect]}`);
    else check(`M10.${tag} 行数`, true, `CSV ${rows} 行（无对应自述读数，仅登记）`);
  }

  // 与解析脚本实时对账（脚本可跑时才做；不可跑记 SKIP 不算失败）
  const script = path.join(__dirname, "parse-routes.cjs");
  if (fs.existsSync(script)) {
    const { execFileSync } = require("child_process");
    let out = null;
    try {
      out = execFileSync(process.execPath, [script], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, cwd: path.resolve(__dirname, "../../../..") });
    } catch (e) {
      check("M10.脚本可跑", false, `parse-routes.cjs 执行失败：${String(e.message).slice(0, 120)}`);
    }
    if (out) {
      const live = {};
      for (const m of out.matchAll(/^([A-Z][A-Z0-9_]{3,})=(\d+)$/gm)) if (!(m[1] in live)) live[m[1]] = Number(m[2]);
      const keys = ["ROUTE_DECLARATIONS", "UNIQUE_COMPONENT_FILES_PAGE_ONLY", "MENU_ITEM_COUNT", "PROTO_LV2_BASE", "PROTO_PAGE_MISSING_IN_ADMIN", "ADMIN_ONLY_PAGES"];
      for (const k of keys)
        if (!Number.isNaN(countsFromDoc[k]))
          check(`M10.${k} 文档↔脚本`, countsFromDoc[k] === live[k], `文档 ${countsFromDoc[k]} vs 脚本 ${live[k]} 差异=${(live[k] ?? NaN) - countsFromDoc[k]}`);
    }
  }
  return tables;
}

/* ---------- 主流程 ---------- */

let tablesCache = {};

function runAll(base) {
  checks.length = 0;
  tablesCache = {};
  tablesCache.m20 = verifyM20(base) || [];
  tablesCache.m30 = verifyM30(base) || [];
  tablesCache.l40 = verifyL40(base) || [];
  tablesCache.m10 = verifyM10(base) || [];

  const blanks = [
    ...blankCellReport(FILES.m20, tablesCache.m20, 5),
    ...blankCellReport(FILES.m30, tablesCache.m30, 50),
    ...blankCellReport(FILES.l40, tablesCache.l40, 50),
    ...blankCellReport(FILES.m10, tablesCache.m10, 50),
  ];
  check("ALL.明细无空格子/列数对齐", blanks.length === 0, blanks.length ? `${blanks.length} 处：${blanks.slice(0, 6).join(" ; ")}` : "四张表全部行列对齐且无空格");

  return checks.slice();
}

function report(rs) {
  const fails = rs.filter((r) => !r.ok);
  if (AS_JSON) {
    console.log(JSON.stringify({ dir: DIR, total: rs.length, failed: fails.length, checks: rs }, null, 2));
  } else {
    for (const r of rs) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} — ${r.detail}`);
    console.log(`\n总计 ${rs.length} 项，FAIL ${fails.length} 项。`);
  }
  return fails.length;
}

/* ---------- 反测：造错必须变红，复原必须变绿 ---------- */

function selftest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wb-inv-selftest-"));
  const src = path.join(tmp, "src");
  fs.mkdirSync(src, { recursive: true });
  for (const f of Object.values(FILES)) fs.copyFileSync(path.join(DIR, f), path.join(src, f));
  const orig = fs.readFileSync(path.join(src, FILES.m20), "utf8");
  const l40orig = fs.readFileSync(path.join(src, FILES.l40), "utf8");

  const snapshot = () => runAll(src).filter((r) => !r.ok).map((r) => r.id);

  const cases = [];
  const perturb = (label, file, transform) => {
    fs.writeFileSync(path.join(src, file), transform(fs.readFileSync(path.join(src, file), "utf8")), "utf8");
    const red = snapshot();
    fs.writeFileSync(path.join(src, file), file === FILES.m20 ? orig : l40orig, "utf8");
    const green = snapshot();
    cases.push({ label, red, green });
  };

  perturb("反测①抽掉矩阵20 第 8 行（AI 能力源少一条 LIVE）", FILES.m20, (t) => t.replace(/\n\| 8 \| /g, "\n"));
  perturb("反测②翻转唯一 LIVE→PARTIAL（合计与明细错位）", FILES.m20, (t) => t.replace(/\| LIVE \|/, "| PARTIAL |"));
  perturb("反测③合计表 PARTIAL 行号漏写 #8（留空口径）", FILES.m20, (t) => t.replace(/\| 12 \| #1, #3/, "| 11 | #3"));
  perturb("反测④台账40 把 P0 页改判 P3（冒充「洗绿」）", FILES.l40, (t) => t.replace(/\| P0 冒充 LIVE \|/g, "| P3 干净 |"));

  console.log(`# 反测（selftest）临时目录=${tmp}`);
  let bad = 0;
  for (const { label, red, green } of cases) {
    const ok = red.length > 0 && green.length === 0;
    if (!ok) bad++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}\n      造错变红 ${red.length} 项：${red.slice(0, 4).join(", ") || "（无！）"}｜复原变绿 ${green.length} 项`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nSELFTEST_${bad === 0 ? "PASS" : "FAIL"}（造错必红且复原必绿 ${cases.length - bad}/${cases.length}）`);
  process.exitCode = bad === 0 ? 0 : 1;
}

if (SELFTEST) {
  selftest();
} else {
  const n = report(runAll(DIR));
  if (STRICT && n) process.exitCode = 1;
}
