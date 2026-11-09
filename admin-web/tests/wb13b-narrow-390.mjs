/**
 * WORKBENCH-13B · 390×844 窄口回归采集器（卡 §三.D.15/16/17）
 *
 * 卡面原文：「主验收视口为 1440×1000、1024×768；390×844 作为窄口回归，必须无横向裁切且
 * 抽屉/弹层/主操作可用；键盘焦点、按钮语义、对比度、触控命中区不得因视觉对齐退步；
 * F3 已通过的一级 12 项、二级顺序、圆形新对话、通知、确认框、390 鼠标/触摸抽屉必须保持。」
 * 本采集器钉在 390×844 这一档（hasTouch: true、deviceScaleFactor: 1）：11 个业务模块 +
 * 收银台各取一张**有真实路由**的代表页（真相源 measure/wb13b-proto-page-model.json），
 * 全程真实点击底部一级 rail ⇒ 真实点击收起态抽屉里的目录卡 ⇒ 真实路由落位后逐量七项：
 *
 *   ① 横向裁切（D.15「无横向裁切」）：文档 scrollWidth 超宽 + 越界元素；rail 底部条横滚、
 *      页内滚动容器、收起态离屏抽屉按 reason 分桶如实记录，只有「文档超宽」与
 *      「非豁免越界」判红 narrow-overflow，其余进发现项，不静默放行；
 *      判据取 pageOffenders 全量（不是展示用的 40 格切片）：railScroller/offCanvas 两桶会
 *      把切片占满，页级真裁切躲在 DOM 后面 ⇒ 用切片判门禁就是假绿；page 桶同时带祖先
 *      overflowX 链与可滚量程，供逐条复核「裁了到底滚不滚得回来」；被 overflow-x:hidden
 *      同步容器（Element Plus 表头）裁掉的列，按 railScroller 的先例逐组跑真实横向手势（分档滚
 *      + 逐档复测，证明容器真被用户手势滚起来），再按该容器量程逐元素做几何可达复核：都能落入
 *      390 视口 ⇒ 只记 hidden-clipper-scroll-synced 发现项（报告必须披露「要横滚才看得到这些列」）；
 *      有列复核带不到位（例如列比视口还宽）或找不到同一控件的横滚容器 ⇒ 维持 narrow-overflow 红；
 *   ② 抽屉可用（D.15/D.17 的 390 鼠标/触摸抽屉复证）：鼠标真实点击 + 触摸真实 tap 两条
 *      打开/关闭轨迹都验；点击前抽屉若已是展开态 ⇒ 无法证明由点击打开，记 drawer-unusable；
 *      触摸「再收」腿在点之前用 elementFromPoint 重做命中测试：≤390 抽屉展开时 z45 面板盖住
 *      header 的 side-toggle（实测落在 span.sn-logo 上，F3 壳层层级口径），旧坐标盲点只会点到
 *      抽屉面板 ⇒ 改点展开态里可见的抽屉头部 second-nav-collapse；两颗都命中不到才记
 *      drawer-close-control-unreachable 发现项（关闭由遮罩腿证明），命中可点却收不掉才判红；
 *      收银台同样跑满三段（钮开 ⇒ 遮罩收 ⇒ 钮重开 ⇒ 收起钮收），不再豁免关闭证据；
 *   ③ 弹层可用（D.15）：只点安全动词（取单/挂单/详情/新增…）触发 dialog / message-box /
 *      popconfirm / popselect / 页内收银浮层，量是否被 390 裁掉、确认/取消是否可达、
 *      Escape/取消能否关闭；找不到安全触发只记 gap，不硬闯破坏性按钮；
 *   ④ 主操作可达（D.15）：页根内全部按钮的 rect / 面积 / computed min-height / min-width；
 *      越界判红 action-offscreen；<44×44 与 <24px 命中区计数按 D.16 测量口径记录为发现项；
 *   ⑤ 键盘焦点（D.16）：真实 Tab ≤25 站，焦点环判据 = 元素自身 outline 非 none/0，
 *      或「聚焦态 vs 失焦态」在元素+4 层祖先（含 ::before/::after）上的计算样式差
 *      （Element Plus 把环画在包装层 box-shadow/border，只看自身 outline 会把包装层环误判成不可见）；
 *      视口内无环站判红 focus-invisible，视口外站（收起抽屉、横滚 rail）记 focus-offscreen 发现项；
 *   ⑥ 按钮语义（D.16）：文案 / aria-label / title 三者皆空的图标按钮如实计数入档；
 *   ⑦ 对比度（D.16）：页根内每段真实文字量「前景色 vs 实际承托底色」的 WCAG 相对亮度比值；
 *      功能墨族（`--wb-ink` / `--wb-ink2` 的当前令牌值 ∪ 退役值 ∪ 运行时解析值）× --side #F9FAFB /
 *      --bg #FFFFFF 低于 4.5:1（大字 3:1）判红 contrast-regression，并列出渲染 ink2-on-side 的选择器与字号字重；
 *      F1 中央裁定后 ink2 的真值已不是原型 #8A8F98（3.11:1/3.25:1，跌破 AA）而是画布达标令牌，
 *      原型旧值进 RETIRED_INK_VALUES 继续参与判红 ⇒ 谁写回去谁吃红，门禁不随色值漂移；
 *      line-on-side / line-on-bg（≈1.11:1）属装饰性分隔线，按 WCAG 1.4.11 incidental
 *      豁免只记录不判红 —— 该豁免只覆盖线，不覆盖任何带文字的元素；令牌外的暗色文字跌破 AA 时
 *      转发现项 contrast-ink-outside-token（口径外不判红，但必须点名，不许静默丢弃）。
 *
 * 红线自查（卡 §六）：零注入 —— 不带 ?query、不改 DOM/class/style、不 dev 注入、不伪造元素
 * 或状态；登录走同源 /api 代理的真实 demo-login；抽屉/弹层/焦点全部是 page.mouse.click、
 * page.touchscreen.tap 与真实键盘按键；断言不过就写具名违规，不软化、不改名、不拿截图名
 * 冒充修复。每个「模块×代表页」恰好一张独立 PNG（shots/narrow-*.png），帧 SHA 台账里
 * reusedFrames 必须为空，否则记 reused-frame。
 *
 * 用法（admin-web 目录）：
 *   node tests/wb13b-narrow-390.mjs <evidenceDir 绝对路径> [--modules=sale,order,…] [--pages=N|sale:collection] [--keep-servers]
 * 环境变量：WB13_BACKEND_PORT / WB13_WEB_PORT / WB13_CHROME / WB13_NARROW_BUDGET_MS
 * 分块：--modules 按块跑；块间自动合并 —— 不属于本块的记录/违规/gap 原样保留，
 *   属于本块的以本次为准。每模块预算 120s，推荐 4 块 × 3 模块：
 *   sale,order,purchase ⇒ inventory,customer,product ⇒ retail,finance,report ⇒ marketing,system,pos
 *
 * 输出：
 *   <evidenceDir>/measure/wb13b-narrow-390.json   schema wb13b-narrow-390/v1 全量记录
 *   <evidenceDir>/measure/wb13b-narrow-390.md     人读逐模块表（模块|溢出|抽屉|弹层|命中|焦点|无标签|对比|判定）
 *   <evidenceDir>/shots/narrow-<模块>-<页>.png    每模块一页一帧
 *   <evidenceDir>/logs/wb13b-narrow-harness.json  服务起停 / 点击轨迹
 *   <evidenceDir>/logs/wb13b-narrow-390.log       实时日志
 *
 * 机器门禁（逐条打印并以非零码退出，fail-closed）：narrow-overflow / drawer-unusable /
 * overlay-unusable（弹层超 390 或按钮不可达/关不掉，属五门之外的具名扩展）/
 * action-offscreen / focus-invisible / contrast-regression；完整性门：module-timeout /
 * module-without-capture / reused-frame / record-incomplete（含「①–⑦ 必测项缺失」与
 * 「逐条采集来路缺失：captureOrigin/端口/URL 与自身 origin 不同源」两类）。任何一条红 ⇒ exit 1。
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { portOfUrl, redactText } from "./uiux-scenarios-lib.mjs";
import { findClippedA, normalizeColor } from "./f2a-visual-baseline-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const argv = process.argv.slice(2);
const EVIDENCE = argv.find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/wb13b-narrow-390.mjs <evidenceDir> [--modules=sale,order,…] [--pages=N|sale:collection] [--keep-servers]");
  process.exit(2);
}
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });
const KEEP_SERVERS = argv.includes("--keep-servers");

const NARROW = { id: "390x844", width: 390, height: 844 };
const TOUCH_TARGET_MIN_PX = 44;
const MIN_CONTROL_PX = 24;
const TAB_STOP_CAP = 25;
const MODULE_BUDGET_MS = Number(process.env.WB13_NARROW_BUDGET_MS ?? 120000);

const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const MODEL_FILE = path.join(OUT, "measure", "wb13b-proto-page-model.json");
const MANIFEST_POS = path.join(WEB, "src", "shared", "workbench", "manifest-pos.ts");
const MEASURE_JSON = path.join(OUT, "measure", "wb13b-narrow-390.json");
const MEASURE_MD = path.join(OUT, "measure", "wb13b-narrow-390.md");
const HARNESS_FILE = path.join(OUT, "logs", "wb13b-narrow-harness.json");
const LIVE_LOG = path.join(OUT, "logs", "wb13b-narrow-390.log");

/** gap 归属（与 wb13b-state-matrix 同一责任人口径） */
const OWNER = "墨（WORKBENCH-13B §三.D）";
/**
 * 13B 画布语法令牌组色（src/styles.css 画布段）；对比度门禁只对这些**功能墨**前景色判红。
 * F1 中央裁定（凌舟驳回 DEV-13B-01）后，`ink2` 的真值是**达标值**，原型旧值降级为「退役值」。
 * 本轮按中央裁定追加 `inkPrimary`（品牌主色**当文字用**）：#3F6FEF 当前景 4.44:1 跌破 AA，
 * 达标值走 tokens.css 既有 S3-66.1/H-1 专用变体 `--color-primary-text` #365FCE（5.70:1）。
 * ⚠️ 判红口径不得跟着色值走（卡 §三.7 M57 的反面教材）：令牌一旦改色，只认单值的实现会立刻
 *    把新色认成「非令牌 ⇒ 只记录」，门禁当场瞎掉却仍然全绿。因此这里认的是**墨族**：
 *    ① 当前令牌值（下面这张表）；② 全部退役值（RETIRED_INK_VALUES，回退即判红）；
 *    ③ 页面里 `--wb-ink/--wb-ink2/--color-primary-text` 的**运行时解析值**（CANVAS_INK_PROBE 采回来，
 *       任何人改成第三个值也还在档内）。
 * 门禁范围按前景墨族判定，不再附加「承托面必须是 side/bg」：淡底/彩色底同样是功能文字的承托面，
 * 加了这层限定等于给「换个淡底就把红抹掉」留后门（F1 §六 不以豁免制造绿色）。
 */
const CANVAS_TOKENS = { ink: "22,24,29", ink2: "102,107,115", inkPrimary: "54,95,206", line: "236,238,241", side: "249,250,251", bg: "255,255,255" };
/** 退役功能墨值：仍算墨族、仍参与 AA 判红（谁把它们写回画布，谁就得吃一条红） */
const RETIRED_INK_VALUES = {
  "138,143,152": { token: "ink2", note: "原型 L10 --sub #8A8F98：3.11:1(side)/3.25:1(bg)，13B-F1 裁定不得用于功能文字" },
  "63,111,239": { token: "inkPrimary", note: "品牌主色 --color-primary #3F6FEF 用作文字色：4.44:1(bg)/4.25:1(side)，淡底上更低；F1 中央裁定功能文字改走 --color-primary-text #365FCE" },
};
/** 参与对比度门禁的功能墨令牌名（承托面令牌不随色值漂移，仍按 CANVAS_TOKENS 精确认） */
const INK_TOKEN_KEYS = ["ink", "ink2", "inkPrimary"];
const SURFACE_TOKEN_KEYS = ["side", "bg"];
/**
 * 品牌主色**填充**（作底面用，不是文字色）：白字压在品牌底上属于品牌识别，改它=改品牌视觉，
 * 不在 13B 功能墨令牌口径内 ⇒ 不进 contrast-regression 门禁；但必须实测点名，
 * 谁都不能靠「不测」把它变成通过（F1 §六；本轮作为待裁定项上报，不自行判验收）。
 */
const BRAND_FILL_RGB = { "63,111,239": "--color-primary #3F6FEF 填充", "54,95,206": "--color-primary-text #365FCE 填充" };

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}`;
  harnessLog.push(line);
  console.log(msg);
  try {
    appendFileSync(LIVE_LOG, line + "\n");
  } catch {
    /* 实时日志写不进不能反过来掐断采集 */
  }
};

/* ────────────────────────── 服务自起自停（与 13B 采集器同一口径，逐字沿用） ────────────────────────── */

function probeHost(host, port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (up) => {
      sock.destroy();
      resolve(up);
    };
    sock.setTimeout(800);
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
    sock.on("timeout", () => done(false));
  });
}
async function probePort(port) {
  for (const host of ["127.0.0.1", "::1"]) if (await probeHost(host, port)) return true;
  return false;
}
function pidsListeningOn(port) {
  try {
    return execFileSync("netstat", ["-ano"], { encoding: "utf8" })
      .split("\n")
      .filter((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((p) => /^\d+$/.test(p));
  } catch {
    return [];
  }
}
async function forceFreePort(port) {
  for (let round = 0; round < 6; round++) {
    const pids = [...new Set(pidsListeningOn(port))];
    if (pids.length === 0 && !(await probePort(port))) return true;
    for (const pid of pids) {
      try {
        execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
        log(`清理端口 ${port} 上的残留监听 pid=${pid}`);
      } catch {
        /* 已退出 */
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return !(await probePort(port));
}
async function waitForPort(port, up, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if ((await probePort(port)) === up) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
const children = [];
const boundPorts = new Set();
function killTree(child, label) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
    log(`已停止 ${label}（pid=${child.pid}）`);
  } catch (e) {
    log(`停止 ${label} 失败：${String(e).slice(0, 120)}`);
  }
}
async function startBackend() {
  if (await probePort(BACKEND_PORT)) throw new Error(`端口 ${BACKEND_PORT} 已被占用：采集器要求自起自停（用 WB13_BACKEND_PORT 换空闲端口）`);
  const child = spawn(process.execPath, ["scripts/dev-mock.mjs"], {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      USE_MOCK_DB: "true",
      NODE_ENV: "development",
      PORT: String(BACKEND_PORT),
      JWT_SECRET: createHash("sha256").update(`${Date.now()}-jwt`).digest("hex"),
      CSRF_SECRET: createHash("sha256").update(`${Date.now()}-csrf`).digest("hex"),
    },
  });
  children.push({ child, label: `backend:${BACKEND_PORT}` });
  child.stdout.on("data", (b) => backendTail.push(String(b)));
  child.stderr.on("data", (b) => backendTail.push(String(b)));
  /* mock 后端经 dev-mock → tsx watch → server.ts 三段冷启动，空载实测 ~65-70s，机器被其它在办卡
     占CPU 时会拖到 90s 以上（C 段同口径已放宽到 240s）。超时不是产品问题，但把 stderr 尾巴带进
     错误里，才能分清「冷启动慢」和「真起不来」，别拿 90s 的读数去判窄口红。
     F1 现场复算（logs/narrow-A.log + logs/backend-probe.log，2026-11-06 07:19~07:21）：240s 在本机
     有并发采集时**实测过不了** —— 同一条 `tsx watch src/server.ts` 从 spawn 到 `listening on :18191`
     实测 155s，而采集器那一次跑满 240s 仍未起（首块冷、无 tsx 缓存、Qoder 侧并发占 CPU）。
     这不是门禁口径，是环境容差：放宽到 420s，超时依旧按「中止 + 逐模块 module-without-capture 红」
     fail-closed，不因为等得久而放行任何一项。 */
  if (!(await waitForPort(BACKEND_PORT, true, Number(process.env.WB13_BACKEND_READY_MS ?? 420000)))) {
    throw new Error(`后端 ${BACKEND_PORT} 未在 ${Number(process.env.WB13_BACKEND_READY_MS ?? 420000) / 1000}s 内就绪；子进程尾巴=${backendTail.slice(-25).join("").slice(-900) || "(无输出)"}`);
  }
  boundPorts.add(BACKEND_PORT);
  log(`后端 mock 已起（127.0.0.1:${BACKEND_PORT}，USE_MOCK_DB=true）`);
}
async function startVite() {
  if (await probePort(WEB_PORT)) throw new Error(`端口 ${WEB_PORT} 已被占用：采集器要求自起自停（用 WB13_WEB_PORT 换空闲端口）`);
  const child = spawn(
    process.execPath,
    [path.join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(WEB_PORT), "--strictPort"],
    {
      cwd: WEB,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_API_BASE: API_BASE, VITE_API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
    },
  );
  children.push({ child, label: `vite:${WEB_PORT}` });
  child.stdout.on("data", (b) => harnessLog.push(`[vite] ${String(b).trim()}`));
  child.stderr.on("data", (b) => harnessLog.push(`[vite-err] ${String(b).trim()}`));
  if (!(await waitForPort(WEB_PORT, true, 210000))) throw new Error(`vite ${WEB_PORT} 未在 210s 内就绪`);
  boundPorts.add(WEB_PORT);
  log(`前端 dev server 已起（${ORIGIN}，VITE_API_BASE=${API_BASE}）`);
}
async function stopAll() {
  for (const c of children.slice().reverse()) killTree(c.child, c.label);
  const stillUp = [];
  for (const p of [BACKEND_PORT, WEB_PORT]) {
    if (!boundPorts.has(p)) {
      if (await probePort(p)) stillUp.push(p);
      continue;
    }
    if (!(await forceFreePort(p))) stillUp.push(p);
  }
  log(`端口收尾：${stillUp.length === 0 ? `${BACKEND_PORT}/${WEB_PORT} 全部 DOWN` : `仍在线 ${stillUp.join(",")}`}`);
  return stillUp.length === 0;
}
async function loginViaProxy() {
  let lastError = "未发起请求";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const res = await fetch(`${ORIGIN}${API_BASE}/admin/auth/demo-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.data?.token) {
        log(`经 /api 同源代理登录成功（第 ${attempt} 次）：user=${j.data.user?.username} roles=${JSON.stringify(j.data.user?.roles ?? [])}`);
        return j.data;
      }
      const detail = `HTTP ${res.status} ${redactText(JSON.stringify(j ?? {})).slice(0, 160)}`;
      if (res.status < 500) throw new Error(`经 /api 代理登录失败：${detail}`);
      lastError = detail;
    } catch (e) {
      const msg = redactText(String(e));
      if (msg.includes("经 /api 代理登录失败")) throw e;
      lastError = msg;
    }
    log(`  · 登录第 ${attempt} 次未就绪（${lastError.slice(0, 80)}），3s 后重试`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`经 /api 代理登录始终失败：${lastError}`);
}

/* ────────────────────────── 浏览器 ────────────────────────── */

const require = createRequire(path.join(WEB, "package.json"));
const { chromium } = require("playwright");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const netFailures = [];
function attachNetwork(page) {
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!portOfUrl(url) && !/^https?:\/\/localhost/.test(url)) return;
    netFailures.push({ method: req.method(), url, port: portOfUrl(url) || WEB_PORT, error: String(req.failure()?.errorText ?? "unknown"), signature: `${req.method()} ${url}` });
  });
}

/** 390×844 窄口：真实触控能力必须开（D.17 的触摸抽屉复证依赖 hasTouch），像素比锁 1 防缩放宽高造假 */
async function newNarrowPage(browser, auth) {
  const ctx = await browser.newContext({
    viewport: { width: NARROW.width, height: NARROW.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    hasTouch: true,
    isMobile: false,
  });
  if (auth) {
    await ctx.addInitScript(
      ({ token, csrf, user }) => localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } })),
      { token: auth.token, csrf: auth.csrfToken, user: auth.user },
    );
  }
  const page = await ctx.newPage();
  attachNetwork(page);
  return { ctx, page };
}

