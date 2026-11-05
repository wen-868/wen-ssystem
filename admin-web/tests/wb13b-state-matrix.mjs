/**
 * WORKBENCH-13B · §三.C「状态完整性」矩阵采集器（逐模块 loading / ready-empty / unavailable / error / 无权限 / 写操作）
 *
 * 与 wb13b-module-parity.mjs 的分工：并排采集器量的是「实现 ⇄ 原型 是不是同一张脸」；
 * 本工具量的是「同一张脸在**六种状态下各自画不画得出来、画不出来时诚实不诚实**」（卡 §三.C.11/12/13/14 · §四.4）。
 * 服务起停 / 真实 SUPER_ADMIN 登录 / 真实点击导航语法 / 帧 SHA 台账 / 端口收尾标记，全部沿用同一套已验证机制。
 *
 * 每个状态**怎么到达**（这是本卡的口径核心，不是实现细节）：
 *   ready        —— 真实点击 [data-testid="rail"] 模块项 ⇒ 真实点击二级列卡片（real-zone `.sn-row` 优先，
 *                   sub-zone `[data-plan-label]` 其次）⇒ 行为门（IMPL_PAINT_GATE 同口径）判页面真画出来 ⇒ 出帧。
 *   loading      —— 同一次真实导航的**在飞窗口**：点击落地后立刻轮询读 DOM（≤1.5s，60ms 一拍），
 *                   记录第一帧出现过的加载语汇（.el-loading-mask / .el-skeleton / .table-skeleton / :loading 按钮）。
 *                   刻意不用 CDP 限速、不拦响应、不注入 class：放慢网络造出来的 loading 是** harness 的状态**，
 *                   不是用户的状态；读不到就记 status:"unreachable"＋reason 且**不出 PNG**
 *                   （拿静默后的画面冒充 loading 正是 §四.4 禁止的假象 —— 这条是实测改的口径）。
 *   empty        —— 走页面自己的筛选：真实 fill 一个必然不命中的关键字（nonce），点页面自己的「查询/搜索」
 *                   控件（没有查询按钮就按真实回车键触发视图自己的 @keyup.enter）⇒ 等页面自己请求回来 ⇒ 出帧。
 *                   随后清空再查一次 ⇒ ready-again，并逐区比对几何（C.13「保留原型布局与控件位置」的可测内核）。
 *   unavailable  —— 真降级：登录后**杀掉 mock 后端进程**（不是 mock 一个 500），页面自己的请求得到
 *                   ERR_CONNECTION_REFUSED ⇒ 出帧；有 in-page unavailable/retry 语汇就**真点重试**，
 *                   记录重试后是否再发出一条同样失败的请求；随后重启后端并等端口重新应答。
 *   error        —— 同一次降级读数的第二问：页内是否出现**常驻**错误块（el-result / .error-list / 自绘面板），
 *                   还是只有一闪而过的 ElMessage toast。toast 一律记 {surface:"toast"}，
 *                   绝不当成「页面有错误态」（§四.4 不许用假数据/假反馈遮挡）。
 *   no-permission—— 先立事实：路由守卫 (src/router/index.ts 的 meta.roles 分支) 是 ElMessage.warning + **重定向**，
 *                   ⇒ 无权限态在 DOM 里没有落点（守卫行号由源码实测算出，不手抄）。本工具**不伪造 403**，
 *                   改采可观测代理：二级列里 `disabled` / `待接入`（data-plan-status="pending"）的卡，
 *                   真实点击它 ⇒ 记录点击被浏览器拒绝（element is not enabled）与 URL 未变 ⇒ 该卡确实惰性。
 *   write        —— 真点页面自己的新增/编辑/删除/审核按钮 ⇒ 等页面自己的 el-dialog / el-message-box /
 *                   el-popconfirm 弹出 ⇒ 记录确认按钮在点击时刻的 disabled / :loading（is-loading/aria-busy）属性
 *                   ⇒ 只**取消或关闭**，绝不提交任何写操作（不改变 mock 数据）⇒ 回落到 ready 证明可恢复。
 *
 * 页面类型怎么挑（C.14「不同页面类型分别建立视觉契约，不得把所有页面强行改成同一种列表卡」）：
 *   模块键取 `measure/wb13b-proto-page-model.json` 的 11 个业务扇区（sale…system），POS 单列（见下）。
 *   每个扇区按「该扇区已接线（routePath 非空 + superAdminVisible）页面里出现过的 panelType」各挑第一页：
 *   主代表页优先 list（筛选条最典型，empty 可经页面自己的控件到达），其余版式各补一张 ready 帧。
 *   POS 不在 11 个业务 rail 模块里（rail 实测 13 项＝desk + 11 业务 + set，见 shared/workbench/prototype-nav.ts），
 *   所以 --modules=pos 走**另一条真实人工路径**：顶栏胶囊 [data-mode-seg="pos"] ⇒ /pos/dashboard
 *   ⇒ 二级列真实区「快速收银」行 ⇒ /pos/cashier（路由/文案取自 src/shared/workbench/manifest-pos.ts，不硬编码）。
 *   收银台是全局唯一带 in-page unavailable/retry 岛的业务页（C.13 的正样本），print 版式只在 system 扇区，
 *   board/form 由各自扇区的首个已接线页覆盖 —— 五条版式线在 --modules=sale,order,pos,system 分块内即可闭合。
 *
 * 实测改过来的三条口径（第一次自测 sale,order 跑出来的，不是设计时的想当然）：
 *   ① rail 就绪判据必须盯**本模块那一项**：desk/set 是常驻真实项，「rail 上有真实项」不等于 11 个业务模块位
 *      渲染出来了（菜单桥 loading 时 railModules=[] ⇒ 只剩 desk+set+骨架，见 WorkbenchShell.vue 的
 *      railModules / railSkeletons 互斥契约）。旧判据 real.length>0 把「杀后端再重启」后的第一次导航判成
 *      就绪 ⇒ 整个 order 模块被误报成 rail-entry-missing（假阻断）。
 *   ② empty 成立＝结果面真归零 或 页内真画出 empty 岛；「填了字但列表纹丝不动」的画面不是空态，改记 unreachable。
 *      loading 同理：在飞窗口没读到语汇 ⇒ 无帧可出，只有缺口记录。
 *   ③ error 与 unavailable 在**没有重试可点**的页面上是同一个 DOM 瞬间的两个问题 ⇒ error 记
 *      {own:false, sharedWith:"unavailable"} 共用那一帧，绝不复制一份同 SHA 的文件冒充独立证据；
 *      真点过重试时 DOM 是新瞬间 ⇒ error 用自己的帧（重试后）。写操作的「没改数据」改由被动监听的
 *      POST/PUT/PATCH/DELETE 请求数判定（页面本地行数只作旁证），一个写控件点了不弹面不算确认框，
 *      于是逐候选真试（≤3 个），全都不弹面才记 unreachable。
 *
 * 红线自查（卡 §六）：
 *   零注入 —— 不带 ?wb_uiux、不加 query 参数、不设 dev-only flag、不 dispatch 伪造事件、不改 DOM/class/style、
 *   不调用页面内部函数伪造状态；所有状态都是真实点击 / 真实按键 / 真实断网达到的。
 *   零假数据 —— 数据不可得时只量布局与控件位置，不填任何演示值；状态在 DOM 里不存在就记 measured absence
 *   （附源码 file:line 证据 + owner + followUp=WORKBENCH-13C），**绝不把未实现的状态报成通过**。
 *   零副作用 —— 只新增本文件与其产物（shots/measure/logs）；不改 src/**、不改既有测试库、不改 package.json；
 *   写操作只开不提交；跑完自起自停，末行必打「端口收尾：8080/5199 全部 DOWN」。
 *
 * 用法（admin-web 目录，Windows + Git Bash；单片须 <10min ⇒ 按 --modules 分块串行）：
 *   node tests/wb13b-state-matrix.mjs <evidenceDir 绝对路径> [选项]
 * 选项：
 *   --modules=sale,order,pos   只跑这些扇区键（默认 11 个业务扇区；`pos` 需显式点名，走收银台专用路径）
 *   --states=ready,empty,write 只跑这些状态（默认全部 8 档：ready/loading/empty/ready-again/unavailable/error/no-permission/write）
 *   --viewports=1440x1000      只跑这些视口档（默认 1440×1000；窄档刻意不进本工具，见 §三.D 响应式另单）
 *   --pages=sale:collection    指定某模块的代表页（可逗号并列）；`--pages=2` 表示每模块最多采几页（默认 4）
 *   --keep-servers             跑完不关后端/vite（仅本地排错用）
 * 环境变量：WB13_BACKEND_PORT / WB13_WEB_PORT / WB13_CHROME
 *
 * 输出：
 *   <evidenceDir>/shots/state-<状态>-<模块>-<页面>[-<视口>].png   逐状态帧（多视口时名字带视口档，保证一帧一名）
 *   <evidenceDir>/measure/wb13b-state-matrix.json                schema wb13b-state-matrix/v1（逐模块 states[] + 读数 + 门禁）
 *   <evidenceDir>/measure/wb13b-state-matrix.md                  人读矩阵（每模块×状态 有/无/不适用+理由）+ 缺口清单（归 WORKBENCH-13C）
 *   <evidenceDir>/logs/wb13b-state-harness.json                  服务起停 / 杀后端降级 / 点击轨迹 / 尾部日志
 *
 * 分块合并：与并排采集器同一口径 —— 每片写完 JSON 后，把**不在本片模块集合内**的旧片记录原样并入，
 * 同 captureKey 的旧帧视为被本片取代（不重复计帧，SHA 台账只在存活帧之间查重）。
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, appendFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { portOfUrl, redactText } from "./uiux-scenarios-lib.mjs";
import { PAGE_CONTRACT, PAGE_VIEWPORTS, contractFor } from "./wb13b-page-contract-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const argv = process.argv.slice(2);
const EVIDENCE = argv.find((a) => !a.startsWith("--"));
const ALL_STATES = ["ready", "loading", "empty", "ready-again", "unavailable", "error", "no-permission", "write"];
if (!EVIDENCE) {
  console.error("用法：node tests/wb13b-state-matrix.mjs <evidenceDir> [--modules=…] [--states=…] [--viewports=1440x1000] [--pages=…]");
  process.exit(2);
}
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });
mkdirSync(path.join(OUT, "tools"), { recursive: true });
const KEEP_SERVERS = argv.includes("--keep-servers");

const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const MODEL_FILE = path.join(OUT, "measure", "wb13b-proto-page-model.json");
const MATRIX_FILE = path.join(OUT, "measure", "wb13b-state-matrix.json");
const MD_FILE = path.join(OUT, "measure", "wb13b-state-matrix.md");
const HARNESS_FILE = path.join(OUT, "logs", "wb13b-state-harness.json");
const LIVE_LOG = path.join(OUT, "logs", "wb13b-state-matrix.log");

const stateFilter = flag("states")?.split(",").map((s) => s.trim()).filter((s) => ALL_STATES.includes(s)) ?? null;
const STATES = stateFilter && stateFilter.length ? stateFilter : ALL_STATES;
const moduleFilter = flag("modules")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const viewportFilter = flag("viewports")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const viewports = viewportFilter ? PAGE_VIEWPORTS.filter((v) => viewportFilter.includes(v.id)) : [PAGE_VIEWPORTS[0]];
const SINGLE_VIEWPORT = viewports.length === 1;
const pagesFlag = flag("pages");
/** --pages=sale:collection,order:orders ⇒ 指定代表页；--pages=2 ⇒ 每模块页数上限（默认 4，够覆盖该模块版式） */
const PAGE_PIN = (() => {
  const raw = pagesFlag;
  if (!raw) return { pins: {}, limitPerModule: 4 };
  const pins = {};
  let limitPerModule = 4;
  for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = part.split(":");
    if (k && v) pins[k] = v.split("+");
    else if (/^\d+$/.test(k)) limitPerModule = Number(k);
  }
  return { pins, limitPerModule };
})();

const harnessLog = [];
const backendTail = [];
const trail = [];
const log = (msg) => {
  const line = `${new Date().toISOString()} ${msg}`;
  harnessLog.push(line);
  console.log(msg);
  try {
    appendFileSync(LIVE_LOG, `${line}\n`, "utf8");
  } catch {
    /* 实时日志写不进去不影响采集（收尾仍会整体落 logs/） */
  }
};
const note = (moduleKey, pageKey, step, detail) => {
  trail.push({ at: new Date().toISOString(), moduleKey: moduleKey ?? null, page: pageKey ?? null, step, detail });
};

