#!/usr/bin/env node
/**
 * R101-C6-3-2b 自检脚本（纯 node，零第三方依赖，**不 spawn 任何子进程**）
 *
 * 断言：
 *   ① 后端注册端点（方法 + 路径）恰好等于卡内 2 条，少一条 / 多一条 / 拼错一字都判红，
 *      且两条前缀各自声明正确（/api/platform/referral-ledger、/api/platform/channel-reports）；
 *   ② 前端 api.ts 调用的本单端点集合 ↔ 后端注册集合相等；
 *   ③ saas-admin/src 全仓出现的本单前缀路径全部已注册（无自拟变体）；
 *   ④ 页面接线：ChannelPromotion.vue 真实调用两个函数、「渠道效果」子 Tab 与空态文案在位；
 *   ⑤ 迁移 195 硬约束：恰好 1 条 CREATE TABLE IF NOT EXISTS、INSERT=0（零预置）、
 *      无 utf8mb4_unicode_ci、不建物理外键、文本列显式 COLLATE、`uk_invitee` 唯一键在位、
 *      无金额/结算/提现/佣金类列、语句在注释块之前；
 *   ⑥ 口径复算（**独立算术**，与单测/等价装置同一份 fixture 与同一张手算表）：
 *      20% 计点 + 年度 60000 截断（含"额度用尽记 0 分"），以及渠道效果聚合的明细/合计；
 *   ⑦ 「不得新增对外写台账端点」：本单路由文件里只有 GET，没有任何写方法。
 *
 * 用法：
 *   node saas-admin/tools/c6-3-2b-selfcheck.mjs             # 检查本仓库
 *   node saas-admin/tools/c6-3-2b-selfcheck.mjs <repoRoot>   # 检查指定根目录（供"改坏⇒红"反测）
 * 退出码：0 = 全绿；1 = 有 FAIL（可作门禁）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "..", ".."));

/* ── 卡内钉死的 2 条端点（唯一真相源 = 派单卡 §四，路径逐字） ── */
const CARD_ENDPOINTS = [
  "GET /api/platform/referral-ledger",
  "GET /api/platform/channel-reports/effect",
];

const ROUTES = [
  { file: "backend/src/routes/platform-referral-ledger.routes.ts", prefix: "/api/platform/referral-ledger" },
  { file: "backend/src/routes/platform-channel-report.routes.ts", prefix: "/api/platform/channel-reports" },
];

const API_FILE = "saas-admin/src/api.ts";
const PAGE_FILE = "saas-admin/src/views/marketing/ChannelPromotion.vue";
const LEDGER_SERVICE = "backend/src/services/platform/platform-referral-ledger.service.ts";
const REPORT_SERVICE = "backend/src/services/platform/platform-channel-report.service.ts";
const MIGRATION = "docs/migrations/195_老带新台账.sql";

const results = [];
function check(label, ok, detail = "") {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"} · ${label}${detail ? ` · ${detail}` : ""}`);
}

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`缺少文件：${rel}（root=${ROOT}）`);
  return fs.readFileSync(abs, "utf8");
}