const fileShot = (file, meta = {}) => ({ file: `shots/${path.basename(file)}`, bytes: statSync(file).size, sha256: sha256(readFileSync(file)), ...meta });

/* ────────────────────────── 页内函数（全部自包含：Playwright 只搬运函数体，自由变量必须就地内联） ────────────────────────── */

/** 390 窄壳现场读数：rail 是否塌成底部条、抽屉 transform/mask/toggle 的状态（②的证据底座） */
function NARROW_SHELL_READER() {
  const D = document;
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const shell = D.querySelector('[data-testid="wb-shell"]');
  const sub = D.querySelector('[data-testid="second-nav"]');
  const rail = D.querySelector('[data-testid="rail"]');
  const mask = D.querySelector('[data-testid="side-mask"]');
  const toggle = D.querySelector('[data-testid="side-toggle"]');
  let tx = 0;
  if (sub) {
    const t = getComputedStyle(sub).transform;
    if (t && t !== "none") {
      const m = t.slice(t.indexOf("(") + 1, t.indexOf(")")).split(",");
      tx = Math.round(Number(m[4]) || 0);
    }
  }
  const railSt = rail ? getComputedStyle(rail) : null;
  return {
    narrow: window.innerWidth <= 390,
    vw: window.innerWidth,
    vh: window.innerHeight,
    shellCls: shell ? String(shell.className || "").slice(0, 90) : null,
    subnav: sub ? { box: rect(sub), hidden: sub.classList.contains("hidden"), transformX: tx } : null,
    drawerOpen: !!sub && !sub.classList.contains("hidden") && tx >= -10,
    rail: rail
      ? { box: rect(rail), flexDir: railSt.flexDirection, overflowX: railSt.overflowX, scrollWidth: Math.round(rail.scrollWidth), clientWidth: Math.round(rail.clientWidth), hScroll: rail.scrollWidth - rail.clientWidth }
      : null,
    mask: mask ? rect(mask) : null,
    toggle: toggle ? rect(toggle) : null,
    mainPadBottom: (() => {
      const main = D.querySelector("main.wb-view");
      return main ? getComputedStyle(main).paddingBottom : null;
    })(),
  };
}

/**
 * rail 横滚读数（真实手势前后各采一次）：`.wb-rail` 在 ≤390 下转底部横条，
 * 越界条目落进 railScroller 豁免桶的前提是**用户真能横滚到它们**。
 * 这里只读数、不动手（手势由 Node 侧的 page.mouse.wheel 真实发出），
 * 并把最后一个一级条目的可见性一起带回，作为「豁免桶成立与否」的证据。
 */
function RAIL_SCROLL_PROBE() {
  const D = document;
  const rail = D.querySelector('[data-testid="rail"]');
  if (!rail) return { found: false };
  const r = rail.getBoundingClientRect();
  const vw = window.innerWidth;
  const items = [...rail.querySelectorAll(".wb-rail-item")];
  const edge = items[items.length - 1];
  const er = edge ? edge.getBoundingClientRect() : null;
  return {
    found: true,
    overflowX: getComputedStyle(rail).overflowX,
    scrollLeft: Math.round(rail.scrollLeft),
    maxScrollLeft: Math.round(rail.scrollWidth - rail.clientWidth),
    railPoint: { x: Math.round(r.x + Math.min(r.width - 2, 20)), y: Math.round(r.y + r.height / 2) },
    itemCount: items.length,
    edgeItem: er
      ? { key: edge.getAttribute("data-rail-key"), x: Math.round(er.x), right: Math.round(er.right), inView: er.left >= -1 && er.right <= vw + 1 }
      : null,
    clippedItems: items.filter((el) => { const b = el.getBoundingClientRect(); return !(b.left >= -1 && b.right <= vw + 1); }).map((el) => el.getAttribute("data-rail-key")),
  };
}

/**
 * 「隐藏式同步容器」手势探针（cfg = 越界元素带出的 clipper 矩形）。
 * Element Plus 之类把表头放进 overflow-x:hidden + scrollLeft 由表体同步的容器：静态 CSS 看不出
 * 用户能不能滚到，所以沿用 railScroller 的先例 —— 必须用真实横滚手势证明内容带得回视口。
 * 探针在容器正下方（同一控件的表体区）找一个真正可横向滚的滚动容器，并要求它与隐藏容器
 * 有共同祖先（否则滚的是别处，证据不成立），同时回读隐藏容器自身的 scrollLeft 作为同步证据。
 */
function HEADER_SYNC_GESTURE(cfg) {
  const D = document;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const selish = (el) => {
    const tag = String(el.tagName || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${el.id ? `#${el.id}` : ""}${cls ? "." + cls : ""}`.slice(0, 90);
  };
  const hScroller = (el) => {
    let p = el;
    for (let d = 0; d < 10 && p; d += 1) {
      const s = getComputedStyle(p);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") && p.scrollWidth - p.clientWidth > 1) return p;
      p = p.parentElement;
    }
    return null;
  };
  /* 先按选择器定位隐藏同步容器并**把它滚进视口**：越界元素常常在折叠线以下（实测 y=1135 > 844），
     直接用视口坐标算手势点会被 clamp 到底部 rail 上（y=840），于是 elementFromPoint 命中 nav.wb-rail
     ⇒ 假「clipper-not-located」红。这里先 scrollIntoView 再按新矩形取点，才是用户真实手势的复现。 */
  let located = null;
  if (cfg.sel) {
    const cands = [...D.querySelectorAll(cfg.sel)].filter((el) => {
      const s = getComputedStyle(el);
      const room = el.scrollWidth - el.clientWidth;
      if (!((s.overflowX === "hidden" || s.overflowX === "clip") && room > 1)) return false;
      return cfg.range == null || Math.abs(room - cfg.range) <= 2;
    });
    if (cands.length) {
      located = cands[0];
      located.scrollIntoView({ block: "center", inline: "nearest" });
      const lr = located.getBoundingClientRect();
      cfg = { ...cfg, x: lr.x, y: lr.y, w: lr.width, h: lr.height };
    }
  }
  const cx = Math.min(Math.max(cfg.x + 8, 4), VW - 4);
  const cy = Math.min(Math.max(cfg.y + cfg.h / 2, 4), VH - 4);
  const at = D.elementFromPoint(cx, cy);
  let clipper = null;
  for (let p = at; p && p !== D.documentElement; p = p.parentElement) {
    const r = p.getBoundingClientRect();
    const s = getComputedStyle(p);
    const sameGeom = Math.abs(r.x - cfg.x) <= 2 && Math.abs(r.y - cfg.y) <= 2 && Math.abs(r.width - cfg.w) <= 2 && Math.abs(r.height - cfg.h) <= 2;
    if (sameGeom && (s.overflowX === "hidden" || s.overflowX === "clip") && p.scrollWidth - p.clientWidth > 1) {
      clipper = p;
      break;
    }
  }
  if (!clipper) return { ok: false, why: "clipper-not-located", point: { x: Math.round(cx), y: Math.round(cy) }, topEl: at ? selish(at) : null };
  const gx = Math.min(Math.max(cfg.x + Math.min(cfg.w / 2, 60), 12), VW - 12);
  const gy = Math.min(cfg.y + cfg.h + 16, VH - 60);
  const under = D.elementFromPoint(gx, gy);
  const scroller = under ? hScroller(under) : null;
  let shared = null;
  if (scroller) {
    for (let a = clipper; a && !shared; a = a.parentElement) if (a.contains(scroller)) shared = a;
  }
  return {
    ok: !!shared,
    why: scroller ? (shared ? null : "scroller-not-in-clipper-subtree") : "no-horizontal-scroller-under-clipper",
    gesturePoint: { x: Math.round(gx), y: Math.round(gy) },
    topElUnderGesture: under ? selish(under) : null,
    clipperSel: selish(clipper),
    clipperScrollLeft: Math.round(clipper.scrollLeft),
    clipperRange: Math.round(clipper.scrollWidth - clipper.clientWidth),
    scrollerSel: scroller ? selish(scroller) : null,
    scrollLeft: scroller ? Math.round(scroller.scrollLeft) : 0,
    maxScrollLeft: scroller ? Math.round(scroller.scrollWidth - scroller.clientWidth) : 0,
    sharedAncestor: shared ? selish(shared) : null,
  };
}

/** 遮罩空白点：元素自身可点的、不被子节点遮挡的落点（390 下抽屉宽 min(320px,86vw)，几何中心在抽屉之上，绝不能直接点中心） */function MASK_TAP_SPOT(cfg) {
  const el = document.querySelector(cfg.selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cand = [
    [r.x + r.width - 14, r.y + 14],
    [r.x + r.width / 2, r.y + 14],
    [r.x + 14, r.y + r.height / 2],
    [r.x + r.width - 14, r.y + r.height - 14],
  ];
  for (const [x, y] of cand) {
    if (x < 2 || y < 2 || x > window.innerWidth - 2 || y > window.innerHeight - 2) continue;
    const top = document.elementFromPoint(Math.round(x), Math.round(y));
    if (top === el || (top && !el.contains(top))) return { x: Math.round(x), y: Math.round(y) };
  }
  return null;
}

/**
 * 抽屉展开态下的「收起」腿：对两颗收起钮做**真实命中测试**（elementFromPoint 落在钮自己或它的
 * 子节点上，才算这一腿可测）。≤390 时 .wb-subnav 是 fixed / z-index:45 / width:min(320px,86vw)，
 * 展开后把整条顶部 header（含 side-toggle，实测 topEl=span.sn-logo）连遮罩（z44）一起盖在下面，
 * 拿抽屉收起时的旧坐标盲点第二下落到的是一张抽屉面板 ⇒「再收=false」是采集假象，不是缺陷。
 * 抽屉头部自己那颗 second-nav-collapse（aria-label「收起导航」，@collapse 翻转 sideCollapsed）
 * 在展开态是可见的，所以这一腿改点它：两颗都命中不到才降级为发现项，并由遮罩腿证明关闭。
 */
function DRAWER_CLOSE_SPOT() {
  const D = document;
  const label = (el) => (el ? `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).trim().split(/\s+/).slice(0, 3).join(".")}` : ""}` : "null");
  const cands = [
    { name: "side-toggle", sel: '[data-testid="side-toggle"]' },
    { name: "second-nav-collapse", sel: '[data-testid="second-nav-collapse"]' },
  ];
  const tried = [];
  let hit = null;
  for (const c of cands) {
    const el = D.querySelector(c.sel);
    if (!el) {
      tried.push({ name: c.name, exists: false });
      continue;
    }
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    const point = { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    const top = D.elementFromPoint(point.x, point.y);
    const visible = r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden";
    const rec = {
      name: c.name,
      exists: true,
      visible,
      aria: el.getAttribute("aria-label"),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      point,
      topEl: label(top),
      topIsSelf: !!top && (top === el || el.contains(top)),
      underDrawer: !!(top && D.querySelector('[data-testid="second-nav"]')?.contains(top)),
    };
    tried.push(rec);
    if (!hit && visible && rec.topIsSelf) hit = rec;
  }
  return { hit, tried };
}

/** 一级 rail 键解析（逐字相等 > wb. 前缀 > 文案相等 > 键尾段）；与 wb13b-module-parity 同一口径 */
function IMPL_RAIL_KEY_RESOLVER(payload) {
  const items = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')];
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const keyed = items.map((el) => ({
    key: el.getAttribute("data-rail-key") ?? "",
    label: norm(el.textContent),
    visible: (() => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })(),
  }));
  const want = payload.railKey;
  const name = payload.moduleName;
  const byExact = keyed.find((k) => k.key === want && k.visible);
  const byPrefix = keyed.find((k) => k.key === `wb.${want}` && k.visible);
  const byLabel = keyed.find((k) => k.label === name && k.visible);
  const bySuffix = keyed.find((k) => String(k.key).split(".").pop() === want && k.visible);
  const hit = byExact ?? byPrefix ?? byLabel ?? bySuffix ?? null;
  return { resolved: hit?.key ?? null, via: hit ? (hit === byExact ? "exact" : hit === byPrefix ? "wb-prefix" : hit === byLabel ? "label" : "key-suffix") : null, inventory: keyed };
}

/** 二级列现场快照（BLOCKED/失败记录必须带回这张快照，否则复核只看到「点不到」） */
function SECOND_NAV_SNAPSHOT() {
  const D = document;
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const col = D.querySelector('[data-testid="second-nav"]');
  const cards = [...D.querySelectorAll('[data-testid="second-nav-sub-zone"] .sn-card')].map((el) => ({
    label: el.getAttribute("data-plan-label") ?? null,
    status: el.getAttribute("data-plan-status") ?? null,
    disabled: el.disabled === true,
    cls: [...el.classList].join(".").slice(0, 60),
    text: norm(el.textContent).slice(0, 30),
  }));
  const rows = [...D.querySelectorAll('[data-testid="second-nav-real-zone"] .sn-row')].map((el) => ({
    text: norm(el.textContent).slice(0, 30),
    cls: [...el.classList].join(".").slice(0, 40),
  }));
  return {
    url: location.href,
    colExists: !!col,
    colCls: col ? [...col.classList].join(".").slice(0, 60) : null,
    subTitle: norm(D.querySelector('[data-testid="second-nav-sub-title"]')?.textContent).slice(0, 40),
    cards,
    rows,
    empty: norm(D.querySelector('[data-testid="second-nav-sub-zone"] .sn-empty')?.textContent ?? D.querySelector(".sn-empty")?.textContent).slice(0, 60),
    railOn: [...D.querySelectorAll('[data-testid="rail"] .wb-rail-item.on')].map((el) => el.getAttribute("data-rail-key")),
  };
}

/** 页面渲染行为门（只看 URL 不够：必须真画出来）；与 wb13b-module-parity 同一判据 */
function IMPL_PAINT_GATE(cfg) {
  const D = document;
  const shell = D.querySelector('[data-testid="wb-shell"]');
  const view = D.querySelector('main[data-view="manual"].shown');
  const pageRoot = view ? view.firstElementChild : null;
  const r = pageRoot ? pageRoot.getBoundingClientRect() : null;
  const title = (D.querySelector(".wb-top .wb-top-title")?.textContent || "").trim().replace(/\s+/g, " ");
  const pathName = location.pathname;
  return {
    ok: !!shell && !!view && !!pageRoot && !!r && r.width >= 240 && r.height >= 120 && title.length > 0 && (pathName === cfg.routePath || pathName.endsWith(cfg.routePath)),
    shell: !!shell,
    manualShown: !!view,
    pageRootClass: pageRoot ? String(pageRoot.className || "").slice(0, 60) : null,
    pageRootBox: r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}` : null,
    title,
    path: pathName,
    emptyState: !!D.querySelector('[data-testid="menu-empty"]'),
    url: location.href.replace(/[?#].*$/, ""),
  };
}

/** 门未过时的三层主面取证 */
function IMPL_VIEWS_SNAPSHOT() {
  const D = document;
  return {
    url: location.href,
    shellCls: D.querySelector('[data-testid="wb-shell"]')?.className ?? null,
    topTitle: (D.querySelector(".wb-top .wb-top-title")?.textContent || "").trim().slice(0, 40),
    menuEmpty: !!D.querySelector('[data-testid="menu-empty"]'),
    views: [...D.querySelectorAll("main.wb-view")].map((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return {
        view: el.dataset.view,
        shown: el.classList.contains("shown"),
        display: st.display,
        box: `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}`,
        kids: [...el.children].map((c) => `${c.tagName.toLowerCase()}.${String(c.className || "").trim().split(/\s+/).join(".")}`.slice(0, 70)),
        textLen: (el.textContent || "").replace(/\s+/g, " ").trim().length,
      };
    }),
    railOn: [...D.querySelectorAll('[data-testid="rail"] .wb-rail-item.on')].map((el) => el.getAttribute("data-rail-key")),
  };
}

/** 收银台入口：pos 模式段按钮的真实落点（可见才给点） */
function POS_ENTRY_SPOT() {
  const el = document.querySelector('[data-mode-seg="pos"]');
  if (!el) return { exists: false };
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const visible = r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden";
  return { exists: true, visible, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, point: visible ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null };
}

/**
 * ① 横向裁切读数：文档超宽量 + 全部越界元素分桶。
 * reason=page 才进门禁；railScroller/offCanvas/scroller:* 是口径内豁免，但逐条带回，不静默放行。
 */
function NARROW_OVERFLOW_READER() {
  const D = document;
  const VW = window.innerWidth;
  const selish = (el) => {
    const tag = String(el.tagName || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    const id = el.id ? `#${el.id}` : "";
    return `${tag}${id}${cls ? "." + cls : ""}`.slice(0, 90) || tag;
  };
  const docOverflowX = Math.max(D.documentElement.scrollWidth, D.body ? D.body.scrollWidth : 0) - VW;
  const htmlOx = getComputedStyle(D.documentElement).overflowX;
  const bodyOx = D.body ? getComputedStyle(D.body).overflowX : null;
  const offenders = [];
  for (const el of D.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) <= 0.01) continue;
    if (r.right <= VW + 1 && r.left >= -1) continue;
    let reason = "page";
    if (el.closest('[data-testid="second-nav"].hidden')) reason = "offCanvas";
    else if (st.position === "fixed" && (r.left >= VW - 1 || r.right <= 1)) reason = "offCanvas";
    else {
      let p = el;
      let scroller = null;
      for (let d = 0; d < 12 && p; d += 1) {
        const s = getComputedStyle(p);
        if (s.overflowX === "auto" || s.overflowX === "scroll") {
          scroller = p;
          break;
        }
        p = p.parentElement;
      }
      if (scroller && (scroller.matches('[data-testid="rail"]') || scroller.closest('[data-testid="rail"]'))) reason = "railScroller";
      else if (scroller) reason = `scroller:${selish(scroller).slice(0, 36)}`;
    }
    const rec = { sel: selish(el), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }, reason };
    if (reason === "page") {
      /* page 桶要能自证「用户真的滚不到」：带上祖先链的 overflowX / 可滚量程，
         以及把该元素带入视口所需的那个 overflow:hidden 同步容器（Element Plus 表头就是这种：
         自身 hidden、由兄弟滚动容器带 scrollLeft 同步），供手势腿逐条复核「裁了到底滚不滚得回来」。 */
      const chain = [];
      let q = el;
      let scrollableRange = 0;
      let clipper = null;
      for (let d = 0; d < 14 && q; d += 1) {
        const s = getComputedStyle(q);
        const room = q.scrollWidth - q.clientWidth;
        if (room > 1) scrollableRange += room;
        if (!clipper && (s.overflowX === "hidden" || s.overflowX === "clip") && room > 1) clipper = q;
        chain.push(`${selish(q).slice(0, 26)}:${s.overflowX}${room > 1 ? `(可滚${room})` : ""}`);
        q = q.parentElement;
      }
      rec.ancestorChain = chain.slice(0, 10);
      rec.scrollableRangeInAncestors = scrollableRange;
      if (clipper) {
        const cr = clipper.getBoundingClientRect();
        rec.clipperSel = selish(clipper).slice(0, 60);
        rec.clipperKey = `${rec.clipperSel}@${Math.round(cr.x)},${Math.round(cr.y)},${Math.round(cr.width)}x${Math.round(cr.height)}`;
        rec.clipperRange = Math.round(cr.width ? clipper.scrollWidth - clipper.clientWidth : 0);
        rec.clipperRect = { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) };
      }
    }
    offenders.push(rec);
  }
  const counts = {};
  const byReason = {};
  for (const o of offenders) {
    counts[o.reason === "page" ? "page" : "exempt"] = (counts[o.reason === "page" ? "page" : "exempt"] ?? 0) + 1;
    byReason[o.reason] = (byReason[o.reason] ?? 0) + 1;
  }
  /* 门禁判据不能吃截断后的样本：railScroller/offCanvas 两个桶常年把前 40 格占满，
     排在 DOM 后面的「page」级真裁切越界就会被 gateOff 静默漏掉（inventory 实测
     counts.page=10 而 offenders 切片里一个 page 都没有 ⇒ 假绿）。
     因此把 pageOffenders 全量单独带出来，展示切片与门禁判据彻底分家。 */
  return { vw: VW, docScrollWidth: Math.max(D.documentElement.scrollWidth, D.body ? D.body.scrollWidth : 0), docOverflowX, htmlOverflowX: htmlOx, bodyOverflowX: bodyOx, counts, byReason, pageOffenders: offenders.filter((o) => o.reason === "page"), offenders: offenders.slice(0, 40) };
}

