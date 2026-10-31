/**
 * WORKBENCH-10 · 原型 UIUX 契约 mutation 反测装置
 *
 * 逐条注入 → 断言**点名红** → 逐字节复原 SHA256 恒等 → 复跑回绿。
 *
 * 反测清单（每条对应派单卡 §四-A / §六 的一条禁止事项）：
 *   ① rail 漏项（删掉两个一级业务模块）              ⇒ §A.1「不缺项」红
 *   ② rail 顺序回退（按 manifest 顺序而非原型顺序）   ⇒ §A.1「顺序≥原型」红
 *   ③ 二级目录丢项（库存 12 项砍到 10 项）            ⇒ §五.2「数量与名称可机器对照」红
 *   ④ 设置不回落（无专属目录时不再回落常用功能）       ⇒ 原型 heading=常用功能 实测红
 *   ⑤ 折叠宽度归零（56 → 0，侧栏收没了）             ⇒ §A.4「可折叠」红
 *   ⑥ toggle 不取消（再点不恢复常用功能）             ⇒ §A.3「再次点击恢复」红
 *   ⑦ pending 静默丢弃（只渲染已接线项）              ⇒ §六「不得以没有字段为由删结构」红
 *   ⑧ 第二栏标题照抄一级名（销售 → 销售管理）         ⇒ 原型 heading 实测红
 *   ⑨ Shell rail 回退按 manifest 原顺序渲染           ⇒ 「顺序必须由真相源决定」红
 *
 * 运行（工作树根目录）：
 *   node admin-web/tests/prototype-nav-countertest.mjs --out <中央证据目录>
 *
 * 产物（沿用 WORKBENCH-07F1 纪律）：
 *   - 显式 `--out <dir>` ⇒ 写该绝对路径（相对路径按当前 cwd 解析为绝对路径）；
 *   - 未显式给 `--out` ⇒ 只写系统临时目录（可重复执行，不留痕）；
 *   - **绝不写代码仓**：内置守卫在写入前拒收任何落在仓库工作树内的 --out。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.resolve(path.join(WEB, ".."));
const SRC = path.join(WEB, "src");

/** 解析 --out <dir> / --out=<dir>；未给则空串 */
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
  ? path.join(os.tmpdir(), "wen-ssystem-mutation", "WORKBENCH-10", "redtest")
  : path.resolve(OUT_RAW); // 绝对路径解析：相对路径一律按 cwd 归一

// 红线守卫①：--out 绝不允许指向代码仓工作树内部
// （跨盘符时 path.relative 会返回目标绝对路径，故必须同时排除绝对路径结果）
const outRel = path.relative(REPO, path.resolve(OUT));
if (!outRel.startsWith("..") && !path.isAbsolute(outRel)) {
  throw new Error(`--out 不得指向代码仓内部：${OUT}（仓库根：${REPO}）`);
}
mkdirSync(OUT, { recursive: true });

const TRUTH = path.join(SRC, "shared", "workbench", "prototype-nav.ts");
const SHELL = path.join(SRC, "layouts", "WorkbenchShell.vue");
const SPEC = path.join(here, "prototype-nav.spec.mjs");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

