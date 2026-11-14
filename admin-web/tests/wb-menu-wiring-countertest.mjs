/**
 * MS-WB-CONTENT-WIRING-B-01 · 生产菜单桥与业务内容接线 —— 契约反测（mutation countertest）
 *
 * 三类点名红（权威卡 §三.6，每个注入都必须让目标 spec 的指定断言 FAIL）：
 *   M1 删权限过滤   menu-access.ts 第二层角色裁剪 allowed→true      ⇒ §三1 / §三2 红（店长被放大到全量业务集）
 *   M2 断菜单桥     bridgeByCode = new Map()（桥映射清空）           ⇒ §二3 红（57 码全落 unmapped）
 *   M3 改回硬编码兜底 emptySnapshot 可见集 = 全量 manifest           ⇒ §四1 / §四2 红（error/loading 回退全量）
 *
 * 装置自身纪律（WB14 门2 终审口径，逐条对齐）：
 *   1. computeAllOk(results, selfTest, negative, aggregateSelfCheck) **纯函数四参**，
 *      aggregateSelfCheck.passed !== true ⇒ false（防「验证聚合的自检」被绕过/覆盖，R3 终审）；
 *   2. summary.allOk 由完整结果**单点重新计算**，循环内不散落赋值；process.exitCode 直连聚合值；
 *   3. 聚合自检 8 用例表驱动：基线 + 五类失败（缺 negativeVerified / =false / selfTest.ok=false /
 *      任一 restoredShaMatch=false / 缺 M 结果即 pre-read 异常）+ 两条反向（passed=false、缺失）；
 *   4. 反探针 opt-in：WB_MENU_AGGREGATE_FAIL_PROBE=1 强制 aggregateSelfCheck.passed=false，
 *      走同一聚合路径 ⇒ allOk=false ⇒ exit=1，并打印 AGGREGATE_FAIL（输出重定向 %TEMP%，不污染冻结 summary）；
 *   5. 真 try/catch/**finally**：无条件写回原字节 + SHA 全等复核；恢复动作自身失败必须 catch、
 *      标 restoredShaMatch=false ⇒ 聚合判红 ⇒ 非零退出；
 *   6. SELFTEST 真实异常路径：no-op 注释注入 ⇒ spec 19/0 全绿 ⇒ red.code=0 ⇒
 *      装置逻辑真实 throw「红跑 exit=0（期望 1）」⇒ 此刻文件仍变异态（mutatedSha 留证）⇒
 *      finally 兜底写回 ⇒ SHA 全等。**无任何手工恢复行**（R2-3 根因）；
 *   7. expectedThrow 双条件绑定：redExit===0 且抛出原因命中固定前缀；非预期异常不得计入 SELFTEST 成功；
 *   8. NEGATIVE 代码级反例：注入「删 dashboard 桥条」致 spec 真红（exit=1）⇒ expectedThrow=false ⇒
 *      SELFTEST 必败（negativeVerified=true），反例不计入 allOk 的 ok 判据但要求 restoredShaMatch；
 *   9. 输出缺省 %TEMP%（os.tmpdir()）；写中央 evidence 必须显式 opt-in WB_MENU_MUTATION_OUT。
 *
 * 运行（admin-web 目录）：node tests/wb-menu-wiring-countertest.mjs
 * 正式采集：WB_MENU_MUTATION_OUT=<evidence>/mutation node tests/wb-menu-wiring-countertest.mjs
 * 反探针：  WB_MENU_AGGREGATE_FAIL_PROBE=1 node tests/wb-menu-wiring-countertest.mjs  （期望 exit=1）
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = path.resolve(here, "..");
const MENU_ACCESS = path.join(ADMIN, "src", "shared", "workbench", "menu-access.ts");
const SPEC = path.join(here, "wb-menu-wiring.spec.mjs");
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const RED_EXPECT_PREFIX = "红跑 exit=0（期望 1）";

const MUTATION_IDS = ["M1-role-filter-drop", "M2-menu-bridge-cut", "M3-hardcoded-fallback"];

const MUTATIONS = [
  {
    id: "M1-role-filter-drop",
    file: MENU_ACCESS,
    expectFail: "§三4 权限过滤层实证",
    note: "删第二层角色裁剪（allowed 恒 true）⇒ 全 57 码喂店长时最终集不再收窄，权限过滤层断言红",
    mutate: (t) => {
      const needle = "const allowed = roles.length === 0 || userRoles.some((role) => roles.includes(role));";
      return t.includes(needle) ? t.replace(needle, "const allowed = true; // MUTATION M1: 删权限过滤") : null;
    },
  },
  {
    id: "M2-menu-bridge-cut",
    file: MENU_ACCESS,
    expectFail: "§二3 超管 57 码",
    note: "断菜单桥（bridgeByCode 清空）⇒ 57 码全落 unmapped，桥命中/可见断言红",
    mutate: (t) => {
      const needle = "const bridgeByCode = new Map(bridge.map((entry) => [entry.serverCode, entry.routeName]));";
      return t.includes(needle) ? t.replace(needle, "const bridgeByCode = new Map(); // MUTATION M2: 断菜单桥") : null;
    },
  },
  {
    id: "M3-hardcoded-fallback",
    file: MENU_ACCESS,
    expectFail: "§四1 error 态 fail-closed",
    note: "改回硬编码兜底（emptySnapshot 可见集 = 全量 manifest）⇒ error/loading 回退全量，fail-closed 断言红",
    mutate: (t) => {
      const needle = "visibleRouteNames: new Set<string>(),";
      return t.includes(needle)
        ? t.replace(needle, "visibleRouteNames: new Set<string>(manifestRouteNames), // MUTATION M3: 硬编码兜底")
        : null;
    },
  },
  {
    id: "SELFTEST-real-throw-path",
    file: MENU_ACCESS,
    selftest: true,
    note: "no-op 注释注入 ⇒ spec 全绿 ⇒ 装置真实 throw（红跑 exit=0）⇒ 变异态留证 ⇒ finally 兜底恢复 ⇒ SHA 全等",
    mutate: (t) => t + "\n// wb-menu-wiring-selftest-noop（无行为注释：不改任何导出/字符串断言）\n",
  },
  {
    id: "SELFTEST-NEGATIVE",
    file: MENU_ACCESS,
    negative: true,
    // 故意设一个不可能命中的期望名：反例必须走「未点名」异常路径，验证 expectedThrow 双条件绑定
    expectFail: "__NEGATIVE_NO_EXPECT__",
    note: "代码级反例：删 dashboard 桥条致 spec 真红（exit=1）⇒ expectedThrow=false ⇒ SELFTEST 必败（不污染 allOk）",
    mutate: (t) => {
      const needle = '  { serverCode: "dashboard", routeName: "dashboard", evidence: "10-route-menu-matrix.md:497" },';
      return t.includes(needle) ? t.replace(needle, "") : null;
    },
  },
];

function runSpec() {
  try {
    const out = execFileSync(process.execPath, [SPEC], {
      cwd: ADMIN, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000,
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/* ═══ 纯函数聚合（门2 R3 终审）：任一判据缺失/为假即 false，绝不放开 ═══ */
function computeAllOk(results, selfTest, negative, aggregateSelfCheck) {
  // 「验证聚合函数的自检」自身回归时，最终仍必须 false（R3 终审唯一驳回点）
  if (!aggregateSelfCheck || aggregateSelfCheck.passed !== true) return false;
  // 三类 mutation 结果缺一不可（pre-read 异常 / 中途漏项即 false）
  const muts = MUTATION_IDS.map((id) => results.find((r) => r.id === id));
  if (muts.some((r) => !r)) return false;
  if (!muts.every((r) => r.ok === true)) return false;
  // 全项（含 SELFTEST / NEGATIVE）必须完成 finally 复原且 SHA 全等
  if (!results.every((r) => r.restoredShaMatch === true)) return false;
  if (!selfTest || selfTest.ok !== true) return false;
  if (!negative || negative.negativeVerified !== true) return false;
  return true;
}