/* ────────────────────────── 服务自起自停（与并排采集器同一口径） ────────────────────────── */

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
      } catch {
        /* 已退出 */
      }
    }
    await new Promise((r) => setTimeout(r, 800));
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
  if (!child) return;
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
let backendEntry = null;
async function startBackend(label = "backend") {
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
  backendEntry = { child, label: `${label}:${BACKEND_PORT}` };
  children.push(backendEntry);
  child.stdout.on("data", (b) => backendTail.push(String(b)));
  child.stderr.on("data", (b) => backendTail.push(String(b)));
  /* 实测教训：dev-mock 走 `npm run dev`⇒`tsx watch src/server.ts`，冷启在满载机器上要 85s 才应答；
     90s 预算会把「降级后重启后端」这一步撞成异常中止（整片读数作废）。放宽到 240s，超时必须仍然抛错。 */
  if (!(await waitForPort(BACKEND_PORT, true, 240000))) throw new Error(`后端 ${BACKEND_PORT} 未在 240s 内就绪`);
  boundPorts.add(BACKEND_PORT);
  log(`${label} mock 已起（127.0.0.1:${BACKEND_PORT}，USE_MOCK_DB=true）`);
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
/**
 * 会话续期：mock 后端进程被真杀之后重启，它的**内存态会话表就没了**——旧 token 再发出去只会被 401，
 * 而 src/api/request.ts:40 的响应拦截器遇到 401 是 `clearAuth()`（把持久化的 token/user 一起清掉）
 * ⇒ rail 的 11 个业务模块位从此不再渲染（实测：真实项只剩 desk）。这不是被测应用的缺陷，是会话真的过期了，
 * 所以按真实用户那样**重新登录**：再打一次同源代理的 POST /api/admin/auth/demo-login，拿新 token 覆盖
 * init script（后加的 init script 在同一次导航里后执行，写进去的就是新会话）。
 */
const AUTH_INIT = ({ token, csrf, user }) => localStorage.setItem("admin_auth", JSON.stringify({ token, user: { ...user, csrfToken: csrf } }));
async function renewSession(ctx, page, why) {
  const a = await loginViaProxy();
  auth = { token: a.token, csrfToken: a.csrfToken ?? a.csrf ?? "", user: a.user ?? {} };
  const payload = { token: auth.token, csrf: auth.csrfToken, user: auth.user };
  await ctx.addInitScript(AUTH_INIT, payload);
  if (page) await page.evaluate(AUTH_INIT, payload).catch(() => null);
  log(`  · 会话已续期（${why}）：新 token 摘要 ${createHash("sha256").update(auth.token).digest("hex").slice(0, 8)}·roles=${JSON.stringify(auth.user?.roles ?? [])}`);
  note(null, null, "session-renewed", { why, tokenDigest: createHash("sha256").update(auth.token).digest("hex").slice(0, 12), roles: auth.user?.roles ?? [] });
  return { roles: auth.user?.roles ?? [], digest: createHash("sha256").update(auth.token).digest("hex").slice(0, 12), why };
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
const netWrites = [];
function attachNetwork(page) {
  /* 被动观察（不改任何请求/响应）：unsafe 方法出不出得去，是 C.12「只开不提交」的唯一硬证据 */
  page.on("request", (req) => {
    if (!/POST|PUT|PATCH|DELETE/i.test(req.method())) return;
    if (!portOfUrl(req.url()) && !/^https?:\/\/localhost/.test(req.url())) return;
    netWrites.push({ at: new Date().toISOString(), method: req.method(), url: req.url().replace(/[?#].*$/, ""), port: portOfUrl(req.url()) || WEB_PORT });
  });
  page.on("requestfailed", (req) => {
    netFailures.push({
      at: new Date().toISOString(),
      method: req.method(),
      url: req.url(),
      port: portOfUrl(req.url()),
      error: String(req.failure()?.errorText ?? "unknown"),
    });
  });
}
const fileShot = (file, meta = {}) => ({ file: `shots/${path.basename(file)}`, bytes: statSync(file).size, sha256: sha256(readFileSync(file)), ...meta });

/* ────────────────────────── 页内函数（必须自包含：Playwright 只搬函数体） ────────────────────────── */

/**
 * 状态矩阵一次读：几何（按该页版式的契约区域）、加载语汇、unavailable/error 岛、toast、
 * 表格行/空态、筛选控件与按钮面、写操作弹层面、行为门真相。
 * cfg: {rootSels, regions:[{key,selectors}], gateRegions, writeVerbRe, nonceHint}
 */
function MATRIX_READER(cfg) {
  const D = document;
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const btnState = (el) => ({
    text: norm(el.textContent).slice(0, 24),
    /* 图标按钮没有文字：语义只能从 title / aria-label 取（C.12 的写控件不少是行内图标） */
    label: norm(el.getAttribute("title") || el.getAttribute("aria-label")).slice(0, 24),
    inRow: !!el.closest(".el-table__row, tbody tr, .board-card, .el-table__body"),
    disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
    loadingClass: /is-loading/.test(String(el.className || "")),
    ariaBusy: el.getAttribute("aria-busy"),
    hasSpinner: !!el.querySelector(".el-loading-spinner, .is-loading"),
    cls: String(el.className || "").slice(0, 80),
  });
  /* 读数根：整棵壳层与业务页同在一棵 DOM，不限定就会把壳/AI 面板当页面区块（并排采集器同一教训） */
  let root = null;
  let rootSel = null;
  for (const s of cfg.rootSels) {
    const el = D.querySelector(s);
    if (el) { root = el; rootSel = s; break; }
  }
  const scope = root || D.body;
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = [...scope.querySelectorAll(sel)].find(isVisible);
      if (el) return { el, sel };
    }
    return { el: null, sel: null };
  };
  const regions = cfg.regions.map((r) => {
    const hit = pick(r.selectors);
    return { key: r.key, exists: !!hit.el, sel: hit.sel, rect: hit.el ? box(hit.el) : null, itemCount: hit.el ? hit.el.querySelectorAll("*").length : 0 };
  });
  /* 加载语汇：只认真实渲染出来的那一个（常驻但 display:none 的遮罩不算） */
  const visibleCount = (sel) => [...D.querySelectorAll(sel)].filter(isVisible).length;
  const loading = {
    elLoadingMask: visibleCount(".el-loading-mask"),
    elSkeleton: visibleCount(".el-skeleton"),
    tableSkeleton: visibleCount(".table-skeleton"),
    ariaBusy: visibleCount("[aria-busy='true']"),
    loadingButtons: [...D.querySelectorAll("button")].filter((b) => isVisible(b) && /is-loading/.test(String(b.className))).length,
    buttonsTotal: [...D.querySelectorAll("button")].filter(isVisible).length,
  };
  /* 状态岛清单：unavailable/error 都按「页内常驻块」口径量，toast 单独一档，二者不得互相顶替 */
  const ISLANDS = [
    { key: "pos-cat--unavailable", selectors: [".pos-cat--unavailable"], family: "unavailable" },
    { key: "pos-cats-retry", selectors: ["[data-testid='pos-cats-retry']"], family: "unavailable", retry: true },
    { key: "pos-catalogue-unavailable", selectors: [".pos-catalogue-unavailable", "[data-testid='pos-catalogue-unavailable']"], family: "unavailable" },
    { key: "sn-unavailable", selectors: [".sn-unavailable"], family: "unavailable" },
    { key: "wb-menu-empty", selectors: [".wb-menu-empty"], family: "unavailable" },
    { key: "el-result", selectors: [".el-result"], family: "error" },
    { key: "error-list", selectors: [".error-list"], family: "error" },
    { key: "page-error-block", selectors: [".load-error", ".error-block", ".error-state"], family: "error" },
    { key: "el-empty", selectors: [".el-empty", ".empty-state", ".v17-empty"], family: "empty" },
  ];
  const islands = [];
  for (const spec of ISLANDS) {
    for (const sel of spec.selectors) {
      for (const el of [...scope.querySelectorAll(sel), ...(spec.key === "sn-unavailable" || spec.key === "wb-menu-empty" ? [...D.querySelectorAll(sel)] : [])]) {
        if (!isVisible(el)) continue;
        const retryCtl = el.tagName === "BUTTON" || /retry|重试/.test(norm(el.textContent)) || /retry/.test(String(el.className));
        islands.push({ key: spec.key, family: spec.family, sel, text: norm(el.textContent).slice(0, 60), rect: box(el), isRetryControl: !!spec.retry, hasRetryWord: retryCtl });
      }
    }
  }
  /* 重试控件全集（unavailable 岛上真正可点的那个） */
  const retryControls = [...scope.querySelectorAll("button, a")].filter((el) => isVisible(el) && /重试|重新加载|retry/i.test(norm(el.textContent))).map((el) => ({ text: norm(el.textContent).slice(0, 24), sel: el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : el.tagName.toLowerCase(), rect: box(el) }));
  const toasts = [...D.querySelectorAll(".el-message, .el-notification")].filter(isVisible).map((el) => ({
    surface: "toast",
    cls: String(el.className || "").slice(0, 80),
    kind: /--error/.test(String(el.className)) ? "error" : /--warning/.test(String(el.className)) ? "warning" : /--success/.test(String(el.className)) ? "success" : "info",
    text: norm(el.textContent).slice(0, 80),
  }));
  const table = {
    rows: scope.querySelectorAll(".el-table__body .el-table__row, tbody tr.el-table__row").length,
    headerCells: scope.querySelectorAll(".el-table__header th").length,
    hasTable: !!scope.querySelector(".el-table"),
    emptyText: norm(scope.querySelector(".el-empty__description, .empty-state, .v17-empty")?.textContent).slice(0, 60),
  };
  /* 筛选控件面（empty 状态只能经它到达） */
  const filterScopes = [".filter-bar", ".filter-card", ".page-header", ".toolbar"].map((s) => scope.querySelector(s)).filter(Boolean);
  const filterHosts = [];
  for (const host of filterScopes.length ? filterScopes : [scope]) {
    for (const inp of [...host.querySelectorAll("input")]) {
      if (!isVisible(inp)) continue;
      if (inp.type === "checkbox" || inp.type === "radio" || inp.type === "hidden") continue;
      filterHosts.push({ hostCls: String(host.className || "").slice(0, 48), placeholder: inp.getAttribute("placeholder") || "", value: inp.value || "", disabled: inp.disabled === true, readOnly: inp.readOnly === true, inputType: inp.type || "text", inSelect: !!inp.closest(".el-select, .el-date-editor, .el-cascader, .el-date-picker"), rect: box(inp) });
    }
  }
  const queryButtons = [...scope.querySelectorAll("button")].filter((el) => isVisible(el) && /查询|搜索/.test(norm(el.textContent))).map(btnState);
  /* 写操作面：页面自己的新增/编辑/删除/审核按钮（文字或 title/aria-label 命中动词都算，只找可点亮的） */
  const allButtons = [...scope.querySelectorAll("button")].filter(isVisible).map(btnState);
  const verbRe = new RegExp(cfg.writeVerbRe);
  const writeButtons = allButtons.filter((b) => b.text ? verbRe.test(b.text) : verbRe.test(b.label));
  /* 行内**无任何文字/标签**的图标按钮：语义不可判定 ⇒ 刻意不点（盲点可能直接执行写操作，越红线），
     但必须如实数出来，作为 C.12「写操作面不可观测」的证据而不是当它不存在。 */
  const unlabeledRowActions = allButtons.filter((b) => !b.text && !b.label && b.inRow && !b.disabled);
  /* 弹层面：el-dialog / el-message-box / el-popconfirm；确认按钮的 disabled/:loading 在**点击时刻**量 */
  const overlayOf = (sel) => {
    const el = [...D.querySelectorAll(sel)].find(isVisible);
    if (!el) return { exists: false };
    const header = norm(el.querySelector(".el-dialog__header, .el-message-box__header, .el-drawer__header, .el-popconfirm .el-popconfirm__title")?.textContent).slice(0, 40);
    const footerButtons = [...el.querySelectorAll(".el-dialog__footer button, .el-message-box__btns button, .el-drawer__footer button, .el-popconfirm button, .el-cascader__dropdown button")].filter(isVisible).map(btnState);
    return {
      exists: true,
      sel,
      header,
      rect: box(el),
      footerButtons,
      confirmButtons: footerButtons.filter((b) => /确定|确认|保存|提交|开始|生成|创建|收款|结算/.test(b.text)),
      cancelButtons: footerButtons.filter((b) => /取消|关闭|返回|再想想|不/.test(b.text)),
      bodyLen: norm(el.textContent).length,
    };
  };
  const overlays = {
    dialog: overlayOf(".el-overlay .el-dialog"),
    messagebox: overlayOf(".el-message-box"),
    drawer: overlayOf(".el-overlay .el-drawer"),
    popover: overlayOf(".el-popover:not([style*='display: none'])"),
    popconfirm: overlayOf(".el-popconfirm"),
    overlayCount: [...D.querySelectorAll(".el-overlay")].filter(isVisible).length,
  };
  const view = D.querySelector('main[data-view="manual"].shown');
  const paint = {
    url: location.href.replace(/[?#].*$/, ""),
    path: location.pathname,
    shell: !!D.querySelector('[data-testid="wb-shell"]'),
    manualShown: !!view,
    rootSel,
    pageRootClass: root ? String(root.className || "").slice(0, 70) : null,
    pageRootBox: root ? box(root) : null,
    topTitle: norm(D.querySelector(".wb-top .wb-top-title")?.textContent).slice(0, 40),
    railOn: [...D.querySelectorAll('[data-testid="rail"] .wb-rail-item.on')].map((el) => el.getAttribute("data-rail-key")),
    menuEmpty: !!D.querySelector('[data-testid="menu-empty"], .wb-menu-empty'),
    aiFace: !!D.querySelector('main[data-view="chat"].shown, main[data-view="feed"].shown'),
  };
  return { regions, loading, islands, retryControls, toasts, table, filterHosts, queryButtons, allButtons, writeButtons, unlabeledRowActions, overlays, paint };
}

/** 行为门：页面真的到了且真的画出来了（与并排采集器同一判据，页内自包含） */
function IMPL_PAINT_GATE(cfg) {
  const D = document;
  const shell = D.querySelector('[data-testid="wb-shell"]');
  const view = D.querySelector('main[data-view="manual"].shown');
  const pageRoot = view ? view.firstElementChild : null;
  const r = pageRoot ? pageRoot.getBoundingClientRect() : null;
  const title = (D.querySelector(".wb-top .wb-top-title")?.textContent || "").trim().replace(/\s+/g, " ");
  const path = location.pathname;
  return {
    ok: !!shell && !!view && !!pageRoot && !!r && r.width >= 240 && r.height >= 120 && title.length > 0 && (path === cfg.routePath || path.endsWith(cfg.routePath)),
    shell: !!shell,
    manualShown: !!view,
    pageRootClass: pageRoot ? String(pageRoot.className || "").slice(0, 60) : null,
    pageRootBox: r ? `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}` : null,
    title,
    path,
    url: location.href.replace(/[?#].*$/, ""),
  };
}

/** 二级列卡片实态（无权限可观测代理的真源）：标签 / data-plan-status / disabled / 是否含「待接入」 */
function SUBNAV_CARDS_READER() {
  const D = document;
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cards = [...D.querySelectorAll('[data-testid="second-nav-sub-zone"] [data-plan-label]')].map((el) => ({
    via: "sub-zone",
    label: el.getAttribute("data-plan-label"),
    status: el.getAttribute("data-plan-status"),
    disabled: el.disabled === true,
    hasPendingWord: /待接入/.test(norm(el.textContent)),
    title: el.getAttribute("title") || "",
    text: norm(el.textContent).slice(0, 40),
    visible: vis(el),
  }));
  const rows = [...D.querySelectorAll('[data-testid="second-nav-real-zone"] .sn-row')].map((el) => ({
    via: "real-zone",
    label: norm(el.textContent),
    status: null,
    disabled: el.disabled === true,
    hasPendingWord: /待接入/.test(norm(el.textContent)),
    title: el.getAttribute("title") || "",
    visible: vis(el),
  }));
  return { cards, rows, url: location.href.replace(/[?#].*$/, ""), subEmpty: norm(D.querySelector('[data-testid="second-nav-sub-zone"] .sn-empty')?.textContent).slice(0, 60) };
}

/** rail 一级项真实键解析（目录口径 railKey ⇄ DOM data-rail-key，同并排采集器优先级） */
function IMPL_RAIL_KEY_RESOLVER(payload) {
  const items = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')];
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const keyed = items.map((el) => ({ key: el.getAttribute("data-rail-key") ?? "", label: norm(el.textContent), visible: el.getBoundingClientRect().width > 0 }));
  const want = payload.railKey;
  const name = payload.moduleName;
  const hit =
    keyed.find((k) => k.key === want && k.visible) ??
    keyed.find((k) => k.key === `wb.${want}` && k.visible) ??
    keyed.find((k) => k.label === name && k.visible) ??
    keyed.find((k) => String(k.key).split(".").pop() === want && k.visible) ??
    null;
  return { resolved: hit?.key ?? null, inventory: keyed };
}

/** 商品/表格行读数（POS 收银台没有 el-table，用卡片数当结果集行数） */
function RESULT_COUNT_READER() {
  const D = document;
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const count = (sel) => [...D.querySelectorAll(sel)].filter(vis).length;
  return {
    tableRows: count(".el-table__body .el-table__row"),
    productCards: count(".product-card, .goods-card, .product-item, .goods-item"),
    boardColumns: count(".board-column"),
    emptyBlocks: count(".el-empty, .empty-state, .v17-empty"),
    loadingMasks: count(".el-loading-mask"),
    skeletonBlocks: count(".el-skeleton"),
    unavailableBlocks: count(".pos-cat--unavailable, .pos-catalogue-unavailable, .sn-unavailable, .wb-menu-empty"),
    errorBlocks: count(".el-result, .error-list, .load-error, .error-block, .error-state"),
  };
}

/* ────────────────────────── 源码事实（状态在 DOM 里不存在时，file:line 证据从源码算，不手抄） ────────────────────────── */

const STATE_NEEDLES = {
  loading: ["v-loading", "TableSkeleton", "el-skeleton", ":loading="],
  empty: ["el-empty", "#empty", "emptyText", "empty-state"],
  error: ["el-result", "error-list", "loadError", "ElMessage.error"],
  unavailable: ["unavailable", "retry", "重试"],
  "no-permission": ["v-permission", "hasPerm", "meta.roles", "403", "无权限"],
  write: ["ElMessageBox.confirm", "el-popconfirm", "el-dialog", "ElMessage.success"],
};
function readSrc(rel) {
  const f = path.join(WEB, "src", rel);
  return existsSync(f) ? readFileSync(f, "utf8") : null;
}
/** 逐 needle 找行号（1 起）；文件不存在 ⇒ null，由调用方如实记「视图源不可读」 */
function scanView(rel) {
  const src = readSrc(rel);
  if (src === null) return { file: `src/${rel}`, readable: false, hits: {} };
  const lines = src.split(/\r?\n/);
  const hits = {};
  for (const [state, needles] of Object.entries(STATE_NEEDLES)) {
    const found = [];
    for (const needle of needles) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(needle)) {
          found.push({ needle, line: i + 1 });
          break; // 每个 needle 只取第一处命中，够定位且防爆栈
        }
      }
    }
    hits[state] = found;
  }
  return { file: `src/${rel}`, readable: true, hits, totalLines: lines.length };
}
/** 路由守卫实测行号（无权限态没有 DOM 落点这条结论的证据源） */
function routerGuardEvidence() {
  const src = readSrc("router/index.ts");
  if (!src) return { file: "src/router/index.ts", readable: false };
  const lines = src.split(/\r?\n/);
  const findRe = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l)) + 1;
  const start = findRe(/角色权限检查/);
  const warn = findRe(/您没有权限访问该页面/);
  const redirect = findRe(/next\(target\)/);
  return {
    file: "src/router/index.ts",
    readable: true,
    guardStartLine: start || null,
    warningLine: warn || null,
    redirectLine: redirect || null,
    cites: lines.slice(Math.max(0, (start || 1) - 1), Math.max(0, redirect || 0)).map((l, i) => ({ line: (start || 1) + i, text: l.trim().slice(0, 90) })).filter((x) => x.text),
  };
}
function walkVue(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name);
    const st = statSync(f);
    if (st.isDirectory()) walkVue(f, acc);
    else if (name.endsWith(".vue")) acc.push(f);
  }
  return acc;
}
/** 是否存在可复用的 unavailable/retry 组件（业务页若没有岛，这条决定它归 13C 还是 13B） */
function sharedUnavailableComponent() {
  const files = [...walkVue(path.join(WEB, "src", "components")), ...walkVue(path.join(WEB, "src", "layouts"))];
  const viewFiles = walkVue(path.join(WEB, "src", "views"));
  const found = [];
  for (const f of files) {
    const rel = f.replace(/\\/g, "/").split("/src/").pop();
    const src = readFileSync(f, "utf8");
    if (!/unavailable/i.test(src)) continue;
    const line = src.split(/\r?\n/).findIndex((l) => /unavailable/i.test(l)) + 1;
    const base = path.basename(f);
    found.push({
      file: `src/${rel}`,
      line,
      retryIsland: /retry|重试/.test(src),
      propDriven: /defineProps[\s\S]{0,900}(unavailable|state)/.test(src) || /withDefaults\([\s\S]{0,400}(unavailable|state)/.test(src),
      importedByBusinessViews: viewFiles.filter((v) => readFileSync(v, "utf8").includes(base.replace(".vue", "")) || readFileSync(v, "utf8").includes(`components/${rel}`)).length,
    });
  }
  return found;
}

/* ────────────────────────── 采集计划（页面模型派生，不手抄） ────────────────────────── */

function readJsonRequired(f, label) {
  if (!existsSync(f)) {
    console.error(`缺少 ${label}：${f}\n⇒ 先跑 tests/wb13b-proto-page-model.mjs（A1 交付）`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(f, "utf8"));
}
const model = readJsonRequired(MODEL_FILE, "原型页面模型");
const railKeyOf = new Map((model.catalogReconciliation ?? []).map((c) => [c.sectorKey, c.railKey]));
const BUSINESS_SECTORS = (model.model ?? []).map((s) => s.sectorKey).filter((k) => k !== "dash" && k !== "pos" && railKeyOf.get(k));
const POS_PATH = path.join(WEB, "src", "shared", "workbench", "manifest-pos.ts");
const POS_CASHIER = (() => {
  if (!existsSync(POS_PATH)) return null;
  const src = readFileSync(POS_PATH, "utf8");
  const line = src.split(/\r?\n/).find((l) => /web\.pos\.cashier/.test(l)) ?? "";
  const m = line.match(/item\("web\.pos\.cashier",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/);
  const imp = line.match(/import\("\.\.\/\.\.\/([^"]+)"\)/);
  if (!m) return null;
  return { viewKey: "pos-cashier", pageName: m[3], routeName: m[1], routePath: m[2], panelType: "pos", routeCompKey: imp?.[1] ?? null, line: src.split(/\r?\n/).indexOf(line) + 1 };
})();

const modulesWanted = (moduleFilter ?? BUSINESS_SECTORS).filter((k) => k === "pos" || (model.model ?? []).some((s) => s.sectorKey === k));
const plannedModules = modulesWanted.map((key) => {
  const sector = (model.model ?? []).find((s) => s.sectorKey === key);
  return { key, railKey: railKeyOf.get(key) ?? key, name: sector?.sectorName ?? key, sector };
});

/** 版式 ⇒ 该页应测的契约区域（取 PAGE_CONTRACT 的 impl 选择器；`__ROOT__` 交给读数根自身） */
function regionsFor(panelType) {
  return contractFor(panelType).map((r) => ({ key: r.key, selectors: (Array.isArray(r.impl) ? r.impl : [r.impl]).map((s) => String(s).replace(/^#(wbBody|wbView|wbWrap|wbTop|wbMain)\s+/, "")).filter((s) => s && s !== "__ROOT__") }));
}
/** POS 版式在 PAGE_CONTRACT 里只有 5 个通用区域（pos 不带 types ⇒ 刻意不是列表卡）；补收银台自有语汇 */
const POS_NATIVE_REGIONS = [
  { key: "posCashierRoot", selectors: [".pos-cashier"] },
  { key: "cashierWorkspace", selectors: [".cashier-workspace"] },
  { key: "categoryPanel", selectors: [".category-panel"] },
  { key: "productPanel", selectors: [".product-panel"] },
  { key: "productSearchbar", selectors: [".product-searchbar"] },
];

/* C.14 静态门禁的判定面：五条版式线必须各有自己的区域集 */
const C14_TYPES = ["list", "board", "form", "print", "pos"];
const c14RegionSets = Object.fromEntries(C14_TYPES.map((t) => [t, contractFor(t).map((r) => r.key)]));
const c14SetsDistinct = new Set(C14_TYPES.map((t) => c14RegionSets[t].join(","))).size === C14_TYPES.length;

/* ────────────────────────── 采集主流程 ────────────────────────── */

let browser = null;
const records = [];
const frames = [];
const violations = [];
const gaps = [];
let auth = null;

function pushRecord(rec) {
  /* 同 captureKey＝同一（模块/页面/视口/状态）读数 ⇒ 后写取代先写（写操作换候选、重试补帧都走这条），
     旧帧文件与同名新帧路径一致（shotName 只由这四元组决定），故不会留下孤儿帧。 */
  const dup = records.findIndex((r) => r.captureKey === rec.captureKey);
  if (dup >= 0) {
    const old = records[dup];
    records.splice(dup, 1);
    const fi = frames.findIndex((f) => f.captureKey === rec.captureKey);
    if (fi >= 0) frames.splice(fi, 1);
    if (old.shot && old.shot.own !== false && old.shot.file !== rec.shot?.file) log(`  · 取代旧读数帧：${old.shot.file}（captureKey ${rec.captureKey} 重采）`);
  }
  records.push(rec);
  if (rec.shot && rec.shot.own !== false) frames.push({ captureKey: rec.captureKey, file: rec.shot.file, sha256: rec.shot.sha256, moduleKey: rec.moduleKey, page: rec.pageKey, state: rec.state, viewport: rec.viewport });
  const line = `[${rec.viewport}] ${rec.moduleKey}/${rec.pageKey} · ${rec.state} ⇒ ${rec.status}${rec.shot ? ` (SHA ${rec.shot.sha256.slice(0, 10)}${rec.shot.own === false ? "·共用 unavailable 帧" : ""})` : ""}${rec.reason ? ` [${rec.reason}]` : ""}`;
  log(line);
  return rec;
}
const captureKeyOf = (m, p, vp, st) => `${m}/${p}@${vp}:${st}`;

function shotName(state, moduleKey, pageKey, vpId) {
  return SINGLE_VIEWPORT ? `state-${state}-${moduleKey}-${pageKey}.png` : `state-${state}-${moduleKey}-${pageKey}-${vpId}.png`;
}
async function snap(page, state, moduleKey, pageKey, vpId, meta = {}) {
  const file = path.join(OUT, "shots", shotName(state, moduleKey, pageKey, vpId));
  await page.screenshot({ path: file, fullPage: false });
  return fileShot(file, { ...meta, captureKey: captureKeyOf(moduleKey, pageKey, vpId, state) });
}

/**
 * rail 就绪判据必须盯**本模块那一项**：desk/set 是常驻真实项，「rail 上有真实项」并不代表 11 个业务
 * 模块位渲染出来了（menuState==="loading" 时 railModules=[] ⇒ 只剩 desk+set+骨架，见 WorkbenchShell.vue
 * 的 railModules/railSkeletons 互斥契约）。实测教训：旧判据 real.length>0 把「杀后端再重启」之后的第一次
 * 导航判成就绪 ⇒ 随后整模块 rail-entry-missing（假阻断）。
 * 返回 {ready, railHit, skeleton}，调用方按真实用户那样等到那一项出现才点。
 */
async function railReadyForModule(page, mod, degraded, steps) {
  const timeout = degraded ? 9000 : 40000;
  const t0 = Date.now();
  let railHit = { resolved: null, inventory: [] };
  while (Date.now() - t0 < timeout) {
    railHit = await page.evaluate(IMPL_RAIL_KEY_RESOLVER, { railKey: mod.railKey, moduleName: mod.name }).catch(() => ({ resolved: null, inventory: [] }));
    if (railHit.resolved) break;
    await page.waitForTimeout(300);
  }
  const skeleton = await page.evaluate(() => document.querySelectorAll('[data-testid="rail"] [data-rail-skeleton="true"]').length);
  if (steps) steps.push(`goto+rail[${mod.railKey}]=${railHit.resolved ? "yes" : degraded ? "no（后端已停，菜单桥回不来，rail 停在骨架位）" : "no"}（rail 骨架位=${skeleton}·可解析真实项=${railHit.inventory.length}·等待 ${Date.now() - t0}ms）`);
  return { ready: !!railHit.resolved, railHit, skeleton };
}

/**
 * 真实点击导航：goto（只用来复位到应用首页，不带 query 参数）⇒ rail 模块项 ⇒ 二级列卡片 ⇒ 行为门。
 * opts.onLanding：**入口点击落地后、等待静默之前**执行 ⇒ loading 档的在飞窗口从这里取（被动读 DOM）。
 * opts.degraded：后端已停时真实菜单桥必然回不来，rail 会停在骨架位；此时仍按真实用户那样点下去
 *                （骨架项的 @click 是应用自己实现的「记录进入意图」），并把 viaSkeleton 如实写进轨迹。
 */
async function navigateTo(page, mod, pg, vpId, ctx, opts = {}) {
  const degraded = opts.degraded === true;
  const steps = [];
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 40000 }).catch(() => null);
  const railProbe = await railReadyForModule(page, mod, degraded, steps);

  if (mod.key === "pos") {
    /* POS 不是 rail 模块（实测 rail 13 项＝desk + 11 业务 + set）⇒ 走顶栏胶囊这条真实人工路径 */
    const seg = page.locator('[data-mode-seg="pos"]');
    if ((await seg.count()) === 0) return { ok: false, reason: "pos-mode-seg-missing", detail: '顶栏工作台⇄收银台胶囊 [data-mode-seg="pos"] 不在 DOM 里', steps };
    await seg.first().click({ timeout: 8000 }).catch((e) => steps.push(`mode-seg 点击异常 ${String(e).slice(0, 80)}`));
    await page.waitForFunction((p) => location.pathname.startsWith(p), "/pos/", { timeout: 20000, polling: 250 }).catch(() => null);
    steps.push("mode-seg=pos ⇒ /pos/dashboard");
    const row = page.locator(`[data-testid="second-nav-real-zone"] .sn-row:has-text("${pg.cardLabel}")`).first();
    const row2 = page.locator(`[data-testid="second-nav-sub-zone"] .sn-card:has-text("${pg.cardLabel}"):not([disabled])`).first();
    const target = (await row.count()) > 0 ? row : (await row2.count()) > 0 ? row2 : null;
    if (!target) return { ok: false, reason: "pos-entry-unreachable", detail: `二级列里没有可点的「${pg.cardLabel}」行/卡`, steps, cards: await page.evaluate(SUBNAV_CARDS_READER).catch(() => null) };
    await target.click({ timeout: 8000 });
    steps.push(`click ${pg.cardLabel}`);
    if (opts.onLanding) await opts.onLanding(page);
  } else {
    /* railProbe.railHit 只含「非骨架」真实项；降级时 rail 停在骨架位（应用自己的加载占位），
       真实用户照样点得下去（@click=clickRailSkeleton 记录意图），所以 degraded 允许点到骨架项，
       并在轨迹里如实写 viaSkeleton —— 这不是注入，是页面自己实现的首击语义。 */
    const railHit = railProbe.railHit;
    const skelKey = degraded
      ? await page
          .evaluate(
            (payload) => {
              const el = document.querySelector(`[data-testid="rail"] [data-rail-skeleton="true"][data-rail-key="${payload.key}"]`) ?? document.querySelector(`[data-testid="rail"] [data-rail-skeleton="true"][data-rail-key="wb.${payload.key}"]`);
              return el?.getAttribute("data-rail-key") ?? null;
            },
            { key: mod.railKey },
          )
          .catch(() => null)
      : null;
    const usable = railHit.resolved ?? skelKey;
    if (!usable) {
      return { ok: false, reason: "rail-entry-missing", detail: `等待 ${degraded ? 9 : 40}s 后真实 rail 清单里仍解析不到模块「${mod.name}」（目录口径 railKey=${mod.railKey}；rail 骨架位=${railProbe.skeleton}·真实项=${railHit.inventory.length}）`, steps, live: railHit.inventory };
    }
    const railLoc = page.locator(`[data-testid="rail"] [data-rail-key='${usable}']`).first();
    await railLoc.click({ timeout: 8000 });
    steps.push(`rail=${usable}${railHit.resolved ? "" : "（骨架位真实点击：菜单桥断供时应用自己的意图记录，不跳转）"}`);
    ctx.domRailKey = usable;
    await page.waitForTimeout(degraded ? 1400 : 1000);
    let clicked = null;
    for (const label of pg.cardLabels.filter(Boolean)) {
      const row = page.locator(`[data-testid="second-nav-real-zone"] .sn-row:has-text("${label}")`).first();
      const card = page.locator(`[data-testid="second-nav-sub-zone"] [data-plan-label="${label}"]`).first();
      const cardEnabled = page.locator(`[data-testid="second-nav-sub-zone"] [data-plan-label="${label}"]:not([disabled])`).first();
      if ((await row.count()) > 0) { await row.click({ timeout: 8000 }); clicked = { via: "real-zone", label }; break; }
      if ((await cardEnabled.count()) > 0) { await cardEnabled.click({ timeout: 8000 }); clicked = { via: "sub-zone", label }; break; }
      if (degraded && (await card.count()) > 0) { await card.click({ timeout: 4000, force: false }).catch((e) => steps.push(`降级态卡 ${label} 点不下去：${String(e).split("\n")[0].slice(0, 80)}`)); clicked = { via: "sub-zone-degraded", label }; break; }
    }
    if (!clicked) {
      return {
        ok: false,
        reason: "second-nav-entry-unreachable",
        detail: `二级列里点不到「${pg.cardLabels.filter(Boolean).join("/")}」（该模块目录只有实数卡可点）`,
        steps,
        cards: await page.evaluate(SUBNAV_CARDS_READER).catch(() => null),
      };
    }
    steps.push(`card=${clicked.via}/${clicked.label}`);
    ctx.lastClicked = clicked;
    if (opts.onLanding) await opts.onLanding(page);
  }
  let gate = null;
  for (let round = 1; round <= 2; round++) {
    try {
      await page.waitForFunction(IMPL_PAINT_GATE, { routePath: pg.routePath }, { timeout: 15000, polling: 300 });
      gate = await page.evaluate(IMPL_PAINT_GATE, { routePath: pg.routePath });
      steps.push(`paint-gate ok（第 ${round} 轮）`);
      return { ok: true, gate, steps };
    } catch {
      gate = await page.evaluate(IMPL_PAINT_GATE, { routePath: pg.routePath }).catch(() => null);
      steps.push(`第 ${round} 轮行为门未过：${gate ? `manualShown=${gate.manualShown} root=${gate.pageRootClass ?? "∅"} box=${gate.pageRootBox ?? "∅"} title="${gate.title}" path=${gate.path}` : "读数抛错"}`);
    }
  }
  return { ok: false, reason: "paint-gate-failed", detail: `点击后业务页没画出来（预期 ${pg.routePath}）`, steps, gate };
}

/** 只把二级列打开（不要求业务页画出来）：无权限档观察面对象是二级列本身 */
async function openModuleColumn(page, mod, vpId) {
  const steps = [];
  await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 40000 }).catch(() => null);
  if (mod.key === "pos") {
    await page.locator('[data-mode-seg="pos"]').first().click({ timeout: 8000 }).catch(() => null);
    steps.push("mode-seg=pos");
  } else {
    const probe = await railReadyForModule(page, mod, false, steps);
    if (!probe.ready) return { ok: false, reason: "rail-entry-missing", detail: `真实 rail 清单里解析不到「${mod.name}」（rail 骨架位=${probe.skeleton}·真实项=${probe.railHit.inventory.length}）`, steps, live: probe.railHit.inventory };
    await page.locator(`[data-testid="rail"] [data-rail-key='${probe.railHit.resolved}']`).first().click({ timeout: 8000 });
    steps.push(`rail=${probe.railHit.resolved}`);
  }
  await page.waitForTimeout(1400);
  return { ok: true, steps };
}

const IMPL_ROOT_SELS = ['main[data-view="manual"].shown > *', ".page", ".pos-cashier"];
const WRITE_VERB_RE = "新建|新增|添加|创建|生成|编辑|修改|删除|审核|提交|结算|收款|付款|导入|保存|发货|退款|驳回|作废|停用|启用|上架|下架|派单|核销|签发|撤销";

async function readState(page, panelType) {
  const regions = panelType === "pos" ? [...regionsFor("pos"), ...POS_NATIVE_REGIONS] : regionsFor(panelType);
  return page.evaluate(MATRIX_READER, { rootSels: IMPL_ROOT_SELS, regions, writeVerbRe: WRITE_VERB_RE });
}

/** 区域几何索引（C.13 比对用）：{key: {exists, x, y, width, height}} */
function geom(read) {
  const out = {};
  for (const r of read.regions) out[r.key] = { exists: r.exists, x: r.rect?.x ?? null, y: r.rect?.y ?? null, width: r.rect?.width ?? null, height: r.rect?.height ?? null, sel: r.sel };
  if (read.paint.pageRootBox) out.__pageRoot = { exists: true, ...read.paint.pageRootBox };
  return out;
}
/** C.13 可测内核：筛选条/工具条/表头/看板/图表这些**控件位置**必须原位；内容行数（tableCell）另议 */
const PRESERVE_KEYS = ["filterBar", "toolbarActions", "tableWrap", "table", "tableHeadCell", "boardGrid", "chart", "pageCard", "formActions"];
function preservationCheck(readyRead, emptyRead, label) {
  const g0 = geom(readyRead);
  const g1 = geom(emptyRead);
  const rows = [];
  let worst = 0;
  let gated = 0;
  for (const key of PRESERVE_KEYS) {
    const a = g0[key];
    const b = g1[key];
    if (!a || !b) continue;
    if (a.exists && !b.exists) { rows.push({ key, metric: "exists", ready: true, [label]: false, delta: null, verdict: "jumped-out" }); continue; }
    if (!a.exists || !b.exists) { rows.push({ key, metric: "exists", ready: a.exists, [label]: b.exists, delta: null, verdict: "n/a" }); continue; }
    for (const metric of ["x", "width"]) {
      const d = Math.abs((a[metric] ?? 0) - (b[metric] ?? 0));
      gated += 1;
      worst = Math.max(worst, d);
      rows.push({ key, metric, ready: a[metric], [label]: b[metric], delta: d, verdict: d <= 1 ? "kept" : "moved" });
    }
  }
  return { gated, maxAbsDelta: worst, rows, bad: rows.filter((r) => r.verdict === "moved" || r.verdict === "jumped-out"), applicable: gated > 0 };
}

/** 状态记录缺件即判红（silent absence 不允许） */
function completenessCheck(rec) {
  const hasCapture = !!rec.shot;
  const hasHonestAbsence = rec.status !== "captured" && rec.reason && rec.owner && rec.followUp;
  if (hasCapture || hasHonestAbsence) return null;
  return { kind: "state-record-incomplete", moduleKey: rec.moduleKey, page: rec.pageKey, reason: `状态 ${rec.state} 既没有出帧，也没有 {reachable:false, reason, owner, followUp}（status=${rec.status}）` };
}

const OWNER = "墨（WORKBENCH-13B §三.C）";
const FOLLOWUP_DEFAULT = "WORKBENCH-13C：业务页状态机改造（loading/empty/unavailable+retry/error 常驻块/无权限 DOM 落点），逐条附本记录 file:line 证据";
function gap(moduleKey, pageKey, state, reason, detail, evidence, followUp = FOLLOWUP_DEFAULT) {
  const g = { moduleKey, page: pageKey, state, reason, detail, evidence, owner: OWNER, followUp };
  gaps.push(g);
  return g;
}

/* ────────────────────────── 逐状态驱动 ────────────────────────── */

async function driveHealthy(page, mod, pg, vpId, ctx) {
  const base = { moduleKey: mod.key, moduleName: mod.name, pageKey: pg.viewKey, pageName: pg.pageName, routePath: pg.routePath, panelType: pg.panelType, viewport: vpId, contractRegions: pg.regions, viewSource: pg.viewSource };
  /* loading 的在飞窗口必须在**入口点击落地那一刻**开始被动读：本机 mock 十来个毫秒就回来了，
     等静默之后再读必然得到「无加载态」的假结论。onLanding 就在这一条真实时间轴上跑。 */
  let loadingHit = null;
  const loadingSamples = [];
  const onLanding = async (p) => {
    if (!STATES.includes("loading")) return;
    for (let i = 0; i < 25; i++) {
      const r = await readState(p, pg.panelType).catch(() => null);
      if (!r) break;
      const affordance = r.loading.elLoadingMask > 0 ? ".el-loading-mask" : r.loading.elSkeleton > 0 ? ".el-skeleton" : r.loading.tableSkeleton > 0 ? ".table-skeleton" : r.loading.loadingButtons > 0 ? "button[is-loading]" : r.loading.ariaBusy > 0 ? "[aria-busy=true]" : null;
      loadingSamples.push({ i, affordance, path: r.paint.path, ...r.loading, rows: r.table.rows });
      if (affordance) {
        loadingHit = { affordance, sample: i, reading: r.loading, pathAtSample: r.paint.path, shot: await snap(p, "loading", mod.key, pg.viewKey, vpId, { panelType: pg.panelType }) };
        return;
      }
      await p.waitForTimeout(60);
    }
  };
  const nav = await navigateTo(page, mod, pg, vpId, ctx, { onLanding });
  if (!nav.ok) {
    for (const st of ["ready", "loading", "empty", "ready-again", "write"]) {
      if (!STATES.includes(st)) continue;
      const rec = pushRecord({ ...base, state: st, captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, st), status: "blocked", reason: nav.reason, detail: nav.detail, owner: OWNER, followUp: FOLLOWUP_DEFAULT, navSteps: nav.steps, liveRail: nav.live ?? null, liveCards: nav.cards ?? null });
      completenessCheck(rec);
    }
    return { ok: false, nav };
  }

  if (STATES.includes("loading")) {
    if (!loadingHit) {
      /* 在飞窗口里什么都没读到 ⇒ loading 在这一页**不可观测**：这是缺口，不是一帧。
         刻意不出 PNG —— 拿静默后的画面冒充 loading 正是 §四.4 禁止的假象；改记诚实缺件。 */
      const first = loadingSamples[0] ?? null;
      /* 源码面有没有 loading 语汇决定了这条缺口的性质：有 ⇒ 本机 mock 太快、窗口里量不到（结论未定，
         需真实慢网另测）；没有 ⇒ 这一页压根没写加载态（C.11 真缺失）。两者都记，不混成一句「没看到」。 */
      const srcHasLoading = (pg.viewEvidence?.hits?.loading ?? []).length > 0;
      const srcHits = (pg.viewEvidence?.hits?.loading ?? []).map((h) => `${h.needle}@${h.line}`).join(" ");
      pushRecord({
        ...base,
        state: "loading",
        captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "loading"),
        status: "unreachable",
        reason: srcHasLoading ? "loading-not-observable-on-local-mock" : "no-loading-affordance-in-source",
        detail: `${pg.pageName}（${pg.panelType}）在飞窗口轮询 ${loadingSamples.length} 拍（60ms/拍）未见 .el-loading-mask/.el-skeleton/.table-skeleton/:loading/aria-busy；源码面${srcHasLoading ? `有 loading 语汇（${srcHits}）⇒ 本机 mock 回得太快，量不到窗口不等于没有，需真实慢网另判` : "也没有 loading 语汇 ⇒ 这一页根本没写加载态（C.11 真缺失）"}。刻意不出 PNG（拿静默画面冒充 loading 是 §四.4 禁止的假象）`,
        owner: OWNER,
        followUp: srcHasLoading ? "WORKBENCH-13C：真实慢网（或真实大结果集）下复核 loading 窗口；本卡只声明「本机不可观测」" : FOLLOWUP_DEFAULT,
        reading: { affordance: "none", sourceHasLoadingAffordance: srcHasLoading, samples: loadingSamples.length, samplesDigest: loadingSamples.slice(0, 6), firstLoadingRead: first },
        evidence: pg.viewEvidence?.hits?.loading ?? [],
      });
      gap(mod.key, pg.viewKey, "loading", srcHasLoading ? "loading-window-unobservable-on-fast-mock" : "no-loading-affordance-in-source", `${pg.pageName}（${pg.panelType}）在真实导航的在飞窗口里没画出任何加载语汇（轮询 ${loadingSamples.length} 拍）；源码面${srcHasLoading ? "有（慢网另判）" : "也没有 ⇒ 真缺失"}`, pg.viewEvidence?.hits?.loading ?? []);
    } else {
      log(`  · loading 语汇=${loadingHit.affordance}（落地后第 ${loadingHit.sample} 拍）`);
      pushRecord({ ...base, state: "loading", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "loading"), status: "captured", shot: loadingHit.shot, reading: { affordance: loadingHit.affordance, loading: loadingHit.reading, samples: loadingSamples.length, samplesDigest: loadingSamples.slice(0, 6) }, evidence: pg.viewEvidence?.hits?.loading ?? [] });
    }
  }

  /* ── ready：等页面自己的请求回来并静默 ── */
  await page.waitForTimeout(1500);
  const readyRead = await readState(page, pg.panelType);
  const readyShot = await snap(page, "ready", mod.key, pg.viewKey, vpId, { panelType: pg.panelType, topTitle: readyRead.paint.topTitle });
  const ready = { ...base, state: "ready", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "ready"), status: "captured", shot: readyShot, reading: readyRead, paint: readyRead.paint, geometry: geom(readyRead), evidence: pg.viewEvidence?.hits?.ready ?? [] };
  pushRecord(ready);

  /* ── empty + ready-again：走页面自己的筛选 ── */
  let emptyRec = null;
  if (STATES.includes("empty")) {
    /* 候选优先取「搜索/关键字」语义的**可写文本框**：el-select/el-date-editor 里的 input 是只读的，
       fill 得抛错（真实用户也填不了），拿它当筛选控件等于伪造空态。 */
    const writable = readyRead.filterHosts.filter((f) => !f.disabled && !f.readOnly && !f.inSelect);
    const ranked = writable
      .map((f) => ({ f, score: /搜索|关键字|关键词|名称|单号|条码|手机|编号/.test(f.placeholder) ? 0 : 1 }))
      .sort((a, b) => a.score - b.score);
    const cand = ranked[0]?.f ?? null;
    if (!cand) {
      const readonlyish = readyRead.filterHosts.filter((f) => f.readOnly || f.inSelect);
      emptyRec = pushRecord({ ...base, state: "empty", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "empty"), status: "unreachable", reason: readyRead.filterHosts.length ? "only-readonly-or-select-filters" : "no-filter-control", detail: readonlyish.length
        ? `${pg.pageName} 页内 ${readyRead.filterHosts.length} 个筛选位全是只读/下拉（el-select、日期、级联：${readonlyish.slice(0, 3).map((f) => f.placeholder || "(无占位)").join(" / ")}），没有可输入的关键字框 ⇒ 空态经「填关键字」这条真实路径到不了（不伪造：不注入 class、不直接调页面函数）`
        : `${pg.pageName} 页内没有可用的文本筛选控件（filterHosts=${readyRead.filterHosts.length}）⇒ 无法经页面自己的控件真实到达空态`, owner: OWNER, followUp: FOLLOWUP_DEFAULT, reading: { filterHosts: readyRead.filterHosts, writableCount: writable.length } });
      gap(mod.key, pg.viewKey, "empty", readyRead.filterHosts.length ? "no-keyword-filter-control" : "no-filter-control", String(emptyRec.detail), pg.viewEvidence?.hits?.empty ?? []);
    } else {
      const nonce = "WB13B不可能命中的关键字ZZ9";
      const before = { rows: readyRead.table.rows, resultCounts: await page.evaluate(RESULT_COUNT_READER) };
      let inputLoc = page.locator(`${cand.hostCls ? `.${String(cand.hostCls).trim().split(/\s+/)[0]}` : "main"} input`).first();
      const byPlaceholder = cand.placeholder ? page.locator(`main input[placeholder="${cand.placeholder}"]`).first() : null;
      if (byPlaceholder && (await byPlaceholder.count()) > 0) inputLoc = byPlaceholder;
      try {
        await inputLoc.fill(nonce);
      } catch (e) {
        emptyRec = pushRecord({ ...base, state: "empty", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "empty"), status: "unreachable", reason: "filter-input-not-fillable", detail: `${pg.pageName} 选中的筛选框真实 fill 失败（${String(e).split("\n")[0].slice(0, 120)}）⇒ 空态经页面自己的控件到不了`, owner: OWNER, followUp: FOLLOWUP_DEFAULT, reading: { control: cand } });
        gap(mod.key, pg.viewKey, "empty", "filter-input-not-fillable", String(emptyRec.detail), pg.viewEvidence?.hits?.empty ?? []);
      }
      if (emptyRec?.status === "unreachable") {
        if (STATES.includes("ready-again")) pushRecord({ ...base, state: "ready-again", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "ready-again"), status: "unreachable", reason: "empty-not-reached", detail: "empty 没到达 ⇒ 无从谈「清筛选回到 ready」", owner: OWNER, followUp: FOLLOWUP_DEFAULT });
      } else {
      await inputLoc.press("Enter").catch(() => null);
      const qbtn = readyRead.queryButtons.find((b) => !b.disabled);
      if (qbtn) await page.locator(`main button:has-text("${qbtn.text}")`).first().click({ timeout: 4000 }).catch(() => null);
      await page.waitForTimeout(1800);
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null);
      await page.waitForTimeout(400);
      const emptyRead = await readState(page, pg.panelType);
      const after = await page.evaluate(RESULT_COUNT_READER);
      const emptyAffordance = emptyRead.islands.filter((i) => i.family === "empty");
      /* 空态成立＝结果面真的归零（表格行＋卡片，看板列不算数据结果）或页面画出了自己的 empty 岛；
         只有「填了字但行数没变」时**不能**叫 empty（那还是 ready 的画面，出帧就是假证据）。 */
      const beforeTotal = before.resultCounts.tableRows + before.resultCounts.productCards;
      const afterTotal = after.tableRows + after.productCards;
      const clearedResult = beforeTotal > 0 && afterTotal === 0;
      const reachedEmpty = clearedResult || emptyAffordance.length > 0;
      if (!reachedEmpty) {
        emptyRec = pushRecord({
          ...base,
          state: "empty",
          captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "empty"),
          status: "unreachable",
          reason: beforeTotal === 0 ? "no-observable-result-surface" : "filter-did-not-yield-empty",
          detail:
            beforeTotal === 0
              ? `${pg.pageName} 的结果面在 ready 帧上就没有可数的表格行/商品卡（tableRows=${before.resultCounts.tableRows}·productCards=${before.resultCounts.productCards}），筛选后也没画出 empty 岛 ⇒ 空态在这一页没有可观测落点`
              : `${pg.pageName} 填入必然不命中的关键字并走页面自己的查询（${qbtn ? `点「${qbtn.text}」` : "真实回车"}）后结果面没归零（${beforeTotal}⇒${afterTotal}），页内也没有 empty 岛 ⇒ 该查询没接关键字（或不走服务端），空态经真实交互到不了`,
          owner: OWNER,
          followUp: FOLLOWUP_DEFAULT,
          reading: { keywordMatched: clearedResult, resultCountsBefore: before.resultCounts, resultCountsAfter: after, emptyAffordance: [], reachedBy: { control: { placeholder: cand.placeholder, hostCls: cand.hostCls }, pressedQueryButton: qbtn?.text ?? null } },
          evidence: pg.viewEvidence?.hits?.empty ?? [],
        });
        gap(mod.key, pg.viewKey, "empty", beforeTotal === 0 ? "no-observable-empty-landing" : "filter-not-keyed", String(emptyRec.detail), pg.viewEvidence?.hits?.empty ?? []);
        if (STATES.includes("ready-again")) {
          pushRecord({ ...base, state: "ready-again", captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "ready-again"), status: "unreachable", reason: "empty-not-reached", detail: "empty 没到达 ⇒ 无从谈「清筛选回到 ready」；本页 ready 帧即健康态", owner: OWNER, followUp: FOLLOWUP_DEFAULT });
        }
      } else {
      const emptyShot = await snap(page, "empty", mod.key, pg.viewKey, vpId, { panelType: pg.panelType, queryNonceRedacted: "«nonce»" });
      const pres = preservationCheck(readyRead, emptyRead, "empty");
      emptyRec = pushRecord({
        ...base,
        state: "empty",
        captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "empty"),
        status: "captured",
        shot: emptyShot,
        reachedBy: { control: { placeholder: cand.placeholder, hostCls: cand.hostCls }, pressedQueryButton: qbtn?.text ?? null },
        reading: {
          keywordMatched: clearedResult,
          resultCountsBefore: before.resultCounts,
          resultCountsAfter: after,
          emptyAffordance: emptyAffordance.map((e) => ({ key: e.key, text: e.text, rect: e.rect })),
          layoutPreservation: pres,
          controlsStillThere: emptyRead.filterHosts.length,
        },
        geometry: geom(emptyRead),
        evidence: pg.viewEvidence?.hits?.empty ?? [],
      });
      if (pres.applicable && pres.bad.length) {
        violations.push({ kind: "layout-jump-on-empty", moduleKey: mod.key, page: pg.viewKey, reason: `C.13：空态下控件位置没保住 —— ${pres.bad.map((b) => `${b.key}.${b.metric}${b.verdict === "jumped-out" ? "(整块消失)" : ` Δ${b.delta}px`}`).join(", ")}`, detail: pres.bad });
      }
      if (!emptyAffordance.length && clearedResult) {
        gap(mod.key, pg.viewKey, "empty", "no-empty-affordance", `${pg.pageName} 结果集真被清空了（${before.rows}⇒${after.tableRows} 行）但页内没有 el-empty/empty-state 常驻空态 ⇒ §四.4「空态可见」不成立`, pg.viewEvidence?.hits?.empty ?? []);
      }

      /* 恢复：清空再查一次（真实交互），并要求几何回到 ready */
      if (STATES.includes("ready-again")) {
        await inputLoc.fill("");
        await inputLoc.press("Enter").catch(() => null);
        if (qbtn) await page.locator(`main button:has-text("${qbtn.text}")`).first().click({ timeout: 4000 }).catch(() => null);
        await page.waitForTimeout(1800);
        await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => null);
        const againRead = await readState(page, pg.panelType);
        const againShot = await snap(page, "ready-again", mod.key, pg.viewKey, vpId, { panelType: pg.panelType });
        const recovery = preservationCheck(readyRead, againRead, "readyAgain");
        pushRecord({
          ...base,
          state: "ready-again",
          captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "ready-again"),
          status: "captured",
          shot: againShot,
          reading: { resultCounts: await page.evaluate(RESULT_COUNT_READER), recoveryVsReady: recovery, rows: againRead.table.rows },
          geometry: geom(againRead),
          evidence: [],
        });
        if (recovery.applicable && recovery.bad.length) {
          violations.push({ kind: "recovery-geometry-mismatch", moduleKey: mod.key, page: pg.viewKey, reason: `C.13：清筛选后几何没回到 ready（≤±1px 口径） —— ${recovery.bad.map((b) => `${b.key}.${b.metric} Δ${b.delta ?? "∅"}px`).join(", ")}`, detail: recovery.bad });
        }
      }
      }
      }
    }
  }

  /* ── write：真点开写操作面，只取消不提交 ── */
  if (STATES.includes("write")) {
    await driveWrite(page, { ...base, panelType: pg.panelType, viewEvidence: pg.viewEvidence }, readyRead, { renavigate: async (p) => navigateTo(p, mod, pg, vpId, ctx) });
  }
  return { ok: true, nav, readyRead, emptyRec };
}