/** 代码仓工作树的 git status --porcelain 行（不含空行） */
function repoDirty() {
  return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function runSpec() {
  try {
    const stdout = execFileSync(process.execPath, [SPEC], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** 在归一化(LF)文本中定位并替换；找不到即抛错（保证 mutation 真生效） */
function patch(text, from, to, id) {
  const norm = text.replace(/\r\n/g, "\n");
  const f = from.replace(/\r\n/g, "\n");
  assert.ok(norm.includes(f), `${id}: 注入点未找到 → ${f.slice(0, 90)}`);
  return norm.replace(f, to.replace(/\r\n/g, "\n"));
}

/** 按原文件行尾风格写回（本仓 .vue 为 CRLF、.ts 为 LF，写错会让工作树凭空变脏） */
function writeKeepingEol(file, originalText, newText) {
  const crlf = originalText.includes("\r\n");
  writeFileSync(file, crlf ? newText.replace(/\n/g, "\r\n") : newText);
}

const CASES = [
  {
    id: "W1-rail-missing-modules",
    title: "① rail 漏项：删掉「商品中心 / 数据报表」两个一级业务模块",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  { key: "product", label: "商品中心", title: "商品中心", groupCode: "wb.product", kind: "module" },
  { key: "instant-retail", label: "即时零售", title: "即时零售", groupCode: "wb.instant-retail", kind: "module" },
  { key: "finance", label: "财务管理", title: "财务管理", groupCode: "wb.finance", kind: "module" },
  { key: "report", label: "数据报表", title: "数据报表", groupCode: "wb.report", kind: "module" },`,
        `  { key: "instant-retail", label: "即时零售", title: "即时零售", groupCode: "wb.instant-retail", kind: "module" },
  { key: "finance", label: "财务管理", title: "财务管理", groupCode: "wb.finance", kind: "module" },
  // MUTATION-W1：静默删掉「商品中心 / 数据报表」两项`,
        "W1",
      ),
    expect: "一级 rail：项数",
    expectExit: 1,
  },
  {
    id: "W2-rail-order-fallback-manifest",
    title: "② rail 顺序回退：把「销售管理 / 订单管理」对调（退回 manifest 式随意顺序）",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  { key: "sales", label: "销售管理", title: "销售管理", groupCode: "wb.sales", kind: "module" },
  { key: "order", label: "订单管理", title: "订单管理", groupCode: "wb.order", kind: "module" },`,
        `  // MUTATION-W2：顺序回退为随意顺序，不再遵循原型 vanilla
  { key: "order", label: "订单管理", title: "订单管理", groupCode: "wb.order", kind: "module" },
  { key: "sales", label: "销售管理", title: "销售管理", groupCode: "wb.sales", kind: "module" },`,
        "W2",
      ),
    expect: "一级 rail：顺序逐项",
    expectExit: 1,
  },
  {
    id: "W3-subcatalog-dropped",
    title: "③ 二级目录丢项：库存 12 项砍到 10 项（删库存预警 / 效期预警）",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `    "库存预警",
    "库存成本",`,
        `    "库存成本",
    // MUTATION-W3：静默丢掉「库存预警」`,
        "W3",
      ),
    expect: "二级目录：13 组逐组",
    expectExit: 1,
  },
  {
    id: "W4-settings-no-fallback",
    title: "④ 设置不回落：无专属目录时不再回落常用功能",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  const own = PROTOTYPE_SUBCATALOG[railKey];
  return own && own.length > 0 ? railKey : "desk";`,
        `  return railKey; // MUTATION-W4：取消回落，设置项渲染成空第二栏`,
        "W4",
      ),
    expect: "设置项回落",
    expectExit: 1,
  },
  {
    id: "W5-collapse-to-zero",
    title: "⑤ 折叠宽度归零：56 → 0（侧栏直接收没）",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  sideCollapsedWidth: 56,`,
        `  sideCollapsedWidth: 0, // MUTATION-W5：折叠态消失`,
        "W5",
      ),
    expect: "折叠宽度",
    expectExit: 1,
  },
  {
    id: "W6-toggle-no-deselect",
    title: "⑥ toggle 不取消：再点同一模块不恢复常用功能",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  return selected === clicked ? null : clicked;`,
        `  return clicked; // MUTATION-W6：取消失效，点了就回不来`,
        "W6",
      ),
    expect: "再次点击同项",
    expectExit: 1,
  },
  {
    id: "W7-pending-silently-dropped",
    title: "⑦ pending 静默丢弃：只渲染已接线项（以「现有接口没有字段」为由删结构）",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `    return { label, status: "wired", item };
  });
}`,
        `    return { label, status: "wired", item };
    // MUTATION-W7：pending 项被静默丢弃（§六 禁止：不得以现有接口没有字段为由删结构）
  }).filter((e) => e.status === "wired");
}`,
        "W7",
      ),
    expect: "manifest 全空",
    expectExit: 1,
  },
  {
    id: "W8-head-copied-from-rail",
    title: "⑧ 第二栏标题照抄一级名：销售 → 销售管理",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `  sales: "销售",`,
        `  sales: "销售管理", // MUTATION-W8：标题照抄一级名，与原型 heading=销售 不符`,
        "W8",
      ),
    expect: "第二栏短标题逐项",
    expectExit: 1,
  },
  {
    id: "W9-shell-rail-order-revert",
    title: "⑨ Shell rail 回退按 manifest 原顺序（visibleGroups）渲染",
    target: SHELL,
    mutate: (t) =>
      patch(
        t,
        `        v-for="group in railModules"`,
        `        v-for="group in visibleGroups" <!-- MUTATION-W9：回归 manifest 原顺序 -->`,
        "W9",
      ),
    expect: "rail 顺序写回 manifest 原顺序",
    expectExit: 1,
  },
  {
    id: "W10-rail-duplicate-dashboard",
    title: "⑩ rail 尾部重复渲染已被 desk 固定项占用的 wb.dashboard",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `    if (fixedCodes.has(code)) continue; // 固定项已承载，避免重复 rail 项`,
        `    // MUTATION-W10：不再跳过固定项已占用的分组（会让「工作台」出现两次）`,
        "W10",
      ),
    expect: "不得在 rail 尾部重复渲染",
    expectExit: 1,
  },
  {
    id: "W11-rail-label-exposes-groupcode",
    title: "⑪ 原型未声明分组的 rail 标签退回 groupCode（UI 出现 wb.xxx）",
    target: TRUTH,
    mutate: (t) =>
      patch(
        t,
        `    const label = group.title || code;`,
        `    const label = code; // MUTATION-W11：把分组码暴露到 UI`,
        "W11",
      ),
    expect: "绝不把 groupCode 暴露到 UI",
    expectExit: 1,
  },
  {
    id: "W12-shell-collapse-prop-unbound",
    title: "⑫ Shell 不再把折叠态传给 Subnav（折叠缩略条永不渲染）",
    target: SHELL,
    mutate: (t) =>
      patch(
        t,
        `      :collapsed="sideCollapsed"\n`,
        ``,
        "W12",
      ),
    expect: "Shell 必须把折叠态传给 Subnav",
    expectExit: 1,
  },
];

