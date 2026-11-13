/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SALES-RETAIL-MARKETING-01 · Mutation 反测装置（M1-M5）
 *
 * 纪律（对齐 e2e/prototype12-mutation.mjs 口径）：
 *   1. 基线先绿（tests/prototype12-pages-sales-retail-marketing-contract.spec.mjs 全绿 EXIT 0）；
 *   2. 每次单点注入真实缺陷 → 跑门禁断言**点名红**（校验 FAIL 行含预期用例名）；
 *   3. 逐字节复原（SHA256 before==after，恒等；按原文件行尾风格写回）；
 *   4. 复跑同门禁回绿；
 *   5. 收工自检：git status --porcelain 前后快照相等（本装置不入库、不留痕）。
 *
 * 注入点全部落在本卡允许路径（sale/instant-retail/marketing 页面域），不触碰共享文件/router。
 * 门禁映射：
 *   M1 → 合同用例2 S5 COPY_BLACKLIST   → sale/CollectionLinks.vue 注入「设计说明」
 *   M2 → 合同用例11 空态精确集          → instant-retail/InstantRetailDelivery.vue 摘除 el-empty
 *   M3 → 合同用例6 订单状态机           → instant-retail/InstantRetailOrders.vue statusMap 改名
 *   M4 → 合同用例9 instant-retail API  → instant-retail/InstantRetailOrders.vue 摘除 fetchInstantOrders
 *   M5 → 合同用例12 loading 精确集      → marketing/CouponManage.vue 摘除 v-loading
 *
 * 运行（worktree 根）：
 *   node admin-web/e2e/prototype12-pages-sales-retail-marketing-mutation.mjs --out <中央证据目录>/mutations
 *   （未给 --out ⇒ 系统临时目录，可重复执行不留痕）
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, "..");
const REPO = path.resolve(WEB, "..");
const SRC = path.join(WEB, "src");

function parseOutArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") return argv[i + 1] ?? "";
    if (argv[i].startsWith("--out=")) return argv[i].slice("--out=".length);
  }
  return "";
}

const OUT_RAW = parseOutArg(process.argv.slice(2));
const OUT_IS_TMP = OUT_RAW.length === 0;
const OUT = OUT_IS_TMP
  ? path.join(os.tmpdir(), "wen-ssystem-mutation", "P12-PAGES-SRM", "redtest")
  : path.resolve(OUT_RAW);

// 红线守卫：--out 绝不允许指向代码仓工作树内部
const outRel = path.relative(REPO, path.resolve(OUT));
if (!outRel.startsWith("..") && !path.isAbsolute(outRel)) {
  throw new Error(`--out 不得指向代码仓内部：${OUT}（仓库根：${REPO}）`);
}
mkdirSync(OUT, { recursive: true });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

function repoDirty() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** 在归一化(LF)文本中定位并替换；找不到即抛错（保证 mutation 真生效） */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 100)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

/** 按原文件行尾风格写回（写错会让工作树凭空变脏） */
function writeKeepingEol(file, originalText, newText) {
  const crlf = originalText.includes("\r\n");
  writeFileSync(file, crlf ? newText.replace(/\n/g, "\r\n") : newText);
}

