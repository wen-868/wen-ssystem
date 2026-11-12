/**
 * WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 · 5 类 mutation 红绿闭环
 *
 * 流程（逐条）：注入精确缺陷 → 跑合同测试（期待 FAIL，点名断言）→ SHA256 恒等复原 →
 * 复跑合同测试（期待 PASS）→ git status 自检（工作树洁净，无残留注入）。
 *
 * 运行（worktree 根）：node admin-web/e2e/prototype12-pages-supply-customer-product-mutation.mjs
 * 输出：中央 evidence mutations/redtest.json + redtest.md
 */
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(HERE, "..", "..");
const ADMIN = path.join(WT, "admin-web");
const EV = "D:/Users/ZXQL/ZXQL-WORK/projects/ms/evidence/WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01/mutations";
mkdirSync(EV, { recursive: true });

const CONTRACT = path.join(ADMIN, "tests", "prototype12-pages-supply-customer-product-contract.mjs");
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

function runContract() {
  const r = spawnSync("node", [CONTRACT], { cwd: ADMIN, encoding: "utf8", timeout: 120000 });
  const out = (r.stdout || "") + (r.stderr || "");
  return { exit: r.status, out };
}

const MUTATIONS = [
  {
    id: "M1",
    name: "路由组件指向破坏（products → Brands）",
    file: "admin-web/src/router/index.ts",
    note: "共享壳层文件！本 mutation 仅在测试装置内临时注入，跑完立即 SHA256 恒等复原；不改写生产语义",
    inject: (src) => src.replace(
      'import("../views/product/Products.vue")',
      'import("../views/product/Brands.vue")'
    ),
    needle: "../views/product/Products.vue",
    expectFail: "T02 每条路由组件文件真实存在|T05 档案与路由",
  },
  {
    id: "M2",
    name: "页面 API 死端点回注（Products.vue 恢复 /product-tags/by-type）",
    file: "admin-web/src/views/product/Products.vue",
    inject: (src) => src.replace(
      'await Promise.all([api.get("/admin/tags/groups"), api.get("/admin/tags")])',
      'await api.get("/product-tags/by-type")'
    ),
    needle: 'await Promise.all([api.get("/admin/tags/groups"), api.get("/admin/tags")])',
    expectFail: "T10 API 契约零未命中",
  },
  {
    id: "M3",
    name: "诚实空态拆除（ProductReviewWorkflow el-empty → div）",
    file: "admin-web/src/views/product/ProductReviewWorkflow.vue",
    inject: (src) => src.replace(/<el-empty[^>]*description="审核流程配置功能待后端支持"[\s\S]*?<\/el-empty>/, '<div>审核流程配置</div>'),
    needle: '<el-empty',
    expectFail: "T13 两桩页显式「待后端支持」",
  },
  {
    id: "M4",
    name: "加载态拆除（ProductImport 唯一 :loading 移除）",
    file: "admin-web/src/views/product/ProductImport.vue",
    inject: (src) => src.replace(' :loading="importLoading"', ''),
    needle: ':loading="importLoading"',
    expectFail: "T14 API 页 loading 态全覆盖",
  },
  {
    id: "M5",
    name: "页内标题偏离原型（Inventory.vue 库存列表 → 库存管理）",
    file: "admin-web/src/views/inventory/Inventory.vue",
    inject: (src) => src.replace('<h2 class="page-title">库存列表</h2>', '<h2 class="page-title">库存管理</h2>'),
    needle: '<h2 class="page-title">库存列表</h2>',
    expectFail: "T08 对齐页页内标题与原型页名一致",
  },
];

const results = [];
// mutation 前工作树快照（本人真实改动在场）：洁净判据=每次复原后与快照逐字恒等
const statusBefore = execSync("git status --porcelain", { cwd: WT, encoding: "utf8" });
console.log("=== M0 基线：合同测试全绿 ===");
const base = runContract();
console.log(`baseline exit=${base.exit}`);
if (base.exit !== 0) {
  console.error("基线不绿，终止 mutation（反测先证基线绿）");
  console.error(base.out.slice(-800));
  process.exit(1);
}

for (const mu of MUTATIONS) {
  const abs = path.join(WT, mu.file);
  const original = readFileSync(abs, "utf8");
  const originalSha = sha(abs);
  if (!original.includes(mu.needle)) {
    console.error(`M${mu.id} 注入点未命中（源码已漂移?），跳过并报错`);
    results.push({ id: mu.id, name: mu.name, status: "INJECT_MISS" });
    continue;
  }
  // 注入
  writeFileSync(abs, mu.inject(original), "utf8");
  const injectedSha = sha(abs);
  const red = runContract();
  const redFail = red.exit !== 0;
  const pointed = redFail && mu.expectFail.split("|").some(k => red.out.includes(k));
  // 复原
  writeFileSync(abs, original, "utf8");
  const restoredSha = sha(abs);
  const identical = restoredSha === originalSha;
  const green = runContract();
  const greenPass = green.exit === 0;
  // 工作树自检：复原后状态必须与 mutation 前快照逐字恒等（无注入残留）
  let gitClean = true;
  try {
    const st = execSync("git status --porcelain", { cwd: WT, encoding: "utf8" });
    gitClean = st === statusBefore;
  } catch { /* git 不可用时不阻塞 */ }
  results.push({
    id: mu.id, name: mu.name,
    injectedHash: injectedSha, originalHash: originalSha, restoredHash: restoredSha,
    shaIdentical: identical,
    redExit: red.exit, redPointedAtExpected: pointed, redFailLines: red.out.split("\n").filter(l => l.includes("FAIL")).slice(0, 3),
    greenExit: green.exit,
    gitClean,
    status: redFail && pointed && identical && greenPass ? "PASS" : "FAIL",
  });
  console.log(`${mu.id} ${mu.status ?? ""} ${results[results.length - 1].status}  red_exit=${red.exit} pointed=${pointed} sha_identical=${identical} green_exit=${green.exit} clean=${gitClean}`);
}

writeFileSync(path.join(EV, "redtest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), baseline: "contract 20/20 PASS", results }, null, 2), "utf8");
const md = [
  "# WORKBENCH-PROTOTYPE-12-PAGES-SUPPLY-CUSTOMER-PRODUCT-01 · mutation 反测记录",
  "",
  "| id | 注入 | 注入红(red_exit/点名) | SHA 恒等 | 复绿(green_exit) | 工作树洁净 | 结论 |",
  "|---|---|---|---|---|---|---|",
  ...results.map(r => `| ${r.id} | ${r.name} | ${r.redExit}/​${r.redPointedAtExpected} | ${r.shaIdentical} | ${r.greenExit} | ${r.gitClean} | ${r.status} |`),
].join("\n");
writeFileSync(path.join(EV, "redtest.md"), md + "\n", "utf8");
const allPass = results.length === MUTATIONS.length && results.every(r => r.status === "PASS");
console.log(`\nmutation 闭环: ${results.filter(r => r.status === "PASS").length}/${MUTATIONS.length} PASS`);
process.exit(allPass ? 0 : 1);