/* ═══ 聚合自检：8 用例表驱动（基线 + 五类失败 + 两条反向）═══ */
const okMut = (id) => ({ id, ok: true, restoredShaMatch: true });
const okResults = () => MUTATION_IDS.map(okMut);
const okSelf = () => ({ ok: true });
const okNeg = () => ({ negativeVerified: true });
const okAgg = () => ({ passed: true });
const AGGREGATE_SELF_CHECK_CASES = [
  { name: "baseline-all-pass", expect: true, build: () => [okResults(), okSelf(), okNeg(), okAgg()] },
  { name: "missing-negativeVerified", expect: false, build: () => [okResults(), okSelf(), {}, okAgg()] },
  { name: "negativeVerified=false", expect: false, build: () => [okResults(), okSelf(), { negativeVerified: false }, okAgg()] },
  { name: "selfTest.ok=false", expect: false, build: () => [okResults(), { ok: false }, okNeg(), okAgg()] },
  {
    name: "restoredShaMatch=false",
    expect: false,
    build: () => {
      const rs = okResults(); rs[1] = { id: MUTATION_IDS[1], ok: true, restoredShaMatch: false };
      return [rs, okSelf(), okNeg(), okAgg()];
    },
  },
  { name: "missing-result(pre-read异常)", expect: false, build: () => [okResults().slice(0, 2), okSelf(), okNeg(), okAgg()] },
  { name: "aggregateSelfCheck.passed=false", expect: false, build: () => [okResults(), okSelf(), okNeg(), { passed: false }] },
  { name: "aggregateSelfCheck.missing", expect: false, build: () => [okResults(), okSelf(), okNeg(), null] },
];
function runAggregateSelfCheck() {
  const rows = [];
  let passed = true;
  for (const c of AGGREGATE_SELF_CHECK_CASES) {
    const actual = computeAllOk(...c.build());
    const ok = actual === c.expect;
    if (!ok) passed = false;
    rows.push({ name: c.name, expected: c.expect, actual, ok });
  }
  return { passed, cases: rows.length, rows };
}