/**
 * ④ 主操作可达 + ⑥ 按钮语义读数：页根内全部按钮的 rect/面积/min-height/min-width/
 * 越界/小命中区/无标签图标位。命中区计数只测量不判红（卡口径）；越界要再分「滚得到 /
 * 滚不到」，只有 action-offscreen（硬越界）进门禁，滚动可达的记发现项。
 */
function PAGE_ACTIONS_READER() {
  const D = document;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const sels = ['main[data-view="manual"].shown > *', 'main[data-view="manual"] > *:not([data-testid="menu-empty"])', ".page"];
  let root = null;
  let rootSel = null;
  for (const s of sels) {
    const el = D.querySelector(s);
    if (el) {
      root = el;
      rootSel = s;
      break;
    }
  }
  const scope = root || D.body;
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const selish = (el) => {
    const tag = String(el.tagName || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}`.slice(0, 90);
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  /**
   * 越界 ≠ 不可用：沿某个方向是否存在**可滚动的祖先（含文档）**能把元素带进视口。
   * 判红只留给「滚也滚不到」的硬越界；滚得到的记发现项（D.15 口径是主操作**可用**，
   * 分页钮落在首屏下方由纵向滚动可达，属正常长页，不该冒充"操作丢失"）。
   */
  const scrollerFor = (el, dir) => {
    const horizontal = dir === "left" || dir === "right";
    let p = el.parentElement;
    for (let d = 0; p && p !== D.body && d < 14; d += 1, p = p.parentElement) {
      const s = getComputedStyle(p);
      if (horizontal ? s.overflowX === "auto" || s.overflowX === "scroll" : s.overflowY === "auto" || s.overflowY === "scroll") {
        const room = horizontal ? p.scrollWidth - p.clientWidth : p.scrollHeight - p.clientHeight;
        if (room > 1) return selish(p).slice(0, 40);
      }
    }
    const se = D.scrollingElement || D.documentElement;
    const room = horizontal ? se.scrollWidth - se.clientWidth : se.scrollHeight - se.clientHeight;
    return room > 1 ? "(文档)" : null;
  };
  const items = [...scope.querySelectorAll("button, [role='button'], .btn2, a.el-button")]
    .filter(isVisible)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const text = norm(el.textContent);
      const aria = norm(el.getAttribute("aria-label"));
      const title = norm(el.getAttribute("title"));
      const name = text || aria || title;
      const iconOnly = !text && (!!el.querySelector("svg, i, .el-icon, use") || /icon/.test(String(typeof el.className === "string" ? el.className : "")));
      const need = [];
      if (r.right > VW + 1) need.push("right");
      if (r.left < -1) need.push("left");
      if (r.bottom > VH + 1) need.push("down");
      if (r.top < -1) need.push("up");
      const ways = need.map((dir) => ({ dir, scroller: scrollerFor(el, dir) }));
      const reachByScroll = need.length > 0 && ways.every((w) => w.scroller);
      return {
        sel: selish(el),
        name: name.slice(0, 24),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        area: Math.round(r.width * r.height),
        minH: st.minHeight,
        minW: st.minWidth,
        disabled: el.disabled === true,
        offNeed: need,
        offByScroller: ways,
        offscreen: need.length > 0 && !reachByScroll,
        reachByScroll,
        below44: r.width < 44 || r.height < 44,
        below24: r.width < 24 || r.height < 24,
        iconOnly,
        unlabeled: !name,
        primary: /查询|搜索|新增|新建|添加|保存|提交|确认|导出|刷新|结算|取单|挂单|详情|查看/.test(name) && !el.disabled,
      };
    });
  const reachable = items.filter((i) => i.reachByScroll);
  return {
    rootSel: rootSel ?? "(兜底 body)",
    total: items.length,
    below44: items.filter((i) => i.below44).length,
    below24: items.filter((i) => i.below24).length,
    unlabeled: items.filter((i) => i.unlabeled).length,
    iconOnly: items.filter((i) => i.iconOnly).length,
    offscreen: items.filter((i) => i.offscreen).slice(0, 12),
    offscreenCount: items.filter((i) => i.offscreen).length,
    reachByScrollCount: reachable.length,
    reachByScrollPrimaryCount: reachable.filter((i) => i.primary).length,
    reachByScrollSamples: reachable.slice(0, 12).map((i) => ({ sel: i.sel, name: i.name, y: i.rect.y, need: i.offNeed, via: i.offByScroller })),
    smallSamples: items.filter((i) => i.below44).sort((a, b) => a.area - b.area).slice(0, 8),
    unlabeledSamples: items.filter((i) => i.unlabeled).slice(0, 12),
    primary: items.filter((i) => i.primary).slice(0, 10),
  };
}

/** 键盘行走的起步点：页面上不受任何交互元素遮挡的中性坐标（真实鼠标点击落在这里再开始 Tab） */
function NEUTRAL_SPOT() {
  const interactive = (el) => el.closest("button, a, input, select, textarea, [contenteditable], [role='button'], [tabindex]:not([tabindex='-1'])");
  const cand = [
    [195, 320],
    [195, 480],
    [80, 640],
    [195, 700],
    [300, 90],
  ];
  for (const [x, y] of cand) {
    if (x >= window.innerWidth || y >= window.innerHeight) continue;
    const el = document.elementFromPoint(x, y);
    if (!el) continue;
    if (interactive(el)) continue;
    if (el.closest('[data-testid="second-nav"]') || el.closest('[data-testid="rail"]')) continue;
    return { x, y, tag: String(el.tagName).toLowerCase(), cls: (typeof el.className === "string" ? el.className : "").slice(0, 40) };
  }
  return null;
}

/** 一站 Tab 落点读数：焦点身份 + 焦点环判据（outline 非 none/0 ⇒ outline 环；box-shadow 非 none ⇒ shadow 环） */
function FOCUS_STOP_READER() {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: "body" };
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const outlineW = parseFloat(st.outlineWidth) || 0;
  const ring = st.outlineStyle !== "none" && outlineW > 0 ? "outline" : st.boxShadow && st.boxShadow !== "none" ? "shadow" : "none";
  return {
    tag: String(el.tagName).toLowerCase(),
    sel: `${String(el.tagName).toLowerCase()}${el.id ? "#" + el.id : ""}${(typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "")}`.slice(0, 90),
    text: (norm(el.textContent) || norm(el.getAttribute("aria-label")) || norm(el.getAttribute("title")) || norm(el.getAttribute("placeholder"))).slice(0, 20),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1,
    ring,
    outline: { style: st.outlineStyle, width: st.outlineWidth, color: st.outlineColor.slice(0, 40) },
    shadow: String(st.boxShadow).slice(0, 80),
    inSubnav: !!(el.closest && el.closest('[data-testid="second-nav"]')),
    inRail: !!(el.closest && el.closest('[data-testid="rail"]')),
  };
}

/**
 * 焦点环终判据：activeElement + 4 层祖先在「聚焦 → 失焦 → 复聚焦」之间的计算样式差。
 * Element Plus 把输入框的焦点环画在包装层（.el-input__wrapper 的 box-shadow），input 自身
 * outline 恒为 none ⇒ 只看自身会把「有环」误判成「键盘焦点不可见」。
 * 失焦后等 420ms（> EP 默认 .3s 过渡）再取基线，避免把过渡中间帧当成变化；
 * 采样面覆盖伪元素（::before/::after 画的环与 border 下划线）和 className（类切换本身），
 * 并带失焦瞬间的 activeElement 读数 —— 差判 0 时必须能分清「真的没变化」和「blur 没生效」。
 * 判完立即把焦点还给原元素，Tab 行走序列与不做此检测时一致。
 */
async function FOCUS_RING_DIFF() {
  const el = document.activeElement;
  if (!el || el === document.body) return { changedCount: 0, chain: [], activeAfterBlur: "body?" };
  const chain = [];
  for (let p = el, d = 0; d < 5 && p && p !== document.body; p = p.parentElement, d += 1) chain.push(p);
  const selish = (n) => {
    const tag = String(n.tagName || "").toLowerCase();
    const cls = (typeof n.className === "string" ? n.className : n.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${n.id ? "#" + n.id : ""}${cls ? "." + cls : ""}`.slice(0, 60);
  };
  const names = chain.map((n) => selish(n));
  const pseudo = (p, w) => {
    const s = getComputedStyle(p, w);
    return [s.content, s.boxShadow, s.outlineStyle, s.outlineWidth, s.borderBottomColor, s.backgroundColor].join("~");
  };
  const snap = () => chain.map((p) => {
    const s = getComputedStyle(p);
    return ["ol", s.outlineStyle, s.outlineWidth, s.outlineColor, "sh", s.boxShadow, "bd", s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor, "bg", s.backgroundColor].join("|");
  });
  const snapFull = () => {
    const base = snap();
    return base.map((b, i) => `${b}@@before=${pseudo(chain[i], "::before")}@@after=${pseudo(chain[i], "::after")}`);
  };
  const classes = () => chain.map((p) => String(p.className ?? ""));
  const focused = snapFull();
  const clsFocused = classes();
  el.blur();
  const activeAfterBlur = document.activeElement ? String(document.activeElement.tagName).toLowerCase() : null;
  await new Promise((res) => setTimeout(res, 420));
  const blurred = snapFull();
  const clsBlurred = classes();
  const changed = [];
  for (let i = 0; i < focused.length; i += 1) {
    if (focused[i] !== blurred[i]) changed.push({ node: names[i], focused: focused[i].slice(0, 150), blurred: blurred[i].slice(0, 150) });
  }
  const classOnly = [];
  for (let i = 0; i < clsFocused.length; i += 1) {
    if (clsFocused[i] !== clsBlurred[i] && focused[i] === blurred[i]) classOnly.push({ node: names[i], focused: clsFocused[i].slice(0, 120), blurred: clsBlurred[i].slice(0, 120) });
  }
  el.focus();
  await new Promise((res) => setTimeout(res, 60));
  return { changedCount: changed.length, changed: changed.slice(0, 4), classOnlyChanged: classOnly.slice(0, 3), activeAfterBlur, chain: names };
}

/** ③ 弹层触发扫描：页根内按安全动词等级找第一个非破坏性动作；破坏性动词只登记不动手 */
function OVERLAY_TRIGGER_SCAN(cfg) {
  const D = document;
  const safe = cfg.safeVerbs;
  const destr = new RegExp(cfg.destructiveRe);
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const selish = (el) => {
    const tag = String(el.tagName || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}`.slice(0, 90);
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  const sels = ['main[data-view="manual"].shown > *', 'main[data-view="manual"] > *:not([data-testid="menu-empty"])', ".page"];
  let root = null;
  for (const s of sels) {
    const el = D.querySelector(s);
    if (el) {
      root = el;
      break;
    }
  }
  const scope = root || D.body;
  const cands = [...scope.querySelectorAll("button, [role='button'], .btn2, a.el-button")].filter(isVisible);
  let best = null;
  for (const v of safe) {
    const hit = cands.find((el) => {
      const t = norm(el.textContent) || norm(el.getAttribute("aria-label"));
      return t.includes(v) && !destr.test(t);
    });
    if (hit) {
      best = { verb: v, el: hit };
      break;
    }
  }
  const destructiveSeen = cands.filter((el) => destr.test(norm(el.textContent))).map((el) => norm(el.textContent).slice(0, 20)).slice(0, 10);
  if (!best) return { found: false, destructiveSeen, candidateTexts: cands.map((el) => norm(el.textContent).slice(0, 16)).filter(Boolean).slice(0, 40) };
  const r = best.el.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const top = D.elementFromPoint(cx, cy);
  const guarded = !!top && (top === best.el || best.el.contains(top) || (top.closest && top.closest("button, [role='button']") === best.el));
  return {
    found: true,
    verb: best.verb,
    text: (norm(best.el.textContent) || norm(best.el.getAttribute("aria-label"))).slice(0, 24),
    sel: selish(best.el),
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    point: guarded ? { x: cx, y: cy } : null,
    destructiveSeen,
  };
}

/** 浮层现场全量读数：身份/尺寸/是否被 390 裁到/确认取消可达性 */
function OVERLAY_STATE_SCAN(cfg) {
  const D = document;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const active = [];
  for (const sel of cfg.overlaySels) {
    for (const el of D.querySelectorAll(sel)) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) <= 0.05) continue;
      if (r.width < 20 || r.height < 20) continue;
      const buttons = [...el.querySelectorAll("button, [role='button']")]
        .map((b) => {
          const br = b.getBoundingClientRect();
          const name = norm(b.textContent) || norm(b.getAttribute("aria-label")) || norm(b.getAttribute("title"));
          return {
            text: name.slice(0, 20),
            rect: { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) },
            visible: br.width > 0 && br.height > 0 && getComputedStyle(b).display !== "none",
            inViewport: br.width > 0 && br.left >= -1 && br.right <= VW + 1 && br.top >= -1 && br.bottom <= VH + 1,
          };
        })
        .filter((b) => b.visible);
      const confirm = buttons.find((b) => /确\s*定|确\s*认|提\s*交|保\s*存/.test(b.text)) ?? null;
      const cancel = buttons.find((b) => /取\s*消|关\s*闭|返\s*回|我\s*知\s*道/.test(b.text)) ?? null;
      active.push({
        kind: sel,
        cls: (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).slice(0, 3).join(".").slice(0, 60),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        within390: r.left >= -1 && r.right <= VW + 1 && r.top >= -1 && r.bottom <= VH + 1,
        confirmReachable: !!confirm && confirm.inViewport,
        cancelReachable: !!cancel && cancel.inViewport,
        buttons: buttons.slice(0, 10),
        confirmText: confirm?.text ?? null,
        cancelText: cancel?.text ?? null,
      });
    }
  }
  return { count: active.length, active };
}

/** 抽屉里代表页条目的真实落点：可点的目录卡优先，其次真实区 .sn-row；「待接入」占位卡点了不导航，必须先剔掉再匹配 */
function DRAWER_CARD_SCAN(cfg) {
  const D = document;
  const labels = (cfg.labels ?? []).filter((l) => typeof l === "string" && l.length >= 2);
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  /* 390 复算出的采集侧缺陷：二级栏目录卡里有 `.sn-card.pending`（文案「库存列表待接入」），
     文本包含目标标签 ⇒ 旧匹配先命中它，真点之后 URL 仍停在 /dashboard，被渲染门判成
     「人工层没画出来」的假模块红。占位卡根本不会导航 ⇒ 匹配池必须先剔它，剔完再去真实区 .sn-row 找。 */
  const isPending = (el) =>
    el.classList.contains("pending") ||
    el.getAttribute("data-plan-status") === "pending" ||
    el.getAttribute("aria-disabled") === "true" ||
    el.disabled === true;
  const matches = (el) => {
    const lab = norm(el.getAttribute?.("data-plan-label"));
    const t = norm(el.textContent);
    return labels.some((l) => (lab && lab === l) || (lab && lab.includes(l)) || t.startsWith(l) || t.includes(l));
  };
  const toggle = D.querySelector('[data-testid="second-nav-real-toggle"]');
  const tiers = [
    ["sub-card", [...D.querySelectorAll('[data-testid="second-nav-sub-zone"] .sn-card')]],
    ["sn-row", [...D.querySelectorAll('[data-testid="second-nav-real-zone"] .sn-row')]],
    ["fallback", [...D.querySelectorAll('[data-testid="second-nav"] .sn-card, [data-testid="second-nav"] .sn-row')]],
  ].map(([zone, all]) => ({ zone, all: all.filter(isVisible) }));
  let zone = "empty";
  let pool = [];
  let matchedIndex = -1;
  const pendingLabels = [];
  for (const tier of tiers) {
    if (tier.all.length === 0) continue;
    const live = tier.all.filter((el) => !isPending(el));
    pendingLabels.push(...tier.all.filter(isPending).map((el) => norm(el.textContent).slice(0, 24)));
    const i = live.findIndex(matches);
    if (i >= 0) {
      zone = tier.zone;
      pool = live;
      matchedIndex = i;
      break;
    }
    if (pool.length === 0) {
      pool = live.length ? live : tier.all;
      zone = tier.zone;
    }
  }
  const out = {
    zone,
    total: pool.length,
    hasMoreToggle: !!toggle,
    matched: matchedIndex >= 0 ? norm(pool[matchedIndex].textContent).slice(0, 30) : null,
    texts: pool.map((el) => norm(el.textContent).slice(0, 24)).slice(0, 40),
    pendingOnly: matchedIndex < 0 && pendingLabels.length > 0 ? pendingLabels.slice(0, 12) : null,
    labels,
  };
  if (matchedIndex < 0) return { ...out, point: null };
  const el = pool[matchedIndex];
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.x + r.width / 2);
  const cy = Math.round(r.y + r.height / 2);
  const top = D.elementFromPoint(cx, cy);
  out.rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  out.point = !!top && (top === el || el.contains(top)) ? { x: cx, y: cy } : null;
  return out;
}

/**
 * ⑦b 令牌真值取样（F1 §三.7 的反弱化装置）：把画布根**实际解析到**的功能墨令牌值取回 Node 侧。
 * 门禁认的是「这一族令牌」，不是某个具体十六进制 ⇒ 谁改了令牌值，采样到的新值自动进档；
 * 谁把令牌删了，页面就退回声明里的兜底字面量，而兜底（原型 #8A8F98）正是退役登记表里的值，照判红。
 * 返回 {ink, ink2, inkPrimary, side, bg, line}（已归一成 "r,g,b"），量不到的一律给空串（Node 侧再退回静态表）。
 */
function CANVAS_INK_PROBE() {
  const root = document.querySelector('main[data-view="manual"].shown') || document.querySelector("main.wb-view-manual");
  const cs = root ? getComputedStyle(root) : null;
  const toRgb = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    const el = document.createElement("span");
    el.style.color = s;
    document.body.appendChild(el);
    const resolved = getComputedStyle(el).color;
    el.remove();
    const m = /rgba?\(([^)]*)\)/.exec(resolved);
    if (!m) return "";
    return m[1].trim().split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((n) => String(Math.round(Number(n)))).join(",");
  };
  const read = (name) => toRgb(cs ? cs.getPropertyValue(name) : "");
  return { ink: read("--wb-ink"), ink2: read("--wb-ink2"), inkPrimary: read("--color-primary-text"), side: read("--wb-side"), bg: read("--wb-bg"), line: read("--wb-line") };
}

/** ⑦ 对比度取样：页根内每段真实文字的「前景色 + 实际承托底色 + 字号字重」；亮度换算在 Node 侧做 */
function TEXT_CONTRAST_SCAN() {
  const D = document;
  /**
   * 承托底色 = 祖先链上全部半透明层**逐层合成**后的不透明真值（F1 整改）。
   * 旧写法取「第一个 alpha>0.01 的层」原样返回 ⇒ Node 侧 rgbOf 只留前三个数、把 alpha 丢掉，
   * 品牌主色文字压在自己 6%/12% 淡底上时算出 `#3F6FEF vs rgb(63,111,239)` = **1.00:1** 的假数，
   * 门禁既没判红也没判绿，是把缺陷直接读成了「比值」的测量错误（不是口径宽松，是数算错了）。
   * 合成序：自最外层（不含 alpha 时以画布白为底）向内按 source-over 叠加，撞上完全不透明层即停。
   * 已知局限：只认 background-color，不解析 background-image 渐变/图片；这类底面若量到白底属于乐观估计，
   * 报告与差异表按「computed background-color 口径」披露，不用它反证达标。
   */
  const layerOf = (c) => {
    const m = /rgba?\(([^)]*)\)/.exec(String(c || ""));
    if (!m) return null;
    const p = m[1].trim().split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    const a = p.length >= 4 ? p[3] : 1;
    return [Math.round(p[0]), Math.round(p[1]), Math.round(p[2]), Math.min(1, Math.max(0, Number.isFinite(a) ? a : 1))];
  };
  const paintedBg = (el) => {
    const stack = [];
    let cur = el;
    for (let d = 0; d < 14 && cur; d += 1) {
      const lay = layerOf(getComputedStyle(cur).backgroundColor);
      if (lay) {
        stack.push(lay);
        if (lay[3] >= 0.999) break;
      }
      cur = cur.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const [r, g, b, a] = stack[i];
      base = [Math.round(r * a + base[0] * (1 - a)), Math.round(g * a + base[1] * (1 - a)), Math.round(b * a + base[2] * (1 - a))];
    }
    return `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
  };
  const selish = (el) => {
    const tag = String(el.tagName || "").toLowerCase();
    const cls = (typeof el.className === "string" ? el.className : el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${tag}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}`.slice(0, 90);
  };
  const sels = ['main[data-view="manual"].shown > *', 'main[data-view="manual"] > *:not([data-testid="menu-empty"])', ".page"];
  let root = null;
  for (const s of sels) {
    const el = D.querySelector(s);
    if (el) {
      root = el;
      break;
    }
  }
  const scope = root || D.body;
  const out = [];
  for (const el of scope.querySelectorAll("*")) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && String(n.textContent).trim().length > 0);
    if (!hasText) continue;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width === 0 || r.height === 0) continue;
    if (st.visibility === "hidden" || Number(st.opacity) <= 0.05) continue;
    out.push({
      sel: selish(el),
      text: String(el.textContent).trim().replace(/\s+/g, " ").slice(0, 28),
      fg: st.color,
      bg: paintedBg(el),
      fontSize: st.fontSize,
      fontWeight: st.fontWeight,
    });
    if (out.length >= 220) break;
  }
  return out;
}