/** 递归列出目录下所有文件（跳过 node_modules/dist/.git/.vite/.tmp-*） */
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".vite"].includes(entry.name)) continue;
    if (entry.name.startsWith(".tmp-")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** 路径归一：/platform/x/${id} 与 /api/platform/x/:id 都归一为 /api/platform/x/:param */
function normalizePath(raw) {
  let s = String(raw).trim();
  if (/^\/platform\//.test(s)) s = `/api${s}`;
  if (!s.startsWith("/api/")) s = `/api${s.startsWith("/") ? s : `/${s}`}`;
  return s.replace(/\$\{[^}]*\}/g, ":param").replace(/:[A-Za-z0-9_]+/g, ":param");
}

function sorted(arr) {
  return [...arr].sort();
}

/** 统计前剥掉 SQL 注释行；必须先归一 CRLF（core.autocrlf=true ⇒ 工作区是 CRLF） */
function stripSqlComments(sql) {
  return sql
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** ⑥ 独立算术复算：20% 计点 + 年度 60000 截断（不引用服务代码，纯算术） */
function recomputePoints(basisUnits) {
  return Math.floor(basisUnits * 0.2);
}
function recomputeCapped(basisUnits, usedPointsInYear) {
  const requested = recomputePoints(basisUnits);
  const remaining = Math.max(0, 60000 - usedPointsInYear);
  return { requested, remaining, granted: Math.min(requested, remaining) };
}

/* ⑥ 同一份 fixture（与 backend 单测、等价装置逐字相同） */
const FIXTURE_ROWS = [
  { dimension: "PROMO", tenantCount: 4, referralCount: 0, rewardPoints: 0 },
  { dimension: "AGENT", tenantCount: 2, referralCount: 1, rewardPoints: 2600 },
  { dimension: "REFERRAL", tenantCount: 1, referralCount: 1, rewardPoints: 1000 },
];
const HAND_TABLE = { PROMO: 4, AGENT: 2, REFERRAL: 1 };
const HAND_TOTALS = { tenantCount: 7, referralCount: 2, rewardPoints: 3600 };

try {
  /* ───────── ① 后端注册端点（方法 + 路径） ───────── */
  const registered = new Set();
  for (const { file, prefix } of ROUTES) {
    const source = read(file);
    const declared = /prefix:\s*"([^"]+)"/.exec(source)?.[1];
    check(`① 前缀声明：${file} ⇒ ${prefix}`, declared === prefix, `实际=${declared}`);
    // 端点集合用**文件里实际声明的**前缀拼（而不是期望常量）：这样"前缀被改坏"会同时打在
    // ① 前缀声明 与 ① 端点集合 两条断言上，避免只靠一条断言兜底（S3-135-F1 同族教训）。
    const effectivePrefix = declared ?? prefix;
    for (const m of source.matchAll(/[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
      const rel = m[2];
      const full = normalizePath(`${effectivePrefix}${rel === "/" ? "" : rel}`);
      registered.add(`${m[1].toUpperCase()} ${full}`);
    }
  }
  check(
    "① 后端注册端点恰好是卡内 2 条（方法 + 路径逐字）",
    registered.size === CARD_ENDPOINTS.length && CARD_ENDPOINTS.every((e) => registered.has(e)),
    `backend=${JSON.stringify(sorted(registered))}`
  );

  /* ───────── ⑦ 不得有对外"写台账"端点（卡 §四） ───────── */
  const ledgerRouteSource = read(ROUTES[0].file);
  const writeMethods = [...ledgerRouteSource.matchAll(/\.(post|put|patch|delete)\(\s*"/g)];
  check(
    "⑦ 台账域只有只读端点（无 post/put/patch/delete）",
    writeMethods.length === 0,
    `写方法命中=${writeMethods.length}`
  );

  /* ───────── ② 前端调用端点（api.ts） ───────── */
  const apiSource = read(API_FILE);
  const feCalls = new Set();
  for (const m of apiSource.matchAll(/api\.(get|post|put|patch|delete)<[\s\S]*?>\(\s*[`"]([^`"]+)[`"]/g)) {
    const normalized = normalizePath(m[2]);
    if (!/^\/api\/platform\/(referral-ledger|channel-reports)/.test(normalized)) continue;
    feCalls.add(`${m[1].toUpperCase()} ${normalized}`);
  }
  check(
    "② 前端 api.ts 调用端点 ↔ 后端注册端点逐字一致（集合相等）",
    feCalls.size === registered.size && [...feCalls].every((e) => registered.has(e)),
    `frontend=${JSON.stringify(sorted(feCalls))}`
  );

  /* ───────── ③ 前端不得出现自拟/未注册路径 ───────── */
  const feRoot = path.join(ROOT, "saas-admin", "src");
  const PATH_RE = /(?:\/api)?\/platform\/(?:referral-ledger|channel-reports)(?:\/\$\{[^}]*\}|\/[A-Za-z0-9_.-]+)*/g;
  const seenPaths = new Set();
  const pathHits = [];
  for (const abs of walk(feRoot)) {
    if (!/\.(ts|vue|js|mjs)$/.test(abs)) continue;
    const src = fs.readFileSync(abs, "utf8");
    const rel = path.relative(ROOT, abs);
    for (const m of src.matchAll(PATH_RE)) {
      const normalized = normalizePath(m[0]);
      seenPaths.add(normalized);
      const line = src.slice(0, m.index).split("\n").length;
      pathHits.push(`${rel}:${line}  ${m[0]}  ⇒  ${normalized}`);
    }
  }
  const registeredPaths = new Set([...registered].map((e) => e.split(" ")[1]));
  check(
    "③ 前端出现的本单路径全部已在后端注册（无自拟变体）",
    [...seenPaths].every((p) => registeredPaths.has(p)),
    `unregistered=${JSON.stringify([...seenPaths].filter((p) => !registeredPaths.has(p)))}`
  );

  /* ───────── ④ 页面接线（Tab② 渠道效果 + Tab① 台账） ───────── */
  const pageSource = read(PAGE_FILE);
  check(
    "④-a 页面调用 listReferralLedger 与 getChannelEffectReport（两端真实接线）",
    pageSource.includes("listReferralLedger") && pageSource.includes("getChannelEffectReport")
  );
  check(
    "④-b 子 Tab 保留（R7：并入本页，不新增页面/路由/菜单）且空态文案在位",
    pageSource.includes("渠道效果") &&
      pageSource.includes("暂无渠道效果数据") &&
      pageSource.includes("暂无老带新台账数据")
  );
  check(
    "④-c 页面只读：台账无补录/写入调用（无 createReferral / postReferral 之类）",
    !/(createReferral|writeReferral|postReferral|updateReferral)/i.test(pageSource)
  );

  /* ───────── ⑤ 迁移 195 硬约束 ───────── */
  const sql = stripSqlComments(read(MIGRATION));
  const createCount = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS/g)].length;
  const inserts = [...sql.matchAll(/\bINSERT\b/gi)].length;
  const updates = [...sql.matchAll(/^\s*UPDATE\b/gim)].length;
  const deletes = [...sql.matchAll(/^\s*DELETE\b/gim)].length;
  const badCollate = [...sql.matchAll(/utf8mb4_unicode_ci/g)].length;
  const foreignKeys = [...sql.matchAll(/\b(FOREIGN KEY|REFERENCES)\b/gi)].length;
  const varcharLines = sql.split("\n").filter((line) => /VARCHAR\s*\(/i.test(line));
  const varcharWithoutCollate = varcharLines.filter((line) => !/COLLATE\s+utf8mb4_0900_ai_ci/i.test(line));
  const moneyColumns = sql
    .split("\n")
    .filter((line) => /^\s*[A-Za-z_][\w]*\s+(BIGINT|INT|DECIMAL|VARCHAR)/i.test(line))
    .map((line) => line.split(/\bCOMMENT\b/i)[0])
    .filter((line) => /(amount|money|settle|withdraw|balance|commission|profit)/i.test(line));

  check(
    `⑤-a 恰好 1 条 CREATE TABLE IF NOT EXISTS（实际 ${createCount}）/ 零预置（INSERT ${inserts} / UPDATE ${updates} / DELETE ${deletes}）`,
    createCount === 1 && inserts === 0 && updates === 0 && deletes === 0
  );
  check(
    `⑤-b 文本列 ${varcharLines.length} 个全部显式 COLLATE utf8mb4_0900_ai_ci（缺 ${varcharWithoutCollate.length}）且无 unicode_ci（${badCollate}）`,
    varcharLines.length > 0 && varcharWithoutCollate.length === 0 && badCollate === 0
  );
  check(`⑤-c 不建物理外键（命中 ${foreignKeys}）`, foreignKeys === 0);
  check(
    "⑤-d 一被邀请租户一条：UNIQUE KEY uk_invitee (invitee_tenant_id) 在位",
    // ⚠️ 必须查**剥掉注释后的可执行 SQL**：文件末尾的说明注释里也写着同一个键名，
    //    直接对原文做正则会让"DDL 里的唯一键被删掉"照样绿（本脚本首次反测即抓到这条假绿）。
    /UNIQUE KEY uk_invitee \(invitee_tenant_id\)/.test(sql)
  );
  check(
    "⑤-e 零金额：无任何金额/结算/提现/佣金类列（只看列名+类型）",
    moneyColumns.length === 0,
    `命中=${JSON.stringify(moneyColumns.map((l) => l.trim().split(/\s+/)[0]))}`
  );
  check(
    "⑤-f 语句在注释块之前（踩坑 [63]：注释开头的块会被 runner 丢弃）",
    (() => {
      const lines = read(MIGRATION).replace(/\r\n/g, "\n").split("\n");
      const firstComment = lines.findIndex((line) => line.trim().startsWith("--"));
      const lastExecutable = lines.reduce(
        (last, line, i) => (line.trim().length > 0 && !line.trim().startsWith("--") ? i : last),
        0
      );
      return firstComment > lastExecutable;
    })()
  );
  check(
    "⑤-g 注释文字内无 ASCII 分号（否则注释块会被切成两半）",
    !read(MIGRATION)
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((line) => line.trim().startsWith("--"))
      .join("\n")
      .includes(";")
  );

  /* ───────── ⑥ 口径复算（独立算术 + 常量与源码一致性） ───────── */
  const rateInSource = /REFERRAL_REWARD_RATE\s*=\s*0\.2/.test(read(LEDGER_SERVICE));
  const capInSource = /REFERRAL_ANNUAL_CAP_POINTS\s*=\s*60000/.test(read(LEDGER_SERVICE));
  check("⑥-a 比例 20% 与年度上限 60000 在服务源码中逐字可见", rateInSource && capInSource);

  const pointCases = [1000, 999, 5, 0];
  const pointExpected = [200, 199, 1, 0];
  check(
    "⑥-b 20% 计点复算：1000→200 / 999→199 / 5→1 / 0→0",
    JSON.stringify(pointCases.map(recomputePoints)) === JSON.stringify(pointExpected)
  );

  const capCases = [
    { basis: 10000, used: 59500, granted: 500, capped: true },
    { basis: 10000, used: 60000, granted: 0, capped: true },
    { basis: 10000, used: 0, granted: 2000, capped: false },
    { basis: 2500, used: 59500, granted: 500, capped: false },
  ];
  const capOk = capCases.every((c) => {
    const r = recomputeCapped(c.basis, c.used);
    return r.granted === c.granted && r.granted < r.requested === c.capped;
  });
  check(
    "⑥-c 年度上限复算：59500+2000→500 / 60000+2000→0 / 0+2000→2000 / 59500+500→500（恰好补齐不算截断）",
    capOk,
    JSON.stringify(capCases.map((c) => [c.basis, c.used, recomputeCapped(c.basis, c.used).granted]))
  );

  const byDimension = {};
  for (const row of FIXTURE_ROWS) {
    byDimension[row.dimension] = (byDimension[row.dimension] ?? 0) + row.tenantCount;
  }
  const totals = FIXTURE_ROWS.reduce(
    (acc, row) => ({
      tenantCount: acc.tenantCount + row.tenantCount,
      referralCount: acc.referralCount + row.referralCount,
      rewardPoints: acc.rewardPoints + row.rewardPoints,
    }),
    { tenantCount: 0, referralCount: 0, rewardPoints: 0 }
  );
  check(
    "⑥-d 聚合复算（同 fixture）：分维度 tenantCount 与手算表一致",
    JSON.stringify(byDimension) === JSON.stringify(HAND_TABLE),
    `复算=${JSON.stringify(byDimension)} 手算=${JSON.stringify(HAND_TABLE)}`
  );
  check(
    "⑥-e 聚合复算（同 fixture）：合计 7 / 2 / 3600",
    JSON.stringify(totals) === JSON.stringify(HAND_TOTALS),
    `复算=${JSON.stringify(totals)}`
  );
  check(
    "⑥-f 报表口径常量与 SQL 同源：rewardRate/annualCapPoints 由服务常量导出，排除 REVOKED 写在 SQL",
    read(REPORT_SERVICE).includes("REFERRAL_REWARD_RATE") &&
      read(REPORT_SERVICE).includes("REFERRAL_ANNUAL_CAP_POINTS") &&
      read(REPORT_SERVICE).includes("l.status <> 'REVOKED'")
  );

  /* ───────── ⑧ 迁移编号 + EXPECTED_MAX_MIGRATION 快照（派单标准头第 7 条） ───────── */
  const MIGRATION_SNAPSHOT_TEST = "backend/src/__tests__/shared/migration-c6-4-1.test.ts";
  const migFiles = fs.readdirSync(path.join(ROOT, "docs/migrations")).filter((f) => f.endsWith(".sql"));
  const numbers = migFiles
    .map((f) => (/^(\d{3})_/.exec(f) ?? [])[1])
    .filter(Boolean)
    .map(Number);
  const maxNumber = Math.max(...numbers);
  const snapshot = Number(/const EXPECTED_MAX_MIGRATION = (\d+)/.exec(read(MIGRATION_SNAPSHOT_TEST))?.[1]);
  check(
    `⑧ 迁移编号：仓内最大编号 ${maxNumber} = 本单 195（唯一），且快照 EXPECTED_MAX_MIGRATION=${snapshot}`,
    maxNumber === 195 && snapshot === 195 && numbers.filter((n) => n === 195).length === 1,
    `max=${maxNumber} 快照=${snapshot} 195 出现次数=${numbers.filter((n) => n === 195).length}`
  );

  /* ───────── 输出 ───────── */
  console.log("\n—— 前端本单路径字面逐条（文件:行 ⇒ 归一化路径） ——");
  for (const hit of pathHits) console.log(`   ${hit}`);
  console.log(`—— 后端注册端点 ——\n   ${sorted(registered).join("\n   ")}`);
} catch (err) {
  check(`致命错误：${err instanceof Error ? err.message : String(err)}`, false);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项断言，FAIL ${failed.length} 项 / EXIT=${failed.length ? 1 : 0}`);
process.exitCode = failed.length ? 1 : 0;