// 输出缺省 %TEMP%；写中央 evidence 必须显式 opt-in
const outDir = process.env.WB_MENU_MUTATION_OUT
  ? path.resolve(process.env.WB_MENU_MUTATION_OUT)
  : path.join(os.tmpdir(), "wb-menu-wiring-mutation");
mkdirSync(outDir, { recursive: true });

const summary = {
  generatedAt: new Date().toISOString(),
  spec: "tests/wb-menu-wiring.spec.mjs",
  results: [], selfTest: null, negative: null, aggregateSelfCheck: null,
  allOk: false, // 只由循环尾 computeAllOk 单点赋值，循环内不散落赋值
};
console.log(`MS-WB-CONTENT-WIRING-B-01 契约反测 · 3 类点名红 + SELFTEST 真实异常路径 + NEGATIVE 反例 + 聚合自检`);
console.log(`输出目录：${outDir}（${process.env.WB_MENU_MUTATION_OUT ? "evidence opt-in" : "%TEMP% 缺省"}）`);

for (const m of MUTATIONS) {
  const rec = { id: m.id, note: m.note, ok: false, file: path.relative(ADMIN, m.file) };
  // R2：原字节/原 SHA 提升到 try 外，异常路径 finally 仍持有原字节
  let original = null;
  let beforeSha = null;
  try {
    beforeSha = sha256(m.file);
    rec.originalSha = beforeSha;
    original = readFileSync(m.file, "utf8");
    const mutated = m.mutate(original);
    if (mutated === null || mutated === original) throw new Error("注入未生效（定位失败或替换为空改动）");
    writeFileSync(m.file, mutated);
    rec.mutatedSha = sha256(m.file);
    rec.mutatedDiffers = rec.mutatedSha !== beforeSha;
    if (!rec.mutatedDiffers) throw new Error("变异态快照与原 SHA 相同（注入未真正落盘）");

    const red = runSpec();
    const redLines = red.out.split(/\r?\n/).filter((l) => l.startsWith("FAIL"));
    rec.redExit = red.code;
    rec.redNamed = m.expectFail ? redLines.some((l) => l.includes(m.expectFail)) : false;
    rec.redNamedLine = redLines.find((l) => l.includes(m.expectFail ?? "\u0000")) ?? null;
    if (red.code !== 1) throw new Error(`红跑 exit=${red.code}（期望 1）；FAIL 行：${redLines.join(" | ") || "无"}`);
    if (!rec.redNamed) throw new Error(`红跑未点名期望断言「${m.expectFail}」；实际：${redLines.join(" | ")}`);
    writeFileSync(path.join(outDir, `${m.id}-red.log`), `SPEC: ${path.relative(ADMIN, SPEC)}\n${red.out}`);

    // happy path 复原（finally 仍会无条件复核一次）
    writeFileSync(m.file, original);
    const green = runSpec();
    rec.greenExit = green.code;
    rec.greenSummary = (green.out.match(/小结：.+/) ?? [""])[0].trim();
    if (green.code !== 0) throw new Error(`绿跑 exit=${green.code}（期望 0）`);
    writeFileSync(path.join(outDir, `${m.id}-green.log`), `SPEC: ${path.relative(ADMIN, SPEC)}\n${green.out}`);
    rec.ok = true;
    console.log(`OK      ${m.id}  ← 原${beforeSha.slice(0, 8)} 红(点名「${m.expectFail}」exit=1) → 复原SHA全等 → 绿(${rec.greenSummary} exit=0)`);
  } catch (err) {
    rec.error = String(err.message ?? err).slice(0, 300);
    if (m.selftest || m.negative) {
      // R2-3.1：expectedThrow 双条件绑定，非预期异常（含反例真红）不得计入 SELFTEST 成功
      rec.expectedThrow = rec.redExit === 0 && rec.error.startsWith(RED_EXPECT_PREFIX);
      rec.throwStage = rec.expectedThrow ? "expected-red-exit0" : "unexpected";
      console.log(`${rec.expectedThrow ? "THROW   " : "UNEXPECT"} ${m.id}  ← ${rec.error}`);
    } else {
      console.log(`FAIL    ${m.id}  ← ${rec.error}`);
    }
  } finally {
    // R2-3.2：真 finally——无条件写回原字节 + SHA 复核；恢复自身失败 catch 并判红
    if (original !== null) {
      try {
        let nowSha = sha256(m.file);
        if (nowSha !== beforeSha) {
          writeFileSync(m.file, original);
          nowSha = sha256(m.file);
          rec.failOpenRecovered = true;
          console.log(`RECOVER ${m.id}  ← 异常路径残留注入态已由 finally 写回原字节`);
        }
        rec.restoredSha = nowSha;
        rec.restoredShaMatch = nowSha === beforeSha;
        if (!rec.restoredShaMatch) throw new Error("finally 复核仍与原 SHA 不符");
      } catch (e) {
        rec.restoreError = String(e.message ?? e).slice(0, 300);
        rec.restoredShaMatch = false;
        console.log(`RESTORE_FAIL ${m.id}  ← ${rec.restoreError}`);
      }
    }
    if (m.selftest) {
      // 四判据齐备才算通过：真实 throw + 变异态留证 + finally 兜底真写回 + SHA 全等
      rec.ok = Boolean(rec.expectedThrow && rec.mutatedDiffers && rec.failOpenRecovered && rec.restoredShaMatch);
      if (!rec.ok) {
        rec.error = `SELFTEST 判据不齐：expectedThrow=${rec.expectedThrow} mutatedDiffers=${rec.mutatedDiffers} failOpenRecovered=${rec.failOpenRecovered} restoredShaMatch=${rec.restoredShaMatch}`;
      } else {
        console.log(`OK      ${m.id}  ← 真实throw + 变异态(${rec.mutatedSha.slice(0, 8)}≠${beforeSha.slice(0, 8)}) + finally兜底 + SHA全等(${rec.restoredSha.slice(0, 8)})`);
      }
    }
    if (m.negative) {
      // 反例判据：真红(exit=1) ⇒ expectedThrow=false ⇒ SELFTEST 必败；且 finally 仍复原
      rec.negativeVerified = Boolean(rec.ok === false && rec.redExit === 1 && rec.restoredShaMatch);
      console.log(`${rec.negativeVerified ? "OK      " : "FAIL    "} ${m.id}  ← 反例真红必败：negativeVerified=${rec.negativeVerified}（redExit=${rec.redExit} ok=${rec.ok}）`);
    }
  }
  summary.results.push(rec);
  if (m.selftest) summary.selfTest = rec;
  if (m.negative) summary.negative = rec;
}