/** 浮层选择器（Element Plus 词汇表 + 收银台/账本页内浮层岛）；安全触发动词分级；破坏性动词永不点击 */
const OVERLAY_SELS = [".el-overlay .el-dialog", ".el-message-box", ".el-overlay .el-drawer", ".el-popconfirm", ".el-popover", ".el-select-dropdown", ".pos-pay-mask", ".wb-ledger"];
const SAFE_TRIGGER_VERBS = ["取单", "挂单", "详情", "查看", "明细", "价格参考", "新增", "新建", "添加", "编辑", "更多", "设置", "分配", "查询", "搜索", "筛选", "导出", "打印", "刷新"];
const DESTRUCTIVE_RE = "删除|作废|清空|退款|停用|启用|驳回|撤销|下架|上架|结算|收款|支付|买单";

/* ────────────────────────── Node 侧：WCAG 对比度换算 ────────────────────────── */

const srgbLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function rgbOf(value) {
  try {
    const parts = String(normalizeColor(String(value))).split(",").map((s) => Number(String(s).trim()));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return parts.slice(0, 3);
  } catch {
    return null;
  }
}
const tokenOf = (value, inkIndex = null) => {
  const rgb = rgbOf(value);
  if (!rgb) return null;
  const key = rgb.join(",");
  if (inkIndex && inkIndex.has(key)) return inkIndex.get(key);
  return Object.keys(CANVAS_TOKENS).find((t) => CANVAS_TOKENS[t] === key) ?? null;
};
/**
 * 墨族索引（F1 §三.7）：当前令牌值 ∪ 退役值 ∪ 页面运行时解析值 ⇒ 「认色」不再等于「认门禁」。
 * resolvedInks 由 CANVAS_INK_PROBE 从画布根量回来（形如 {ink:"22,24,29", ink2:"102,107,115"}），
 * 采集时若解析不到（令牌被删、画布外页面）就退回静态表 + 退役值，绝不退回「谁都不认」。
 */
function buildInkIndex(resolvedInks = {}) {
  const idx = new Map();
  for (const t of INK_TOKEN_KEYS) if (CANVAS_TOKENS[t]) idx.set(CANVAS_TOKENS[t], t);
  for (const [rgb, meta] of Object.entries(RETIRED_INK_VALUES)) idx.set(rgb, meta.token);
  for (const t of INK_TOKEN_KEYS) {
    const rgb = rgbOf(resolvedInks?.[t] ?? "");
    if (rgb) idx.set(rgb.join(","), t);
  }
  return idx;
}
/**
 * 承托面索引：与墨族同一条道理 —— 门禁认的是「画布的两块承托面」，不是写死的 rgb。
 * 今天运行时解析值与静态表恒等（side 249,250,251 / bg 255,255,255），所以这条不改变任何现有读数；
 * 它的价值在明天：谁把 `--wb-side` 换成第三个值，那些文字对仍然落在门禁里（换深了直接判红），
 * 而不是「底色不再等于旧字面量 ⇒ 整批配对退出统计」这种把门禁改瞎的写法。
 */
function buildSurfaceIndex(resolvedInks = {}) {
  const idx = new Map();
  for (const t of SURFACE_TOKEN_KEYS) if (CANVAS_TOKENS[t]) idx.set(CANVAS_TOKENS[t], t);
  for (const t of SURFACE_TOKEN_KEYS) {
    const rgb = rgbOf(resolvedInks?.[t] ?? "");
    if (rgb) idx.set(rgb.join(","), t);
  }
  return idx;
}
/** WCAG 大字豁免：≥24px，或 ≥18.66px 且字重 ≥700 ⇒ 阈值 3:1，否则 4.5:1 */
const isLargeText = (sizePx, weight) => sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
/** 比退役 #8A8F98 更深（或同级）的前景色算「功能墨候选」，用于把令牌外暗字全部披露成发现项而不是静默丢弃 */
const INK_CANDIDATE_MAX_LUMINANCE = luminance([138, 143, 152]);

/**
 * ⑦ 对比度换算与判红口径：前景属于**功能墨族**（ink/ink2/inkPrimary 的当前值、退役值、运行时解析值三来源并集）
 * 的文字对，**不论落在哪块承托面**（side/bg/淡底/彩色底）都参与 contrast-regression 门禁。
 * 其余跌破 AA 的文字不判红也不许静默丢弃，按 WCAG 自己的分界三路点名入档：
 *   · 压在品牌主色填充上的字（含白字）→ contrast-on-brand-fill（改它＝改品牌，本轮作为待裁定项上报，不自判通过）；
 *   · 禁用/不可用控件里的字 → contrast-inactive-text-recorded（WCAG 1.4.3 排除 inactive UI 组件，逐条带证据）；
 *   · 其余非令牌色（Element 默认灰等）→ contrast-ink-outside-token（口径外如实点名 + 13C 去向）。
 * line-on-side / line-on-bg 装饰线读数单独带回（≈1.11:1），按 WCAG 1.4.11 incidental 豁免不判红，逐项证明。
 * 谁也不能靠「换个写法/换个底色就不测了」把红抹掉（F1 §三.2 / §六）。
 */
function contrastAnalyze(rawPairs, resolvedInks = {}) {
  const inkIndex = buildInkIndex(resolvedInks);
  const surfaceIndex = buildSurfaceIndex(resolvedInks);
  const seen = new Map();
  const pairs = [];
  for (const p of rawPairs) {
    const fg = rgbOf(p.fg);
    const bg = rgbOf(p.bg);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    const size = Number.parseFloat(p.fontSize) || 12;
    const weight = Number.parseInt(p.fontWeight, 10) || 400;
    const need = isLargeText(size, weight) ? 3 : 4.5;
    const fgToken = tokenOf(p.fg, inkIndex);
    const bgToken = tokenOf(p.bg, surfaceIndex);
    const key = `${fgToken ?? p.fg}|${bgToken ?? p.bg}|${size}|${weight}`;
    if (seen.has(key)) {
      seen.get(key).count += 1;
      continue;
    }
    const brandFill = BRAND_FILL_RGB[bg.join(",")] ?? null;
    const rec = {
      sel: p.sel,
      text: p.text,
      fg: p.fg,
      bg: p.bg,
      fgToken,
      bgToken,
      fontSize: size,
      fontWeight: weight,
      ratio: Math.round(ratio * 100) / 100,
      need,
      pass: ratio >= need,
      canvasPair: INK_TOKEN_KEYS.includes(fgToken),
      brandFill,
      inactive: !!p.inactive,
      count: 1,
    };
    seen.set(key, rec);
    pairs.push(rec);
  }
  const fails = pairs.filter((r) => r.canvasPair && !r.pass);
  const weakestCanvas = pairs.filter((r) => r.canvasPair).reduce((a, b) => (!a || b.ratio < a.ratio ? b : a), null);
  const weakestAny = pairs.reduce((a, b) => (!a || b.ratio < a.ratio ? b : a), null);
  const ink2OnSide = pairs.filter((r) => r.fgToken === "ink2" && r.bgToken === "side").map((r) => ({ sel: r.sel, fontSize: r.fontSize, fontWeight: r.fontWeight, ratio: r.ratio, text: r.text, count: r.count }));
  const linePairs = pairs.filter((r) => r.fgToken === "line").map((r) => ({ sel: r.sel, bgToken: r.bgToken, ratio: r.ratio, count: r.count }));
  const retiredRgbKeys = new Set(Object.keys(RETIRED_INK_VALUES));
  const retiredInkSeen = pairs
    .filter((r) => retiredRgbKeys.has(rgbOf(r.fg)?.join(",")))
    .map((r) => ({ sel: r.sel, fg: r.fg, inkToken: retiredRgbKeys.has(rgbOf(r.fg)?.join(",")) ? RETIRED_INK_VALUES[rgbOf(r.fg).join(",")].token : null, bgToken: r.bgToken, fontSize: r.fontSize, ratio: r.ratio, need: r.need, text: r.text, count: r.count }));
  const brief = (r) => ({ sel: r.sel, fg: r.fg, bg: r.bg, bgToken: r.bgToken, fontSize: r.fontSize, fontWeight: r.fontWeight, ratio: r.ratio, need: r.need, text: r.text, count: r.count });
  /** 白字/深字压在品牌主色填充上：实测点名，改它属品牌视觉裁定，不由本卡自行放行也不由本卡自行判过 */
  const brandFillFails = pairs.filter((r) => r.brandFill && !r.pass && !r.inactive).map(brief);
  /** 令牌外跌破 AA 且不属于上面两类豁免口径的文字（Element 默认灰等）：按比值从低到高点名 */
  const outsideTokenInks = pairs
    .filter((r) => !r.fgToken && !r.brandFill && !r.inactive && r.pass === false)
    .map(brief)
    .sort((a, b) => a.ratio - b.ratio);
  /** 禁用/不可用控件内的低对比文字：WCAG 1.4.3 排除 inactive UI，逐条带 sel 证据，不做批量豁免 */
  const inactiveFails = pairs.filter((r) => r.inactive && !r.pass).map((r) => ({ ...brief(r), inactive: r.inactive }));
  return {
    checked: pairs.length,
    samples: pairs.slice(0, 60),
    fails: fails.slice(0, 12),
    failCount: fails.length,
    weakestCanvas,
    weakestAny,
    ink2OnSide: ink2OnSide.slice(0, 12),
    linePairs: linePairs.slice(0, 6),
    inkTokens: resolvedInks,
    retiredInkSeen: retiredInkSeen.slice(0, 8),
    outsideTokenInks: outsideTokenInks.slice(0, 8),
  };
}

/* ────────────────────────── 计划：11 业务模块 + pos 的代表页 ────────────────────────── */