/**
 * C.12 写操作面：真点页面自己的写控件 ⇒ 等页面自己的确认面弹出 ⇒ 量点击时刻的 disabled/:loading
 * ⇒ 只取消/关闭，绝不提交。一个控件点了没弹出面（直接改本地状态/直接执行）不能叫「确认框」，
 * 所以这里按候选**逐个真试**（最多 3 个，每次换候选都用真实点击导航回这一页复位），
 * 全部没面才诚实记 unreachable；每一次尝试都留证（控件名/本地行数变化/有没有 unsafe 请求出去）。
 * ctx.renavigate：调用方给的回页函数（同一条真实点击语法，不是 goto 到业务路由）。
 */
const SURFACE_KINDS = [["el-dialog", "dialog"], ["el-message-box", "messagebox"], ["el-drawer", "drawer"], ["el-popconfirm", "popconfirm"], ["el-popover", "popover"]];
const surfaceKey = (kind) => SURFACE_KINDS.find(([k]) => k === kind)?.[1] ?? "dialog";
async function detectSurface(page, panelType) {
  let surface = (await readState(page, panelType)).overlays;
  let kind = SURFACE_KINDS.find(([k, key]) => surface[key]?.exists)?.[0] ?? null;
  if (!kind) {
    await page.waitForTimeout(1200);
    surface = (await readState(page, panelType)).overlays;
    kind = SURFACE_KINDS.find(([k, key]) => surface[key]?.exists)?.[0] ?? null;
  }
  /* el-popover 常被筛选下拉借用：面上没有任何「确定/保存/提交」按钮时不当它是写操作确认面 */
  if (kind === "el-popover") {
    const btns = surface.popover.confirmButtons ?? [];
    if (!btns.some((b) => /确定|保存|提交|确认/.test(b.text))) kind = null;
  }
  return { surface, kind };
}