const agg = runAggregateSelfCheck();
if (process.env.WB_MENU_AGGREGATE_FAIL_PROBE === "1") {
  agg.passed = false;
  console.log("AGGREGATE_FAIL  ← 反探针：aggregateSelfCheck.passed 强制 false，走同一聚合路径（期望 allOk=false / exit=1）");
}
summary.aggregateSelfCheck = agg;
console.log(`聚合自检：${agg.cases} 用例 · ${agg.rows.filter((r) => r.ok).length}/${agg.cases} 符合预期 · passed=${agg.passed}`);
for (const r of agg.rows) console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.name}  expected=${r.expected} actual=${r.actual}`);

// 单点聚合：allOk 与 exitCode 都只由最终聚合结果决定
summary.allOk = computeAllOk(summary.results, summary.selfTest, summary.negative, summary.aggregateSelfCheck);
process.exitCode = summary.allOk ? 0 : 1;

const resultFile = path.join(outDir, "wb-menu-wiring-countertest-summary.json");
writeFileSync(resultFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\n小结：3 类点名红 + SELFTEST ${summary.selfTest?.ok ? "OK（真实异常路径）" : "FAIL"} + NEGATIVE ${summary.negative?.negativeVerified ? "OK（真红必败）" : "FAIL"}；聚合自检 ${agg.cases}/${agg.cases}；allOk=${summary.allOk}`);
console.log(`结果：${resultFile}`);
console.log(`EXIT_CODE ${process.exitCode}`);