// 基线：mutation 前的工作树读数（守卫②的比对基准）
const dirtyBefore = repoDirty();
console.log(`工作树基线：git status --porcelain = ${dirtyBefore.length} 行`);

const originals = new Map();
for (const f of [TRUTH, SHELL]) originals.set(f, readFileSync(f));
console.log("基线 SHA256：");
for (const [f, buf] of originals) console.log(`  ${path.basename(f)} = ${sha256(buf)}`);

const base = runSpec();
console.log(`\n基线复跑（应绿）：EXIT=${base.code}`);
console.log(base.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(base.code, 0, "基线必须为绿");

const records = [];
for (const item of CASES) {
  const original = readFileSync(item.target);
  const originalText = original.toString("utf8");
  const originalHash = sha256(original);
  const mutated = item.mutate(originalText);
  assert.notEqual(mutated, originalText.replace(/\r\n/g, "\n"), `${item.id}: 注入未生效`);
  writeKeepingEol(item.target, originalText, mutated);
  const injectedHash = sha256(readFileSync(item.target));

  const result = runSpec();
  const failedLines = result.stdout.split("\n").filter((l) => l.startsWith("FAIL"));
  const named = failedLines.some((l) => l.includes(item.expect));

  console.log(`\n[反测 ${item.id}] ${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${result.code}；FAIL=${failedLines.length}；点名「${item.expect}」=${named}`);
  for (const l of failedLines) console.log(`  ${l}`);

  writeFileSync(item.target, original);
  const restoredHash = sha256(readFileSync(item.target));
  console.log(`  复原 SHA256 = ${restoredHash}；恒等=${restoredHash === originalHash}`);

  records.push({
    id: item.id,
    title: item.title,
    target: path.relative(WEB, item.target).replace(/\\/g, "/"),
    exitCode: result.code,
    failedCount: failedLines.length,
    named,
    expect: item.expect,
    injectedHash,
    originalHash,
    restoredHash,
    restoredIdentical: restoredHash === originalHash,
    failedLines,
  });

  assert.equal(result.code, item.expectExit, `${item.id}: 注入后必须变红`);
  assert.ok(named, `${item.id}: 未点名「${item.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原 SHA256 必须恒等`);
}

const after = runSpec();
console.log(`\n复原后复跑：EXIT=${after.code}`);
console.log(after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"));
assert.equal(after.code, 0, "复原后必须回绿");

// ── 红线守卫②：收工自检，本装置不得让代码仓工作树的 git status 发生任何变化 ──
const dirtyAfter = repoDirty();
const added = dirtyAfter.filter((l) => !dirtyBefore.includes(l));
const removed = dirtyBefore.filter((l) => !dirtyAfter.includes(l));
assert.deepEqual(added, [], `本装置弄脏了工作树：\n${added.join("\n")}`);
assert.deepEqual(removed, [], `工作树凭空少了行（装置越权清理）：\n${removed.join("\n")}`);

writeFileSync(
  path.join(OUT, "redtest.md"),
  [
    "# WORKBENCH-10 原型 UIUX 契约 mutation 反测记录",
    "",
    "> 被测用例：`admin-web/tests/prototype-nav.spec.mjs`（33 条）",
    "> 装置：`admin-web/tests/prototype-nav-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 → 复跑回绿）",
    `> 输出目录（绝对路径）：\`${OUT}\`${OUT_IS_TMP ? "（未给 --out ⇒ 系统临时目录）" : "（--out 显式指定）"}`,
    `> 代码仓工作树：\`${REPO}\`（本装置不向其写入任何证据）`,
    "",
    "| 反测 | 目标 | 注入 | EXIT | FAIL | 点名 | 复原恒等 |",
    "|:--|:--|:--|--:|--:|:--:|:--:|",
    ...records.map(
      (r) =>
        `| ${r.id} | \`${r.target}\` | ${r.title} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} |`,
    ),
    "",
    "## 逐条 FAIL 原文",
    "",
    ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.failedLines, "```", ""]),
    "## 工作树洁净度",
    "",
    "| 读数 | git status --porcelain |",
    "|:--|--:|",
    `| mutation 运行前 | ${dirtyBefore.length} 行 |`,
    `| mutation 运行后 | ${dirtyAfter.length} 行 |`,
    `| 新增行 | ${added.length} |`,
    `| 减少行 | ${removed.length} |`,
    "",
    "## 复原后复跑",
    "",
    "```text",
    after.stdout.split("\n").filter((l) => l.startsWith("小结")).join("\n"),
    "```",
    "",
  ].join("\n"),
);

writeFileSync(path.join(OUT, "redtest.json"), `${JSON.stringify(records, null, 2)}\n`);

const passed = records.filter((r) => r.named && r.restoredIdentical && r.exitCode === 1).length;
console.log(
  `\n小结：${passed}/${CASES.length} 点名变红 + ${records.filter((r) => r.restoredIdentical).length}/${CASES.length} SHA256 恒等 + 复原后回绿`,
);
console.log(`证据目录：${OUT}`);