/** 收银台条目真相源：manifest-pos.ts 的 item("web.pos.cashier", …) */
function posCashierEntry() {
  try {
    const line = readFileSync(MANIFEST_POS, "utf8").split(/\r?\n/).find((l) => /item\("web\.pos\.cashier"/.test(l)) ?? "";
    const m = /item\("web\.pos\.cashier",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/.exec(line);
    if (m) return { viewKey: m[1], routePath: m[2], title: m[3] };
  } catch {
    /* 读不到就走兜底 */
  }
  return { viewKey: "pos-cashier", routePath: "/pos/cashier", title: "快速收银" };
}

function buildPlan() {
  if (!existsSync(MODEL_FILE)) throw new Error(`页面模型缺失：${MODEL_FILE}（请先跑 wb13b 页面模型采集，本工具不注入、不猜路由）`);
  const model = JSON.parse(readFileSync(MODEL_FILE, "utf8"));
  const railOf = new Map((model.catalogReconciliation ?? []).map((c) => [c.sectorKey, c.railKey]));
  const BUSINESS_ORDER = ["sale", "order", "purchase", "inventory", "customer", "product", "retail", "finance", "report", "marketing", "system"];
  const PREFER = ["list", "board", "fuse", "form", "order", "print", "detail", "bill"];
  const wanted = (flag("modules") ?? BUSINESS_ORDER.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
  const pagesArg = flag("pages");
  const pins = (pagesArg ?? "").split(",").filter((s) => s.includes(":")).map((s) => s.split(":"));
  const limit = pagesArg && /^\d+$/.test(pagesArg) ? Math.max(1, Number(pagesArg)) : 1;
  const sectors = new Map((model.model ?? []).map((m) => [m.sectorKey, m]));
  const planned = [];
  const push = (entry) => {
    if (!entry.routePath) return;
    planned.push(entry);
  };
  for (const key of wanted) {
    if (key === "pos") {
      const pos = posCashierEntry();
      push({
        key: "pos",
        name: "门店收银",
        kind: "pos",
        railKey: null,
        pageKey: pos.viewKey,
        pageTitle: pos.title,
        routePath: pos.routePath,
        panelType: "pos",
        labels: [pos.title, "收银台", "快速收银", pos.viewKey],
      });
      continue;
    }
    const sector = sectors.get(key);
    if (!sector) {
      console.error(`--modules 里的 ${key} 不在页面模型中（可用键：${[...BUSINESS_ORDER, "pos"].join(",")}）`);
      process.exit(2);
    }
    const lv2 = (sector.lv2 ?? []).filter((p) => p.routePath && p.superAdminVisible !== false);
    const byType = new Map();
    for (const p of lv2) if (p.panelType && !byType.has(p.panelType)) byType.set(p.panelType, p);
    let reps = PREFER.map((t) => byType.get(t)).filter(Boolean);
    for (const p of lv2) if (!reps.includes(p) && reps.length < limit + 2) reps.push(p);
    const keyPins = pins.filter(([k]) => k === key).map(([, v]) => v);
    if (keyPins.length) reps = lv2.filter((p) => keyPins.includes(p.viewKey));
    reps = reps.slice(0, Math.max(1, keyPins.length ? keyPins.length : limit));
    const railKey = railOf.get(key) ?? key;
    for (const p of reps.length ? reps : [null]) {
      if (!p) {
        planned.push({ key, name: sector.sectorName, kind: "business", railKey, pageKey: "none", pageTitle: null, routePath: null, panelType: null, labels: [], unplanned: true });
        continue;
      }
      push({
        key,
        name: sector.sectorName,
        kind: "business",
        railKey,
        pageKey: p.viewKey,
        pageTitle: p.routeTitle ?? p.manifestTitle ?? p.pageName,
        routePath: p.routePath,
        panelType: p.panelType ?? null,
        labels: [p.protoSubLabel, p.manifestTitle, p.routeTitle, p.pageName, p.viewKey].filter(Boolean),
      });
    }
  }
  if (planned.length === 0) {
    console.error("--modules 解析后为空");
    process.exit(2);
  }
  return planned;
}

/* ────────────────────────── 驱动：真实点击 / 真实触摸 / 真实按键 ────────────────────────── */

let browser = null;
let auth = null;

const sleep = (page, ms) => page.waitForTimeout(ms);

function waitDrawer(page, want, timeout = 6000) {
  return page
    .waitForFunction(
      (cfg) => {
        const sub = document.querySelector('[data-testid="second-nav"]');
        if (!sub) return false;
        let tx = 0;
        const t = getComputedStyle(sub).transform;
        if (t && t !== "none") tx = Math.round(Number(t.slice(t.indexOf("(") + 1, t.indexOf(")")).split(",")[4]) || 0);
        const hidden = sub.classList.contains("hidden");
        return cfg.open ? !hidden && tx >= -10 : hidden || tx < -10;
      },
      { open: want },
      { timeout: Math.max(300, timeout) },
    )
    .then(() => true)
    .catch(() => false);
}

async function railSpot(page, plan, waitMs = 30000) {
  /* rail 首帧渲染的是骨架项（.is-rail-skeleton，被解析器排除）⇒ 菜单/契约数据没回来就解析，
     会得到 resolved=null 的假「入口裁死」。给一个有上限的真等待，等到非骨架项出现为止；
     等不到仍然 fail-closed，并把等待时长写进违规理由，不许把超时当通过。 */
  const t0 = Date.now();
  let rail = await page.evaluate(IMPL_RAIL_KEY_RESOLVER, { railKey: plan.railKey, moduleName: plan.name });
  while (!rail.resolved && Date.now() - t0 < waitMs) {
    await page.waitForTimeout(500);
    rail = await page.evaluate(IMPL_RAIL_KEY_RESOLVER, { railKey: plan.railKey, moduleName: plan.name });
  }
  const waitedMs = Date.now() - t0;
  if (!rail.resolved) {
    const sk = await page.evaluate(() => document.querySelectorAll('[data-testid="rail"] .is-rail-skeleton').length);
    return { ok: false, rail, waitedMs, skeletons: sk };
  }
  const loc = page.locator(`[data-testid="rail"] .wb-rail-item[data-rail-key="${rail.resolved}"]`).first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox().catch(() => null);
  if (!box) return { ok: false, rail, waitedMs, reason: "rail-item-no-box" };
  return { ok: true, rail, waitedMs, point: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) } };
}

async function closeDrawerByMask(page, mode) {
  const st = await page.evaluate(NARROW_SHELL_READER);
  if (!st.drawerOpen) return { closed: true, via: "already-closed", shell: st };
  if (!st.mask) return { closed: false, via: "no-mask", shell: st };
  const spot = await page.evaluate(MASK_TAP_SPOT, { selector: '[data-testid="side-mask"]' });
  if (!spot) return { closed: false, via: "no-mask-spot", shell: st };
  if (mode === "touch") await page.touchscreen.tap(spot.x, spot.y);
  else await page.mouse.click(spot.x, spot.y);
  const closed = await waitDrawer(page, false, 5000);
  return { closed, via: `mask-${mode}@${spot.x},${spot.y}`, shell: await page.evaluate(NARROW_SHELL_READER) };
}

/** 抽屉重开：优先真实点击「展开导航」（rail 项对已选模块是反选语义，重复点会取消选中，不能用它重开） */
async function reopenDrawer(page, mode) {
  const st = await page.evaluate(NARROW_SHELL_READER);
  if (st.drawerOpen) return { opened: true, via: "already-open" };
  if (st.toggle) {
    const pt = { x: Math.round(st.toggle.x + st.toggle.w / 2), y: Math.round(st.toggle.y + st.toggle.h / 2) };
    if (mode === "touch") await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.click(pt.x, pt.y);
    const opened = await waitDrawer(page, true, 5000);
    return { opened, via: `side-toggle@${pt.x},${pt.y}` };
  }
  return { opened: false, via: "no-toggle", shell: st };
}

async function findEntrySpot(page, plan) {
  let spot = await page.evaluate(DRAWER_CARD_SCAN, { labels: plan.labels });
  if (!spot.point && spot.hasMoreToggle) {
    await page.locator('[data-testid="second-nav-real-toggle"]').first().click().catch(() => {});
    await page.waitForTimeout(350);
    spot = await page.evaluate(DRAWER_CARD_SCAN, { labels: plan.labels });
  }
  return spot;
}

/** 业务模块入口：rail 真实点击（兼作 ②鼠标抽屉轨迹）⇒ 抽屉目录卡真实点击 ⇒ 路由落位 */
async function enterBusiness(page, plan, step, V, F, G, rec) {
  const dm = { via: "rail", rail: null, openedByRealClick: false, maskTapClosed: null, autoClosedAfterPick: null, entryTrail: null, drawerRect: null, transformX: null, maskRect: null, cards: null, rows: null, trail: [] };
  rec.drawer.mouse = dm;
  const spotInfo = await railSpot(page, plan);
  if (!spotInfo.ok) {
    const snap = await page.evaluate(SECOND_NAV_SNAPSHOT);
    V.push({ kind: "module-without-capture", moduleKey: plan.key, page: plan.pageKey, reason: `等待 ${spotInfo.waitedMs}ms 后一级 rail 仍解析不到 ${plan.railKey}（resolved=${String(spotInfo.rail?.resolved)}，骨架项 ${spotInfo.skeletons ?? "?"} 个）⇒ 入口不可用/证据缺失，fail-closed`, detail: { waitedMs: spotInfo.waitedMs, skeletons: spotInfo.skeletons ?? null, inventory: spotInfo.rail?.inventory?.slice(0, 20) ?? null, snap } });
    return null;
  }
  dm.rail = { key: spotInfo.rail.resolved, via: spotInfo.rail.via, point: spotInfo.point, waitedMs: spotInfo.waitedMs };
  await page.mouse.click(spotInfo.point.x, spotInfo.point.y);
  dm.openedByRealClick = await waitDrawer(page, true, 6000);
  const afterOpen = await page.evaluate(NARROW_SHELL_READER);
  const snapOpen = await page.evaluate(SECOND_NAV_SNAPSHOT);
  dm.drawerRect = afterOpen.subnav?.box ?? null;
  dm.transformX = afterOpen.subnav?.transformX ?? null;
  dm.maskRect = afterOpen.mask;
  dm.cards = snapOpen.cards.length;
  dm.rows = snapOpen.rows.length;
  step(`真实鼠标点 rail ${spotInfo.rail.resolved}（${spotInfo.rail.via}${spotInfo.waitedMs > 1500 ? `，等骨架消退 ${spotInfo.waitedMs}ms` : ""}）⇒ 抽屉 open=${dm.openedByRealClick} tx=${dm.transformX} 目录卡 ${dm.cards} 张/真实区 ${dm.rows} 行`);
  if (!dm.openedByRealClick) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "真实鼠标点击一级 rail 后抽屉未展开（6s 等待超时）", detail: { shell: afterOpen, snap: snapOpen } });
  let spot = await findEntrySpot(page, plan);
  if (!spot.point) {
    const closeRes = await closeDrawerByMask(page, "mouse");
    dm.maskTapClosed = closeRes.closed;
    dm.trail.push(closeRes.via);
    if (!closeRes.closed) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "真实鼠标点击遮罩空白未能收起抽屉", detail: closeRes.shell });
    const reopen = await reopenDrawer(page, "mouse");
    dm.trail.push(reopen.via);
    spot = await findEntrySpot(page, plan);
    if (!spot.point) {
      /* 抽屉里该代表页没有「可点」条目（全 mismatch，或只剩 .sn-card.pending 待接入占位卡——disabled，点了不导航）。
         这是接入缺口（菜单桥/端点未接），不是 390 视觉缺陷：如实挂 gap 交人工，同时退回**真实路由**
         （无 query、无注入，与 enterPos 同一口径）把溢出/命中区/焦点/弹层/对比度这五条腿量完。
         量不到就判模块红＝把后端缺口说成窄口缺陷；退回路由却不挂 gap＝把点不到的入口藏起来。两头都不许。 */
      const why = spot.pendingOnly?.length
        ? `抽屉内该代表页只有待接入占位卡（${spot.pendingOnly.slice(0, 4).join("/")}），点了不导航`
        : `抽屉 ${spot.zone} 区 ${spot.total} 条里没有匹配 ${JSON.stringify(plan.labels.slice(0, 3))} 的可点条目`;
      G.push({
        moduleKey: plan.key,
        page: plan.pageKey,
        state: "drawer-entry",
        reason: `390 抽屉点击腿无证据：${why} ⇒ 本模块窄口读数改由真实路由 ${plan.routePath} 兜底采集`,
        detail: { labels: plan.labels, zone: spot.zone, texts: spot.texts, pendingOnly: spot.pendingOnly ?? null, routePath: plan.routePath, snap: await page.evaluate(SECOND_NAV_SNAPSHOT).then((s) => ({ cards: s.cards.slice(0, 20), rows: s.rows.slice(0, 20), empty: s.empty })) },
        owner: OWNER,
        followUp: "墨：入口接入（菜单桥/端点）后复跑该模块的抽屉点击腿；或由人工在 390 确认该页在二级栏的可见性",
        evidence: rec.frame?.file ?? null,
      });
      F.push({ kind: "drawer-entry-route-fallback", moduleKey: plan.key, page: plan.pageKey, reason: `退回真实路由 ${plan.routePath}（无 query、无注入）完成其余五条腿测量`, detail: { why, pendingOnly: spot.pendingOnly ?? null } });
      await page.goto(`${ORIGIN}${plan.routePath}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
      await sleep(page, 500);
      const paintR = await page.evaluate(IMPL_PAINT_GATE, { routePath: plan.routePath });
      if (!paintR.ok) {
        V.push({ kind: "module-without-capture", moduleKey: plan.key, page: plan.pageKey, reason: `抽屉无可用条目（${why}），退回真实路由后人工层仍未画出 ⇒ 该模块在 390 零读数，fail-closed`, detail: { entry: spot, paint: paintR, views: await page.evaluate(IMPL_VIEWS_SNAPSHOT) } });
        return null;
      }
      dm.entryTrail = { zone: spot.zone, matched: null, point: null, total: spot.total, via: "route-fallback", pendingOnly: spot.pendingOnly ?? null };
      dm.routeFallback = plan.routePath;
      rec.paint = paintR;
      step(`抽屉条目 ${why} ⇒ 退回真实路由 ${plan.routePath}，渲染门 ok=${paintR.ok}`);
      return { paint: paintR, viaRoute: true };
    }
  }
  await page.mouse.click(spot.point.x, spot.point.y);
  dm.entryTrail = { zone: spot.zone, matched: spot.matched, point: spot.point, total: spot.total };
  step(`真实点击抽屉条目 ${JSON.stringify(spot.matched)}（${spot.zone} 共 ${spot.total} 条）@${spot.point.x},${spot.point.y}`);
  await page
    .waitForFunction((p) => location.pathname === p || location.pathname.endsWith(p), plan.routePath, { timeout: 20000 })
    .catch(() => {
      /* 路由没落位交给渲染门如实判 */
    });
  const paint = await page.evaluate(IMPL_PAINT_GATE, { routePath: plan.routePath });
  if (!paint.ok) {
    V.push({ kind: "module-without-capture", moduleKey: plan.key, page: plan.pageKey, reason: `页面渲染门未过：点击 ${JSON.stringify(spot.matched)}（${spot.zone}）后人工层没有真实画出来`, detail: { entry: dm.entryTrail, paint, views: await page.evaluate(IMPL_VIEWS_SNAPSHOT) } });
    return null;
  }
  const afterPick = await page.evaluate(NARROW_SHELL_READER);
  dm.autoClosedAfterPick = !afterPick.drawerOpen;
  if (afterPick.drawerOpen) {
    const closeRes = await closeDrawerByMask(page, "mouse");
    dm.maskTapClosed = closeRes.closed;
    if (!closeRes.closed) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "点击条目后抽屉既未自动收起、点遮罩也未能收起", detail: closeRes.shell });
  } else {
    dm.maskTapClosed = "n/a（点条目已自动收起）";
  }
  rec.paint = paint;
  return { paint };
}

/** 收银台入口：真实点 pos 模式段；模式段在 390 不可见时如实退回真实路由并记发现项（无 query、无注入） */
async function enterPos(page, plan, step, V, F, rec) {
  const dm = { via: "mode-seg", modeSegPoint: null, routeFallback: false, openedByToggle: null, entryTrail: null, trail: [] };
  rec.drawer.mouse = dm;
  const entry = await page.evaluate(POS_ENTRY_SPOT);
  if (!entry.point) {
    dm.routeFallback = true;
    F.push({ kind: "pos-mode-seg-not-clickable", moduleKey: "pos", page: plan.pageKey, reason: `pos 模式段${entry.exists ? "在但 390 下不可见" : "不存在"} ⇒ 退回真实路由 /pos/cashier（无 query、无注入），抽屉证据改由展开导航腿承担`, detail: entry });
    await page.goto(`${ORIGIN}${plan.routePath}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
    await sleep(page, 500);
  } else {
    await page.mouse.click(entry.point.x, entry.point.y);
    dm.modeSegPoint = entry.point;
    await sleep(page, 900);
    const reopen = await reopenDrawer(page, "mouse");
    dm.openedByToggle = reopen.opened;
    dm.trail.push(reopen.via);
    if (!reopen.opened) V.push({ kind: "drawer-unusable", moduleKey: "pos", page: plan.pageKey, reason: "pos 场景下真实点击展开导航未能打开抽屉", detail: reopen.shell ?? null });
    const spot = await findEntrySpot(page, plan);
    dm.entryTrail = { zone: spot.zone, matched: spot.matched, point: spot.point, total: spot.total };
    if (spot.point) {
      await page.mouse.click(spot.point.x, spot.point.y);
      await sleep(page, 700);
    }
  }
  await page
    .waitForFunction((p) => location.pathname === p || location.pathname.endsWith(p), plan.routePath, { timeout: 15000 })
    .catch(() => {});
  const paint = await page.evaluate(IMPL_PAINT_GATE, { routePath: plan.routePath });
  if (!paint.ok) {
    V.push({ kind: "module-without-capture", moduleKey: "pos", page: plan.pageKey, reason: "收银页渲染门未过", detail: { paint, views: await page.evaluate(IMPL_VIEWS_SNAPSHOT) } });
    return null;
  }
  rec.paint = paint;
  step(`收银台入口：模式段=${entry.point ? "真实点击" : "不可见⇒真实路由兜底"} 抽屉(toggle)=${dm.openedByToggle ?? "n/a"} 行=${JSON.stringify(dm.entryTrail?.matched ?? null)}`);
  return { paint, modeSegVisible: !!entry.point };
}