async function driveWrite(page, base, readyRead, ctx = {}) {
  const writeBtns = readyRead.writeButtons ?? [];
  const candidates = writeBtns.filter((b) => !b.disabled);
  if (!candidates.length) {
    const unlabeled = readyRead.unlabeledRowActions ?? [];
    const allDisabled = !unlabeled.length && writeBtns.length > 0;
    /* 三桶必须分开（实测教训：收银台的写操作面是「结算¥0.00 disabled + 清空 disabled」，
       笼统写成「没有可用写控件」会把 C.12 已经拿到的**禁用态**证据说成没证据。
       禁用态是卡 §三.C.12 明列要核对的一项，必须点名；只有确认框/提交中/失败反馈才真的到不了
       （要它们就得真提交，越「只开不提交」红线）。 */
    pushRecord({ ...base, state: "write", captureKey: captureKeyOf(base.moduleKey, base.pageKey, base.viewport, "write"), status: "unreachable", reason: unlabeled.length ? "only-unlabeled-icon-write-controls" : allDisabled ? "write-controls-exist-but-all-disabled" : "no-enabled-write-control", detail: unlabeled.length
      ? `该页可见按钮 ${readyRead.allButtons.length} 个，其中 ${unlabeled.length} 个是行内**无文字无 title/aria-label** 的图标按钮：语义不可判定，刻意不点（盲点可能直接执行写操作，越「只开不提交」红线）⇒ C.12 的确认框/提交中在这一页量不到，是缺口不是通过`
      : allDisabled
        ? `该页写动词控件确实存在且全部处于禁用态（${writeBtns.map((b) => `「${b.text || b.label || "(图标)"}」disabled`).join("、")}）⇒ C.12 的**禁用态**已由 ready 帧与 disabled 读数核实；确认框/提交中/失败反馈需要真提交，越红线不点 ⇒ 交人工兜底（位置见 gap）；行内图标按钮 ${unlabeled.length} 个`
        : `该页可见按钮 ${readyRead.allButtons.length} 个，没有命中写操作动词且可用的控件（动词面：${WRITE_VERB_RE.slice(0, 20)}…）；行内图标按钮 ${unlabeled.length} 个`, owner: OWNER, followUp: FOLLOWUP_DEFAULT, reading: { buttons: readyRead.allButtons.map((b) => ({ text: b.text, label: b.label, inRow: b.inRow, disabled: b.disabled })), disabledWriteControls: writeBtns, unlabeledRowActions: unlabeled } });
    gap(base.moduleKey, base.pageKey, "write", unlabeled.length ? "unlabeled-icon-write-controls" : allDisabled ? "write-control-disabled-need-human-submit" : "no-write-control", `写操作面在 ${base.pageName} ${unlabeled.length ? `只有 ${unlabeled.length} 个无标签图标按钮（不可判定语义，刻意不点）` : allDisabled ? `只有禁用态写控件（${writeBtns.map((b) => b.text || "(图标)").join("、")}）⇒ 禁用态已核实，确认框/提交中/失败反馈必须人工带数据真提交才能看（人工兜底位置＝该页写控件区，需先把业务数据填到可提交）` : "没有任何命中写动词的可用控件"} ⇒ C.12 部分核对`, base.viewEvidence?.hits?.write ?? []);
    return { found: false };
  }
  const attempts = [];
  for (const wbtn of candidates.slice(0, 3)) {
    if (attempts.length && ctx.renavigate) {
      const back = await ctx.renavigate(page).catch((e) => ({ ok: false, reason: "renavigate-threw", detail: String(e).slice(0, 120) }));
      if (!back?.ok) { attempts.push({ control: wbtn.text, tried: false, note: `回页失败（${back?.reason}）⇒ 后续候选没继续点，避免在错页上读数` }); break; }
    }
    const writesBefore = netWrites.length;
    const before = await page.evaluate(RESULT_COUNT_READER);
    const btnSel = wbtn.text ? `main button:has-text("${wbtn.text}")` : `main button[title="${wbtn.label}"], main button[aria-label="${wbtn.label}"]`;
    try {
      await page.locator(btnSel).first().click({ timeout: 6000 });
    } catch (e) {
      attempts.push({ control: wbtn.text, tried: false, clickError: String(e).split("\n")[0].slice(0, 120) });
      continue;
    }
    await page.waitForTimeout(900);
    const { surface, kind: active } = await detectSurface(page, base.panelType);
    if (!active) {
      const afterNoSurface = await page.evaluate(RESULT_COUNT_READER);
      const firedWrites = netWrites.slice(writesBefore);
      attempts.push({
        control: wbtn.text,
        tried: true,
        surface: null,
        localRowsBefore: { tableRows: before.tableRows, productCards: before.productCards },
        localRowsAfter: { tableRows: afterNoSurface.tableRows, productCards: afterNoSurface.productCards },
        unsafeRequestsFired: firedWrites.map((w) => `${w.method} ${w.url}`),
        verdict: "点了没弹确认面 ⇒ 该控件直接执行/直接改本地状态，C.12 的「确认框」在它身上不存在",
      });
      await page.keyboard.press("Escape").catch(() => null);
      continue;
    }
    const key = surfaceKey(active);
    const conf = surface[key].confirmButtons ?? [];
    const cancel = surface[key].cancelButtons ?? [];
    const confirmAtClick = conf.map((c) => ({ text: c.text, disabled: c.disabled, loadingClass: c.loadingClass, ariaBusy: c.ariaBusy, hasSpinner: c.hasSpinner }));
    const shot = await snap(page, "write", base.moduleKey, base.pageKey, base.viewport, { panelType: base.panelType, control: wbtn.text, surface: active });
    /* 只取消/关闭，绝不提交（mock 数据一行都不许动） */
    let closedBy = null;
    if (cancel.length) { await page.locator(`.el-overlay button:has-text("${cancel[0].text}")`).first().click({ timeout: 4000 }).catch(() => null); closedBy = `页面自己的「${cancel[0].text}」按钮`; }
    else { await page.keyboard.press("Escape"); closedBy = "Escape（真实键盘）"; }
    await page.waitForTimeout(900);
    const after = await page.evaluate(RESULT_COUNT_READER);
    const firedWrites = netWrites.slice(writesBefore);
    const postSurface = (await readState(page, base.panelType)).overlays;
    const backToReady = postSurface.overlayCount === 0 && (await page.evaluate(IMPL_PAINT_GATE, { routePath: base.routePath }))?.ok === true;
    pushRecord({
      ...base,
      state: "write",
      captureKey: captureKeyOf(base.moduleKey, base.pageKey, base.viewport, "write"),
      status: "captured",
      shot,
      reading: {
        control: wbtn,
        attempts,
        surface: active,
        surfaceHeader: surface[key].header ?? null,
        confirmButtonsAtClick: confirmAtClick,
        /* 提交中可观测性：确认按钮没有任何 loading 语汇 ⇒ 「提交中」态在 MessageBox 里量不到，是发现不是笔误 */
        submittingObservable: confirmAtClick.some((c) => c.loadingClass || c.hasSpinner || c.ariaBusy === "true"),
        disabledStateObserved: confirmAtClick.some((c) => c.disabled),
        closedBy,
        recoveredToReady: backToReady,
        resultCountsBefore: before,
        resultCountsAfter: after,
        /* 「没改数据」的硬证据＝取消前后没有任何 unsafe 请求出浏览器；本地行数变化只作旁证 */
        unsafeRequestsFired: firedWrites.map((w) => `${w.method} ${w.url}`),
        noMutation: firedWrites.length === 0 && before.tableRows === after.tableRows,
        localRowsChanged: before.tableRows !== after.tableRows || before.productCards !== after.productCards,
      },
      evidence: base.viewEvidence?.hits?.write ?? [],
    });
    if (!confirmAtClick.length) {
      gap(base.moduleKey, base.pageKey, "write", "no-confirm-button-on-surface", `${wbtn.text} 打开的是 ${active}，面上没有确认按钮读数 ⇒ C.12「确认框」不可测`, base.viewEvidence?.hits?.write ?? []);
    } else if (!confirmAtClick.some((c) => c.loadingClass || c.hasSpinner || c.ariaBusy === "true")) {
      gap(base.moduleKey, base.pageKey, "write", "submitting-state-unobservable", `确认按钮（${confirmAtClick.map((c) => c.text).join("/")}）在点击时刻没有 :loading/is-loading/aria-busy ⇒ 「提交中」态不可观测（ElMessageBox 不接 confirmButtonProps）`, base.viewEvidence?.hits?.write ?? []);
    }
    if (attempts.length) {
      gap(base.moduleKey, base.pageKey, "write", "write-control-without-confirm", `${attempts.map((a) => a.control).join("/")} 这些写控件点下去不弹确认面（直接执行或直接改本地状态）；本页最终用「${wbtn.text}」测到弹层 ⇒ C.12 的确认框对前者不成立`, base.viewEvidence?.hits?.write ?? []);
    }
    return { found: true, surface: active, control: wbtn.text, attempts };
  }
  /* 三个候选都没有确认面 ⇒ 写操作态在这一页不可观测（附每次尝试的实测） */
  pushRecord({
    ...base,
    state: "write",
    captureKey: captureKeyOf(base.moduleKey, base.pageKey, base.viewport, "write"),
    status: "unreachable",
    reason: "no-confirm-surface-on-any-write-control",
    detail: `${base.pageName} 上 ${attempts.length} 个可用写控件（${attempts.map((a) => a.control).join("/")}）逐个真点过，没有一个弹出 el-dialog/el-message-box/el-drawer/el-popconfirm ⇒ C.12 的「确认框/禁用态/提交中」在这一页没有可观测落点`,
    owner: OWNER,
    followUp: FOLLOWUP_DEFAULT,
    reading: { attempts, tried: attempts.length, candidateCount: candidates.length },
    evidence: base.viewEvidence?.hits?.write ?? [],
  });
  gap(base.moduleKey, base.pageKey, "write", "no-confirm-surface", `${base.pageName} 逐个真点 ${attempts.length}/${Math.min(candidates.length, 3)} 个写控件都没有弹出确认面 ⇒ C.12 无法核对确认框与提交中`, base.viewEvidence?.hits?.write ?? []);
  return { found: false, attempts };
}

