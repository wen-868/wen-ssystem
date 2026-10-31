/**
 * WORKBENCH-10-UIUX-PARITY-F1 · 六区补齐的 mutation 反测装置（硬验收 7）
 *
 * 逐条注入 → 断言**点名红** → 逐字节复原 SHA256 恒等 → 复跑回绿。
 * 覆盖 ≥8 类（本装置 12 类），每条对应派单卡 §一/§四/§五/§六 的一条禁止事项：
 *   ① M1 B 播报无端点却报 ready（伪造指标）        ⇒ 「五个装载器不注入读取器一律 unavailable」红
 *   ② M2 B 不可用块不给重试入口（把失败藏起来）     ⇒ 「每块四件齐：loading / note / retry / empty」红
 *   ③ M3 C 归档端点缺失却回 ok:true（伪成功）      ⇒ 「归档动作：ok:false + unavailable」红
 *   ④ M4 C 会话列表弹「已归档」成功 toast          ⇒ 「会话列表 UI 红线」红
 *   ⑤ M5 C 对话面塞原型人名（王强）                ⇒ 「守恒红线：对话面无原型人名演示数据」红
 *   ⑥ M6 D 待接入分支也清车结算（假交易成功）       ⇒ 「收银台接线指向真实端点实现」红
 *   ⑦ M7 D 付款码长度放宽（16–24 位口径漂）         ⇒ 「弹层三按钮与原型逐字一致；付款码门槛」红
 *   ⑧ M8 E 设置中心砍掉一个 Tab（7→6）             ⇒ 「§三.E.1 设置中心恰有 7 个 Tab」红
 *   ⑨ M9 E 暗色不写 DOM 属性（只改 UI 显示值）      ⇒ 「亮色不残留 data-wb-theme 属性」红
 *   ⑩ M10 F 390 断点漂到 420（窄口改造失效）        ⇒ 「断点真相源＝390px，媒体查询串与之同源」红
 *   ⑪ M11 G 生产构建也开放测试注入（越权口子）      ⇒ 「生产构建恒不激活」红
 *   ⑫ M12 G 恒跳过菜单桥交集（注入写进生产判定）    ⇒ 「跳过交集只发生在激活态」红
 *
 * 运行（工作树 admin-web 目录）：
 *   node tests/wb-f1-mutation-countertest.mjs --out <中央证据目录>
 *
 * 产物纪律（沿用 WORKBENCH-10 既有装置）：
 *   - 显式 `--out <dir>` ⇒ 写该绝对路径；未给 ⇒ 只写系统临时目录；
 *   - **绝不写代码仓**：写入前拒收任何落在工作树内的 --out；
 *   - 结束时用 `git status --porcelain` 自证本装置没有弄脏工作树。
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
  ? path.join(os.tmpdir(), "wen-ssystem-mutation", "WORKBENCH-10-F1", "redtest")
  : path.resolve(OUT_RAW);

// 红线守卫：--out 绝不允许指向代码仓工作树内部
const outRel = path.relative(REPO, path.resolve(OUT));
if (!outRel.startsWith("..") && !path.isAbsolute(outRel)) {
  throw new Error(`--out 不得指向代码仓内部：${OUT}（工作树根：${REPO}）`);
}
mkdirSync(OUT, { recursive: true });

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const F = {
  broadcast: path.join(SRC, "shared", "workbench", "wb-feed-broadcast.ts"),
  feedView: path.join(SRC, "components", "workbench", "AiFeedView.vue"),
  chatSessions: path.join(SRC, "shared", "workbench", "wb-chat-sessions.ts"),
  sessionList: path.join(SRC, "components", "AiChat", "AiSessionList.vue"),
  composer: path.join(SRC, "components", "workbench", "AiChatComposer.vue"),
  cashier: path.join(SRC, "views", "pos", "CashierView.vue"),
  posCheckout: path.join(SRC, "shared", "workbench", "wb-pos-checkout.ts"),
  settings: path.join(SRC, "shared", "workbench", "wb-settings.ts"),
  theme: path.join(SRC, "shared", "workbench", "wb-theme.ts"),
  viewport: path.join(SRC, "shared", "workbench", "wb-viewport.ts"),
  injection: path.join(SRC, "shared", "workbench", "wb-uiux-injection.ts"),
};

const SPEC = {
  b: path.join(here, "wb-b-feed.spec.mjs"),
  cSessions: path.join(here, "wb-c-chat-sessions.spec.mjs"),
  cInteraction: path.join(here, "wb-c-chat-interaction.spec.mjs"),
  d: path.join(here, "wb-d-pos.spec.mjs"),
  e: path.join(here, "wb-e-settings.spec.mjs"),
  f: path.join(here, "wb-f-narrow.spec.mjs"),
  g: path.join(here, "wb-g-injection.spec.mjs"),
};
const ALL_SPECS = [SPEC.b, SPEC.cSessions, SPEC.cInteraction, SPEC.d, SPEC.e, SPEC.f, SPEC.g];

function runSpec(specPath) {
  try {
    const stdout = execFileSync(process.execPath, [specPath], {
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

/** 按原文件行尾风格写回（本仓 .vue 多为 CRLF、.ts 为 LF，写错会让工作树凭空变脏） */
function writeKeepingEol(file, originalText, newText) {
  const crlf = originalText.includes("\r\n");
  writeFileSync(file, crlf ? newText.replace(/\n/g, "\r\n") : newText);
}

