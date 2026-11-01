/**
 * WORKBENCH-12-WIRING-BATCH-A · mutation 反测装置（派单卡 §三-8「至少 4 类」）
 *
 * 反测清单（注入 → 断言点名红 → 逐字节复原 SHA256 恒等 → 复跑回绿）：
 *   M1 售后路径回退双段（api/aftersale.ts）
 *   M2 useRoute 挪回 onMounted 异步回调（PurchaseOrders.vue）
 *   M3 打印设置挂上假路由 path（manifest-pos.ts）
 *   M4 采购入库 useRoute 挪回异步回调（PurchaseInStocks.vue）
 *   M5 manifest 声明不存在的 routeName（假路由）
 *   M6 删除「本地动作集合」导出（消费方硬编码回归）
 *
 * 运行（工作树根）：node admin-web/tests/wiring-batch-a-countertest.mjs
 * 产出：../worktrees/ms/WORKBENCH-12 的 evidence 目录（由调用方复制到中央）
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const SRC = path.join(WEB, "src");

const TARGETS = {
  aftersale: path.join(SRC, "api", "aftersale.ts"),
  orders: path.join(SRC, "views", "purchase", "PurchaseOrders.vue"),
  stocks: path.join(SRC, "views", "purchase", "PurchaseInStocks.vue"),
  manifest: path.join(SRC, "shared", "workbench", "manifest-pos.ts"),
};

const SPEC = path.join(WEB, "tests", "wiring-batch-a.spec.mjs");
const sha256 = (b) => createHash("sha256").update(b).digest("hex").toUpperCase();

function runSpec() {
  try {
    const out = execFileSync(process.execPath, [SPEC], { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** 归一化后替换；找不到注入点即抛错（保证 mutation 真生效） */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 80)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

const CASES = [
  {
    id: "M1-aftersale-double-segment",
    title: "售后路径回退双段 /aftersales/aftersales",
    target: TARGETS.aftersale,
    mutate: (t) => patch(t, 'api.get("/admin/aftersales", { params })', 'api.get("/admin/aftersales/aftersales", { params })', "M1"),
    expect: "A1",
  },
  {
    id: "M2-useRoute-in-onMounted",
    title: "useRoute 挪回 onMounted 异步回调（PurchaseOrders）",
    target: TARGETS.orders,
    mutate: (t) =>
      patch(
        t,
        "const orderNo = route.query.orderNo as string | undefined;",
        "const orderNo = useRoute().query.orderNo as string | undefined;",
        "M2",
      ),
    expect: "B1",
  },
  {
    id: "M3-print-fake-route",
    title: "打印设置挂上假路由 path",
    target: TARGETS.manifest,
    mutate: (t) =>
      patch(
        t,
        `    /** 必须保持 null：非 null 会让外壳误当可跳转路由（见文件头说明） */
    path: null,
    title: "打印设置",`,
        `    path: "/pos/print-settings",
    title: "打印设置",`,
        "M3",
      ),
    expect: "C1",
  },
  {
    id: "M4-stocks-useRoute-in-onMounted",
    title: "采购入库 useRoute 挪回异步回调",
    target: TARGETS.stocks,
    mutate: (t) =>
      patch(
        t,
        "const stockNo = route.query.stockNo as string | undefined;",
        "const stockNo = useRoute().query.stockNo as string | undefined;",
        "M4",
      ),
    expect: "B1",
  },
  {
    id: "M5-manifest-fake-routeName",
    title: "manifest 声明不存在的 routeName",
    target: TARGETS.manifest,
    mutate: (t) =>
      patch(
        t,
        'item("web.pos.cashier", "pos-cashier", "/pos/cashier"',
        'item("web.pos.cashier", "pos-no-such-route", "/pos/no-such-route"',
        "M5",
      ),
    expect: "C2",
  },
  {
    id: "M6-drop-local-action-exports",
    title: "删除本地动作集合导出（消费方硬编码回归）",
    target: TARGETS.manifest,
    mutate: (t) =>
      patch(
        t,
        "/** 本地动作入口（无路由项）——供外壳与测试统一消费，避免各自硬编码判断 */\nexport const CASHIER_LOCAL_ACTION_ITEMS",
        "export const __REMOVED_LOCAL_ACTIONS =",
        "M6",
      ),
    expect: "C5",
  },
];