/** 真降级：杀后端 ⇒ 真实点击导航 ⇒ 页面自己的请求 ERR_CONNECTION_REFUSED ⇒ unavailable/error 双读数 */
async function driveDegraded(page, mod, pg, vpId, ctx) {
  if (!pg.primary) return;
  const base = { moduleKey: mod.key, moduleName: mod.name, pageKey: pg.viewKey, pageName: pg.pageName, routePath: pg.routePath, panelType: pg.panelType, viewport: vpId, contractRegions: pg.regions, viewSource: pg.viewSource };
  const failuresBefore = netFailures.length;
  const killedAt = new Date().toISOString();
  if (backendEntry) {
    killTree(backendEntry.child, backendEntry.label);
    children.splice(children.indexOf(backendEntry), 1);
    backendEntry = null;
  }
  const portDown = await waitForPort(BACKEND_PORT, false, 20000);
  const alsoFreed = await forceFreePort(BACKEND_PORT);
  log(`  · 后端已真实停止（${killedAt}）：端口 ${BACKEND_PORT} DOWN=${portDown}/forceFree=${alsoFreed}`);
  const nav = await navigateTo(page, mod, pg, vpId, ctx, { degraded: true });
  await page.waitForTimeout(2500);
  const reading = await readState(page, pg.panelType);
  const newFailures = netFailures.slice(failuresBefore);
  const refused = newFailures.filter((f) => /ERR_CONNECTION_REFUSED|ERR_NETWORK|ECONNREFUSED/i.test(f.error));
  const inPageUnavailable = reading.islands.filter((i) => i.family === "unavailable");
  const shellIslands = reading.islands.filter((i) => i.key === "wb-menu-empty" || i.key === "sn-unavailable");
  const pageRetry = reading.retryControls.concat(inPageUnavailable.filter((i) => i.isRetryControl).map((i) => ({ text: i.text, sel: i.sel, rect: i.rect })));
  /* 导航门未过但应用画出了自己的不可得面（.wb-menu-empty / .sn-unavailable）⇒ 这就是真实降级结果，
     按 captured 记（附 pagePainted:false + viaShellIsland），不把「应用确实给了岛」洗成阻断。 */
  const statusOf = (navOk) => (navOk ? "captured" : shellIslands.length || inPageUnavailable.length ? "captured" : "blocked");

  /* unavailable 帧 */
  let unavailableShot = null;
  let postRetry = false;
  let degradedReading = reading;
  if (STATES.includes("unavailable")) {
    unavailableShot = await snap(page, "unavailable", mod.key, pg.viewKey, vpId, { panelType: pg.panelType, backendDown: true });
    const st = statusOf(nav.ok);
    const rec = pushRecord({
      ...base,
      state: "unavailable",
      captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "unavailable"),
      status: st,
      shot: unavailableShot,
      degrade: { method: "kill-mock-backend-process", backendPort: BACKEND_PORT, portDown, killedAt, requestFailures: newFailures.slice(0, 8), connectionRefusedCount: refused.length },
      reading: {
        navSteps: nav.steps,
        pagePainted: nav.ok,
        viaShellIsland: !nav.ok && (shellIslands.length > 0 || inPageUnavailable.length > 0),
        inPageUnavailableIslands: inPageUnavailable,
        retryControls: pageRetry,
        shellIslands,
        paint: reading.paint,
        resultCounts: await page.evaluate(RESULT_COUNT_READER),
        fakeBusinessData: false,
      },
      evidence: pg.viewEvidence?.hits?.unavailable ?? [],
      ...(st === "captured" ? {} : { reason: nav.reason, detail: nav.detail, owner: OWNER, followUp: FOLLOWUP_DEFAULT }),
    });
    if (!inPageUnavailable.length) {
      gap(mod.key, pg.viewKey, "unavailable", "no-in-page-unavailable-island", `后端进程真停（${refused.length} 条请求 ERR_CONNECTION_REFUSED）后，${pg.pageName} 页内没有任何 unavailable/retry 岛（只 ${shellIslands.length ? "有壳层 .wb-menu-empty/.sn-unavailable" : "什么都没有"}）⇒ C.13 要求的「保留布局 + 真实 unavailable/retry」在这一页不成立`, pg.viewEvidence?.hits?.unavailable ?? []);
    }
    /* 有真实重试控件就真点它，记录点下去发生了什么 */
    if (pageRetry.length) {
      const failesBeforeRetry = netFailures.length;
      let clickResult = null;
      const retryLoc = pageRetry[0].text ? page.locator(`button:has-text("${pageRetry[0].text}")`).first() : page.locator(pageRetry[0].sel).first();
      try {
        await retryLoc.click({ timeout: 6000 });
        clickResult = { clicked: true, text: pageRetry[0].text };
      } catch (e) {
        clickResult = { clicked: false, error: String(e).split("\n")[0].slice(0, 140) };
      }
      await page.waitForTimeout(2000);
      const afterRetryFailures = netFailures.slice(failesBeforeRetry);
      const afterRetryReading = await readState(page, pg.panelType);
      rec.reading.retryAttempt = {
        ...clickResult,
        control: pageRetry[0],
        requestsFiredByRetry: afterRetryFailures.length,
        stillRefused: afterRetryFailures.filter((f) => /ERR_CONNECTION_REFUSED|ERR_NETWORK/i.test(f.error)).length,
        islandAfterRetry: afterRetryReading.islands.filter((i) => i.family === "unavailable").length,
        outcome: afterRetryFailures.length > 0 ? "真实重发请求（仍然失败，岛保留）⇒ 重试是真接线不是装饰" : clickResult.clicked ? "点击成功但没有新请求 ⇒ 重试控件不真触发" : "点不下去",
      };
      /* 重试点下去以后 DOM 是**另一个瞬间**（新的失败请求/新的岛状态）：这一帧留给 error 档当自己的帧，
         不再另存 unavailable-retry，避免同画面两个文件名（= 伪造「两个状态各有独立证据」）。 */
      postRetry = clickResult.clicked;
      if (postRetry && !STATES.includes("error")) {
        const retryShot = await snap(page, "unavailable-retry", mod.key, pg.viewKey, vpId, { panelType: pg.panelType });
        frames.push({ captureKey: `${rec.captureKey}:retry`, file: retryShot.file, sha256: retryShot.sha256, moduleKey: mod.key, page: pg.viewKey, state: "unavailable-retry", viewport: vpId });
      }
      if (postRetry) degradedReading = afterRetryReading;
    }
  }

  /* error 帧：同一次降级的第二问 —— 常驻错误块 vs 一闪而过的 toast */
  if (STATES.includes("error")) {
    const inPageError = degradedReading.islands.filter((i) => i.family === "error");
    const toasts = degradedReading.toasts;
    /* 没真点过重试 ⇒ error 与 unavailable 是**同一个 DOM 瞬间**的两个问题：共用一帧并写明 sharedWith，
       绝不复制一份同 SHA 的文件冒充「error 也有自己的帧」。 */
    let shot = postRetry || !unavailableShot
      ? await snap(page, "error", mod.key, pg.viewKey, vpId, { panelType: pg.panelType, backendDown: true, frameMoment: postRetry ? "after-real-retry-click" : "error-only-run", surface: inPageError.length ? "in-page" : toasts.length ? "toast" : "none" })
      : { ...unavailableShot, own: false, sharedWith: "unavailable", frameMoment: "same-dom-as-unavailable" };
    /* 真点过重试但画面逐字节未变（重发请求仍失败 ⇒ 岛还是那一块）：此时另存一张 error 文件＝伪造「两个状态各有独立证据」。
       删掉重复帧、并入 unavailable 帧，并把「渲染相同」写进读数里，而不是让帧台账自己判红。 */
    if (shot.own !== false && unavailableShot && shot.sha256 === unavailableShot.sha256) {
      rmSync(path.join(OUT, shot.file), { force: true });
      log(`  · 重试后渲染逐字节相同（SHA ${shot.sha256.slice(0, 10)}）⇒ 不另存 error 帧，并入 unavailable 帧并写明 renderIdenticalToUnavailable`);
      shot = { ...unavailableShot, own: false, sharedWith: "unavailable", frameMoment: "retry-clicked-render-identical", renderIdenticalToUnavailable: true };
    }
    const st = statusOf(nav.ok);
    const rec = pushRecord({
      ...base,
      state: "error",
      captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "error"),
      status: st,
      shot,
      reading: {
        surface: inPageError.length ? "in-page" : toasts.length ? "toast" : "none",
        pagePainted: nav.ok,
        frameMoment: postRetry ? "after-real-retry-click" : "same-dom-as-unavailable",
        inPageErrorBlocks: inPageError,
        /* toast 永远记成 toast，绝不当成「页面有错误态」（§四.4 不许用假反馈遮挡） */
        toasts: toasts.map((t) => ({ surface: "toast", kind: t.kind, text: t.text })),
        toastOnly: !inPageError.length && toasts.length > 0,
        connectionRefusedCount: refused.length,
      },
      evidence: pg.viewEvidence?.hits?.error ?? [],
      ...(st === "captured" ? {} : { reason: nav.reason, detail: nav.detail, owner: OWNER, followUp: FOLLOWUP_DEFAULT }),
    });
    if (rec.reading.surface === "none") gap(mod.key, pg.viewKey, "error", "no-error-surface-at-all", `后端真停后 ${pg.pageName} 既没有常驻错误块也没有抓到 toast ⇒ 失败完全不可见（§四.4）`, pg.viewEvidence?.hits?.error ?? []);
    else if (rec.reading.toastOnly) gap(mod.key, pg.viewKey, "error", "toast-only-error", `${pg.pageName} 的错误反馈只有一闪而过的 toast（${toasts.map((t) => t.text).join(" / ").slice(0, 60) || "已消失"}），页内没有可停留的 error 块 ⇒ C.11 的 error 态不成立`, pg.viewEvidence?.hits?.error ?? []);
    if (inPageError.length && toasts.length) rec.reading.note = "同帧同时存在常驻错误块与 toast（两者不冲突，门禁只认前者）";
  }

  /* 后端恢复：必须真起来，不然后续分块与收尾标记都不算数 */
  await startBackend("backend-重启(降级后)");
  const backUp = await waitForPort(BACKEND_PORT, true, 60000);
  log(`  · 后端已恢复（端口应答=${backUp}）`);
  if (!backUp) violations.push({ kind: "backend-not-restored", moduleKey: mod.key, page: pg.viewKey, reason: `降级采集后端口 ${BACKEND_PORT} 未在 60s 内重新应答 ⇒ 后续状态不可信` });
  /* 会话续期 + rail 自愈核对：旧 token 在新进程里必然 401（拦截器 clearAuth ⇒ rail 塌成只剩 desk），
     所以降级档之后一定要用真实登录接口换一个新会话，再确认真的 rail 项回得来。 */
  const renewal = backUp ? await renewSession(page.context(), page, `${mod.key}/${pg.viewKey} 降级后重启后端`) : null;
  let healed = null;
  if (backUp && mod.key !== "pos") {
    healed = await railReadyForModule(page, mod, false, null);
    if (!healed.ready) {
      violations.push({ kind: "degraded-recovery-incomplete", moduleKey: mod.key, page: pg.viewKey, reason: `后端重启+会话续期后 rail 仍解析不到「${mod.name}」（真实项=${healed.railHit.inventory.length}·骨架位=${healed.skeleton}）⇒ 降级不可恢复，本片后续结论作废`, detail: healed.railHit.inventory });
    }
  }
  ctx.degraded = { portDown, refused: refused.length, backUp, sessionRenewal: renewal, railHealed: healed ? healed.ready : "n/a(pos)" };
}