/** ②′ 触摸轨迹：独立页面全新状态；tap rail 开 ⇒ 点遮罩收 ⇒ side-toggle tap 再开再收（F3 触摸抽屉复证） */
async function touchDrawerPass(plan, step, V, F) {
  let ctx = null;
  let page = null;
  try {
    ({ ctx, page } = await newNarrowPage(browser, auth));
    const out = { via: "rail-tap", openedByTap: false, closedByMaskTap: false, reopenedByToggleTap: false, closedByToggleTap: false, closeControl: null, drawerRect: null, transformX: null, trail: [] };
    if (plan.kind === "pos") {
      await page.goto(`${ORIGIN}${plan.routePath}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
      await sleep(page, 500);
      /* 收银台没有 rail tap 腿（抽屉入口是顶部钮）：这里用同一颗钮补齐同样三段
         钮开 ⇒ 遮罩收 ⇒（走下面共用段）钮重开 ⇒ 收起钮收，pos 不再豁免关闭证据。 */
      out.via = "side-toggle@pos";
      const o = await reopenDrawer(page, "touch");
      out.openedByTap = o.opened;
      out.trail.push(`${o.via} ⇒ open=${o.opened}`);
      if (!o.opened) {
        V.push({ kind: "drawer-unusable", moduleKey: "pos", page: plan.pageKey, reason: "收银场景真实触摸 tap 展开导航未能打开抽屉", detail: o.shell ?? null });
        return out;
      }
      const pClose = await closeDrawerByMask(page, "touch");
      out.closedByMaskTap = pClose.closed;
      out.trail.push(`${pClose.via} ⇒ closed=${pClose.closed}`);
      if (!pClose.closed) V.push({ kind: "drawer-unusable", moduleKey: "pos", page: plan.pageKey, reason: "收银场景真实触摸 tap 遮罩空白未能收起抽屉", detail: pClose.shell ?? null });
    } else {
      await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
      await sleep(page, 500);
      const spotInfo = await railSpot(page, plan);
      if (!spotInfo.ok) {
        out.reason = "rail-resolve-failed";
        F.push({ kind: "touch-pass-skipped", moduleKey: plan.key, page: plan.pageKey, reason: `触摸轨迹等待 ${spotInfo.waitedMs}ms 仍无法解析 rail 项，鼠标轨迹的抽屉证据仍然有效`, detail: { railKey: plan.railKey, waitedMs: spotInfo.waitedMs, skeletons: spotInfo.skeletons ?? null } });
        return out;
      }
      await page.touchscreen.tap(spotInfo.point.x, spotInfo.point.y);
      out.openedByTap = await waitDrawer(page, true, 6000);
      const st = await page.evaluate(NARROW_SHELL_READER);
      out.drawerRect = st.subnav?.box ?? null;
      out.transformX = st.subnav?.transformX ?? null;
      out.trail.push(`tap rail ${spotInfo.rail.resolved}@${spotInfo.point.x},${spotInfo.point.y} ⇒ open=${out.openedByTap}`);
      if (!out.openedByTap) {
        V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "真实触摸 tap 一级 rail 未能展开抽屉（6s 超时）", detail: st });
        return out;
      }
      const closeRes = await closeDrawerByMask(page, "touch");
      out.closedByMaskTap = closeRes.closed;
      out.trail.push(`${closeRes.via} ⇒ closed=${closeRes.closed}`);
      if (!closeRes.closed) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "真实触摸 tap 遮罩空白未能收起抽屉", detail: closeRes.shell ?? null });
    }
    const st2 = await page.evaluate(NARROW_SHELL_READER);
    if (st2.drawerOpen) {
      out.trail.push("遮罩未收起成功：toggle 重开腿跳过（遮罩腿已判红，不再叠加）");
    } else if (st2.toggle) {
      const pt = { x: Math.round(st2.toggle.x + st2.toggle.w / 2), y: Math.round(st2.toggle.y + st2.toggle.h / 2) };
      await page.touchscreen.tap(pt.x, pt.y);
      out.reopenedByToggleTap = await waitDrawer(page, true, 5000);
      out.trail.push(`tap side-toggle@${pt.x},${pt.y} ⇒ open=${out.reopenedByToggleTap}`);
      if (out.reopenedByToggleTap) {
        /* 收腿前必须重做命中测试：≤390 抽屉展开时 z45 面板把 header 的 side-toggle 整颗盖住
           （实测 topEl=span.sn-logo），拿收起态的旧坐标盲点第二下落到的是一张抽屉面板 ⇒
           「再收=false」是采集假象，不是缺陷。改点展开态里真正可见的那颗收起钮
           （抽屉头部 second-nav-collapse）；两颗都命中不到才降级为发现项，由遮罩腿证明关闭。 */
        const probe = await page.evaluate(DRAWER_CLOSE_SPOT);
        out.closeProbe = probe;
        const hit = probe.hit;
        if (hit) {
          await page.touchscreen.tap(hit.point.x, hit.point.y);
          out.closedByToggleTap = await waitDrawer(page, false, 5000);
          out.closeControl = hit.name;
          out.trail.push(`tap ${hit.name} 再收@${hit.point.x},${hit.point.y}（命中=${hit.topEl}）⇒ closed=${out.closedByToggleTap}`);
          if (!out.closedByToggleTap) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: `抽屉展开态下 ${hit.name}(aria-label=${JSON.stringify(hit.aria)}) 命中测试可点（命中=${hit.topEl}），真实 tap 后抽屉仍未收起 ⇒ 收起钮失效`, detail: { hit, tried: probe.tried, shell: await page.evaluate(NARROW_SHELL_READER) } });
        } else {
          out.closedByToggleTap = null;
          out.closeControlsUnreachable = true;
          out.trail.push(`收起腿不可测：两颗钮落点全被盖住（${probe.tried.map((x) => `${x.name}→${x.topEl ?? "缺失"}`).join(" / ")}）⇒ 关闭只由遮罩腿证明`);
          F.push({ kind: "drawer-close-control-unreachable", moduleKey: plan.key, page: plan.pageKey, reason: `≤390 抽屉展开时 side-toggle 与 second-nav-collapse 的落点都没通过 elementFromPoint 命中测试（${probe.tried.map((x) => `${x.name}→${x.topEl ?? "缺失"}`).join(" / ")}）⇒ 收起钮在该档不可达，关闭由遮罩腿证明（遮罩收=${out.closedByMaskTap}）。属 F3 壳层层级口径，非 13B 视觉对齐引入的退步`, detail: probe });
        }
      }
      if (!out.reopenedByToggleTap) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "真实触摸 tap 展开导航未能打开抽屉", detail: await page.evaluate(NARROW_SHELL_READER) });
    } else {
      out.trail.push("side-toggle 不可见：触摸重开腿缺证");
      F.push({ kind: "toggle-not-visible", moduleKey: plan.key, page: plan.pageKey, reason: "窄壳下找不到可见的展开导航按钮，触摸重开只录到遮罩腿", detail: st2 });
    }
    if (plan.kind === "pos" && !out.reopenedByToggleTap && !out.openedByTap) {
      V.push({ kind: "drawer-unusable", moduleKey: "pos", page: plan.pageKey, reason: "收银场景真实触摸未能打开抽屉", detail: await page.evaluate(NARROW_SHELL_READER) });
    }
    step(`触摸抽屉轨迹(${out.via})：tap 开=${out.openedByTap ?? "n/a"} 遮罩收=${out.closedByMaskTap ?? "n/a"} toggle 重开=${out.reopenedByToggleTap} 再收=${out.closedByToggleTap === null ? `钮全被盖(${(out.closeProbe?.tried ?? []).map((x) => x.topEl ?? "缺失").join("/")})` : `${out.closedByToggleTap}@${out.closeControl}`}`);
    return out;
  } catch (e) {
    F.push({ kind: "touch-pass-error", moduleKey: plan.key, page: plan.pageKey, reason: `触摸轨迹异常终止：${redactText(String(e)).slice(0, 180)}` });
    return { error: redactText(String(e)).slice(0, 180) };
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

/** ⑤ 键盘焦点：真实 Tab ≤25 站；环判据 = ①元素自身 outline 非 none/0，或 ②聚焦态 vs 失焦态逐节点样式差
 *  （Element Plus 把焦点环放在包装层 box-shadow，input 自身 outline 恒为 none ⇒ 只看自身会误判无环）。
 *  ②只对 ①落空的站补测，测完把焦点还给原元素，Tab 序列不变。 */
async function focusWalk(page, plan, V, F, step) {
  const neutral = await page.evaluate(NEUTRAL_SPOT);
  if (neutral) await page.mouse.click(neutral.x, neutral.y);
  const stops = [];
  const seen = new Set();
  for (let i = 0; i < TAB_STOP_CAP; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(40);
    const s = await page.evaluate(FOCUS_STOP_READER);
    if (!s || s.tag === "body") continue;
    const key = `${s.sel}|${s.text}|${s.rect?.x},${s.rect?.y}`;
    if (seen.has(key)) break;
    if (s.inViewport && s.ring === "none") s.ringDiff = await page.evaluate(FOCUS_RING_DIFF);
    seen.add(key);
    stops.push(s);
  }
  const ringless = stops.filter((s) => s.inViewport && s.ring === "none");
  const noRing = ringless.filter((s) => !s.ringDiff || s.ringDiff.changedCount === 0);
  const shadowOnly = stops.filter((s) => s.inViewport && s.ring === "shadow");
  const offStops = stops.filter((s) => !s.inViewport);
  if (noRing.length) V.push({ kind: "focus-invisible", moduleKey: plan.key, page: plan.pageKey, reason: `视口内 ${noRing.length} 个 Tab 站既无自身 outline，聚焦/失焦逐节点比对也无任何变化（含 4 层祖先）⇒ 键盘焦点不可见`, detail: noRing.slice(0, 8) });
  if (offStops.length) F.push({ kind: "focus-offscreen", moduleKey: plan.key, page: plan.pageKey, reason: `${offStops.length} 个 Tab 站落在视口外（收起抽屉/横滚 rail），按焦点发现项如实记录、不进门禁`, detail: offStops.slice(0, 8) });
  if (shadowOnly.length) F.push({ kind: "focus-ring-shadow-unverified", moduleKey: plan.key, page: plan.pageKey, reason: `${shadowOnly.length} 站的环判据只有元素自身 box-shadow（未与失焦态对照）⇒ 可能是常驻装饰阴影，宽松度如实披露、不判红`, detail: shadowOnly.slice(0, 6) });
  step(`键盘行走：${stops.length} 站（上限 ${TAB_STOP_CAP}），视口内无环 ${noRing.length}（聚焦/失焦差补判 ${ringless.length - noRing.length}），视口外 ${offStops.length}`);
  return {
    neutralSpot: neutral,
    stopsCount: stops.length,
    cap: TAB_STOP_CAP,
    ringMethod: "outline-or-focus-blur-diff",
    ringOutline: stops.filter((s) => s.ring === "outline").length,
    ringShadow: stops.filter((s) => s.ring === "shadow").length,
    ringByDiff: ringless.length - noRing.length,
    noRingInViewport: noRing.length,
    offViewport: offStops.length,
    samples: stops.slice(0, 12),
  };
}

/** ③ 弹层：只点安全动词触发；量裁切/确认取消可达性；Escape→取消→遮罩 三级真实关闭链；破坏性触发永不点击（gap 交人工） */
async function overlayTest(page, plan, V, F, G, rec, step) {
  const res = { reachable: false, reason: null, trigger: null, overlay: null, closed: null, closeTrail: [] };
  const scan = await page.evaluate(OVERLAY_TRIGGER_SCAN, { safeVerbs: SAFE_TRIGGER_VERBS, destructiveRe: DESTRUCTIVE_RE });
  if (!scan.found) {
    res.reason = scan.candidateTexts?.length ? "no-safe-trigger" : "no-action-controls";
    G.push({
      moduleKey: plan.key,
      page: plan.pageKey,
      state: "overlay",
      reason: scan.destructiveSeen?.length ? `代表页只有破坏性动作钮（${scan.destructiveSeen.slice(0, 4).join("/")} 等），采集器不点击，弹层可用性由人工在 390 复核` : "页根内没有任何可点击动作控件",
      detail: { destructiveSeen: scan.destructiveSeen ?? [], candidateTexts: (scan.candidateTexts ?? []).slice(0, 20) },
      owner: OWNER,
      followUp: "墨补该代表页的安全弹层触发入口，或人工 390 复核",
      evidence: rec.frame?.file ?? null,
    });
    return res;
  }
  res.trigger = { verb: scan.verb, text: scan.text, sel: scan.sel, rect: scan.rect };
  const overlayGap = (reasonText, followUp) => G.push({
    moduleKey: plan.key,
    page: plan.pageKey,
    state: "overlay",
    reason: reasonText,
    detail: { trigger: res.trigger, scan: { rect: scan.rect, point: scan.point } },
    owner: OWNER,
    followUp,
    evidence: rec.frame?.file ?? null,
  });
  if (!scan.point) {
    res.reason = "trigger-covered";
    F.push({ kind: "overlay-trigger-covered", moduleKey: plan.key, page: plan.pageKey, reason: `触发钮 ${JSON.stringify(scan.text)} 中心被遮挡，未强点`, detail: scan.rect });
    overlayGap(`390 下唯一安全触发钮 ${JSON.stringify(scan.text)} 的中心被遮挡，弹层可用性未测 ⇒ 遮挡本身也可能是窄口缺陷`, "墨复核遮挡来源（固定底栏/浮层），并在 390 人工确认弹层可用");
    return res;
  }
  const cfg = { overlaySels: OVERLAY_SELS };
  const keyOf = (o) => `${o.kind}|${o.cls}`;
  /** 与「常驻浮层岛」做差集：.pos-pay-mask/.wb-ledger 这类页面既有容器不能当本次触发的弹层，否则假绿/假红 */
  const base = await page.evaluate(OVERLAY_STATE_SCAN, cfg);
  const freshActive = async () => {
    const st2 = await page.evaluate(OVERLAY_STATE_SCAN, cfg);
    const pool = base.active.map(keyOf);
    return st2.active.filter((x) => {
      const i = pool.indexOf(keyOf(x));
      if (i === -1) return true;
      pool.splice(i, 1);
      return false;
    });
  };
  await page.mouse.click(scan.point.x, scan.point.y);
  let fresh = [];
  const waited = Date.now();
  while (Date.now() - waited < 4000) {
    fresh = await freshActive();
    if (fresh.length) break;
    await page.waitForTimeout(250);
  }
  if (!fresh.length) {
    res.reason = "trigger-click-no-overlay";
    F.push({ kind: "overlay-not-open", moduleKey: plan.key, page: plan.pageKey, reason: `真实点击 ${JSON.stringify(scan.text)} 未出现新浮层（可能是导航型动作）`, detail: res.trigger });
    overlayGap(`390 下安全触发钮 ${JSON.stringify(scan.text)} 真点之后没有新浮层（该页可能只有导航型动作）⇒ 本页弹层可用性零证据`, "墨确认该代表页是否应有弹层；若要测则补一个非破坏性弹层入口，否则人工 390 复核");
    return res;
  }
  let o = fresh[0];
  /* 入场动画没收敛时量到的是位移中途的 rect（EP drawer rtl 从 x=视口宽 滑入 ⇒ 390 宽、x=390 的
     「假越界」），必须等几何稳定后再判裁切；仍越界才是真的窄口缺陷。 */
  let geomPrev = JSON.stringify(o.rect);
  let settleRounds = 0;
  let geomStable = false;
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(180);
    const again = await freshActive();
    const cur = again.find((x) => keyOf(x) === keyOf(o)) ?? again[0];
    if (!cur) break;
    o = cur;
    settleRounds += 1;
    const now = JSON.stringify(cur.rect);
    if (now === geomPrev) {
      geomStable = true;
      break;
    }
    geomPrev = now;
  }
  res.overlaySettle = { rounds: settleRounds, geomStable, maxMs: 8 * 180 };
  res.overlay = { kind: o.kind, cls: o.cls, rect: o.rect, within390: o.within390, confirmText: o.confirmText, cancelText: o.cancelText, confirmReachable: o.confirmReachable, cancelReachable: o.cancelReachable, buttons: o.buttons };
  res.reachable = o.within390 && (o.confirmReachable || o.cancelReachable || o.buttons.length === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(420);
  let n = (await freshActive()).length;
  res.closeTrail.push(`Escape ⇒ 新增浮层剩 ${n} 层`);
  if (n > 0) {
    const cancel = o.buttons.find((b) => /取\s*消|关\s*闭/.test(b.text) && b.inViewport);
    if (cancel) {
      await page.mouse.click(cancel.rect.x + Math.round(cancel.rect.w / 2), cancel.rect.y + Math.round(cancel.rect.h / 2));
      await page.waitForTimeout(420);
      n = (await freshActive()).length;
      res.closeTrail.push(`点取消 ⇒ 剩 ${n} 层`);
    }
  }
  if (n > 0) {
    const spot = await page.evaluate(MASK_TAP_SPOT, { selector: ".el-overlay" });
    if (spot) {
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(420);
      n = (await freshActive()).length;
      res.closeTrail.push(`点遮罩 ⇒ 剩 ${n} 层`);
    }
  }
  res.closed = n === 0;
  if (!o.within390 || !res.reachable || !res.closed) {
    const why = [!o.within390 ? `rect ${o.rect.x},${o.rect.y} ${o.rect.w}×${o.rect.h} 超出 390×844（几何已复测 ${res.overlaySettle.rounds} 轮，${res.overlaySettle.geomStable ? "已稳定仍越界 ⇒ 不是入场动画中途读数" : `未收敛（各 ${Math.round(res.overlaySettle.maxMs / res.overlaySettle.rounds)}ms 间隔，最多 ${res.overlaySettle.maxMs}ms）`}）` : "", !res.reachable ? "确认/取消不可达" : "", !res.closed ? `关不掉（Escape/取消/遮罩用尽仍剩 ${n} 层）` : ""].filter(Boolean).join("；");
    V.push({ kind: "overlay-unusable", moduleKey: plan.key, page: plan.pageKey, reason: `弹层不可用：${why}`, detail: { overlay: res.overlay, settle: res.overlaySettle, closeTrail: res.closeTrail } });
  }
  step(`弹层：触发 ${JSON.stringify(res.trigger.text)} ⇒ ${o.kind} ${o.rect.w}×${o.rect.h} 可达=${res.reachable} 关闭=${res.closed}`);
  return res;
}

/* ────────────────────────── 每模块：一条时间轴跑完七项测量 ────────────────────────── */

async function runModule(plan) {
  const V = [];
  const F = [];
  const G = [];
  const rec = {
    captureKey: `${plan.key}:${plan.pageKey}`,
    moduleKey: plan.key,
    moduleName: plan.name,
    kind: plan.kind,
    railKey: plan.railKey ?? null,
    pageKey: plan.pageKey,
    pageTitle: plan.pageTitle,
    routePath: plan.routePath,
    panelType: plan.panelType ?? null,
    viewport: NARROW.id,
    hasTouch: true,
    deviceScaleFactor: 1,
    /* 每块自起一遍后端/vite，端口每次现换 ⇒ 「同源」只能逐条自证，不能拿最后一块的 origin 去套前面 11 块。 */
    captureOrigin: ORIGIN,
    captureWebPort: WEB_PORT,
    captureBackendPort: BACKEND_PORT,
    steps: [],
    drawer: { mouse: null, touch: null },
    paint: null,
    overflow: null,
    actions: null,
    focus: null,
    overlay: null,
    contrast: null,
    frame: null,
    verdict: "pass",
  };
  const step = (s) => {
    rec.steps.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
    log(`[${plan.key}:${plan.pageKey}] ${s}`);
  };
  /** 统一收尾：先按已有违规/帧定格判定，再带着部分记录返回（早退路径不许留默认 pass） */
  const bail = () => {
    rec.verdict = V.length ? "红" : rec.frame ? "通过" : "阻塞";
    return { rec, V, F, G };
  };
  const deadline = Date.now() + MODULE_BUDGET_MS;
  const overBudget = (label) => {
    if (Date.now() <= deadline) return false;
    V.push({ kind: "module-timeout", moduleKey: plan.key, page: plan.pageKey, reason: `模块在「${label}」一步超过 ${MODULE_BUDGET_MS}ms 预算；其后测量放弃、已有部分记录仍如实入档`, detail: { steps: rec.steps.slice(-8) } });
    return true;
  };
  if (!plan.routePath) {
    V.push({ kind: "module-without-capture", moduleKey: plan.key, page: plan.pageKey, reason: "页面模型里该模块没有可用的已路由代表页", detail: { railKey: plan.railKey ?? null } });
    rec.verdict = "blocked";
    return bail();
  }
  let ctx = null;
  let page = null;
  try {
    ({ ctx, page } = await newNarrowPage(browser, auth));
    await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
    await sleep(page, 600);
    const base = await page.evaluate(NARROW_SHELL_READER);
    step(`390 壳：vw=${base.vw} rail=${base.rail ? `${base.rail.box.h}px/${base.rail.flexDir}/横滚+${base.rail.hScroll}px` : "缺失"} 抽屉开=${base.drawerOpen} 遮罩=${base.mask ? "有" : "无"} main 下内边距=${base.mainPadBottom}`);
    if (!base.narrow) V.push({ kind: "record-incomplete", moduleKey: plan.key, page: plan.pageKey, reason: `视口宽 ${base.vw} 非 390，窄壳契约未生效`, detail: base });
    if (base.drawerOpen) V.push({ kind: "drawer-unusable", moduleKey: plan.key, page: plan.pageKey, reason: "页面载入时抽屉已是展开态 ⇒ 无法证明点击受控（F1 窄壳默认收起），点击证据作废重查", detail: base });
    const entry = plan.kind === "pos" ? await enterPos(page, plan, step, V, F, rec) : await enterBusiness(page, plan, step, V, F, G, rec);
    if (!entry) {
      rec.verdict = "blocked";
      return bail();
    }
    if (overBudget("测量组")) return bail();

    /* ① 横向裁切（D.15） */
    const ov = await page.evaluate(NARROW_OVERFLOW_READER);
    rec.overflow = ov;
    const gateOff = ov.pageOffenders ?? [];
    /**
     * ①c 隐藏式同步容器（Element Plus 表头那类 overflow-x:hidden + 表体 scrollLeft 同步）
     * 不能靠静态 CSS 免红：按 railScroller 的先例，逐组做真实横向 wheel 手势并在手势后复测
     * pageOffenders。带得回视口 ⇒ 记 hidden-clipper-scroll-synced 发现项（报告必须披露：
     * 390 下这些列要靠横滚才看得到）；带不回来或找不到同一控件的横滚容器 ⇒ 维持 narrow-overflow 红。
     */
    const clipGroups = new Map();
    for (const o of gateOff) {
      if (!o.clipperKey) continue;
      if (!clipGroups.has(o.clipperKey)) clipGroups.set(o.clipperKey, { key: o.clipperKey, sel: o.clipperSel, rect: o.clipperRect, range: o.clipperRange, offenders: [] });
      clipGroups.get(o.clipperKey).offenders.push(o);
    }
    const hardOff = gateOff.filter((o) => !o.clipperKey);
    const clipTrail = [];
    for (const g of clipGroups.values()) {
      const t = { group: `${g.offenders.length} 个越界 · ${g.sel}（hidden，量程 ${g.range}px）`, clipperKey: g.key };
      const gp = await page.evaluate(HEADER_SYNC_GESTURE, { x: g.rect.x, y: g.rect.y, w: g.rect.w, h: g.rect.h, sel: g.sel, range: g.range });
      t.before = gp;
      let restored = false;
      if (gp.ok && gp.maxScrollLeft > 1) {
        /* 逐档横滚 + 逐档复测（证据腿）：一次性滚到最右会把前面的列推出左边界，
           单点复测会把「滚得到」误读成「带不回」；这里只用来证明容器真的被真实手势滚动了，
           可达性判定见下面的几何式（档距粗于列宽，采样不作定罪依据）。 */
        const keyOf = (o) => `${o.sel}|${o.rect.y}|${o.rect.w}`;
        const track = new Map();
        for (const o of g.offenders) track.set(keyOf(o), { sel: o.sel, x: o.rect.x, inView: false });
        const total = gp.maxScrollLeft - gp.scrollLeft;
        const stepPx = 200;
        let acc = 0;
        await page.mouse.move(gp.gesturePoint.x, gp.gesturePoint.y);
        for (let guard = 0; guard <= 30; guard += 1) {
          const snap = await page.evaluate(NARROW_OVERFLOW_READER);
          const seen = new Set((snap.pageOffenders ?? []).filter((o) => o.clipperKey === g.key).map(keyOf));
          for (const [k, v] of track) if (!seen.has(k)) v.inView = true;
          t.steps = (t.steps ?? 0) + 1;
          t.lastClipperScrollLeft = (await page.evaluate(HEADER_SYNC_GESTURE, { x: g.rect.x, y: g.rect.y, w: g.rect.w, h: g.rect.h, sel: g.sel, range: g.range })).clipperScrollLeft;
          if (acc >= total) break;
          const nxt = Math.min(stepPx, total - acc);
          await page.mouse.wheel(nxt, 0);
          acc += nxt;
          await sleep(page, 160);
        }
        const never = [...track.values()].filter((v) => !v.inView);
        /* 逐档采样只能证明「容器真的被手势滚起来了」，不能用来判可达性：
           档距（200px）比列宽还粗时，一列可能恰好跨在两档之间没被采到 ⇒ 假红。
           可达性按几何精确判：元素在内容坐标里的位置 ox = rect.x + 起始 scrollLeft，
           只要存在 s ∈ [0, 量程] 让它整体落进 390 视口（ox-w 侧 ≤ s ≤ ox 侧，且列宽 ≤ 视口宽），
           就是「真实横滚手势能带到」；带不到（列比视口还宽 / 滚不到那个位）才是裁切。 */
        const maxS = gp.clipperRange;
        /* 整表结构容器（colgroup / thead / tr / table）宽 = 全部列宽之和，必然大于视口；
           它本身不是「一列被裁」，而是窄口容器策略（表格宿主横滚）的正常形态。
           判据只对**叶子单元格/列**要求整体可带入；结构容器按「其叶子列全部可达」判定，
           否则任何多列表在 390 下都必然假红。叶子列有任一不可达 ⇒ 结构容器也一并判不可达。 */
        const STRUCTURAL = /^(colgroup|thead|tbody|tfoot|tr|table)$/i;
        const isStructural = (sel) => STRUCTURAL.test(String(sel ?? "").split(/[.#]/)[0]);
        const leaves = gateOff.filter((o) => o.clipperKey === g.key && !isStructural(o.sel)).map((o) => {
          const ox = o.rect.x + gp.clipperScrollLeft;
          const lo = Math.max(0, ox + o.rect.w - ov.vw - 1);
          const hi = Math.min(maxS, ox + 1);
          return { sel: o.sel, w: o.rect.w, ox: Math.round(ox), needScroll: [Math.round(lo), Math.round(hi)], structural: false, reachable: hi >= lo && o.rect.w <= ov.vw };
        });
        const leavesOk = leaves.length > 0 && leaves.every((l) => l.reachable);
        const analytic = gateOff.filter((o) => o.clipperKey === g.key).map((o) => {
          const structural = isStructural(o.sel);
          const leaf = leaves.find((l) => l.sel === o.sel);
          if (leaf) return leaf;
          const ox = o.rect.x + gp.clipperScrollLeft;
          const lo = Math.max(0, ox + o.rect.w - ov.vw - 1);
          const hi = Math.min(maxS, ox + 1);
          return { sel: o.sel, w: o.rect.w, ox: Math.round(ox), needScroll: [Math.round(lo), Math.round(hi)], structural, reachable: structural ? leavesOk : hi >= lo && o.rect.w <= ov.vw };
        });
        const unreachable = analytic.filter((a) => !a.reachable);
        /* 判据 = 几何可达 + 手势确实把这个 hidden 容器滚动了；
           逐档采样只作证据（档距粗于列宽时允许某列没被采到，不拿来定罪，避免假红）。 */
        restored = unreachable.length === 0 && t.lastClipperScrollLeft > gp.clipperScrollLeft;
        await page.mouse.wheel(-acc, 0);
        await sleep(page, 200);
        t.back = (await page.evaluate(NARROW_OVERFLOW_READER)).pageOffenders?.length ?? null;
        t.after = { scrolledPx: acc, steps: t.steps, clipperScrollLeftFrom: gp.clipperScrollLeft, clipperScrollLeftMax: t.lastClipperScrollLeft, pageTotalBefore: gateOff.length, backToPageTotal: t.back, neverSampledInView: never.slice(0, 4), neverSampledCount: never.length, unreachableByGeometry: unreachable.slice(0, 4), unreachableCount: unreachable.length, analytic: analytic.map((a) => `${a.sel} w${a.w} 需 s∈[${a.needScroll[0]},${a.needScroll[1]}] ${a.reachable ? "可达" : "不可达"}`) };
      }
      t.verdict = restored ? "手势带回" : "手势带不回";
      clipTrail.push(t);
      step(`隐藏同步容器 ${g.sel}：${g.offenders.length} 个越界 · 手势点 ${gp.gesturePoint?.x},${gp.gesturePoint?.y} · 分 ${t.after?.steps ?? 0} 档滚到 clipper.scrollLeft ${t.after?.clipperScrollLeftMax ?? "未滚"}（量程 ${gp.clipperRange}）· 逐档未采到 ${t.after?.neverSampledCount ?? "?"} 个 / 几何判不可达 ${t.after?.unreachableCount ?? "?"} 个 · 回位后越界总数 ${t.after?.backToPageTotal ?? "?"}（原 ${gateOff.length}）⇒ ${t.verdict}`);
      if (!restored) hardOff.push(...g.offenders);
      else F.push({ kind: "hidden-clipper-scroll-synced", moduleKey: plan.key, page: plan.pageKey, reason: `${g.offenders.length} 个越界元素在 overflow-x:hidden 的同步容器（${g.sel}）里：分 ${t.after.steps} 档真实横向手势把容器 scrollLeft 从 ${t.after.clipperScrollLeftFrom} 滚到 ${t.after.clipperScrollLeftMax}（量程 ${gp.clipperRange}），逐元素按几何复核都能在该量程内整体落入 390 视口 ⇒ 不判 narrow-overflow，但「390 下这些列要横滚才看得到」必须写进报告`, detail: t });
    }
    rec.overflowGate = { pageTotal: gateOff.length, clipGroups: clipTrail.length, synced: clipTrail.filter((x) => x.verdict === "手势带回").length, hard: hardOff.length };
    if (ov.docOverflowX > 1) {
      V.push({ kind: "narrow-overflow", moduleKey: plan.key, page: plan.pageKey, reason: `文档 scrollWidth ${ov.docScrollWidth}px 超出 390 视口 ${ov.docOverflowX}px`, detail: { htmlOverflowX: ov.htmlOverflowX, bodyOverflowX: ov.bodyOverflowX, pageOffenders: gateOff.slice(0, 8) } });
    } else if (hardOff.length) {
      V.push({ kind: "narrow-overflow", moduleKey: plan.key, page: plan.pageKey, reason: `${hardOff.length} 个不在滚动容器里的元素越出 390 视口（文档未横滚，隐藏同步容器也没有可证明带回的手势 ⇒ 用户看不见内容被裁）`, detail: { gate: rec.overflowGate, trail: clipTrail.filter((x) => x.verdict !== "手势带回"), offenders: hardOff.slice(0, 10) } });
    }
    /* ①b railScroller 豁免桶的成立条件：真实横滚手势能把越界条目带进视口（滚不到 ⇒ 豁免不成立，判红） */
    let railP = { found: false };
    const railBucket = (ov.byReason?.railScroller ?? 0) > 0;
    if (railBucket) {
      const p0 = await page.evaluate(RAIL_SCROLL_PROBE);
      railP = p0;
      if (p0.found && p0.maxScrollLeft > 1) {
        /* 位移取「到端点的精确距离」并在反向上用同一量值：
           合成 wheel 的 deltaX 与像素 1:1、到边界钳位，旧写法固定 ±280 在起始位非 0 时
           （例：点完末位模块后 rail 自选位停在 20）反向钳到 0 ≠ 20，
           门禁 N12 就会把「手势可逆」误读成「探针没还原 ⇒ 截图口径不一致」的假红。 */
        const d = p0.maxScrollLeft - p0.scrollLeft;
        await page.mouse.move(p0.railPoint.x, p0.railPoint.y);
        await page.mouse.wheel(d, 0);
        await page.waitForTimeout(240);
        railP = { ...p0, after: await page.evaluate(RAIL_SCROLL_PROBE), delta: d };
        await page.mouse.wheel(-d, 0);
        await page.waitForTimeout(160);
        const back = await page.evaluate(RAIL_SCROLL_PROBE);
        railP.restored = Math.abs(back.scrollLeft - p0.scrollLeft) <= 2;
        railP.restoredTo = back.scrollLeft;
        step(`rail 横滚手势：scrollLeft ${p0.scrollLeft}→${railP.after.scrollLeft}（量程 ${p0.maxScrollLeft}，手势 ±${d}px）· 末位一级项 ${p0.edgeItem?.key} 入视口=${railP.after.edgeItem?.inView} · 还原=${railP.restored}（回位 ${railP.restoredTo}）`);
      } else if (p0.found) {
        railP.after = p0;
        railP.restored = true;
      }
      const noReach = !railP.found || !railP.after || railP.after.edgeItem?.inView !== true;
      if (noReach) {
        V.push({ kind: "narrow-overflow", moduleKey: plan.key, page: plan.pageKey, reason: `railScroller 豁免桶不成立：${ov.counts.exempt ?? 0} 个一级入口横向越界，而真实横滚手势没能把末位条目（${p0.edgeItem?.key ?? "?"}@x${p0.edgeItem?.x}）带进 390 视口 ⇒ 入口被裁死`, detail: { probe: railP, offenders: ov.offenders.filter((o) => o.reason === "railScroller").slice(0, 10) } });
      } else {
        F.push({ kind: "rail-scroll-gesture-verified", moduleKey: plan.key, page: plan.pageKey, reason: `${ov.counts.exempt} 个越界元素在 rail 横条内，真实 wheel 手势可把它们带入视口（railScroller 豁免有证据）`, detail: railP });
      }
    }
    rec.railScroll = railBucket ? railP : null;
    if (ov.counts.exempt) F.push({ kind: "overflow-exempt-bucket", moduleKey: plan.key, page: plan.pageKey, reason: `${ov.counts.exempt} 个越界元素落在 railScroller/offCanvas/scroller 豁免桶（口径内如实披露，不进门禁；横滚可用性另有独立判据）`, detail: ov.offenders.filter((o) => o.reason !== "page").slice(0, 12) });
    if (overBudget("动作读数")) return bail();

    /* ④ 主操作可达 + ⑥ 按钮语义 */
    const ac = await page.evaluate(PAGE_ACTIONS_READER);
    rec.actions = {
      rootSel: ac.rootSel,
      total: ac.total,
      below44: ac.below44,
      below24: ac.below24,
      unlabeled: ac.unlabeled,
      iconOnly: ac.iconOnly,
      offscreenCount: ac.offscreenCount,
      offscreen: ac.offscreen,
      reachByScrollCount: ac.reachByScrollCount,
      reachByScrollPrimaryCount: ac.reachByScrollPrimaryCount,
      reachByScrollSamples: ac.reachByScrollSamples,
      primary: ac.primary,
      smallSamples: ac.smallSamples.slice(0, 6),
      unlabeledSamples: ac.unlabeledSamples,
    };
    if (ac.offscreenCount) V.push({ kind: "action-offscreen", moduleKey: plan.key, page: plan.pageKey, reason: `${ac.offscreenCount} 个页内动作按钮落在 390×844 视口之外且没有任何可滚动祖先能把它们带进视口（硬越界 ⇒ 用户够不到）`, detail: ac.offscreen.slice(0, 8) });
    if (ac.reachByScrollCount) F.push({ kind: "action-reachable-by-scroll", moduleKey: plan.key, page: plan.pageKey, reason: `${ac.reachByScrollCount} 个按钮越出首屏但可由祖先（或文档）真实滚动带入 ⇒ 不判 action-offscreen，但如实入档；其中主操作 ${ac.reachByScrollPrimaryCount} 个`, detail: ac.reachByScrollSamples });
    if (ac.below44) F.push({ kind: "touch-target-small", moduleKey: plan.key, page: plan.pageKey, reason: `${ac.below44} 个按钮命中区小于 ${TOUCH_TARGET_MIN_PX}×${TOUCH_TARGET_MIN_PX}px（其中 ${ac.below24} 个不足 ${MIN_CONTROL_PX}px）——D.16 测量口径记录，不判红`, detail: { below44: ac.below44, below24: ac.below24, smallest: ac.smallSamples } });
    if (ac.unlabeled) F.push({ kind: "icon-button-unlabeled", moduleKey: plan.key, page: plan.pageKey, reason: `${ac.unlabeled} 个图标按钮无文案/aria-label/title（D.16 语义口径如实计数）`, detail: ac.unlabeledSamples });
    if (overBudget("对比度取样")) return bail();

    /* ⑦ 对比度 */
    const cs = contrastAnalyze(await page.evaluate(TEXT_CONTRAST_SCAN), await page.evaluate(CANVAS_INK_PROBE));
    rec.contrast = cs;
    if (cs.fails.length) V.push({ kind: "contrast-regression", moduleKey: plan.key, page: plan.pageKey, reason: `${cs.failCount} 组 13B 画布文字对（ink/ink2 × side/bg）低于 4.5:1（大字 3:1）`, detail: cs.fails });
    if (cs.linePairs.length) F.push({ kind: "contrast-hairline-recorded", moduleKey: plan.key, page: plan.pageKey, reason: "line-on-side / line-on-bg 装饰分隔线 ≈1.11:1，按 WCAG 1.4.11 incidental 豁免只记录不判红（软化点，报告必须披露）", detail: cs.linePairs });
    if (cs.outsideTokenInks.length) F.push({ kind: "contrast-ink-outside-token", moduleKey: plan.key, page: plan.pageKey, reason: `画布承托面上有 ${cs.outsideTokenInks.length} 组「不比退役 #8A8F98 浅、但不属于 13B 功能墨令牌族」的文字跌破 AA ⇒ 不进 contrast-regression 门禁（口径外），但必须点名披露并交 13C 判定归属`, detail: cs.outsideTokenInks });

    /* ⑤ 键盘焦点 */
    rec.focus = await focusWalk(page, plan, V, F, step);

    /* 每模块×每页恰好一帧：弹层触发前截，避免浮层污染页面证据图 */
    const shotFile = path.join(OUT, "shots", `narrow-${plan.key}-${plan.pageKey}.png`);
    await page.screenshot({ path: shotFile });
    rec.frame = fileShot(shotFile, { viewport: NARROW.id, overflowX: ov.docOverflowX });
    /* 早于建帧写入的缺口（抽屉入口路由兜底就是其中之一）此刻才拿得到证据帧 ⇒ 统一回填，
       不许留 evidence=null 让复核无路可走（「有 owner 没证据」和「没 owner」一样是空披露）。 */
    for (const g of G) if (!g.evidence) g.evidence = rec.frame.file;
    if (overBudget("弹层测试")) return bail();

    /* ③ 弹层 */
    rec.overlay = await overlayTest(page, plan, V, F, G, rec, step);

    /* ②″ 触摸轨迹（独立页面，全新状态） */
    rec.drawer.touch = await touchDrawerPass(plan, step, V, F);
  } catch (e) {
    V.push({ kind: "record-incomplete", moduleKey: plan.key, page: plan.pageKey, reason: `采集抛出异常：${redactText(String(e)).slice(0, 220)}`, detail: { steps: rec.steps.slice(-6) } });
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
  rec.verdict = V.length ? "红" : rec.frame ? "通过" : "阻塞";
  return bail();
}

/* ────────────────────────── 主流程 ────────────────────────── */

const RUN_STARTED_AT = new Date().toISOString();
const planned = buildPlan();
log(`本块计划：${planned.map((p) => `${p.key}:${p.pageKey}`).join(" / ")}（预算 ${MODULE_BUDGET_MS}ms/模块，视口 ${NARROW.id}，hasTouch）`);

const records = [];
const violations = [];
const gaps = [];
const findings = [];
let aborted = null;
let portsOk = true;
try {
  await startBackend();
  await startVite();
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  for (const plan of planned) {
    const out = await runModule(plan);
    records.push(out.rec);
    violations.push(...out.V);
    gaps.push(...out.G);
    findings.push(...out.F);
  }
  await browser.close().catch(() => {});
  browser = null;
} catch (e) {
  aborted = redactText(String(e?.stack ?? e)).slice(0, 2000);
  log(`中止：${aborted.split("\n")[0].slice(0, 240)}`);
  if (browser) await browser.close().catch(() => {});
  const done = new Set(records.map((r) => r.moduleKey));
  for (const p of planned) if (!done.has(p.key)) violations.push({ kind: "module-without-capture", moduleKey: p.key, page: p.pageKey, reason: "采集被异常中止，该模块没有记录（fail-closed，不得当通过）", detail: { aborted: true } });
}
if (KEEP_SERVERS) log("--keep-servers：后端/vite 保留在线（仅本地排错；不影响证据口径）");
else portsOk = await stopAll();

/* ── 分块合并：不属于本块的记录/违规/gap/发现原样保留，本块以本次为准 ── */
const keepModules = new Set(planned.map((p) => p.key));
let mergeNote = "首次运行（无历史 JSON，本块结果直接入档）";
if (existsSync(MEASURE_JSON)) {
  try {
    const prev = JSON.parse(readFileSync(MEASURE_JSON, "utf8"));
    const mine = new Set(records.map((r) => r.captureKey));
    const keptRecs = (prev.records ?? []).filter((r) => !keepModules.has(r.moduleKey) && !mine.has(r.captureKey));
    const keptViol = (prev.violations ?? []).filter((v) => !keepModules.has(v.moduleKey));
    const keptGaps = (prev.gaps ?? []).filter((g) => !keepModules.has(g.moduleKey));
    let keptFind = (prev.findings ?? []).filter((f) => !keepModules.has(f.moduleKey));
    /* roster-incomplete 是全局项（moduleKey=null），按「那块当时还缺谁」写。分块跑齐以后它还留在档里，
       就是把「已齐」说成「还缺 9 个」的陈谎 ⇒ 合并时丢弃，下面按合并后的全量 roster 重算一次。 */
    const staleRoster = keptFind.filter((f) => f.kind === "roster-incomplete").length;
    keptFind = keptFind.filter((f) => f.kind !== "roster-incomplete");
    records.unshift(...keptRecs);
    violations.unshift(...keptViol);
    gaps.unshift(...keptGaps);
    findings.unshift(...keptFind);
    mergeNote = `已合并历史分块：保留记录 ${keptRecs.length} 条 / 违规 ${keptViol.length} 条 / gap ${keptGaps.length} 条${staleRoster ? ` / 丢弃 ${staleRoster} 条陈旧 roster-incomplete（合并后按全量重算）` : ""}；本块 ${planned.map((p) => p.key).join(",")} 整体以本次为准`;
  } catch (e) {
    mergeNote = `历史 JSON 读不了（${String(e).slice(0, 90)}），仅保留本块结果`;
  }
}
log(mergeNote);

/* 逐块跑时不能拿「本块没跑到的模块」判红（那是分块假红，state 矩阵刚踩过）⇒  roster 只作为发现项如实列出，
   由 wb13b-narrow-390.spec 在收口时按「12 个模块（11 业务 + 收银台）必须全部入档」硬判。 */
const ROSTER = ["sale", "order", "purchase", "inventory", "customer", "product", "retail", "finance", "report", "marketing", "system", "pos"];
const missingModules = ROSTER.filter((k) => !records.some((r) => r.moduleKey === k));
if (missingModules.length) findings.push({ kind: "roster-incomplete", moduleKey: null, page: null, reason: `累计入档还缺 ${missingModules.length} 个模块：${missingModules.join("/")} ⇒ 分块未跑完，收口用例必须判红`, detail: { missing: missingModules, present: records.map((r) => r.moduleKey) } });

/* ── 完整性台账：帧 SHA 去重 + 缺项检查 + findClippedA 复核 ── */
const bySha = new Map();
for (const r of records) {
  if (!r.frame?.sha256) continue;
  const arr = bySha.get(r.frame.sha256) ?? [];
  arr.push(r.captureKey);
  bySha.set(r.frame.sha256, arr);
}
const reusedFrames = [...bySha.entries()].filter(([, keys]) => keys.length > 1).map(([sha, keys]) => ({ sha: sha.slice(0, 16), keys }));
for (const rf of reusedFrames) {
  for (const k of rf.keys) violations.push({ kind: "reused-frame", moduleKey: String(k).split(":")[0], page: k, reason: `帧与 ${rf.keys.filter((x) => x !== k).join("、")} SHA 相同 ⇒「每模块一页一帧」未满足，疑似复用截图冒充采集`, detail: { sha: rf.sha } });
}
for (const r of records) {
  const missing = [];
  if (!r.overflow) missing.push("①横向裁切");
  if (r.overflow?.pageOffenders?.length && !r.overflowGate) missing.push("①c 隐藏同步容器手势");
  if (r.overflow && !Array.isArray(r.overflow.pageOffenders)) missing.push("① 越界全量判据(pageOffenders)");
  if (!r.actions) missing.push("④主操作");
  if (!r.focus) missing.push("⑤键盘焦点");
  if (!r.contrast) missing.push("⑦对比度");
  if (!r.overlay) missing.push("③弹层");
  if (!r.drawer?.mouse) missing.push("②抽屉(鼠标)");
  if (!r.drawer?.touch) missing.push("②抽屉(触摸)");
  if (!r.frame) missing.push("帧");
  const upstream = violations.some((v) => v.moduleKey === r.moduleKey && ["module-without-capture", "module-timeout"].includes(v.kind));
  if (missing.length && !upstream) {
    violations.push({ kind: "record-incomplete", moduleKey: r.moduleKey, page: r.pageKey, reason: `记录缺必测项：${missing.join("、")}`, detail: { missing, verdict: r.verdict ?? null, steps: (r.steps ?? []).slice(-6) } });
  }
}
/* 分块每跑一块自起一遍服务、端口每次现换 ⇒ 「同源」只能逐条自证。逐条 origin/端口缺失就是采集来路不完整，
   不许拿最后一块的 scope.origin 去套前面 11 块（那是把别人的服务说成自己的）。 */
for (const r of records) {
  const lack = [];
  if (!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]{4,5}$/.test(String(r.captureOrigin ?? ""))) lack.push("逐条采集 origin");
  if (!Number.isFinite(r.captureWebPort) || !Number.isFinite(r.captureBackendPort)) lack.push("逐条采集端口");
  if (r.paint?.url && r.captureOrigin && !String(r.paint.url).startsWith(String(r.captureOrigin))) lack.push(`URL 与自身 origin 不同源（${r.paint.url} vs ${r.captureOrigin}）`);
  if (lack.length) violations.push({ kind: "record-incomplete", moduleKey: r.moduleKey, page: r.pageKey, reason: `记录缺采集来路口径：${lack.join("、")}`, detail: { missing: lack, captureOrigin: r.captureOrigin ?? null, url: r.paint?.url ?? null } });
}
const clippedLib = findClippedA(records.filter((r) => r.frame).map((r) => ({ ...r.frame, captureKey: r.captureKey, moduleKey: r.moduleKey })));
const clippedFrames = records.filter((r) => r.frame && Number(r.frame.overflowX) !== 0).map((r) => r.captureKey);

/* ── 逐模块摘要行 ── */
const perModule = records.map((r) => {
  const mineV = violations.filter((v) => v.moduleKey === r.moduleKey && (v.page === r.pageKey || v.page === r.captureKey));
  const kinds = [...new Set(mineV.map((v) => v.kind))];
  const dm = r.drawer?.mouse ?? {};
  const dt = r.drawer?.touch ?? {};
  return {
    moduleKey: r.moduleKey,
    moduleName: r.moduleName ?? null,
    pageKey: r.pageKey,
    routePath: r.routePath ?? null,
    overflowX: r.overflow?.docOverflowX ?? null,
    nonExemptOffenders: r.overflowGate?.hard ?? r.overflow?.counts?.page ?? null,
    overflowClipSyncGroups: r.overflowGate?.synced ?? 0,
    drawerMouse: dm.via === "mode-seg" ? (dm.routeFallback ? "路由兜底" : `模式段点击+toggle${dm.openedByToggle ? "开" : "未开"}`) : `点开=${dm.openedByRealClick ? "真" : "假"}/随条目收=${dm.autoClosedAfterPick ? "真" : "—"}`,
    drawerTouch: dt.error
      ? "异常"
      : `tap开=${dt.openedByTap ?? "n/a"}/遮罩收=${dt.closedByMaskTap ?? "n/a"}/toggle重开=${dt.reopenedByToggleTap ?? "n/a"}/再收=${dt.closedByToggleTap === true ? `真(${dt.closeControl})` : dt.closeControlsUnreachable ? "钮全被盖" : String(dt.closedByToggleTap)}`,
    overlay: r.overlay ? (r.overlay.reason ? `未测(${r.overlay.reason})` : `${r.overlay.reachable ? "可用" : "不可用"} 关不掉=${r.overlay.closed === false ? "真" : "否"}`) : "—",
    actions: r.actions ? { total: r.actions.total, below44: r.actions.below44, below24: r.actions.below24, offscreen: r.actions.offscreenCount, reachByScroll: r.actions.reachByScrollCount } : null,
    focus: r.focus ? { stops: r.focus.stopsCount, noRingInViewport: r.focus.noRingInViewport, offViewport: r.focus.offViewport, ringByDiff: r.focus.ringByDiff } : null,
    railScroll: r.railScroll ? { overflowX: r.railScroll.overflowX, maxScrollLeft: r.railScroll.maxScrollLeft, afterScrollLeft: r.railScroll.after?.scrollLeft ?? null, edgeInView: r.railScroll.after?.edgeItem?.inView ?? null, restored: r.railScroll.restored ?? null } : null,
    unlabeledButtons: r.actions?.unlabeled ?? null,
    weakestContrast: r.contrast ? { canvas: r.contrast.weakestCanvas?.ratio ?? null, any: r.contrast.weakestAny?.ratio ?? null, canvasFails: r.contrast.fails.length, ink2OnSide: r.contrast.ink2OnSide.length } : null,
    frame: r.frame?.file ?? null,
    verdict: kinds.length ? `红：${kinds.join("/")}` : r.frame ? "通过" : "阻塞",
    violationKinds: kinds,
  };
});
const gateCounts = {};
for (const v of violations) gateCounts[v.kind] = (gateCounts[v.kind] ?? 0) + 1;

/* ── 对比度台账（F1 中央裁定后的口径）──
   父卡事实：13B 把基线深灰 #333333（同底色 12.09:1）换成原型二级文字色 ink2 #8A8F98（3.11:1/3.25:1），
   在 11px 功能文字上跌破 WCAG AA 4.5:1 ⇒ 凌舟驳回判「WCAG AA 优先」，实现侧已把画布 `--wb-ink2`
   定义为达标值（src/styles.css 画布段 0b）。本台账因此换轴：
     · `contrastConflicts` 仍然逐条如实登记任何跌破 AA 的功能墨对 —— 采集器**不许**因为「已经修过」就跳过；
       整改成立时它必须是空数组，非空即 F1 未关闭（门禁照旧判红并以非零码退出）。
     · `contrastAAReadings` 是新增的达标面读数：逐模块把 ink2-on-side / ink2-on-bg 的真实比值、字号、
       选择器、画布令牌运行时解析值一并入档，用来证明「红为 0」来自色值达标，而不是来自口径被关掉。
     · `retiredInkSeen` 记录画布里是否还渲染着退役低对比值 #8A8F98（非 0 ⇒ 有页面绕过了令牌）。 */
const BASELINE_INK_RGB = [51, 51, 51];
const canvasRgb = (token) => (CANVAS_TOKENS[token] ?? CANVAS_TOKENS.side).split(",").map(Number);
const contrastConflicts = records
  .filter((r) => r.contrast?.fails?.length)
  .map((r) => ({
    moduleKey: r.moduleKey,
    pageKey: r.pageKey,
    viewport: NARROW.id,
    pairs: r.contrast.fails.map((f) => ({ sel: f.sel, text: f.text, fontSize: f.fontSize, fontWeight: f.fontWeight, fgToken: f.fgToken, bgToken: f.bgToken, ratio: f.ratio, need: f.need })),
    baselineRatioOnSameBg: Math.round(contrastRatio(BASELINE_INK_RGB, canvasRgb(r.contrast.fails[0]?.bgToken ?? "side")) * 100) / 100,
    conflict: "§三.A 要求与原型取色一致（ink2 #8A8F98 就是原型二级文字色）⇄ §三.D.16 要求对比度不因视觉对齐退步（基线同位置是 #333333）⇒ 两条卡面口径在同一处文字上对撞",
    whyNotSilentlyFixed: "凌舟已按中央裁定关闭该冲突（13B-F1 §三.1：AA 优先）⇒ 本条若非空就是「整改未覆盖到这一处」，属于缺陷复发，不接受再走豁免",
    owner: OWNER,
    followUp: "WORKBENCH-13B-WORKBENCH-MODULE-VISUAL-PARITY-01-F1 §三.1/§三.3 返工未关闭：按 styles.css 0b 段令牌口径补齐该处，并复采本模块窄口帧",
  }));
const contrastAAReadings = records
  .filter((r) => r.contrast)
  .map((r) => {
    const ink2Pairs = (r.contrast.samples ?? []).filter((p) => p.fgToken === "ink2" && (p.bgToken === "side" || p.bgToken === "bg"));
    const ratios = ink2Pairs.map((p) => p.ratio).filter(Number.isFinite);
    return {
      moduleKey: r.moduleKey,
      pageKey: r.pageKey,
      viewport: NARROW.id,
      inkTokens: r.contrast.inkTokens ?? null,
      ink2Pairs: ink2Pairs.map((p) => ({ sel: p.sel, bgToken: p.bgToken, fontSize: p.fontSize, fontWeight: p.fontWeight, ratio: p.ratio, need: p.need, pass: p.pass, count: p.count })),
      ink2Sampled: ink2Pairs.length,
      ink2MinRatio: ratios.length ? Math.min(...ratios) : null,
      ink2AllPassAA: ink2Pairs.length > 0 && ink2Pairs.every((p) => p.pass),
      retiredInkRendered: (r.contrast.retiredInkSeen ?? []).reduce((n, x) => n + (x.count ?? 1), 0),
      canvasFails: r.contrast.fails.length,
      weakestCanvas: r.contrast.weakestCanvas?.ratio ?? null,
      outsideTokenInks: (r.contrast.outsideTokenInks ?? []).length,
    };
  });

/* ── JSON 入档 ── */
const bundle = {
  schema: "wb13b-narrow-390/v1",
  card: "WORKBENCH-13B §三.D.15/16/17（390×844 窄口回归：无横向裁切 + 抽屉/弹层/主操作可用 + 焦点/语义/对比度/命中区不退步）",
  generatedAt: new Date().toISOString(),
  runStartedAt: RUN_STARTED_AT,
  sources: {
    pageModel: "measure/wb13b-proto-page-model.json",
    shell: "admin-web/src/layouts/WorkbenchShell.vue（390 媒体查询段：底部条 56px / 抽屉 translateX / 遮罩 z44）",
    css: "admin-web/src/styles.css（13B 画布语法段）+ admin-web/src/styles/tokens.css（:focus-visible outline 2px）",
    manifestPos: "admin-web/src/shared/workbench/manifest-pos.ts",
    viewportTruth: "admin-web/src/shared/workbench/wb-viewport.ts（390 断点真相源）",
    siblings: ["tests/wb13b-module-parity.mjs", "tests/wb13b-state-matrix.mjs", "tests/wb-f-narrow.spec.mjs"],
  },
  scope: {
    viewport: NARROW.id,
    hasTouch: true,
    deviceScaleFactor: 1,
    modulesPlanned: planned.map((p) => p.key),
    pagesFlag: flag("pages") ?? null,
    budgetMsPerModule: MODULE_BUDGET_MS,
    origin: ORIGIN,
    backendPort: BACKEND_PORT,
    webPort: WEB_PORT,
    /* 分块合并后 scope 只描述「最后一块」起的服务；前面各块的来路逐条记在 records[].captureOrigin，
       这里汇总一份去重列表，免得读的人拿单一 origin 去套全档。 */
    chunkOrigins: [...new Set(records.map((r) => r.captureOrigin).filter(Boolean))],
  },
  redLines: [
    "不得只改测试/夹具/截图名称冒充 UI 修复",
    "不得用 mock 数据证明有数据态",
    "不得用 query 参数、开发注入或 DOM 注入生成生产视觉通过证据",
  ],
  summary: {
    aborted: aborted ? aborted.split("\n")[0] : null,
    portsClean: portsOk,
    carriedMerge: mergeNote,
    chunkRecords: records.filter((r) => keepModules.has(r.moduleKey)).length,
    totalRecords: records.length,
    gateCounts,
    reusedFrames,
    clippedFrames,
    clippedByLib: clippedLib.length,
    perModule,
  },
  records,
  violations,
  gaps,
  findings,
  deviations: contrastConflicts,
  contrastAA: {
    rule: "F1 中央裁定（凌舟驳回 DEV-13B-01）：功能文字 WCAG AA 优先于原型取色；ink2 达标值 = 画布令牌解析值",
    modulesWithInk2: contrastAAReadings.filter((x) => x.ink2Sampled > 0).length,
    modulesAllPass: contrastAAReadings.filter((x) => x.ink2AllPassAA).length,
    minInk2Ratio: (() => {
      const rs = contrastAAReadings.map((x) => x.ink2MinRatio).filter(Number.isFinite);
      return rs.length ? Math.min(...rs) : null;
    })(),
    retiredInkRendered: contrastAAReadings.reduce((n, x) => n + x.retiredInkRendered, 0),
    canvasFails: contrastAAReadings.reduce((n, x) => n + x.canvasFails, 0),
    outsideTokenInks: contrastAAReadings.reduce((n, x) => n + x.outsideTokenInks, 0),
    perModule: contrastAAReadings,
  },
  network: netFailures.slice(0, 60),
};
writeFileSync(MEASURE_JSON, JSON.stringify(bundle, null, 2));

/* 仓内证据副本：专项测试只读它 ⇒ clean 检出无需起服务即可复现（与 f2a/f2 采集器同一口径） */
writeFileSync(path.join(WEB, "tests", "fixtures", "wb13b-narrow-390.json"), JSON.stringify(bundle, null, 2) + "\n");

/* ── MD 人读表 ── */
const mdCell = {
  overflow: (r, row) => {
    if (!r.overflow) return "未采";
    const rs = row.railScroll;
    const rail = rs ? `；rail 横滚 ${rs.overflowX} 量程${rs.maxScrollLeft}px→滚后 scrollLeft=${rs.afterScrollLeft} 末位入口入视口=${rs.edgeInView ? "是" : "否"}` : "";
    return `超 ${r.overflow.docOverflowX}px / 越界 ${r.overflow.offenders.length}（门禁级 ${r.overflow.counts.page ?? 0}）${rail}`;
  },
  drawer: (row) => `鼠标 ${row.drawerMouse}；触摸 ${row.drawerTouch}`,
  overlay: (row) => row.overlay,
  actions: (r) => (r.actions ? `${r.actions.total} 钮 · <44 ${r.actions.below44} · <24 ${r.actions.below24} · 硬越界 ${r.actions.offscreenCount} · 滚得到 ${r.actions.reachByScrollCount ?? 0}` : "未采"),
  focus: (r) => (r.focus ? `${r.focus.stopsCount} 站 · 无环 ${r.focus.noRingInViewport}（失焦对照补判 ${r.focus.ringByDiff ?? 0}）· 视口外 ${r.focus.offViewport}` : "未采"),
  contrast: (r) => {
    if (!r.contrast) return "未采";
    const w = r.contrast.weakestCanvas ?? r.contrast.weakestAny;
    return `最弱 ${w ? `${w.ratio}:1（${w.fgToken ?? "非令牌"}/${w.bgToken ?? "非令牌"} ${w.pass ? "达标" : "不达标"}）` : "—"} · 画布红 ${r.contrast.fails.length}`;
  },
};
const mdRows = records.map((r) => {
  const row = perModule.find((p) => p.moduleKey === r.moduleKey && p.pageKey === r.pageKey) ?? {};
  return `| ${r.moduleKey} (${r.pageKey}) | ${mdCell.overflow(r, row)} | ${mdCell.drawer(row)} | ${mdCell.overlay(row)} | ${mdCell.actions(r)} | ${mdCell.focus(r)} | ${r.actions?.unlabeled ?? "未采"} | ${mdCell.contrast(r)} | ${row.verdict ?? r.verdict ?? "—"} |`;
});
const md = [
  "# WORKBENCH-13B · 390×844 窄口回归（卡 §三.D.15/16/17）",
  "",
  `- 生成：${bundle.generatedAt} · 本块模块：${planned.map((p) => p.key).join(", ")} · 合并：${mergeNote}`,
  "- 口径：真实登录（/api 代理 demo-login）+ 真实点击 rail/抽屉条目 + 真实触摸 tap + 真实 Tab/Escape + 真实 wheel 横滚；零注入（无 ?query、无 DOM 改写、无 mock 有数据态）。",
  "- 焦点环判据 = 元素自身 outline ∪ 聚焦/失焦逐节点（含 4 层祖先）计算样式差；只看自身 outline 会把 Element Plus 包装层环误判成不可见。",
  "- 触摸「再收」腿先做 elementFromPoint 命中测试：≤390 抽屉展开时 z45 面板盖住 header 的 side-toggle（实测落在抽屉自己的 span.sn-logo 上）⇒ 改点展开态可见的 second-nav-collapse；两颗钮都命中不到才记 drawer-close-control-unreachable 发现项（关闭由遮罩腿证明，属 F3 壳层层级口径、非 13B 退步），命中可点而真 tap 收不掉才判 drawer-unusable。收银台同样跑满三段，不豁免关闭证据。",
  "- 越界判据 = 硬越界（无任何可滚祖先/文档能带入）才判 action-offscreen 与 narrow-overflow；门禁读的是 pageOffenders 全量，不是展示用的 40 格切片（切片会被 rail/离屏抽屉桶占满 ⇒ 假绿）。railScroller 与 overflow-x:hidden 同步容器（Element Plus 表头那类）两个豁免桶都必须有真实横滚手势证据：滚后复测，内容回不到 390 视口就是红，回到了也只记发现项、报告必须写明「这些列要横滚才看得到」。",
  "- 门禁：narrow-overflow / drawer-unusable / overlay-unusable / action-offscreen / focus-invisible / contrast-regression；完整性：module-timeout / module-without-capture / reused-frame / record-incomplete。任何一条红 ⇒ 退出码 1。",
  `- 视口外焦点站（收起抽屉/横滚 rail）、<44×44 命中区计数、无标签图标钮计数、line-on-side 装饰线 ≈1.11:1：按卡口径为**测量/发现项**，如实入档不判红（软化点全部写进交付报告）。`,
  "",
  "| 模块 | 溢出 | 抽屉(鼠标/触摸) | 弹层 | 主操作命中 | 焦点环 | 无标签按钮 | 最弱对比度 | 判定 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...mdRows,
  "",
  "## 违规明细（具名、不软化）",
  "",
  ...(violations.length ? violations.map((v) => `- **[${v.kind}]** ${v.moduleKey}/${v.page}：${v.reason}`) : ["- 无。"]),
  "",
  "## 缓交人工的 gap",
  "",
  ...(gaps.length ? gaps.map((g) => `- ${g.moduleKey}/${g.page}（${g.state}）：${g.reason} —— ${g.owner}；${g.followUp}`) : ["- 无。"]),
  "",
  "## 发现项（测量口径，不进门禁）",
  "",
  ...(findings.length ? findings.map((f) => `- [${f.kind}] ${f.moduleKey ?? "-"}/${f.page ?? "-"}：${f.reason}`) : ["- 无。"]),
  "",
  "## 对比度达标读数（F1 中央裁定：功能文字 WCAG AA 优先于原型取色）",
  "",
  `画布令牌运行时解析值：${[...new Set(contrastAAReadings.map((x) => `ink2=${x.inkTokens?.ink2 || "未定义（退回兜底）"}`))].join(" / ") || "—"}（退役值 #8A8F98 在画布渲染 ${contrastAAReadings.reduce((n, x) => n + x.retiredInkRendered, 0)} 处）`,
  "",
  "| 模块/页 | ink2 功能文字采样 | 最低比值 | 全达 AA | 令牌外暗字(AA 不达标) | 画布红 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...contrastAAReadings.map((x) => `| ${x.moduleKey}/${x.pageKey} | ${x.ink2Sampled} | ${x.ink2MinRatio ?? "—"}:1 | ${x.ink2Sampled ? (x.ink2AllPassAA ? "是" : "否") : "无采样"} | ${x.outsideTokenInks} | ${x.canvasFails} |`),
  "",
  "## 对比度冲突台账（跌破 AA 的功能墨对；F1 整改成立时应当为空，非空＝返工未关闭）",
  "",
  ...(contrastConflicts.length
    ? contrastConflicts.flatMap((c) => [
        `- **${c.moduleKey}/${c.pageKey}**（${c.viewport}）：${c.pairs.length} 组跌破阈值 —— ${c.pairs.map((p) => `\`${p.sel}\` ${p.fontSize}px ${p.fgToken}-on-${p.bgToken} **${p.ratio}:1**（需 ${p.need}:1）`).join("；")}；基线同底色 #333333 为 ${c.baselineRatioOnSameBg}:1`,
        `  - 冲突：${c.conflict}`,
        `  - 为何不当场改色：${c.whyNotSilentlyFixed}`,
        `  - 处置：${c.owner} ⇒ ${c.followUp}`,
      ])
    : ["- 无（画布功能墨文字对全部达 AA 4.5:1）—— 凌舟驳回的 9 条 contrast-regression 已由画布令牌整改关闭。"]),
  "",
  `网络失败 ${netFailures.length} 条（详见 JSON network 段）；端口收尾：${portsOk ? "全部 DOWN" : "有端口未清理，请人工复核"}。`,
  "",
].join("\n");
writeFileSync(MEASURE_MD, md);
writeFileSync(HARNESS_FILE, JSON.stringify({ startedAt: RUN_STARTED_AT, finishedAt: new Date().toISOString(), ports: { BACKEND_PORT, WEB_PORT }, planned: planned.map((p) => `${p.key}:${p.pageKey}`), log: harnessLog.slice(-800), backendTail: backendTail.slice(-80).join("").slice(-8000) }, null, 2));