/** 门禁 runner：跑 27 页合同 spec，返回 { code, stdout } */
function runGates() {
  const gatesPath = path.join(here, "..", "tests", "prototype12-pages-sales-retail-marketing-contract.spec.mjs");
  try {
    const stdout = execFileSync(process.execPath, [gatesPath], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const rel = (p) => path.join(SRC, p);

/** 五类 mutation：id / 文件 / 期望点名红的关键词 / patches(from→to 多补丁) */
const MUTATIONS = [
  {
    id: "M1",
    why: "COPY_BLACKLIST 回潮（设计说明注入收款链接页）",
    file: "views/sale/CollectionLinks.vue",
    expectFailMarkers: ["COPY_BLACKLIST", "设计说明"],
    patches: [
      { from: `<p class="page-desc">分享收款链接管理</p>`, to: `<p class="page-desc">分享收款链接管理 设计说明</p>` },
    ],
  },
  {
    id: "M2",
    why: "列表空态摘除（配送记录空态消失）",
    file: "views/instant-retail/InstantRetailDelivery.vue",
    expectFailMarkers: ["空态合同", "el-empty"],
    patches: [
      {
        from: `<template #empty>
          <el-empty description="暂无配送记录" />
        </template>`,
        to: `<template #empty>
        </template>`,
      },
    ],
  },
  {
    id: "M3",
    why: "订单状态机漂移（PENDING 中文名改写）",
    file: "views/instant-retail/InstantRetailOrders.vue",
    // 断言输出列出的是「缺失的期望行」（含原中文名），故点名标记取原值「待确认」
    expectFailMarkers: ["状态机漂移", "待确认"],
    patches: [
      { from: `PENDING: { name: "待确认", type: "primary" }`, to: `PENDING: { name: "待接单", type: "primary" }` },
    ],
  },
  {
    id: "M4",
    why: "API 绑定摘除（订单页失去 fetchInstantOrders：导入与调用点同时摘除）",
    file: "views/instant-retail/InstantRetailOrders.vue",
    expectFailMarkers: ["API 绑定缺失", "InstantRetailOrders.vue 缺 fetchInstantOrders"],
    patches: [
      { from: `  fetchInstantOrders,\n  fetchInstantOrderDetail,`, to: `  fetchInstantOrderDetail,` },
      { from: `await fetchInstantOrders(params)`, to: `await fetchOrdersList(params)` },
    ],
  },
  {
    id: "M5",
    why: "loading 态摘除（优惠券表格失去 v-loading）",
    file: "views/marketing/CouponManage.vue",
    expectFailMarkers: ["loading 合同", "v-loading"],
    patches: [
      { from: `<el-table :data="coupons" v-loading="loading" stripe>`, to: `<el-table :data="coupons" stripe>` },
    ],
  },
];

const log = (...a) => console.log(new Date().toISOString(), ...a);
const summary = { ts: new Date().toISOString(), baseline: {}, mutations: [], gitStatusClean: null };

/* ── 0. 基线必须先绿 ── */
const gitBefore = repoDirty();
const base = runGates();
summary.baseline = { exitCode: base.code, tail: base.stdout.split("\n").slice(-2).join("\n").trim() };
if (base.code !== 0) {
  console.error("基线不是绿门禁，拒绝注入（先修基线再反测）：\n" + base.stdout);
  process.exit(2);
}
// 用例数从门禁真实输出解析（禁止硬编码，避免陈旧字面量自述与实测不符）
const caseCount = (base.stdout.match(/小结：\s*(\d+)\s*passed\s*\/\s*(\d+)\s*failed/) || [])[1];
if (!caseCount) {
  console.error("无法从门禁输出解析用例数，拒绝继续：\n" + base.stdout);
  process.exit(2);
}
summary.baseline.caseCount = Number(caseCount);
log(`基线绿 ✓ EXIT=0（${caseCount} 用例）`);

/* ── 1..5 逐类注入 → 点名红 → 复原 → 回绿 ── */
let allOk = true;
for (const m of MUTATIONS) {
  const entry = { id: m.id, why: m.why, file: m.file };
  const file = rel(m.file);
  const beforeBuf = readFileSync(file);
  entry.sha256Before = sha256(beforeBuf);

  // 注入（逐补丁）
  let patched = beforeBuf.toString("utf8");
  for (const [i, p] of m.patches.entries()) {
    patched = patch(patched, p.from, p.to, `${m.id}#${i}`);
  }
  writeKeepingEol(file, beforeBuf.toString("utf8"), patched);
  const red = runGates();
  entry.redExitCode = red.code;
  entry.redMarkers = m.expectFailMarkers.map((k) => ({ marker: k, hit: red.stdout.includes(k) }));
  const namedRed = red.code !== 0 && entry.redMarkers.every((x) => x.hit);

  // 复原（逐字节）
  writeFileSync(file, beforeBuf);
  const afterBuf = readFileSync(file);
  entry.sha256After = sha256(afterBuf);
  const restored = entry.sha256Before === entry.sha256After;

  // 回绿
  const green = runGates();
  entry.greenExitCode = green.code;

  entry.ok = namedRed && restored && green.code === 0;
  allOk = allOk && entry.ok;
  summary.mutations.push(entry);
  log(`${entry.ok ? "PASS" : "FAIL"} [${m.id}] ${m.why} → 红=${red.code !== 0}(点名=${namedRed}) 复原=${restored} 回绿=${green.code === 0}`);
}

/* ── 收工自检：git status 前后快照恒等 ── */
const gitAfter = repoDirty();
summary.gitStatusClean = JSON.stringify(gitBefore) === JSON.stringify(gitAfter);
log(`git status 不留痕=${summary.gitStatusClean}（快照 ${gitBefore.length} 行前后恒等）`);

const outJson = path.join(OUT, "mutation-red-green.json");
writeFileSync(outJson, JSON.stringify(summary, null, 2));
log(`证据落盘：${outJson}`);

if (!allOk || !summary.gitStatusClean) {
  console.error("存在未闭环的 mutation，禁止进入门禁阶段");
  process.exit(1);
}
console.log("\n小结：5/5 mutation 红绿闭环 + 复原恒等 + 工作树不留痕");
process.exit(0);