/** 无权限可观测代理：二级列 disabled/待接入 卡真点一次，记录它惰性（不伪造 403） */
async function driveNoPermission(page, mod, pg, vpId, ctx) {
  if (!pg.primary) return;
  const base = { moduleKey: mod.key, moduleName: mod.name, pageKey: pg.viewKey, pageName: pg.pageName, routePath: pg.routePath, panelType: pg.panelType, viewport: vpId, contractRegions: pg.regions, viewSource: pg.viewSource };
  const nav = await openModuleColumn(page, mod, vpId).catch((e) => ({ ok: false, reason: "open-module-column-threw", detail: String(e).slice(0, 160), steps: [] }));
  /* 本档的观察面对象是**二级列**：无权限态在页体内没有落点（守卫重定向），所以不进业务页也照样出证 */
  const cards = await page.evaluate(SUBNAV_CARDS_READER).catch(() => null);
  const inert = (cards?.cards ?? []).filter((c) => c.disabled || c.status === "pending" || c.hasPendingWord);
  /* 二级列没打开就不出帧（出帧等于把别的模块的列当成自己的证据 ⇒ 跨模块同 SHA） */
  const shot = nav.ok ? await snap(page, "no-permission", mod.key, pg.viewKey, vpId, { panelType: pg.panelType, proxy: "disabled-second-nav-card" }) : null;
  let clickProbe = null;
  if (inert.length) {
    const target = page.locator(`[data-testid="second-nav-sub-zone"] [data-plan-label="${inert[0].label}"]`).first();
    const urlBefore = page.url();
    try {
      await target.click({ timeout: 3000 });
      clickProbe = { attempted: true, activated: true, urlChanged: page.url() !== urlBefore, note: "点击未被浏览器拒绝（该卡可能不是 disabled）" };
    } catch (e) {
      clickProbe = { attempted: true, activated: false, refusal: String(e).split("\n")[0].slice(0, 140), urlChanged: page.url() !== urlBefore };
    }
  }
  pushRecord({
    ...base,
    state: "no-permission",
    captureKey: captureKeyOf(mod.key, pg.viewKey, vpId, "no-permission"),
    status: nav.ok && inert.length ? "captured" : nav.ok ? "unreachable" : "blocked",
    shot,
    reading: {
      guardRedirectsInsteadOfRendering: GUARD,
      noDomLandingFor403: true,
      observableProxyCount: inert.length,
      observableProxy: inert.slice(0, 6),
      realClickOnProxy: clickProbe,
      cardsTotal: cards?.cards?.length ?? 0,
      realRows: cards?.rows?.length ?? 0,
      subEmpty: cards?.subEmpty ?? null,
      navSteps: nav.steps ?? [],
      navFailure: nav.ok ? null : { reason: nav.reason, detail: nav.detail },
    },
    ...(nav.ok && inert.length
      ? {}
      : {
          reason: nav.ok ? "no-disabled-or-pending-card" : nav.reason,
          detail: nav.ok
            ? `该模块二级列 ${cards?.cards?.length ?? 0} 张卡全部可用（无 disabled/待接入），真实区 ${cards?.rows?.length ?? 0} 行 ⇒ 没有可观测的无权限代理面可点`
            : nav.detail,
          owner: OWNER,
          followUp: "WORKBENCH-13C：补可观测的无权限落点（403 页或权限态组件），见 gap 记录里的守卫 file:line",
        }),
    evidence: pg.viewEvidence?.hits?.["no-permission"] ?? [],
  });
  gap(mod.key, pg.viewKey, "no-permission", "no-dom-landing", `路由守卫命中 meta.roles 时是 ElMessage.warning + 重定向（${GUARD.file}:${GUARD.guardStartLine}-${GUARD.redirectLine}）⇒ 无权限态在 DOM 里没有落点；本页只采到可观测代理（disabled/待接入 卡 ${inert.length} 张${clickProbe?.activated === false ? "，真实点击被浏览器拒绝，惰性成立" : ""}）`, pg.viewEvidence?.hits?.["no-permission"] ?? [], "WORKBENCH-13C：加 403/无权限落点页（或可观测的权限态组件），带路由守卫 file:line 证据");
}

/* ────────────────────────── 跑 ────────────────────────── */

const GUARD = routerGuardEvidence();
const SHARED_UNAVAILABLE = sharedUnavailableComponent();

browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  await startBackend();
  await startVite();
  const a = await loginViaProxy();
  auth = { token: a.token, csrfToken: a.csrfToken ?? a.csrf ?? "", user: a.user ?? {} };
} catch (e) {
  console.error(`服务起停/登录失败：${redactText(String(e)).slice(0, 300)}`);
  await stopAll();
  await browser.close().catch(() => null);
  writeOutputs({ aborted: redactText(String(e)) });
  process.exit(1);
}

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addInitScript(AUTH_INIT, { token: auth.token, csrf: auth.csrfToken, user: auth.user });
  const page = await ctx.newPage();
  attachNetwork(page);
  page.on("pageerror", (e) => {
    const msg = redactText(String(e)).slice(0, 200);
    log(`  ! 页面未捕获异常：${msg}`);
  });

  for (const mod of plannedModules) {
    const sector = mod.sector;
    const ctxState = {};
    /* 计划页：已接线（routePath + superAdminVisible）页面按版式各取第一张；POS 扇区只取收银台（其余版式由业务扇区同版式页覆盖） */
    let routed = (sector?.lv2 ?? []).filter((p) => p.routePath && p.superAdminVisible !== false);
    if (mod.key === "pos") {
      if (!POS_CASHIER) {
        violations.push({ kind: "module-without-capture", moduleKey: "pos", page: "pos-cashier", reason: "src/shared/workbench/manifest-pos.ts 里解析不到 web.pos.cashier 的路由行" });
        continue;
      }
      routed = [POS_CASHIER];
    }
    const byType = new Map();
    for (const p of routed) if (!byType.has(p.panelType)) byType.set(p.panelType, p);
    let picked = [...byType.values()];
    const prefer = ["list", "board", "fuse", "form", "order", "print", "pos", "detail", "bill"];
    picked.sort((a, b) => prefer.indexOf(a.panelType) - prefer.indexOf(b.panelType));
    const primaryType = byType.get("list") ? "list" : prefer.find((t) => byType.has(t));
    picked = [byType.get(primaryType), ...picked.filter((p) => p.panelType !== primaryType)].filter(Boolean);
    if (PAGE_PIN.pins[mod.key]) {
      const pins = PAGE_PIN.pins[mod.key];
      const forced = routed.filter((p) => pins.includes(p.viewKey));
      if (forced.length) picked = forced;
    }
    picked = picked.slice(0, PAGE_PIN.limitPerModule);
    const plannedTypes = [...new Set(picked.map((p) => p.panelType))];
    log(`模块 ${mod.name}（${mod.key}／rail=${mod.railKey}）：代表页 ${picked.map((p) => `${p.viewKey}(${p.panelType})`).join(", ")}`);

    const pages = picked.map((p) => {
      const rel = p.routeCompKey ?? null;
      return {
        ...p,
        cardLabels: [p.protoSubLabel, p.manifestTitle, p.routeTitle, p.pageName].filter(Boolean),
        cardLabel: p.pageName,
        regions: contractFor(p.panelType).map((r) => r.key),
        viewSource: rel,
        viewEvidence: rel ? scanView(rel) : null,
      };
    });

    let healthyCaptures = 0;
    for (const [idx, pg] of pages.entries()) {
      pg.primary = idx === 0;
      const res = await driveHealthy(page, mod, pg, vp.id, ctxState);
      if (res.ok) healthyCaptures += 1;
      /* 主代表页没有可用写控件时，先在本片已采的类型页上再找一次（同一条真实点击语法，不多跑导航），
         还不够就走向本模块**其余**已接线页面 —— C.12 要核的是「有写操作的页面」，把没有写控件的页面记成
         「不适用」等于把缺口藏进选页里。第二阶段以源码扫描有写语汇为前置，只多走 2 页，不做无目的遍历。 */
      if (res.ok && idx === 0) {
        const writeRec = () => records.find((r) => r.moduleKey === mod.key && r.viewport === vp.id && r.state === "write" && r.pageKey === pg.viewKey);
        const hunt = async (alt) => {
          const altNav = await navigateTo(page, mod, alt, vp.id, ctxState);
          if (!altNav.ok) return { found: false };
          await page.waitForTimeout(1200);
          const altRead = await readState(page, alt.panelType);
          return driveWrite(page, { moduleKey: mod.key, moduleName: mod.name, pageKey: alt.viewKey, pageName: alt.pageName, routePath: alt.routePath, panelType: alt.panelType, viewport: vp.id, contractRegions: alt.regions, viewSource: alt.viewSource, viewEvidence: alt.viewEvidence }, altRead, { renavigate: async (p) => navigateTo(p, mod, alt, vp.id, ctxState) });
        };
        const dropPrimaryGap = () => {
          const stale = records.findIndex((r) => r.captureKey === captureKeyOf(mod.key, pg.viewKey, vp.id, "write"));
          if (stale >= 0) records.splice(stale, 1);
          const staleGap = gaps.findIndex((g) => g.moduleKey === mod.key && g.page === pg.viewKey && g.state === "write");
          if (staleGap >= 0) gaps.splice(staleGap, 1);
        };
        if (writeRec()?.status === "unreachable") {
          for (const alt of pages.slice(1)) {
            if ((await hunt(alt)).found) {
              dropPrimaryGap();
              break;
            }
          }
          if (writeRec()?.status === "unreachable" && !records.some((r) => r.moduleKey === mod.key && r.viewport === vp.id && r.state === "write" && r.status === "captured")) {
            const pickedKeys = new Set(pages.map((p) => p.viewKey));
            const extra = routed
              .filter((p) => !pickedKeys.has(p.viewKey) && p.routeCompKey && (scanView(p.routeCompKey).hits?.write ?? []).length > 0)
              .slice(0, 2)
              .map((p) => ({ ...p, cardLabels: [p.protoSubLabel, p.manifestTitle, p.routeTitle, p.pageName].filter(Boolean), cardLabel: p.pageName, regions: contractFor(p.panelType).map((r) => r.key), viewSource: p.routeCompKey, viewEvidence: scanView(p.routeCompKey) }));
            if (extra.length) log(`  · 代表页里没有写操作面 ⇒ 追加本模块源码面声明写语汇的页面：${extra.map((p) => p.viewKey).join(", ")}`);
            for (const alt of extra) {
              if ((await hunt(alt)).found) {
                dropPrimaryGap();
                break;
              }
            }
          }
        }
      }
    }

    const primary = pages[0];
    /* 停后端⇒重启这一段是整片最容易因机器负载失败的一步（实测 tsx 冷启要 85s）。它失败只该作废本模块的
       unavailable/error/no-permission 三个状态，不该把已经采好的健康面读数一起带走 ⇒ 就地兜住并如实记缺件。 */
    try {
      if (primary && (STATES.includes("unavailable") || STATES.includes("error"))) await driveDegraded(page, mod, primary, vp.id, ctxState);
      if (primary && STATES.includes("no-permission")) await driveNoPermission(page, mod, primary, vp.id, ctxState);
    } catch (e) {
      const msg = redactText(String(e).split("\n")[0]).slice(0, 180);
      log(`  ! 降级段（unavailable/error/no-permission）采集失败：${msg} ⇒ 三个状态如实记不可达，本片健康面读数保留`);
      for (const st of STATES.filter((s) => ["unavailable", "error", "no-permission"].includes(s))) {
        if (records.some((r) => r.moduleKey === mod.key && r.viewport === vp.id && r.state === st)) continue;
        pushRecord({
          moduleKey: mod.key,
          moduleName: mod.name,
          pageKey: primary?.viewKey ?? "none",
          pageName: primary?.pageName ?? null,
          routePath: primary?.routePath ?? null,
          panelType: primary?.panelType ?? null,
          viewport: vp.id,
          contractRegions: primary?.regions ?? [],
          viewSource: primary?.viewSource ?? null,
          viewEvidence: primary?.viewEvidence ?? null,
          state: st,
          captureKey: captureKeyOf(mod.key, primary?.viewKey ?? "none", vp.id, st),
          status: "unreachable",
          reason: "degraded-drive-failed",
          detail: `${msg}（本机停/起后端超预算）⇒ 这一态在本机量不到，需低负载时段或预热后端复核；刻意不出帧，也不拿健康面画面冒充降级态`,
          owner: OWNER,
          followUp: "WORKBENCH-13C：预热后端 / 低负载时段复跑 unavailable·error·no-permission 三态",
          reading: null,
          evidence: [],
        });
        gap(mod.key, primary?.viewKey ?? "none", st, "degraded-drive-failed", msg, []);
      }
    }

    /* 逐模块状态清单（源码面）：C.11「每模块至少验收适用状态」的输入 */
    const inventoryFiles = (sector?.lv2 ?? []).map((p) => p.routeCompKey).filter(Boolean);
    const scanned = inventoryFiles.map((rel) => scanView(rel)).filter((x) => x.readable);
    const stateInventory = {};
    for (const st of Object.keys(STATE_NEEDLES)) {
      const withHit = scanned.filter((f) => (f.hits[st] ?? []).length > 0).length;
      stateInventory[st] = { filesWithAffordance: withHit, filesScanned: scanned.length, files: scanned.filter((f) => (f.hits[st] ?? []).length > 0).map((f) => ({ file: f.file, hits: f.hits[st] })).slice(0, 12) };
    }
    pushRecord({
      moduleKey: mod.key,
      moduleName: mod.name,
      pageKey: primary?.viewKey ?? null,
      pageName: primary?.pageName ?? null,
      viewport: vp.id,
      state: "__inventory__",
      captureKey: captureKeyOf(mod.key, "__inventory__", vp.id, "inventory"),
      status: "inventory",
      plannedPages: pages.map((p) => ({ viewKey: p.viewKey, panelType: p.panelType, routePath: p.routePath })),
      plannedTypes,
      stateInventory,
      degradedRecovery: ctxState.degraded ?? null,
      routerGuard: GUARD,
      sharedUnavailableComponents: SHARED_UNAVAILABLE,
    });

    if (healthyCaptures === 0) violations.push({ kind: "module-without-capture", moduleKey: mod.key, page: primary?.viewKey ?? null, reason: `该模块在本片没有任何一张采到的代表页（导航全部阻断）⇒ C.11 无从判定` });
    else log(`模块 ${mod.name}：健康面采到 ${healthyCaptures}/${pages.length} 页 · 版式 ${plannedTypes.join("/")}`);
  }
  await ctx.close().catch(() => null);
}

await browser.close().catch(() => null);
if (!KEEP_SERVERS) await stopAll();
writeOutputs({ aborted: null });

/* ────────────────────────── 门禁与产物 ────────────────────────── */

function collectGates(scope = records) {
  const v = violations.slice();
  const invRecords = scope.filter((r) => r.state === "__inventory__");
  /* 1) 覆盖：本片每个模块必须有代表页 + 状态清单记录 */
  for (const mod of plannedModules) {
    if (!invRecords.find((r) => r.moduleKey === mod.key && r.viewport === viewports[0].id)) v.push({ kind: "module-without-capture", moduleKey: mod.key, page: null, reason: "没有状态清单记录（__inventory__）⇒ 该模块未被本工具走到" });
  }
  /* 2) 每个状态记录要么有帧（自己的或声明共用的），要么有 {reason,owner,followUp} 的诚实缺件 */
  for (const r of scope) {
    if (r.state === "__inventory__") continue;
    const miss = completenessCheck(r);
    if (miss) v.push(miss);
    if (r.status === "captured" && !r.shot) v.push({ kind: "captured-without-frame", moduleKey: r.moduleKey, page: r.pageKey, reason: `状态 ${r.state} 记成 captured 却没有帧 ⇒ 结论不可复核，判红` });
    if (r.status === "unreachable" && (!r.owner || !r.followUp)) v.push({ kind: "state-record-incomplete", moduleKey: r.moduleKey, page: r.pageKey, reason: `状态 ${r.state} 记为不可达但缺 owner/followUp（fail-closed：blocked 必带归属）` });
  }
  /* 3) 帧唯一：本片自身台账内不得有复用帧（同 captureKey 视为取代，不算重复；共用帧不入库，见 3b） */
  const living = new Map();
  for (const f of frames) living.set(f.captureKey, f);
  const reused = [];
  const bySha = new Map();
  for (const f of living.values()) {
    const prev = bySha.get(f.sha256);
    if (prev) reused.push({ file: f.file, sha256: f.sha256, alsoUsedBy: prev.file });
    else bySha.set(f.sha256, f.file);
  }
  if (reused.length) v.push({ kind: "reused-frame", moduleKey: reused.map((x) => x.file).join(","), page: null, reason: `C 段帧台账里有 ${reused.length} 张重复帧（两帧同 SHA ⇒ 状态没真的切换或命名撞车）`, detail: reused });
  /* 3b) 共用帧（error ⇄ unavailable 同一 DOM 瞬间）必须指到本片真出过帧的那条记录，且不得自带文件 */
  for (const r of scope.filter((x) => x.shot && x.shot.own === false)) {
    const src = scope.find((x) => x.state === r.shot.sharedWith && x.moduleKey === r.moduleKey && x.pageKey === r.pageKey && x.viewport === r.viewport && x.shot && x.shot.own !== false);
    if (!src) v.push({ kind: "shared-frame-dangling", moduleKey: r.moduleKey, page: r.pageKey, reason: `状态 ${r.state} 声明共用 ${r.shot.sharedWith} 帧，但同模块同页没有那条帧 ⇒ 引用悬空（不许拿别人的图冒充证据）` });
  }
  /* 3c) 我们自己那条红线：写操作只开不提交 —— unsafe 请求一条都不许出去 */
  for (const r of scope.filter((x) => x.state === "write" && x.status === "captured")) {
    const fired = r.reading?.unsafeRequestsFired ?? [];
    if (fired.length) v.push({ kind: "write-submitted", moduleKey: r.moduleKey, page: r.pageKey, reason: `写操作面只该开不该提交，但点击「${r.reading?.control?.text}」后有 ${fired.length} 条 unsafe 请求出浏览器（${fired.slice(0, 3).join(" / ")}）⇒ mock 数据可能被改，本条结论作废需复核` });
  }
  /* 4) C.14：五条版式线各自的区域集必须不同，且本片计划出现的版式都按自己的契约被量过 */
  if (!c14SetsDistinct) v.push({ kind: "contract-forcing", moduleKey: "*", page: null, reason: `C.14：contractFor() 在 list/board/form/print/pos 上返回了相同的区域集（${JSON.stringify(c14RegionSets)}）⇒ 等于把所有页面当同一种列表卡` });
  const requiredTypes = new Set();
  for (const r of scope.filter((x) => x.state === "__inventory__" && x.viewport === viewports[0].id)) for (const t of r.plannedTypes ?? []) requiredTypes.add(t);
  const measuredTypes = new Set(scope.filter((r) => r.status === "captured" && r.panelType && r.viewport === viewports[0].id).map((r) => r.panelType));
  for (const t of requiredTypes) if (!measuredTypes.has(t)) v.push({ kind: "contract-forcing", moduleKey: "*", page: null, reason: `C.14：本片计划里出现的版式 ${t} 没有任何一页按自己的契约被采到（measured=${[...measuredTypes].join("/")}）` });
  for (const r of scope.filter((x) => x.status === "captured" && x.contractRegions && x.panelType)) {
    const own = contractFor(r.panelType).map((x) => x.key);
    if (r.panelType === "pos") continue; /* POS 在通用 5 区之外还带收银台自有语汇，允许超集 */
    if (own.join(",") !== r.contractRegions.join(",")) v.push({ kind: "contract-forcing", moduleKey: r.moduleKey, page: r.pageKey, reason: `C.14：${r.panelType} 版式的页面被按别的区域集量了（契约 ${own.join(",")} ⇄ 实采 ${r.contractRegions.join(",")}）` });
  }
  /* 5) error 口径自检：toast 不得被记成页内 error */
  for (const r of scope.filter((x) => x.state === "error")) {
    if (r.status !== "captured") continue;
    if (r.reading?.surface === "in-page" && (r.reading?.inPageErrorBlocks ?? []).length === 0) v.push({ kind: "error-surface-misreported", moduleKey: r.moduleKey, page: r.pageKey, reason: "把只有 toast 的反馈记成了页内 error（§四.4 禁止用假反馈遮挡）" });
  }
  /* 6) 降级必须真发生：unavailable 记录里得有 ERR_CONNECTION_REFUSED 计数 */
  for (const r of scope.filter((x) => x.state === "unavailable" && x.status === "captured")) {
    if (!r.degrade?.portDown) v.push({ kind: "unavailable-not-real", moduleKey: r.moduleKey, page: r.pageKey, reason: "unavailable 帧不是靠真停后端得到的（portDown≠true）⇒ 违反红线（不得用注入/mock 造状态）" });
    if ((r.reading?.resultCounts?.tableRows ?? 0) > 0 && (r.reading?.inPageUnavailableIslands ?? []).length === 0) v.push({ kind: "unavailable-with-business-data", moduleKey: r.moduleKey, page: r.pageKey, reason: "后端已停但页内还画着业务表格行 ⇒ 假数据遮挡（§四.4）" });
  }
  return { v, reused, living: [...living.values()] };
}

/** 缺口去重键（写成函数声明而不是 const 箭头：writeOutputs 在文件上半部就调用，TDZ 会把合并整段吞掉） */
function gapKey(g) {
  return `${g.moduleKey}|${g.page}|${g.state}|${g.reason}`;
}

/** 删掉一张不再成立的帧（文件 + 帧台账），只动本工具自己写进 shots/ 的文件 */
function dropFrame(rec) {
  if (rec.shot && rec.shot.own !== false) {
    rmSync(path.join(OUT, rec.shot.file), { force: true });
    const fi = frames.findIndex((f) => f.captureKey === rec.captureKey);
    if (fi >= 0) frames.splice(fi, 1);
  }
}

/**
 * 同页同帧归并（在分块合并之后、门禁之前跑，对整卡读数生效）：
 * · loading 帧与同页另一帧逐字节相同 ⇒ 那张 PNG 拍到的是**静默后的画面**，不是加载态：删帧、改记诚实不可达
 *   （§四.4 明禁拿静默画面冒充 loading），并把「语汇确实读到过、窗口在快 mock 下塌了」写进 detail。
 * · 其余同 SHA（如 ready ⇄ ready-again：重新查询回到同一份数据，画面本就相同）⇒ 后一条并入前一条那一帧，
 *   写明 sharedWith / renderIdenticalTo，不另存同 SHA 文件（留两张文件＝伪造「两个状态各有独立证据」）。
 */
function reconcileIdenticalFrames(scope) {
  const byPage = new Map();
  for (const r of scope) {
    if (r.state === "__inventory__" || !r.shot || r.shot.own === false) continue;
    const k = `${r.moduleKey}|${r.pageKey}|${r.viewport}`;
    if (!byPage.has(k)) byPage.set(k, []);
    byPage.get(k).push(r);
  }
  for (const list of byPage.values()) {
    const ownerBySha = new Map();
    for (const r of list) {
      const prev = ownerBySha.get(r.shot.sha256);
      if (!prev) {
        ownerBySha.set(r.shot.sha256, r);
        continue;
      }
      if (r.state === "loading" || prev.state === "loading") {
        const loser = r.state === "loading" ? r : prev;
        const winner = r.state === "loading" ? prev : r;
        const loserFile = loser.shot.file;
        dropFrame(loser);
        Object.assign(loser, {
          status: "unreachable",
          reason: "loading-frame-collapsed-to-ready",
          detail: `${loser.pageName}（${loser.panelType}）在飞轮询确实读到加载语汇（${loser.reading?.affordance ?? "—"}），但落笔截图时页面已静默：这一帧与 ${winner.state} 帧逐字节相同（SHA ${winner.shot.sha256.slice(0, 10)}）⇒ 拍到的是静默画面，不能当 loading 证据；本机 mock 太快，窗口需真实慢网才量得到。`,
          owner: OWNER,
          followUp: "WORKBENCH-13C：真实慢网（或真实大结果集）下复核 loading 窗口；本卡只声明「本机量不到」",
          reading: { ...(loser.reading ?? {}), frameIdenticalTo: winner.state, frameIdenticalSha: winner.shot.sha256.slice(0, 12), affordanceSeenInFlight: loser.reading?.affordance ?? null },
          shot: null,
        });
        log(`  · loading 帧与 ${winner.state} 帧同 SHA（${winner.shot.sha256.slice(0, 10)}）⇒ 删 ${loserFile}，改记 unreachable [loading-frame-collapsed-to-ready]`);
        if (!gaps.some((g) => g.moduleKey === loser.moduleKey && g.page === loser.pageKey && g.state === "loading")) {
          gap(loser.moduleKey, loser.pageKey, "loading", "loading-frame-collapsed-to-ready", `${loser.pageName}（${loser.panelType}）：在飞读到加载语汇，但截图时已静默（与 ${winner.state} 帧同 SHA）⇒ 本机量不到加载窗口`, loser.evidence ?? []);
        }
        ownerBySha.set(r.shot.sha256, r.state === "loading" ? prev : r);
        continue;
      }
      dropFrame(r);
      r.shot = { ...prev.shot, own: false, sharedWith: prev.state, renderIdenticalTo: prev.state, frameMoment: `identical-to-${prev.state}` };
      log(`  · ${r.state} 帧与 ${prev.state} 帧逐字节相同（SHA ${prev.shot.sha256.slice(0, 10)}）⇒ 不另存文件，并入 ${prev.state} 帧`);
    }
  }
}