/* ── 控制台门禁打印 + 退出码 ── */
console.log("═".repeat(76));
console.log(`WORKBENCH-13B · 390×844 窄口回归（§三.D.15/16/17）· 本块：${planned.map((p) => p.key).join(", ")}`);
console.log("─".repeat(76));
for (const row of perModule) {
  console.log(
    ` ${String(row.moduleKey).padEnd(9)} 溢出 ${String(row.overflowX ?? "—").padStart(3)}px 越界 ${String(row.nonExemptOffenders ?? "—").padStart(2)}${row.overflowClipSyncGroups ? `（另 ${row.overflowClipSyncGroups} 组 hidden 同步容器横滚可及）` : ""} | 抽屉 ${row.drawerMouse} / ${row.drawerTouch} | 弹层 ${row.overlay} | <44 ${String(row.actions?.below44 ?? "—")} 无环 ${String(row.focus?.noRingInViewport ?? "—")} 无标签 ${String(row.unlabeledButtons ?? "—")} 最弱 ${String(row.weakestContrast?.canvas ?? row.weakestContrast?.any ?? "—")}:1 | ${row.verdict}`,
  );
}
console.log("─".repeat(76));
for (const v of violations) console.log(`机器门禁红 [${v.kind}] ${v.moduleKey}/${v.page ?? "-"} reason=${String(v.reason).slice(0, 150)}`);
if (violations.length === 0) console.log("机器门禁：narrow-overflow / drawer-unusable / overlay-unusable / action-offscreen / focus-invisible / contrast-regression + 完整性门全部绿");
console.log(`记录 ${records.length}（本块 ${bundle.summary.chunkRecords}）· 违规 ${violations.length} · gap ${gaps.length} · 发现 ${findings.length} · reusedFrames ${reusedFrames.length} · 端口收尾 ${portsOk ? "全部 DOWN" : "未清理"}`);
console.log(`入档：${MEASURE_JSON}\n      ${MEASURE_MD}\n      ${path.join(WEB, "tests", "fixtures", "wb13b-narrow-390.json")}（仓内副本，专项测试只读它）`);
process.exit(violations.length ? 1 : 0);