function repoDirty() {
  try {
    return execFileSync("git", ["status", "--porcelain"], { cwd: REPO, encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (err) {
    return [`<git status 不可用：${String(err).split("\n")[0]}>`];
  }
}

const CASES = [
  {
    id: "M1-broadcast-fake-ready",
    zone: "B",
    title: "① 播报无端点却报 ready：伪造三条 GMV/退款/毛利指标",
    target: F.broadcast,
    spec: SPEC.b,
    expect: "五个装载器不注入读取器一律 unavailable",
    mutate: (t) =>
      patch(
        t,
        `  if (!deps.fetchBroadcasts) {
    return {
      state: "unavailable",
      data: [],
      message: "经营异动播报尚未接入：GMV 环比 / 退款率 / 毛利异动与 AI 建议需要底座播报端点（现无此端点，不本地伪造）",
    };
  }`,
        `  if (!deps.fetchBroadcasts) {
    // MUTATION-M1：端点不存在也报 ready，并塞演示数字（§一 禁止假数字/假播报）
    return {
      state: "ready",
      data: [
        { metric: "GMV 环比", value: "+12.4%", advice: "客流回暖，建议加大补货", needHumanCheck: false },
        { metric: "退款率", value: "0.8%", advice: "属正常区间", needHumanCheck: false },
        { metric: "毛利异动", value: "-3.1%", advice: "关注促销折损", needHumanCheck: false },
      ],
      message: "",
    };
  }`,
        "M1",
      ),
  },
  {
    id: "M2-no-retry-entry",
    zone: "B",
    title: "② 不可用/失败块不给重试入口（把失败态藏起来）",
    target: F.feedView,
    spec: SPEC.b,
    expect: "每块四件齐：loading / note / retry / empty",
    mutate: (t) =>
      patch(
        t,
        `function canRetry(state: FeedBlockState): boolean {
  return state === "error" || state === "unavailable";
}`,
        `function canRetry(state: FeedBlockState): boolean {
  return false; // MUTATION-M2：一律判不可重试，待接入块失去重试入口
}`,
        "M2",
      ),
  },
  {
    id: "M3-archive-fake-success",
    zone: "C",
    title: "③ 归档端点缺失却回 ok:true（伪成功）",
    target: F.chatSessions,
    spec: SPEC.cSessions,
    expect: "归档动作：ok:false",
    mutate: (t) =>
      patch(
        t,
        `export async function archiveChatSession(sessionId: string): Promise<ChatSessionMutationResult> {
  return mutationFailure(ARCHIVE_PENDING_MESSAGE, sessionId);
}`,
        `export async function archiveChatSession(sessionId: string): Promise<ChatSessionMutationResult> {
  return { ok: true, state: "ready", message: "已归档" }; // MUTATION-M3：无端点冒充归档成功
}`,
        "M3",
      ),
  },
  {
    id: "M4-session-list-success-toast",
    zone: "C",
    title: "④ 会话列表弹「已归档」成功 toast（端点并不存在）",
    target: F.sessionList,
    spec: SPEC.cSessions,
    expect: "会话列表 UI 红线",
    mutate: (t) =>
      patch(
        t,
        `const props = defineProps<{`,
        `// MUTATION-M4：伪成功口径（端点缺失时不得出现成功 toast 与「已归档」）
const toastDemo = () => ElMessage.success("已归档");
const props = defineProps<{`,
        "M4",
      ),
  },
  {
    id: "M5-composer-prototype-name",
    zone: "C",
    title: "⑤ 对话面塞原型演示人名（王强）当建议问题",
    target: F.composer,
    spec: SPEC.cInteraction,
    expect: "守恒红线：对话面无原型人名演示数据",
    mutate: (t) =>
      patch(
        t,
        `const text = ref("");`,
        `// MUTATION-M5：原型员工名/店名当演示内容（§一 禁止原型员工姓名与演示店名）
const demoHint = "帮王强看一下红星便利店昨天的退款";
const text = ref("");`,
        "M5",
      ),
  },
  {
    id: "M6-checkout-clear-cart-on-unavailable",
    zone: "D",
    title: "⑥ 通道待接入也清车结算（假交易成功）",
    target: F.cashier,
    spec: SPEC.d,
    expect: "收银台接线指向真实端点实现",
    mutate: (t) =>
      patch(
        t,
        `  if (result.state === "unavailable") {
    payState.value = "unavailable";
    payFeedback.value = result.message;`,
        `  if (result.state === "unavailable") {
    payState.value = "unavailable";
    payFeedback.value = result.message;
    // MUTATION-M6：没收到 PAID 也走清车结算（§六 禁止假交易成功）
    completePaymentFlow("", "0", POS_PAY_METHOD_LABELS[method], method);`,
        "M6",
      ),
  },
  {
    id: "M7-auth-code-loosened",
    zone: "D",
    title: "⑦ 付款码长度口径漂移：16–24 位放宽成任意数字",
    target: F.posCheckout,
    spec: SPEC.d,
    expect: "弹层三按钮与原型逐字一致；付款码门槛只限线上方式",
    mutate: (t) =>
      patch(
        t,
        `export const AUTH_CODE_PATTERN = /^\\d{16,24}$/;`,
        `export const AUTH_CODE_PATTERN = /^\\d{1,}$/; // MUTATION-M7：手打 1 位数字也算付款码`,
        "M7",
      ),
  },
  {
    id: "M8-settings-tab-dropped",
    zone: "E",
    title: "⑧ 设置中心砍掉「运营」Tab（7→6，补齐项 E.1 未完成）",
    target: F.settings,
    spec: SPEC.e,
    expect: "§三.E.1 设置中心恰有 7 个 Tab",
    mutate: (t) =>
      patch(
        t,
        `  {
    key: "ops",
    label: "运营",
    prototypeKey: null,
    adminOnly: true,
    capability: "unavailable",
    note: "运营系统（短视频 / 电商 / 私域）尚未接入（api/ 无对应端点）",
  },
`,
        `  // MUTATION-M8：静默砍掉「运营」分区（§三.E.1 要求 7 Tab 齐备）
`,
        "M8",
      ),
  },
  {
    id: "M9-dark-theme-no-dom",
    zone: "E",
    title: "⑨ 暗色主题不写 DOM 属性（只改 UI 显示值，样式实际不变）",
    target: F.theme,
    spec: SPEC.e,
    expect: "亮色不残留 data-wb-theme 属性",
    mutate: (t) =>
      patch(
        t,
        `export function themeDataAttribute(theme: WbTheme): string | null {
  return theme === "dark" ? "dark" : null;
}`,
        `export function themeDataAttribute(theme: WbTheme): string | null {
  return null; // MUTATION-M9：暗色也不再落属性 ⇒ 覆盖层永远不生效
}`,
        "M9",
      ),
  },
  {
    id: "M10-narrow-breakpoint-drift",
    zone: "F",
    title: "⑩ 窄视口断点从 390 漂到 420（与 CSS 媒体查询脱钩）",
    target: F.viewport,
    spec: SPEC.f,
    expect: "断点真相源＝390px，媒体查询串与之同源",
    mutate: (t) =>
      patch(
        t,
        `export const WB_NARROW_MAX_WIDTH_PX = 390;`,
        `export const WB_NARROW_MAX_WIDTH_PX = 420; // MUTATION-M10：真相源漂移，窄口改造对不上 CSS`,
        "M10",
      ),
  },
  {
    id: "M11-injection-open-in-production",
    zone: "G",
    title: "⑪ 生产构建也接受测试注入（把走查口子留给线上）",
    target: F.injection,
    spec: SPEC.g,
    expect: "生产构建恒不激活",
    mutate: (t) =>
      patch(
        t,
        `  if (!input.isDev) {
    return { active: false, reason: "生产构建（import.meta.env.DEV=false）不开放测试注入" };
  }`,
        `  // MUTATION-M11：取消开发态守卫 ⇒ 线上带参数即可看到未授权可见集
`,
        "M11",
      ),
  },
  {
    id: "M12-always-skip-menu-bridge",
    zone: "G",
    title: "⑫ 恒跳过菜单桥交集（把测试注入写成生产判定）",
    target: F.injection,
    spec: SPEC.g,
    expect: "跳过交集只发生在激活态",
    mutate: (t) =>
      patch(
        t,
        `export function shouldSkipMenuBridgeTrimming(state: UiuxInjectionState): boolean {
  return state.active;
}`,
        `export function shouldSkipMenuBridgeTrimming(state: UiuxInjectionState): boolean {
  return true; // MUTATION-M12：生产态也跳过 /menus/user 交集 ⇒ fail-closed 失效
}`,
        "M12",
      ),
  },
];

const dirtyBefore = repoDirty();
console.log(`工作树 git status：运行前 ${dirtyBefore.length} 行（本装置只临时改、必复原）`);

const records = [];
for (const item of CASES) {
  const original = readFileSync(item.target);
  const originalText = original.toString("utf8");
  const originalHash = sha256(original);

  const mutated = item.mutate(originalText);
  assert.notEqual(mutated, originalText.replace(/\r\n/g, "\n"), `${item.id}: 注入未生效`);
  writeKeepingEol(item.target, originalText, mutated);
  const injectedHash = sha256(readFileSync(item.target));

  const result = runSpec(item.spec);
  const failedLines = result.stdout.split("\n").filter((line) => line.startsWith("FAIL"));
  const named = failedLines.some((line) => line.includes(item.expect));

  console.log(`\n[反测 ${item.id}]（${item.zone}）${item.title}`);
  console.log(`  注入后 SHA256 = ${injectedHash}`);
  console.log(`  EXIT=${result.code}；FAIL=${failedLines.length}；点名「${item.expect}」=${named}`);
  for (const line of failedLines) console.log(`  ${line}`);

  writeFileSync(item.target, original);
  const restoredHash = sha256(readFileSync(item.target));
  console.log(`  复原 SHA256 = ${restoredHash}；恒等=${restoredHash === originalHash}`);

  records.push({
    id: item.id,
    zone: item.zone,
    title: item.title,
    target: path.relative(WEB, item.target).replace(/\\/g, "/"),
    spec: path.relative(WEB, item.spec).replace(/\\/g, "/"),
    expect: item.expect,
    exitCode: result.code,
    failedCount: failedLines.length,
    named,
    originalHash,
    injectedHash,
    restoredHash,
    restoredIdentical: restoredHash === originalHash,
    failedLines,
  });

  assert.equal(result.code, 1, `${item.id}: 注入后必须变红（实测 EXIT=${result.code}）`);
  assert.ok(named, `${item.id}: 未点名「${item.expect}」`);
  assert.ok(records.at(-1).restoredIdentical, `${item.id}: 复原 SHA256 必须恒等`);
}

// ── 复原后七套用例全部回绿 ────────────────────────────────────────────
const greens = ALL_SPECS.map((specPath) => {
  const res = runSpec(specPath);
  const summary = res.stdout
    .split("\n")
    .filter((line) => line.startsWith("小结"))
    .join(" / ");
  return { spec: path.relative(WEB, specPath).replace(/\\/g, "/"), exitCode: res.code, summary };
});
console.log("\n复原后复跑：");
for (const row of greens) console.log(`  ${row.exitCode === 0 ? "GREEN" : "RED "}  ${row.spec}  ${row.summary}`);
assert.ok(
  greens.every((row) => row.exitCode === 0),
  "复原后必须全绿",
);

// ── 红线守卫：本装置不得让工作树的 git status 发生任何变化 ──────────────
const dirtyAfter = repoDirty();
const added = dirtyAfter.filter((line) => !dirtyBefore.includes(line));
const removed = dirtyBefore.filter((line) => !dirtyAfter.includes(line));
assert.deepEqual(added, [], `本装置弄脏了工作树：\n${added.join("\n")}`);
assert.deepEqual(removed, [], `工作树凭空少了行（装置越权清理）：\n${removed.join("\n")}`);

writeFileSync(
  path.join(OUT, "redtest.md"),
  [
    "# WORKBENCH-10-UIUX-PARITY-F1 · mutation 反测记录（硬验收 7：≥8 类）",
    "",
    "> 装置：`admin-web/tests/wb-f1-mutation-countertest.mjs`（注入 → 点名红 → 逐字节复原 SHA256 恒等 → 复跑回绿）",
    "> 覆盖 B/C/D/E/F/G 六区 12 类；每条对应派单卡 §一/§四/§五/§六 的一条禁止事项。",
    `> 输出目录（绝对路径）：\`${OUT}\`${OUT_IS_TMP ? "（未给 --out ⇒ 系统临时目录）" : "（--out 显式指定）"}`,
    `> 代码仓工作树：\`${REPO}\`（本装置不向其写入任何证据）`,
    "",
    "| 反测 | 区 | 目标 | 注入 | 点名红的断言 | EXIT | FAIL | 点名 | 复原恒等 |",
    "|:--|:--|:--|:--|:--|--:|--:|:--:|:--:|",
    ...records.map(
      (r) =>
        `| ${r.id} | ${r.zone} | \`${r.target}\` | ${r.title} | ${r.expect} | ${r.exitCode} | ${r.failedCount} | ${r.named ? "✅" : "❌"} | ${r.restoredIdentical ? "✅" : "❌"} |`,
    ),
    "",
    "## SHA256 三段（原 → 注入 → 复原）",
    "",
    "| 反测 | 目标 | 原文件 | 注入后 | 复原后 |",
    "|:--|:--|:--|:--|:--|",
    ...records.map(
      (r) =>
        `| ${r.id} | \`${r.target}\` | ${r.originalHash.slice(0, 16)}… | ${r.injectedHash.slice(0, 16)}… | ${r.restoredHash.slice(0, 16)}… |`,
    ),
    "",
    "## 逐条 FAIL 原文",
    "",
    ...records.flatMap((r) => [`### ${r.id}（${r.title}）`, "", "```text", ...r.failedLines, "```", ""]),
    "## 复原后复跑（七套 F1 用例）",
    "",
    "| 用例 | EXIT | 小结 |",
    "|:--|--:|:--|",
    ...greens.map((row) => `| \`${row.spec}\` | ${row.exitCode} | ${row.summary} |`),
    "",
    "## 工作树洁净度",
    "",
    "| 读数 | git status --porcelain |",
    "|:--|--:|",
    `| mutation 运行前 | ${dirtyBefore.length} 行 |`,
    `| mutation 运行后 | ${dirtyAfter.length} 行 |`,
    `| 新增行 | ${added.length} |`,
    `| 减少行 | ${removed.length} |`,
    "",
  ].join("\n"),
);

writeFileSync(
  path.join(OUT, "redtest.json"),
  `${JSON.stringify(
    {
      taskId: "WORKBENCH-10-UIUX-PARITY-F1",
      generatedAt: new Date().toISOString(),
      cases: records.length,
      worktree: REPO,
      dirtyBefore: dirtyBefore.length,
      dirtyAfter: dirtyAfter.length,
      greens,
      records,
    },
    null,
    2,
  )}\n`,
);

const passed = records.filter((r) => r.named && r.restoredIdentical && r.exitCode === 1).length;
console.log(
  `\n小结：${passed}/${CASES.length} 点名变红 + ${records.filter((r) => r.restoredIdentical).length}/${CASES.length} SHA256 恒等 + 复原后 ${greens.filter((row) => row.exitCode === 0).length}/${greens.length} 套回绿`,
);
console.log(`证据目录：${OUT}`);