/**
 * 分块合并：不在本片模块集合内的旧记录/旧缺口原样并入（同 captureKey、同缺口键以本片为准）。
 * 必须在门禁之前跑 —— 「本片计划出现的版式是否都被按契约采到」和「帧台账有无重复」都是**整卡**口径的判定，
 * 只看本片会把 board 在上一片采到、这一片只读到阻断，误判成契约缺失（假红），也会漏掉跨片的同 SHA 复用帧；
 * 缺口台账只留最后一片更会把前面 9 个模块的缺件直接抹掉（§五.4 要求逐项可追溯）。
 */
function mergePrevious() {
  const out = { records: [], gaps: [] };
  if (!existsSync(MATRIX_FILE)) return out;
  try {
    const prev = JSON.parse(readFileSync(MATRIX_FILE, "utf8"));
    if (prev?.schema !== "wb13b-state-matrix/v1") {
      log("分块合并跳过：旧 JSON schema 不是 wb13b-state-matrix/v1");
      return out;
    }
    const mine = new Set(records.map((r) => r.captureKey));
    const keepModules = new Set(plannedModules.map((m) => m.key));
    const carried = (prev.records ?? []).filter((r) => !mine.has(r.captureKey) && !keepModules.has(r.moduleKey));
    out.records = carried;
    for (const r of carried) if (r.shot && r.shot.own !== false) frames.push({ captureKey: r.captureKey, file: r.shot.file, sha256: r.shot.sha256, moduleKey: r.moduleKey, page: r.pageKey, state: r.state, viewport: r.viewport });
    const seenGap = new Set(gaps.map(gapKey));
    for (const g of prev.gaps ?? []) {
      if (keepModules.has(g.moduleKey) || seenGap.has(gapKey(g))) continue;
      seenGap.add(gapKey(g));
      gaps.push(g);
      out.gaps.push(g);
    }
    log(`分块合并：并入旧片状态记录 ${carried.length} 条 · 旧片缺口 ${out.gaps.length} 条（累计模块 ${new Set([...records, ...carried].map((r) => r.moduleKey)).size} 个）`);
    return out;
  } catch (e) {
    log(`分块合并跳过：旧 JSON 不可解析（${String(e).slice(0, 100)}）`);
    return out;
  }
}

function writeOutputs({ aborted }) {
  const carried = mergePrevious();
  const allRecords = [...records, ...carried.records];
  reconcileIdenticalFrames(allRecords);
  const { v, reused, living } = collectGates(allRecords);
  for (const x of v) console.error(`  ✗ 门禁判红：${JSON.stringify(x).slice(0, 300)}`);

  const byModule = {};
  for (const r of records) (byModule[r.moduleKey] ??= []).push(r);

  const perModule = [...new Set(allRecords.map((r) => r.moduleKey))].map((k) => {
    const rs = allRecords.filter((r) => r.moduleKey === k);
    const states = ALL_STATES.map((st) => {
      const list = rs.filter((r) => r.state === st && r.viewport === viewports[0].id);
      const captured = list.filter((r) => r.status === "captured").length;
      const unreachable = list.filter((r) => r.status === "unreachable").length;
      const blocked = list.filter((r) => r.status === "blocked").length;
      return { state: st, captured, unreachable, blocked, reason: list[0]?.reason ?? null, statuses: [...new Set(list.map((r) => r.status))] };
    });
    const inv = rs.find((r) => r.state === "__inventory__");
    return {
      moduleKey: k,
      moduleName: rs[0]?.moduleName ?? k,
      representativePages: inv?.plannedPages ?? [],
      plannedTypes: inv?.plannedTypes ?? [],
      states,
      capturedShots: rs.filter((r) => r.shot).length,
      stateInventory: inv?.stateInventory ?? null,
      gaps: gaps.filter((g) => g.moduleKey === k).length,
    };
  });

  const bundle = {
    schema: "wb13b-state-matrix/v1",
    card: "WORKBENCH-13B-WORKBENCH-MODULE-VISUAL-PARITY-01",
    section: "§三.C 状态完整性（11/12/13/14）+ §四.4",
    generatedAt: new Date().toISOString(),
    sources: { pageModel: MODEL_FILE.replace(/\\/g, "/"), manifestPos: POS_PATH.replace(/\\/g, "/"), routerGuard: GUARD },
    scope: { modules: plannedModules.map((m) => m.key), states: STATES, viewports: viewports.map((v) => v.id), pagesFlag: pagesFlag ?? null },
    redLines: { noInjection: "无 ?wb_uiux / 无 query 参数 / 无 dev flag / 无 dispatch 伪造事件 / 无 DOM 改写", statesReachedBy: "真实点击 + 真实按键 + 真停后端进程", writeOps: "只开不提交（resultCountsBefore==After 自检）", fakeData: "数据不可得时只量布局与控件位置，不填任何演示值" },
    summary: {
      modules: perModule.length,
      records: allRecords.length,
      captured: allRecords.filter((r) => r.status === "captured").length,
      unreachable: allRecords.filter((r) => r.status === "unreachable").length,
      blocked: allRecords.filter((r) => r.status === "blocked").length,
      shots: living.length,
      reusedFrames: reused,
      /* 共用帧＝同一 DOM 瞬间的两个问题（无重试可点时 error ⇄ unavailable），不另存同 SHA 文件 */
      sharedFrames: allRecords.filter((r) => r.shot && r.shot.own === false).map((r) => ({ state: r.state, moduleKey: r.moduleKey, page: r.pageKey, sharedWith: r.shot.sharedWith, file: r.shot.file })),
      noFrameStates: allRecords.filter((r) => r.state !== "__inventory__" && !r.shot).map((r) => `${r.moduleKey}/${r.pageKey}:${r.state}(${r.status}/${r.reason ?? "-"})`),
      gapCount: gaps.length,
      violations: v.length,
      c14: { types: C14_TYPES, regionSets: c14RegionSets, setsDistinct: c14SetsDistinct, measuredTypes: [...new Set(allRecords.filter((r) => r.status === "captured").map((r) => r.panelType).filter(Boolean))] },
    contractRegionUniverse: PAGE_CONTRACT.map((r) => ({ key: r.key, label: r.label, types: r.types ?? "all" })),
    posNativeRegions: POS_NATIVE_REGIONS.map((r) => r.key),
      perModule: perModule.map((m) => ({ moduleKey: m.moduleKey, captured: m.capturedShots, states: m.states.map((s) => `${s.state}:${s.captured ? "有" : s.unreachable ? "不适用" : s.blocked ? "阻断" : "无"}`).join(" ") })),
    },
    modules: perModule,
    records: allRecords,
    gaps,
    violations: v,
    network: { failureCount: netFailures.length, sample: netFailures.slice(0, 40) },
    navTrail: trail.slice(-200),
    aborted,
  };
  writeFileSync(MATRIX_FILE, JSON.stringify(bundle, null, 2) + "\n", "utf8");
  writeFileSync(HARNESS_FILE, JSON.stringify({ generatedAt: bundle.generatedAt, scope: bundle.scope, harnessLog, backendTail: backendTail.join("").slice(-8000), ports: { BACKEND_PORT, WEB_PORT }, navTrail: trail.slice(-400) }, null, 2) + "\n", "utf8");

  /* 人读矩阵：每模块 × 状态一行「有/无/不适用+理由」，缺口清单逐条点名 WORKBENCH-13C */
  const md = [];
  const cell = (mod, st) => {
    const rs = allRecords.filter((r) => r.moduleKey === mod.moduleKey && r.state === st && r.viewport === viewports[0].id);
    if (!rs.length) return "不适用（本片未计划）";
    if (rs.some((r) => r.status === "captured")) {
      const cap = rs.find((r) => r.status === "captured");
      const frameNote = cap?.shot?.own === false ? "〔共用帧〕" : "";
      const extra = st === "empty" ? ` 布局保持${rs.find((r) => r.reading?.layoutPreservation?.applicable)?.reading.layoutPreservation.maxAbsDelta <= 1 ? "✓" : "✗"}` : st === "unavailable" ? ` 页内岛=${(rs[0].reading?.inPageUnavailableIslands ?? []).length}` : st === "error" ? ` 面=${rs[0].reading?.surface ?? "?"}${frameNote}` : st === "write" ? ` 面=${cap?.reading?.surface ?? "?"}·试${(cap?.reading?.attempts ?? []).length}次${frameNote}` : "";
      return `有${extra}`;
    }
    if (rs.some((r) => r.status === "unreachable")) return `不适用（${rs[0].reason}）`;
    return `无（阻断 ${rs[0].reason}）`;
  };
  md.push("# WORKBENCH-13B §三.C · 状态完整性矩阵（逐模块 × 逐状态）\n");
  md.push(`- 口径：状态一律由**真实点击 / 真实按键 / 真停后端进程**达到；零注入、零假数据、写操作只开不提交。`);
  md.push(`- 范围：模块 ${bundle.scope.modules.join(" / ")} · 状态 ${bundle.scope.states.join(" / ")} · 视口 ${bundle.scope.viewports.join(" / ")}`);
  md.push(`- 记录 ${bundle.summary.records} 条（出帧 ${bundle.summary.captured} · 诚实不可达 ${bundle.summary.unreachable} · 阻断 ${bundle.summary.blocked}）· 独立帧 ${bundle.summary.shots} 张 · 共用帧 ${bundle.summary.sharedFrames.length} 张（同一 DOM 瞬间的两个问题，不另存同 SHA 文件）· 缺口 ${bundle.summary.gapCount} 条 · 门禁判红 ${bundle.summary.violations} 项\n`);
  md.push(`## 一、逐模块 × 逐状态（有 / 无 / 不适用+理由）`);
  md.push(`| 模块 | ready | loading | empty | ready-again | unavailable | error | 无权限 | write | 帧 |`);
  md.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |`);
  for (const m of perModule) md.push(`| ${m.moduleName} | ${ALL_STATES.map((st) => cell(m, st)).join(" | ")} | ${m.capturedShots} |`);
  md.push(`\n> 「不适用」＝该状态在这一页经真实交互到达不了（页面自己没有那条控件），已按 fail-closed 记 reason/owner/followUp，**不是通过**。\n`);

  md.push(`## 二、C.13 可测内核：数据不可得时布局与控件位置是否保住`);
  md.push(`| 模块 | 页面 | 版式 | 筛选真清空 | el-empty 在 | 门内指标 | 最大位移 | 判定 |`);
  md.push(`| --- | --- | --- | --- | --- | ---: | ---: | --- |`);
  for (const r of allRecords.filter((x) => x.state === "empty" && x.status === "captured")) {
    const p = r.reading?.layoutPreservation ?? {};
    md.push(`| ${r.moduleKey} | ${r.pageKey} | ${r.panelType} | ${r.reading?.keywordMatched ? "是" : "否（后端未按关键字过滤或本页非表格）"} | ${(r.reading?.emptyAffordance ?? []).length ? "是" : "否"} | ${p.gated ?? 0} | ${p.maxAbsDelta ?? 0} | ${p.applicable === false ? "无门内区域（该页没有表/看板/表单动作条）" : (p.bad ?? []).length ? `红：${p.bad.map((b) => b.key).join("/")}` : "原位"} |`);
  }
  md.push(`\n> 门内区域＝筛选条 / 工具条 / 表格外框 / 表格 / 表头单元格 / 看板网格 / 图表块 / 信息卡 / 表单动作条（x、width，容差 ±1px）；表格**行**消失是内容的真实变化，不算布局跳。`);

  md.push(`\n## 三、C.12 写操作面：确认框 / 禁用态 / 提交中 / 失败反馈 / 人工兜底`);
  md.push(`| 模块 | 页面 | 触发控件 | 弹出面 | 确认按钮 loading/disabled | 提交中可观测 | 取消回落 ready | 未改数据 | 无面候选 |`);
  md.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const r of allRecords.filter((x) => x.state === "write")) {
    if (r.status !== "captured") { md.push(`| ${r.moduleKey} | ${r.pageKey} | — | — | — | — | — | ${r.reason ?? r.status} | ${(r.reading?.attempts ?? []).map((a) => a.control).join("/") || "—"} |`); continue; }
    const w = r.reading ?? {};
    md.push(`| ${r.moduleKey} | ${r.pageKey} | ${w.control?.text ?? "—"} | ${w.surface ?? "无"} | ${JSON.stringify(w.confirmButtonsAtClick ?? []).replace(/\|/g, "/").slice(0, 90)} | ${w.submittingObservable ? "可观测" : "不可观测（红→13C）"} | ${w.recoveredToReady ? "是" : "否"} | ${w.noMutation ? "是" : `否（unsafe=${(w.unsafeRequestsFired ?? []).length}）`} | ${(w.attempts ?? []).map((a) => a.control).join("/") || "—"} |`);
  }
  md.push(`\n> 「未改数据」口径＝取消/关闭前后**没有任何 POST/PUT/PATCH/DELETE 请求出浏览器**（被动监听 request 事件，不看 mock 库）；本地行数变化只作旁证列在「无面候选」旁边。\n`);

  md.push(`\n## 四、C.11 逐模块状态语汇源码面（file:line 实测，不是清单抄写）`);
  md.push(`| 模块 | loading 文件/页数 | empty | error(常驻块口径) | unavailable/retry | 写操作 |`);
  md.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const m of perModule.filter((x) => x.stateInventory)) {
    const si = m.stateInventory;
    md.push(`| ${m.moduleName} | ${si.loading.filesWithAffordance}/${si.loading.filesScanned} | ${si.empty.filesWithAffordance}/${si.empty.filesScanned} | ${si.error.filesWithAffordance}/${si.error.filesScanned} | ${si.unavailable.filesWithAffordance}/${si.unavailable.filesScanned} | ${si.write.filesWithAffordance}/${si.write.filesScanned} |`);
  }
  md.push(`\n- 无权限态：路由守卫 ${GUARD.file}:${GUARD.guardStartLine ?? "?"}-${GUARD.redirectLine ?? "?"}（${GUARD.warningLine ? `ElMessage.warning @:${GUARD.warningLine}` : ""} ⇒ 重定向），**DOM 里没有 403 落点**；可观测代理＝二级列 disabled/待接入 卡。`);
  md.push(`- 可复用 unavailable/retry 组件实测：${SHARED_UNAVAILABLE.length ? SHARED_UNAVAILABLE.map((x) => `${x.file}:${x.line}${x.propDriven ? "(props 驱动)" : "(局部)"}`).join(" · ") : "无（仅业务页内联岛）"}\n`);

  md.push(`## 五、C.14 页面类型视觉契约（不得把所有页面改成同一种列表卡）`);
  md.push(`| 版式 | 契约区域数 | 区域集 |`);
  md.push(`| --- | ---: | --- |`);
  for (const t of C14_TYPES) md.push(`| ${t} | ${c14RegionSets[t].length} | ${c14RegionSets[t].join(", ")} |`);
  md.push(`\n- 区域集两两不同：${c14SetsDistinct ? "是" : "否（判红）"} · 本片实测到的版式：${bundle.summary.c14.measuredTypes.join(" / ")} · POS 另带收银台自有语汇（${POS_NATIVE_REGIONS.map((r) => r.key).join(", ")}）`);

  md.push(`\n## 六、缺口清单（未实现的状态 = 实测缺失，逐条归 WORKBENCH-13C）\n`);
  md.push(`| 模块 | 页面 | 状态 | 原因 | 实测说明 | 源码证据 | 责任人 | 后续卡 |`);
  md.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const g of gaps) {
    const ev = (g.evidence ?? []).map((e) => `${g.moduleKey}:${e.line}`).join(",") || `${(allRecords.find((r) => r.moduleKey === g.moduleKey && r.pageKey === g.page)?.viewSource) ?? "—"}:无命中`;
    md.push(`| ${g.moduleKey} | ${g.page} | ${g.state} | ${g.reason} | ${String(g.detail).replace(/\|/g, "/").slice(0, 150)} | ${ev.replace(/\|/g, "/").slice(0, 90)} | ${g.owner} | ${String(g.followUp).replace(/\|/g, "/").slice(0, 90)} |`);
  }
  md.push(`\n## 七、门禁判红明细\n`);
  if (!v.length) md.push("（本片 0 项）");
  for (const x of v) md.push(`- ${JSON.stringify(x)}`);
  md.push(`\n生成时间：${bundle.generatedAt}`);
  writeFileSync(MD_FILE, md.join("\n") + "\n", "utf8");

  console.log(`\n状态矩阵完成：模块 ${perModule.length} · 记录 ${bundle.summary.records}（出帧 ${bundle.summary.captured} · 不可达 ${bundle.summary.unreachable} · 阻断 ${bundle.summary.blocked}）· 缺口 ${gaps.length} · 门禁判红 ${v.length}`);
  console.log(`证据：${MATRIX_FILE}`);
  if (aborted) console.log(`异常中止：${aborted}`);
  process.exit(v.length ? 1 : 0);
}