/* 基线 */
const originals = new Map();
for (const f of Object.values(TARGETS)) originals.set(f, readFileSync(f));

console.log("基线 SHA256：");
for (const [f, b] of originals) console.log(`  ${path.basename(f)} = ${sha256(b)}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.out.split("\n").filter((l) => l.startsWith("小结") || l.startsWith("FAIL")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿");

const records = [];
for (const c of CASES) {
  const original = readFileSync(c.target);
  const originalHash = sha256(original);
  const mutated = c.mutate(original.toString("utf8"));
  writeFileSync(c.target, mutated.replace(/\n/g, "\r\n"));
  const injectedHash = sha256(readFileSync(c.target));

  const r = runSpec();
  const fails = r.out.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = fails.some((l) => l.includes(c.expect));

  console.log(`\n[反测 ${c.id}] ${c.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${r.code}；FAIL=${fails.length}；点名「${c.expect}」=${named}`);
  for (const l of fails) console.log(`  ${l}`);

  writeFileSync(c.target, original);
  const restored = sha256(readFileSync(c.target));
  console.log(`  复原 SHA256 = ${restored}；恒等=${restored === originalHash}`);

  records.push({
    id: c.id,
    title: c.title,
    target: path.relative(WEB, c.target).replace(/\\/g, "/"),
    exitCode: r.code,
    failedCount: fails.length,
    named,
    expect: c.expect,
    fails,
    injectedHash,
    originalHash,
    restoredHash: restored,
    restoredIdentical: restored === originalHash,
  });

  assert.ok(named, `${c.id}: 未点名「${c.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${c.id}: 复原必须 SHA256 恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.out.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

/* 落盘 */
const OUT = process.argv[2] ?? path.join(WEB, "..", "evidence", "mutation");
mkdirSync(OUT, { recursive: true });

const md = [
  "# WORKBENCH-12-WIRING-BATCH-A mutation 反测记录",
  "",
  "> 被测用例：`admin-web/tests/wiring-batch-a.spec.mjs`（23 条）",
  "> 装置：`admin-web/tests/wiring-batch-a-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
  "",
  "| 反测 | 目标 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |",
  "|:--|:--|:--|--:|--:|:--:|:--:|",
  ...records.map((r) => `| ${r.id} | \`${r.target}\` | ${r.title} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} |`),
  "",
  "## 逐条 FAIL 原文",
  "",
  ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.fails, "```", ""]),
  "## SHA256 复原记录",
  "",
  "| 反测 | 基线 | 注入后 | 复原后 | 恒等 |",
  "|:--|:--|:--|:--|:--:|",
  ...records.map((r) => `| ${r.id} | \`${r.originalHash.slice(0, 16)}…\` | \`${r.injectedHash.slice(0, 16)}…\` | \`${r.restoredHash.slice(0, 16)}…\` | ${r.restoredIdentical ? "✅" : "❌"} |`),
  "",
  "## 复原后复跑",
  "",
  "```text",
  after.out.split("\n").filter((l) => l.startsWith("PASS") || l.startsWith("小结")).join("\n"),
  "```",
  "",
].join("\n");
writeFileSync(path.join(OUT, "wiring-batch-a-countertest.md"), md);
console.log(`\n证据已落盘：${path.join(OUT, "wiring-batch-a-countertest.md")}`);
console.log(`全部反测通过：${records.length}/${CASES.length} 点名变红 + ${records.length}/${CASES.length} SHA256 恒等 + 复原后回绿`);
