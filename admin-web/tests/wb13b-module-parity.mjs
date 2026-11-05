/**
 * WORKBENCH-13B · 逐业务模块「原型 ⇄ 实现」并排采集器（卡 §三.A.2/3/4/5）
 *
 * 与 F2a/F3 的并排采集器同一血脉（服务自起自停 / 真实 SUPER_ADMIN 登录 / 同一容差口径 /
 * 状态签名进 figcaption / 帧 SHA 去重），但量的对象从**壳层**换成**每个业务模块页面自身**：
 *
 *   原型侧：file:// 打开融合版原型 ⇒ 等原型自身时序进入静默态 ⇒ **真实点击**一级 rail
 *           （nav.rail .rl-it[data-rk]）⇒ 真实点击二级目录里的同名卡（#subZone .sub-card）
 *           ⇒ 原型自绘页面面板（#wbBody>.s-wrap）落定后截图 + 区域读数。
 *   实现侧：同源 /api 代理 + 真实 demo-login 登录态 ⇒ 真实点击 [data-testid="rail"]
 *           的模块项 ⇒ 真实点击二级列卡片（[data-plan-label]，目录位空时用「已接入入口」真实区）
 *           ⇒ 路由落到该页 path 后截图 + 同一份区域读数。
 *
 * 红线自查（卡 §六）：零注入 —— 不带 ?wb_uiux、不改 DOM/class/style、不用 query 参数或
 * dev 注入当生产视觉证据、不直接调用原型内部函数伪造状态、页面无数据时如实 BLOCKED 并写
 * reason/owner/followUp，绝不补假数据。每页两侧各一张独立 PNG，SHA 去重机器校验。
 *
 * 用法（admin-web 目录）：
 *   node tests/wb13b-module-parity.mjs <evidenceDir 绝对路径> [选项]
 * 选项：
 *   --modules=sale,report        只跑这些原型版块键（默认 11 个业务模块）
 *   --viewports=1440x1000        只跑这些视口档（默认两档主视口）
 *   --pages=1440x1000:4          每模块每档最多采几页（默认 1440×1000 全量、1024×768 每模块 2 页）
 *   --notes=<file.json>          偏差书面解释（默认 <evidenceDir>/tools/wb13b-deviation-notes.json）
 *   --probe                      校准模式：照常采集两侧类名清单与差异表，但不把门禁判红转成退出码
 *   --keep-servers               跑完不关后端/vite（仅本地排错用）
 * 环境变量：WB13_BACKEND_PORT / WB13_WEB_PORT / WB13_CHROME / WB13_PROTOTYPE
 *
 * 输出：
 *   <evidenceDir>/shots/parity-{proto,impl}-<模块>-<页面>-<视口>.png   逐页并排截图
 *   <evidenceDir>/measure/wb13b-module-parity.json                    配对读数 + 差异表 + 门禁结果
 *   <evidenceDir>/measure/wb13b-module-parity.md                      人读逐模块差异表
 *   <evidenceDir>/logs/wb13b-module-parity-harness.json               服务起停 / 点击轨迹 / 重试尾部
 *   admin-web/tests/fixtures/wb13b-module-parity.json                 仓内副本（专项测试只读它）
 */
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { portOfUrl, redactText } from "./uiux-scenarios-lib.mjs";
import { RAIL_SELECTED_BG, RAIL_SELECTED_FG, diffStateSignatures, findClippedA, normalizeColor } from "./f2a-visual-baseline-lib.mjs";
import {
  FONT_ROLES,
  PAGE_CONTRACT,
  PAGE_VIEWPORTS,
  buildFontRows,
  buildPageDiffTable,
  buildRhythmRows,
  collectModuleParityViolations,
  contractFor,
  findPageExempted,
  findPageExplained,
  findPageBlocked,
  findPageOffSpec,
  findPageRhythmViolations,
  findFontHierarchyViolations,
  findReusedFrames,
  mergeDeviationNotes,
  pageGatedStats,
  pageStateSignature,
} from "./wb13b-page-contract-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(here, "..");
const REPO = path.join(WEB, "..");

const argv = process.argv.slice(2);
const EVIDENCE = argv.find((a) => !a.startsWith("--"));
if (!EVIDENCE) {
  console.error("用法：node tests/wb13b-module-parity.mjs <evidenceDir> [--modules=…] [--viewports=…] [--pages=…] [--probe]");
  process.exit(2);
}
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const OUT = path.resolve(EVIDENCE);
mkdirSync(path.join(OUT, "shots"), { recursive: true });
mkdirSync(path.join(OUT, "measure"), { recursive: true });
mkdirSync(path.join(OUT, "logs"), { recursive: true });
mkdirSync(path.join(OUT, "tools"), { recursive: true });
const PROBE_ONLY = argv.includes("--probe");
const KEEP_SERVERS = argv.includes("--keep-servers");

const BACKEND_PORT = Number(process.env.WB13_BACKEND_PORT ?? 8080);
const WEB_PORT = Number(process.env.WB13_WEB_PORT ?? 5199);
const ORIGIN = `http://localhost:${WEB_PORT}`;
const API_BASE = "/api";
const CHROME = process.env.WB13_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PROTO_FILE =
  process.env.WB13_PROTOTYPE ?? "D:/Users/ZXQL/ZXQL-WORK/projects/ai/design/智享全链_工作台电脑端_UI原型_融合版.html";
const PROTO_URL = pathToFileURL(PROTO_FILE).href;
/** 卡面钉住的原型指纹（与 F2a/F3 同一真相源）：不符即拒绝采集，不产出「换了原型」的假证据 */
const PROTO_SHA_EXPECT = "6A2724A640DD613E3688EF79AF9369A978669DD2FA3B359DA31F705A3FC30C51";

const MODEL_FILE = path.join(OUT, "measure", "wb13b-proto-page-model.json");
const INVENTORY_FILE = path.join(OUT, "measure", "wb13b-entry-inventory.json");
const NOTES_FILE = flag("notes") ?? path.join(OUT, "tools", "wb13b-deviation-notes.json");

const harnessLog = [];
const backendTail = [];
const log = (msg) => {
  harnessLog.push(`${new Date().toISOString()} ${msg}`);
  console.log(msg);
};

/* ────────────────────────── 服务自起自停（与 F 系列采集器同一口径） ────────────────────────── */

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
  if (!(await waitForPort(BACKEND_PORT, true))) throw new Error(`后端 ${BACKEND_PORT} 未在 90s 内就绪`);
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

/* ────────────────────────── 页内函数（自包含：源码字符串传入，页内 new Function 还原） ────────────────────────── */

/** 真实渲染判定：display/visibility/opacity/尺寸四道，常驻 inert 层不算活跃浮层 */
function ACTIVE_MODAL_SCANNER(selectors) {
  const out = [];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const active =
        st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.05 && st.pointerEvents !== "none" && r.width > 40 && r.height > 40;
      if (!active) continue;
      out.push({ selector: sel, id: el.id || "", cls: String(el.className || "").slice(0, 48), z: st.zIndex, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
    }
  }
  return out;
}

/**
 * 页面级区域读数：每个契约区域取「第一个命中的候选选择器」，并在该选择器的多条命中里取**真的排出尺寸的那一条**，
 * 只量真实渲染出来的东西；区域缺失同样留 exists=false —— 「读不到」本身就是门禁输入。
 * 另附 itemCount（同选择器在页内的实际条目数 ⇒ 入口数量/列数门禁）、pickMode（单命中 / 第几条可见 / 全部零尺寸）与字体层级角色。
 */
function PAGE_REGION_READER(cfg) {
  const { sideKey, contract, fontRoles } = cfg;
  /* 「一行容器」宿主（分页条/筛选条/统计条…）：高度差几像素时只看容器读数找不到根因，
     附带最高子元素的身份。声明必须留在函数体内 —— 采集器以 .toString() 注入浏览器，外层常量到不了页面。 */
  const DIAG_HOSTS = ["pagination", "filterBar", "statistics", "statCard", "toolbarActions", "formActions"];
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01;
  };
  /*
    作用域根（cfg.rootSel）：实现侧的整个壳层（rail/二级列/顶栏/AI 信息流/会话面板）和业务页在
    **同一棵 DOM** 里，全局 `document.querySelector(".el-card")` 会把壳层/AI 面板的容器当页面区块量，
    差异表就从「页面 vs 页面」变成「整屏 vs 原型面板」⇒ 逐行都是噪声。
    因此两侧都先把读数限定到各自的页面容器：
      · 原型 `main[data-view]` 之外没有壳层概念 ⇒ 根 = `#wbBody .s-wrap`（原型面板本体）
      · 实现 ⇒ 根 = `main[data-view="manual"].shown` 的第一个子元素（`<router-view/>` 渲染出的业务页）
    原型侧页面根因版式而异（版块页有 .s-wrap，home/bill 等没有），所以根解析不到时**如实退回文档**，
    并把退回与否写进 `__scope`，让复核者看得见量的是哪一层。
  */
  const rootCandidates = Array.isArray(cfg.rootSel) ? cfg.rootSel : [cfg.rootSel].filter(Boolean);
  let root = null;
  let rootSel = null;
  for (const s of rootCandidates) {
    const el = document.querySelector(s);
    if (el) { root = el; rootSel = s; break; }
  }
  const scope = root || document;
  /*
    口径（三种读数基准，逐区域由契约的 `scope` 决定）：
      · 默认「页面作用域」⇒ 只在 root 内查（实现侧的 `.el-card/.el-table` 在壳层和 AI 面板里同样存在，
        退回整屏就会把壳当页）。root 查不到时**不**退回文档，直接 exists=false —— 「页面里没有这个区块」
        本身就是差异表的输入。
      · 契约标 `scope:"shell"` 的区域（如页面标题在两侧都渲染在**顶栏**，不在页体内）⇒ 按文档口径查。
      · 原型侧契约里还有 `#wbBody .page-header` 这类**带祖先前缀**的选择器，限定到面板根后必然查不到
        （写的是祖先链），所以原型侧统一开 `fallbackToDocument`；实现侧关闭。
  */
  const docFallback = cfg.fallbackToDocument !== false || !root;
  /*
    祖先前缀摘除（cfg.stripAncestorPrefix，原型侧开启）：契约里原型侧还留着 `#wbBody .page-header`
    这类**带祖先前缀**的选择器；限定到页面根之后祖先链不在子树内，必然查不到。先摘掉前缀再在根子树里查，
    查不到就如实 exists=false —— 「这一页没有这个区块」本身就是差异表的输入，不再靠退回整屏兜底
    （退回整屏会把 AI 信息流/壳层里的同名区块当成页面区块，量出来的是一屏的数，逐行假红）。
  */
  const normSel = (s) => {
    if (!cfg.stripAncestorPrefix || !root) return s;
    const t = String(s).trim();
    // 裸祖先 id（`#wbBody`/`#wbWrap`…）在根子树里必然查不到 ⇒ 语义就是「页面本体」，映射到根自身
    if (/^#(wbBody|wbView|wbWrap|wbTop|wbMain)$/.test(t)) return "__ROOT__";
    return t.replace(/^#(wbBody|wbView|wbWrap|wbTop|wbMain)\s+/, "");
  };
  /* 「同一角色」的取值口径：命中的必须是**真的排出了尺寸**的那一个，不是文档序第一个节点。
     业务页里同一角色常有多份 DOM（隐藏 tab 页 / v-show 抽屉 / 未展开的明细卡里的同名筛选条），
     文档序第一个若是零尺寸的那份，量到 width:0 / x:0 ⇒ 差异表把「隐藏分支」当成页面本体判红，
     而原型侧永远只有可见那一份 ⇒ 两侧基准不同。零尺寸仍要回首份也是故意的：角色真没渲染出来时
     （如无数据 ⇒ 分页条不渲染），零读数就是事实，不许借别的层凑数 —— 细分见下面的 rendered()。 */
  const laidOut = (el) => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0;
  };
  /* 「没渲染出来」与「渲染出来但零尺寸」是两件事，必须分开（13B 实测：会员系统的隐藏 tab 面板里也有一条
     .filter-bar，文档序排在可见那条之前 ⇒ 借过来量到 h=0/w=0，与原型可见筛选条逐行假红）：
     · checkVisibility() false ⇒ display:none / visibility:hidden / content-visibility:hidden / hidden 属性，
       这一份 DOM 根本不在页面上 ⇒ 不能当页面读数，只能继续找下一个别名。
     · 可见但 getBoundingClientRect 为零 ⇒ 真空容器（无数据 ⇒ 分页条不渲染）⇒ 零读数就是事实。 */
  const rendered = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : laidOut(el) || getComputedStyle(el).display !== "none");
  const pick = (sel, base) => {
    const list = Array.isArray(sel) ? sel : [sel];
    let allHidden = null;
    for (const raw of list) {
      if (!raw) continue;
      const s = normSel(raw);
      if (s === "__ROOT__") return root ? { el: root, sel: s, mode: "root" } : null;
      const all = base ? [...base.querySelectorAll(s)] : [];
      const doc = all.length ? [] : docFallback ? [...document.querySelectorAll(s)] : [];
      const pool = all.length ? all : doc;
      if (!pool.length) continue;
      const shown = pool.findIndex((el) => rendered(el) && laidOut(el));
      if (shown >= 0) {
        const mode = pool.length === 1 ? "single" : `laidOut#${shown + 1}-of-${pool.length}`;
        return { el: pool[shown], sel: s, mode };
      }
      const live = pool.find(rendered);
      if (!live) {
        // 整份候选都被收起 ⇒ 本别名在这屏不存在；先记下来，全部别名都这样才判「缺失（隐藏子树）」
        allHidden = allHidden ?? { sel: s, hiddenOnly: pool.length };
        continue;
      }
      const mode = pool.length === 1 ? "single" : `zeroSize-of-${pool.length}`;
      return { el: live, sel: s, mode };
    }
    return allHidden;
  };
  const countOf = (sel, base) => {
    const list = Array.isArray(sel) ? sel : [sel];
    for (const raw of list) {
      if (!raw) continue;
      const s = normSel(raw);
      if (s === "__ROOT__") return root ? { n: 1, sel: s } : { n: 0, sel: "" };
      const inRoot = base ? base.querySelectorAll(s).length : 0;
      const n = inRoot > 0 ? inRoot : docFallback ? document.querySelectorAll(s).length : 0;
      if (n > 0) return { n, sel: s };
    }
    return { n: 0, sel: "" };
  };
  /*
    两条同源的读数归一（两侧都走，缺一条就会造出假红）：
    ① backgroundColor 透明 ⇒ 视觉上看到的是**最近一层有底色的祖先**（原型的 .s-twrap/.wb-tbl 自身没有
       background，落到页面白底上；实现的 .table-card 自带白底）。直接比 rgba 字面值得到
       「0,0,0 vs 255,255,255」的假红，因此透明时向上取首个不透明底色，并记 backgroundColorSource。
    ② 边框色 ⇒ `border-style:none` 时 getComputedStyle 的 borderXColor 会**回落成 currentColor**
       （原型 .s-fi 容器无下边框却读出 #16181D 就是这个），这不是颜色差而是「没有边框」。
       因此该边宽度为 0 时读数记 "none"，让差异表比的是「有无描边」而不是继承来的文字色。
  */
  const alphaOf = (c) => {
    const m = /rgba?\(([^)]*)\)/.exec(String(c || ""));
    if (!m) return 1;
    const p = m[1].trim().split(/[\s,/]+/).filter(Boolean);
    return p.length >= 4 ? Number(p[3]) : 1;
  };
  const paintedBg = (el) => {
    let cur = el;
    for (let d = 0; d < 14 && cur; d += 1) {
      const c = getComputedStyle(cur).backgroundColor;
      if (c && alphaOf(c) > 0.01) return { value: c, source: cur === el ? "self" : `ancestor:${cur.tagName.toLowerCase()}` };
      cur = cur.parentElement;
    }
    return { value: "transparent", source: "none" };
  };
  const sideColor = (st, side) => (Number.parseFloat(st[`border${side}Width`]) > 0 ? st[`border${side}Color`] : "none");
  const baseFor = (region) => (region.scope === "shell" ? document : scope);
  const out = {};
  for (const region of contract) {
    const hit = pick(region[sideKey], baseFor(region));
    const cands = Array.isArray(region[sideKey]) ? region[sideKey] : [region[sideKey]];
    if (!hit) {
      out[region.key] = { exists: false, candidates: cands, metrics: {} };
      continue;
    }
    if (hit.hiddenOnly) {
      // 别名全命中在隐藏子树里 ⇒ 这一屏没有这个区块（存在性交给契约的 expect 档位：either 豁免，both 才判缺）
      out[region.key] = { exists: false, visible: false, candidates: cands, selector: hit.sel, pickMode: `hiddenOnly-of-${hit.hiddenOnly}`, metrics: {} };
      continue;
    }
    const r = hit.el.getBoundingClientRect();
    const st = getComputedStyle(hit.el);
    /* countScope:"table"（契约里给 itemCount=列数 的表头区）⇒ 只数**首个命中单元格所在那张表**的同类单元格。
       原型融合页一页多表（主列表 + 明细卡内表），整页累加得到 27/30 这种「别张表的列」，是口径假红。 */
    let cnt = countOf(region[sideKey], baseFor(region));
    if (region.countScope === "table" && typeof hit.el.closest === "function") {
      const tbl = hit.el.closest("table");
      if (tbl) cnt = { n: tbl.querySelectorAll(hit.el.tagName.toLowerCase()).length, sel: `${cnt.sel}@closest-table` };
    }
    const bg = paintedBg(hit.el);
    /* 「一行容器」的高度两侧常差几像素，只报容器高度找不到根因 ⇒ 对分型宿主附带最高子元素的身份与高度。
       只作诊断（不写进契约 gate ⇒ 差异表里恒为 recorded），不参与判红。 */
    let tall = null;
    if (DIAG_HOSTS.includes(region.key)) {
      const kids = [...hit.el.children].map((c) => {
        const cr = c.getBoundingClientRect();
        const first = String(c.getAttribute("class") || "").trim().split(/\s+/)[0];
        return { h: Math.round(cr.height * 100) / 100, id: `${c.tagName.toLowerCase()}${first ? `.${first}` : ""}` };
      });
      if (kids.length) tall = kids.reduce((a, b) => (b.h > a.h ? b : a));
    }
    out[region.key] = {
      exists: true,
      visible: isVisible(hit.el),
      selector: hit.sel,
      pickMode: hit.mode,
      itemCount: cnt.n,
      metrics: {
        x: Math.round(r.x * 100) / 100,
        y: Math.round(r.y * 100) / 100,
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        right: Math.round(r.right * 100) / 100,
        bottom: Math.round(r.bottom * 100) / 100,
        display: st.display,
        visibility: st.visibility,
        opacity: st.opacity,
        backgroundColor: bg.value,
        backgroundColorSource: bg.source,
        color: st.color,
        padding: st.padding,
        gap: st.gap,
        margin: st.margin,
        marginBottom: st.marginBottom,
        borderRadius: st.borderTopLeftRadius,
        borderStyle: st.borderTopStyle,
        borderTopWidth: st.borderTopWidth,
        borderTopColor: sideColor(st, "Top"),
        borderBottomWidth: st.borderBottomWidth,
        borderBottomColor: sideColor(st, "Bottom"),
        boxShadow: st.boxShadow === "none" ? "none" : "set",
        fontSize: st.fontSize,
        fontWeight: st.fontWeight,
        lineHeight: st.lineHeight,
        gridColumns: st.gridTemplateColumns === "none" ? "none" : st.gridTemplateColumns,
        flexWrap: st.flexWrap,
        flexDirection: st.flexDirection,
        borderCollapse: st.borderCollapse,
        tallestChildHeight: tall ? tall.h : 0,
        tallestChild: tall ? `${tall.id}=${tall.h}` : "none",
        itemCount: cnt.n,
        text: (hit.el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
      },
    };
  }
  const fonts = {};
  for (const role of fontRoles) {
    const hit = pick(role[sideKey], role.scope === "shell" ? document : scope);
    if (!hit || hit.hiddenOnly) {
      // 字体角色也一样：命中的若是隐藏子树，读到的字号属于没画出来的那一版 ⇒ 记不存在，由字体面跳过（缺失交差异表判）
      fonts[role.role] = { exists: false, pickMode: hit ? `hiddenOnly-of-${hit.hiddenOnly}` : null };
      continue;
    }
    const st = getComputedStyle(hit.el);
    fonts[role.role] = { exists: true, fontSize: st.fontSize, fontWeight: st.fontWeight, color: st.color, selector: hit.sel };
  }
  const topTitleEl = document.querySelector(cfg.topTitleSel ?? "#topTitle") ?? document.querySelector(".wb-top .wb-top-title");
  out.__fonts = fonts;
  out.__page = {
    scopeRootSel: rootSel,
    scopeFallback: root ? null : "document（rootSel 未命中 ⇒ 读数是整屏口径，不可当作页面口径）",
    scopeClass: root ? String(root.getAttribute("class") || root.tagName.toLowerCase()).slice(0, 60) : null,
    scopeBox: root ? (() => { const r = root.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x)},${Math.round(r.y)}`; })() : null,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    title: document.title,
    topTitle: (topTitleEl?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
    url: location.href.replace(/[?#].*$/, ""),
    hash: location.hash,
    search: location.search,
    uiuxInject: document.querySelector('[data-testid="wb-shell"]')?.getAttribute("data-uiux-inject") ?? "absent",
    t: Math.round(performance.now()),
  };
  return out;
}

/** 导航态读数（卡 §三.A.4 点名：rail 选中态 + 二级列标题/入口数量/顺序/文案/选中） */
function NAV_STATE_READER(cfg) {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      x: Math.round(r.x * 100) / 100,
      y: Math.round(r.y * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      backgroundColor: st.backgroundColor,
      color: st.color,
      display: st.display,
      visibility: st.visibility,
      on: el.classList.contains(cfg.onClass),
      label: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24),
    };
  };
  const railSel = cfg.railItemSel;
  const rail = [...document.querySelectorAll(railSel)].map((el) => ({
    key: el.getAttribute(cfg.railKeyAttr) ?? "",
    ...box(el),
    iconColor: (() => {
      const ic = el.querySelector("svg, .el-icon, i");
      return ic ? getComputedStyle(ic).color : "";
    })(),
  }));
  const titleEl = document.querySelector(cfg.subTitleSel);
  const cards = [...document.querySelectorAll(cfg.subCardSel)].map((el) => ({
    label: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24),
    ...box(el),
    disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
    status: el.getAttribute("data-plan-status") ?? "",
  }));
  const skeleton = !!document.querySelector(cfg.skeletonSel ?? "null");
  return {
    rail,
    railOn: rail.filter((r) => r.on).map((r) => r.key || r.label),
    subTitle: (titleEl?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
    subCount: cards.length,
    subLabels: cards.map((c) => c.label),
    subActive: cards.filter((c) => c.on).map((c) => c.label),
    subDisabledCount: cards.filter((c) => c.disabled).length,
    skeleton,
  };
}

/**
 * 类名清点（版式核对用）：把页面面板里真实渲染出的类名与出现次数落进证据，
 * 差异表的每个「区域缺失」都能对回这份真源，而不是靠人眼看截图猜。
 */
function CLASS_INVENTORY(cfg) {
  const candidates = [cfg.panelSel, cfg.rootSel, ...(Array.isArray(cfg.extraRootSels) ? cfg.extraRootSels : [])].filter(Boolean);
  let root = null;
  let used = null;
  for (const s of candidates) {
    const el = document.querySelector(s);
    if (el) { root = el; used = s; break; }
  }
  root = root || document.body;
  /* SVG 元素的 `className` 是 SVGAnimatedString 对象，String() 会得到 "[object SVGAnimatedString]"
     ⇒ 类名台账必须走属性读取，否则表格图标/箭头会把整张台账顶满噪声项。 */
  const cls = (el) => (el.getAttribute && el.getAttribute("class")) || "";
  const tokens = new Map();
  for (const el of root.querySelectorAll("*")) {
    for (const c of cls(el).split(/\s+/)) {
      if (!c || c.length > 34) continue;
      tokens.set(c, (tokens.get(c) ?? 0) + 1);
    }
  }
  const kids = [...root.children].slice(0, 24).map((el) => ({ cls: cls(el).slice(0, 40), tag: el.tagName.toLowerCase(), y: Math.round(el.getBoundingClientRect().y), h: Math.round(el.getBoundingClientRect().height) }));
  return {
    root: cls(root).slice(0, 40) || root.tagName.toLowerCase(),
    rootSel: used,
    elements: root.querySelectorAll("*").length,
    classes: [...tokens.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([cls, n]) => `${cls}×${n}`),
    childRhythm: kids,
    pagePanelExists: !!document.querySelector(cfg.panelSel),
  };
}

/**
 * 原型侧「页面是否真的打开」的真相读取。
 * 原型的演示时序会在后台自动发消息（busy=true 期间 actSub→openWB 被
 * `if(busy){toast('正在回复中，稍候再打开');return}` 整口吞掉），
 * 只看 #wbBody 首个子节点的 class 会把「其实是 AI 对话视图」误判成页面已渲染。
 * 因此这里直接读原型自己的全局状态量。WB_TAB / busy / wbOpen 是脚本顶层 let（不在 window 上），
 * 只能用名字在页面全局词法环境里取（new Function 体内引用），取不到就如实为 null；
 * 注意别在页内函数里再声明同名局部量，那会让它自己的 TDZ 反过来把读取打爆。
 * 本页侧函数必须自包含：Playwright 只搬运函数体。
 */
function PROTO_STATE_READER() {
  const D = document;
  // 通用活跃浮层口径（与 PROTO_OVERLAY_SCANNER 逐字一致：本页侧函数无法互相引用，只能就地内联，
  // 两处若口径漂移，门禁与就绪就会各说各话；改动时必须同步）
  const scanActive = () => {
    const acc = [];
    for (const el of D.querySelectorAll("body *")) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) <= 0.05) continue;
      if (st.position !== "fixed" && st.position !== "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 120) continue;
      if (Number(st.zIndex) < 1 && !el.classList.contains("show")) continue;
      acc.push(el.id || String(el.className || "").slice(0, 48));
    }
    return acc;
  };
  const g = (name) => { try { return new Function(`return typeof ${name}==="undefined"?null:${name}`)(); } catch (e) { return null; } };
  const railItems = [...D.querySelectorAll("nav.rail .rl-it:not(.rl-set)")];
  const body = D.querySelector("#wbBody");
  /*
    页面面板 = `#wbBody .s-wrap`（secPanel 的产物），不是 `#wbBody` 的第一个子元素。
    实测 `sale-bills` 时 `#wbBody` 首位是追加层注入的 `div.fu-relbar`（992×36 直达条），
    真正的 `.s-wrap`（992×2156）在它后面 ⇒ 拿 firstChild 量会得到「面板只有 36 高」的假象。
    非版块页（home/bill/stock/ordernew/detail）没有 .s-wrap，才退回 firstChild。
  */
  const panel = (body && body.querySelector(".s-wrap")) || (body ? body.firstElementChild : null);
  const panelRect = panel ? panel.getBoundingClientRect() : null;
  const chatScroll = D.querySelector("#chatScroll");
  return {
    t: Math.round(performance.now()),
    railCount: railItems.length,
    railOn: railItems.filter((e) => e.classList.contains("on")).map((e) => e.getAttribute("data-rk")),
    subCards: [...D.querySelectorAll("#subZone .sub-card")].map((c) => (c.textContent || "").trim()),
    subTitle: (D.querySelector("#subZone .qk-t")?.textContent || "").trim(),
    tab: g("WB_TAB"),
    busy: g("busy"),
    curMod: g("CUR_MOD"),
    wbOpen: g("wbOpen"),
    wbShow: !!D.querySelector("#wbView")?.classList.contains("show"),
    chatHidden: chatScroll ? getComputedStyle(chatScroll).display === "none" : null,
    topTitle: (D.querySelector("#topTitle")?.textContent || "").trim().slice(0, 40),
    panelCls: panel ? String(panel.className || "") : "",
    panelW: panelRect ? Math.round(panelRect.width) : 0,
    panelH: panelRect ? Math.round(panelRect.height) : 0,
    dockExists: !!D.querySelector("#wbBody .s-dock"),
    actives: scanActive(),
  };
}

/**
 * 原型侧「活跃浮层」通用口径。
 * 写死 id 的清单会漏：实测 `#posAlert` 的 class 是 `login show`（不在 `#login`/`.mask.show` 里），
 * 静默后仍在页面最上层拦截指针，rail 点击被 Playwright 判成「元素被遮挡」而超时。
 * 这里改为按真实覆盖行为判定：fixed/absolute + 可见 + 面积够大 + 有层叠或 show 态。
 * 本页侧函数必须自包含：Playwright 只搬运函数体。
 */
function PROTO_OVERLAY_SCANNER() {
  const acc = [];
  for (const el of document.querySelectorAll("body *")) {
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) <= 0.05) continue;
    if (st.position !== "fixed" && st.position !== "absolute") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) continue;
    if (Number(st.zIndex) < 1 && !el.classList.contains("show")) continue;
    acc.push({
      id: el.id || "",
      cls: String(el.className || "").slice(0, 40),
      selector: el.id ? `#${el.id}` : `.${String(el.className || "").split(" ")[0]}`,
      z: st.zIndex,
      width: Math.round(r.width),
      height: Math.round(r.height),
      pointerEvents: st.pointerEvents,
    });
  }
  return acc;
}

/** 遮罩空白点：元素自身可点的、不被子节点遮挡的位置（真实用户「点遮罩关闭」的落点） */
function PROTO_BACKDROP_SPOT(cfg) {
  const el = cfg.id ? document.getElementById(cfg.id) : document.querySelector(cfg.selector);
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
 * 用真实交互把原型浮层归零（Escape + 点遮罩空白），绝不 add/remove class 或改 style。
 * 返回 { boot, trail, final }，final=0 才算干净。
 */
async function dismissProtoOverlays(page, label) {
  const trail = [];
  const boot = await page.evaluate(PROTO_OVERLAY_SCANNER);
  let list = boot;
  for (let round = 0; round < 5 && list.length > 0; round += 1) {
    const entry = { round, before: list.map((o) => o.id || o.cls), actions: [] };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(220);
    list = await page.evaluate(PROTO_OVERLAY_SCANNER);
    entry.actions.push(`Escape ⇒ 剩 ${list.length}`);
    for (const o of list.slice()) {
      const spot = await page.evaluate(PROTO_BACKDROP_SPOT, o);
      if (!spot) {
        entry.actions.push(`无空白遮罩可点：${o.id || o.cls}`);
        continue;
      }
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(220);
      entry.actions.push(`遮罩点击 ${o.id || o.cls} @${spot.x},${spot.y}`);
    }
    list = await page.evaluate(PROTO_OVERLAY_SCANNER);
    entry.after = list.map((o) => o.id || o.cls);
    trail.push(entry);
  }
  return { side: label, boot: boot.map((o) => o.id || o.cls), trail, final: list.length, finalList: list };
}

/** 原型侧采集就绪门：页面真的按目标 tab 打开，且状态未被演示时序破坏 */
function PROTO_PAGE_GATE(cfg) {
  const D = document;
  // 页内函数必须自包含：活跃浮层判定就地内联（口径与 PROTO_OVERLAY_SCANNER 逐字一致）
  const scanActive = () => {
    const acc = [];
    for (const el of D.querySelectorAll("body *")) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) <= 0.05) continue;
      if (st.position !== "fixed" && st.position !== "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 120) continue;
      if (Number(st.zIndex) < 1 && !el.classList.contains("show")) continue;
      acc.push({ id: el.id || "", cls: String(el.className || "").slice(0, 48) });
    }
    return acc;
  };
  const actives = scanActive();
  const railItems = [...D.querySelectorAll("nav.rail .rl-it:not(.rl-set)")];
  const on = railItems.filter((e) => e.classList.contains("on")).map((e) => e.getAttribute("data-rk"));
  const cards = [...D.querySelectorAll("#subZone .sub-card")].map((c) => (c.textContent || "").trim());
  const body = D.querySelector("#wbBody");
  // 页面面板以 .s-wrap 为准：追加层会把 fu-relbar 直达条插到 #wbBody 首位（实测 992×36），
  // 用 firstChild 量会得到「面板没铺开」的假象；只有非版块页（无 .s-wrap）才退回 firstChild。
  const panel = (body && body.querySelector(".s-wrap")) || (body ? body.firstElementChild : null);
  const panelRect = panel ? panel.getBoundingClientRect() : null;
  const panelCls = panel ? String(panel.className || "") : "";
  const g = (name) => { try { return new Function(`return typeof ${name}==="undefined"?null:${name}`)(); } catch (e) { return null; } };
  const tab = g("WB_TAB");
  const busy = g("busy");
  const info = {
    t: Math.round(performance.now()),
    railCount: railItems.length,
    railOn: on,
    targetOn: on.includes(cfg.railKey),
    subTitle: (D.querySelector("#subZone .qk-t")?.textContent || "").trim(),
    subCount: cards.length,
    panelCls,
    panelW: panelRect ? Math.round(panelRect.width) : 0,
    panelH: panelRect ? Math.round(panelRect.height) : 0,
    hasPagePanel: !!D.querySelector("#wbBody .s-wrap"),
    dockExists: !!D.querySelector("#wbBody .s-dock"),
    topTitle: (D.querySelector("#topTitle")?.textContent || "").trim().slice(0, 40),
    tab,
    busy,
    curMod: g("CUR_MOD"),
    wbOpen: g("wbOpen"),
    wbShow: !!D.querySelector("#wbView")?.classList.contains("show"),
    chatHidden: (() => { const c = D.querySelector("#chatScroll"); return c ? getComputedStyle(c).display === "none" : null; })(),
    actives: actives.map((m) => m.id || m.cls || m.selector),
  };
  if (info.railCount === 0) return { ok: false, stage: "rail", why: "rail 尚未渲染", info };
  if (actives.length) return { ok: false, stage: "modal", why: `活跃模态 ×${actives.length}：${info.actives.join(",")}`, info };
  if (!info.targetOn) return { ok: false, stage: "railOn", why: `rail 选中项=${info.railOn.join(",") || "∅"} 期望=${cfg.railKey}`, info };
  // ↓↓↓ 页面打开真相：这四条缺一条就是「没进到那一页」，绝不拿对话视图/信息流当页面证据
  if (busy === true) return { ok: false, stage: "busy", why: "原型 AI 演示正在回复（busy=true），点击被吞", info };
  if (info.wbShow !== true) return { ok: false, stage: "wbShow", why: `#wbView 未处于 show 态（主区仍是${info.chatHidden === false ? "AI 对话" : "工作台信息流"}）`, info };
  if (cfg.expectTab && info.tab !== cfg.expectTab) return { ok: false, stage: "tab", why: `WB_TAB=${JSON.stringify(info.tab)} 期望=${JSON.stringify(cfg.expectTab)}（点击未落到目标页）`, info };
  if (!info.hasPagePanel) return { ok: false, stage: "panel", why: `#wbBody 内没有版块页面面板 .s-wrap（firstChild=${panelCls || "∅"}）`, info };
  if (info.panelW < 40 || info.panelH < 40) return { ok: false, stage: "panel-size", why: `页面面板尺寸为 ${info.panelW}×${info.panelH}，未真正铺开`, info };
  return { ok: true, info };
}

/* ────────────────────────── 浏览器 ────────────────────────── */

const require = createRequire(path.join(WEB, "package.json"));
const { chromium } = require("playwright");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex").toUpperCase();

const netFailures = [];
const okUrls = new Map();

function attachNetwork(page) {
  page.on("response", (res) => {
    if (res.status() < 400) okUrls.set(res.url(), (okUrls.get(res.url()) ?? 0) + 1);
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    netFailures.push({ method: req.method(), url, port: portOfUrl(url), error: String(req.failure()?.errorText ?? "unknown"), signature: `${req.method()} ${url}` });
  });
}

async function newPage(browser, vp, auth) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
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

const IMPL_MODAL_SELECTORS = [".el-overlay", ".el-notification"];

/*
 * 页面读数根（两侧各一套，按序取第一个命中）。
 * 实现侧的 `main.wb-view-manual` 里第一项可能是 `WORKBENCH-13` 修好的菜单空态覆盖层，
 * 业务页本体恒为其**最后一个子元素**（`<router-view/>` 无条件常驻，见 WorkbenchShell.vue:198-221）；
 * 但空态出现时业务页并不存在 ⇒ 用 `.shown > *` 取真实渲染出的页根。
 * `.page` 是绝大多数视图的根类，`.pos-*`/`.category-page`/`.supplier-page`/`.payment-page`
 * 等是 POS/商品/供应商/付款页的自有根（实测 /sale-bills=.pos-sale-bills、/collection=.pos-collection），
 * 所以把「人工层第一个子元素」放在最前，类名候选只作兜底。
 */
const IMPL_PAGE_ROOT_SELS = [
  'main[data-view="manual"].shown > *',
  'main[data-view="manual"] > *:not([data-testid="menu-empty"])',
  ".page",
];
/*
 * 原型侧页面读数根 = **带内边距的那一层** `.wb-wrap`（融合版 L195：max-width 1080 + 32/44/60），
 * 不是它里面已经扣掉边距的 `.s-wrap`（L749 `min-width:0`）。
 * 理由：实现侧的页根（`main.wb-view-manual > *`）在 13B 里正是承托这层包装语法的那个元素
 * （styles.css 的 WORKBENCH-13B 段把 1080/32-44-60 打在它身上）。
 * 若原型仍取 `.s-wrap`，两侧量的就不是同一层：`.s-wrap` 是 992@369 的**内容宽**，
 * 而实现页根是 1080@325 的**边框盒**，pageRoot 的 x/width/padding 三行会永远假红。
 * POS 版式在原型里是 `.wb-wrap.pos-full`（L197），同一条 `.wb-wrap` 选择器已覆盖。
 */
const PROTO_PAGE_ROOT_SELS = ["#wbWrap.wb-wrap", "#wbView .wb-wrap", ".wb-wrap"];

/** 实现侧浮层清零：真实 Escape / 遮罩点击，绝不改 class（口径与 F3 一致） */
async function dismissActiveModals(page, selectors, label) {
  const trail = [];
  let active = await page.evaluate(ACTIVE_MODAL_SCANNER, selectors);
  const bootActive = active.slice();
  for (let round = 0; round < 4 && active.length > 0; round++) {
    const entry = { round, before: active.map((m) => m.id || m.cls || m.selector), actions: [] };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(280);
    active = await page.evaluate(ACTIVE_MODAL_SCANNER, selectors);
    entry.actions.push(`Escape ⇒ 剩 ${active.length}`);
    entry.after = active.map((m) => m.id || m.cls || m.selector);
    trail.push(entry);
  }
  await page.waitForTimeout(350);
  const p1 = await page.evaluate(ACTIVE_MODAL_SCANNER, selectors);
  await page.waitForTimeout(300);
  const p2 = await page.evaluate(ACTIVE_MODAL_SCANNER, selectors);
  return {
    side: label,
    bootActive: bootActive.map((m) => m.id || m.cls || m.selector),
    trail,
    finalActive: p2.length,
    finalList: p2,
    stable: p1.length === 0 && p2.length === 0 && active.length === 0,
  };
}

/* ────────────────────────── 采集计划（两份机器真源派生，不手抄） ────────────────────────── */

function readJsonRequired(f, label) {
  if (!existsSync(f)) {
    console.error(`缺少 ${label}：${f}\n⇒ 先跑 tests/wb13b-proto-page-model.mjs 与 tests/wb13b-entry-inventory.mjs`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(f, "utf8"));
}
const model = readJsonRequired(MODEL_FILE, "原型页面模型（§三.A.1/5）");
const inventory = readJsonRequired(INVENTORY_FILE, "人工入口清单（§三.A.1）");
const protoSha = sha256(readFileSync(PROTO_FILE));
log(`原型指纹：${protoSha}（卡面 ${PROTO_SHA_EXPECT}）`);
if (protoSha !== PROTO_SHA_EXPECT) {
  console.error(`原型指纹与卡面不符 ⇒ 拒绝采集（避免拿改版原型出旧口径证据）`);
  process.exit(1);
}

const railKeyOf = new Map((model.catalogReconciliation ?? []).map((c) => [c.sectorKey, c.railKey]));
const ALL_BUSINESS_SECTORS = (model.model ?? [])
  .map((s) => s.sectorKey)
  .filter((k) => k !== "dash" && k !== "pos" && railKeyOf.get(k));

const moduleFilter = flag("modules")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const viewportFilter = flag("viewports")?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const viewports = viewportFilter ? PAGE_VIEWPORTS.filter((v) => viewportFilter.includes(v.id)) : PAGE_VIEWPORTS;
const pageLimits = (() => {
  const raw = flag("pages");
  const map = { "1440x1000": Infinity, "1024x768": 2 };
  if (raw) {
    for (const part of raw.split(",")) {
      const [k, v] = part.split(":");
      if (k && v) map[k.trim()] = Number(v);
    }
  }
  return map;
})();
const modules = (moduleFilter ?? ALL_BUSINESS_SECTORS).map((sectorKey) => {
  const sector = (model.model ?? []).find((s) => s.sectorKey === sectorKey);
  return {
    key: sectorKey,
    railKey: railKeyOf.get(sectorKey) ?? sectorKey,
    name: sector?.sectorName ?? sectorKey,
  };
});

/** 页面配对：原型侧真实二级卡 ⇄ 实现侧路由入口（两侧都必须能真实点到才算可采） */
const plan = [];
for (const m of modules) {
  const sector = (model.model ?? []).find((s) => s.sectorKey === m.key);
  const pages = (sector?.lv2 ?? []).filter((p) => p.protoSubLabel && p.routePath && p.superAdminVisible !== false);
  for (const vp of viewports) {
    const limit = pageLimits[vp.id] ?? pages.length;
    pages.slice(0, limit === Infinity ? pages.length : limit).forEach((p) => {
      const implEntry = (inventory.entries ?? []).find((e) => e.routeName === p.routeName || e.path === p.routePath || (e.menuCode && e.menuCode === p.manifestMenuCode));
      plan.push({
        id: `${m.key}/${p.viewKey}@${vp.id}`,
        moduleKey: m.key,
        moduleRailKey: m.railKey,
        moduleName: m.name,
        viewport: vp,
        panelType: p.panelType,
        page: {
          viewKey: p.viewKey,
          pageName: p.pageName,
          protoSubLabel: p.protoSubLabel,
          routePath: p.routePath,
          routeName: p.routeName,
          manifestTitle: p.manifestTitle,
          protoComponent: p.protoComponent,
          routeCompKey: p.routeCompKey,
          protoApis: p.protoApis,
        },
        protoCandidates: [p.protoSubLabel, p.pageName].filter(Boolean),
        implCandidates: [p.protoSubLabel, p.manifestTitle, p.routeTitle, p.pageName].filter(Boolean),
        implEntry: implEntry ?? null,
      });
    });
  }
}
log(`采集计划：${modules.length} 个业务模块 × ${viewports.map((v) => v.id).join("/")} ⇒ ${plan.length} 个页面配对`);

const NOTES = existsSync(NOTES_FILE) ? JSON.parse(readFileSync(NOTES_FILE, "utf8")) : {};
log(`偏差书面解释：${existsSync(NOTES_FILE) ? `已加载 ${NOTES_FILE}` : "无（全部超容差项一律判红，不做默认豁免）"}`);

/* ────────────────────────── 采集主流程 ────────────────────────── */

let browser = null;
let exitCode = 0;
let aborted = null;
const pairs = [];
const frames = [];
const errors = [];
const moduleNav = [];
let auth = null;

/**
 * 原型静默就绪：每视口只做一次。
 * 原型自带的冒烟时序（V23/V28/V31…）会在启动后约 20 秒内反复自动发消息、切会话、开弹层，
 * 期间任何一次真实点击都可能被 `busy` 吞掉或把主区拉回对话视图。实测：演示跑完后
 * （活跃浮层归零 + busy=false 连续 2.5 秒）页面进入长期稳定态，逐页真实点击能落地并保持住。
 * 绝不用虚拟时间快进（会把所有演示定时器一次性触发，反而更脏：#setwin/#posAlert 同时敞开）。
 */
async function ensurePrototypeSettled(page, session, vp) {
  if (session.settled === vp.id) return { ok: true, ms: session.settleMs };
  await page.goto(PROTO_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  /*
   * 静默判据要「连续」而不是「抽样三次」：实测 t=10.9s 出现 300ms 的假静默，
   * 紧接着 t=12s busy 又置真 ⇒ 三次×100ms 的窗口会把演示中的一次喘气当成跑完，
   * 点卡照样被吞。这里要求连续 2.5 秒零浮层 + busy=false 才算演示跑完。
   */
  const QUIET_MS = 2500;
  const STEP_MS = 250;
  let last = null;
  let quiet = 0;
  for (let waited = 0; waited < 150000; waited += STEP_MS) {
    last = await page.evaluate(PROTO_STATE_READER);
    const okNow = last.railCount > 0 && last.subCards.length > 0 && last.actives.length === 0 && last.busy === false;
    quiet = okNow ? quiet + STEP_MS : 0;
    if (quiet >= QUIET_MS) break;
    await page.waitForTimeout(STEP_MS);
  }
  const ok = quiet >= QUIET_MS;
  if (!ok) {
    session.overlays = await page.evaluate(PROTO_OVERLAY_SCANNER).catch(() => null);
    return { ok: false, ms: last?.t ?? null, state: last };
  }
  // 静默后仍可能残留演示弹层（实测 #posAlert / #setwin）：用真实 Escape + 点遮罩空白归零，不改 class/style
  const dismiss = await dismissProtoOverlays(page, "prototype-settle");
  const after = await page.evaluate(PROTO_STATE_READER);
  session.settled = vp.id;
  session.settleMs = after.t;
  session.dismiss = dismiss;
  return { ok: after.actives.length === 0 && after.busy === false, ms: after.t, state: after, dismiss };
}

async function waitForPrototypeIdle(page, timeoutMs = 12000) {
  const start = Date.now();
  let last = null;
  for (;;) {
    last = await page.evaluate(PROTO_STATE_READER);
    if (last.busy === false && last.actives.length === 0) return { ok: true, ms: Date.now() - start, state: last };
    if (Date.now() - start >= timeoutMs) return { ok: false, ms: Date.now() - start, state: last };
    await page.waitForTimeout(300);
  }
}

async function capturePrototypePair(pair, page, vp, session) {
  const trail = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const settled = await ensurePrototypeSettled(page, session, vp);
    if (!settled.ok) {
      trail.push(`第 ${attempt} 轮：原型静默态未就绪（${JSON.stringify(settled.state ?? settled.ms).slice(0, 220)}）`);
      session.settled = null;
      continue;
    }
    try {
      /*
        rail 是开关式：`openModule(k)` 写 `CUR_MOD=(CUR_MOD===k)?null:k`。
        原型自带的演示时序会在静默前把某个模块点开 ⇒ 无脑再点一次等于「关掉它」，
        二级目录随即退回 `QUICK`（今日晨报/销售汇总…），后面按卡名找页面必然找不到。
        所以先读实时 CUR_MOD：已选中就不再点，未选中才点，点完必须复核。
      */
      const before = await page.evaluate(PROTO_STATE_READER);
      if (before.curMod !== pair.moduleKey) {
        await page.locator(`nav.rail .rl-it[data-rk='${pair.moduleKey}']`).first().click({ timeout: 8000 });
        await page.waitForTimeout(300);
      }
      const afterRail = await page.evaluate(PROTO_STATE_READER);
      if (afterRail.curMod !== pair.moduleKey) {
        trail.push(`第 ${attempt} 轮：rail 未切到模块（点击前 CUR_MOD=${JSON.stringify(before.curMod)}、点击后=${JSON.stringify(afterRail.curMod)}，二级目录标题=${JSON.stringify(afterRail.subTitle)}）`);
        session.settled = null;
        continue;
      }
      if (afterRail.actives.length) {
        trail.push(`第 ${attempt} 轮：模块切换后冒出活跃浮层 ${afterRail.actives.join(",")} ⇒ 归零后重试`);
        await dismissProtoOverlays(page, `prototype-after-rail-${attempt}`);
        session.settled = null;
        continue;
      }
    } catch (e) {
      const ov = await page.evaluate(PROTO_OVERLAY_SCANNER).catch(() => null);
      trail.push(`第 ${attempt} 轮：rail 点击失败（${String(e.message ?? e).split("\n")[0]}；活跃浮层 ${ov?.map((o) => o.id || o.cls).join(",") || "∅"}）⇒ 归零浮层后重试`);
      await dismissProtoOverlays(page, `prototype-rail-${attempt}`);
      session.settled = null;
      continue;
    }
    /* 演示时序可能在模块切换瞬间又抢回 busy ⇒ 点卡前短轮询等它自己空下来，别把重试次数烧在等待上 */
    const idle = await waitForPrototypeIdle(page);
    if (!idle.ok) {
      trail.push(`第 ${attempt} 轮：等待原型空转超时（busy=${JSON.stringify(idle.state?.busy)}、活跃浮层=${(idle.state?.actives ?? []).join(",") || "∅"}，${idle.ms}ms）`);
      await dismissProtoOverlays(page, `prototype-idle-${attempt}`);
      session.settled = null;
      continue;
    }
    const cards = idle.state.subCards;
    const idx = pair.protoCandidates
      .map((c) => cards.findIndex((label) => label === c))
      .find((i) => i >= 0) ?? cards.findIndex((label) => pair.protoCandidates.some((c) => label.includes(c)));
    if (idx < 0) {
      trail.push(`第 ${attempt} 轮：原型二级目录里没有「${pair.protoCandidates.join("/")}」（实有 ${cards.length} 卡：${cards.join("、")}）`);
      return { status: "blocked", reason: "proto-sub-card-missing", detail: `模块 ${pair.moduleName} 的实时二级目录（CUR_MOD=${pair.moduleKey}）里没有该页面对应的卡`, cards };
    }
    /*
     * 点卡最多三连击：`openWB` 在 busy=true 时直接 return（原型 L1985「正在回复中，稍候再打开」），
     * 一次点击被演示吞掉不算页面失败；同卡重复点击是幂等的（已开时走 opTab 重渲染同一页）。
     */
    let gate = null;
    for (let tap = 1; tap <= 3; tap += 1) {
      try {
        await page.locator("#subZone .sub-card").nth(idx).click({ timeout: 8000 });
      } catch (e) {
        trail.push(`第 ${attempt} 轮第 ${tap} 次点卡：点击被挡（${String(e.message ?? e).split("\n")[0]}）`);
        await dismissProtoOverlays(page, `prototype-card-${attempt}-${tap}`);
        session.settled = null;
        break;
      }
      await page.waitForTimeout(420);
      gate = await page.evaluate(PROTO_PAGE_GATE, {
        railKey: pair.moduleKey,
        expectTab: pair.page.viewKey,
      });
      if (gate.ok) break;
      trail.push(`第 ${attempt} 轮第 ${tap} 次点卡：页面态门未过（${gate.stage}:${gate.why}）`);
      if (gate.info?.busy === true || gate.info?.actives?.length) {
        await waitForPrototypeIdle(page);
        continue;
      }
      break;
    }
    if (!gate || !gate.ok) {
      await dismissProtoOverlays(page, `prototype-card-${attempt}`);
      continue;
    }
    const file = path.join(OUT, "shots", `parity-proto-${pair.moduleKey}-${pair.page.viewKey}-${vp.id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const post = await page.evaluate(PROTO_PAGE_GATE, { railKey: pair.moduleKey, expectTab: pair.page.viewKey });
    if (!post.ok) {
      trail.push(`第 ${attempt} 轮：截图后页面态被原型演示时序破坏（${post.stage}:${post.why}）⇒ 整页重采`);
      continue;
    }
    const readings = await page.evaluate(
      (payload) => {
        const reader = new Function(`return (${payload.readerSrc})`)();
        const nav = new Function(`return (${payload.navSrc})`)();
        const inv = new Function(`return (${payload.invSrc})`)();
        return { regions: reader(payload.readerCfg), nav: nav(payload.navCfg), inventory: inv(payload.inventoryCfg) };
      },
      {
        readerSrc: PAGE_REGION_READER.toString(),
        navSrc: NAV_STATE_READER.toString(),
        invSrc: CLASS_INVENTORY.toString(),
        readerCfg: {
          sideKey: "proto",
          contract: contractFor(pair.panelType),
          fontRoles: FONT_ROLES,
          topTitleSel: "#topTitle",
          rootSel: PROTO_PAGE_ROOT_SELS,
          // 页面区块一律在 `.wb-wrap` 子树内查；查不到就是「这一页没有这个区块」。
          // 关闭整屏退回 + 摘除 `#wbBody …` 祖先前缀：退回会把 AI 信息流/会话面板里的同名区块当成页面区块。
          fallbackToDocument: false,
          stripAncestorPrefix: true,
        },
        navCfg: {
          railItemSel: "nav.rail .rl-it:not(.rl-set)",
          railKeyAttr: "data-rk",
          onClass: "on",
          subTitleSel: "#subZone .qk-t",
          subCardSel: "#subZone .sub-card",
          skeletonSel: "null",
        },
        inventoryCfg: { panelSel: ".s-wrap", rootSel: "#wbBody" },
      },
    );
    return {
      status: "captured",
      readings,
      gate: gate.info,
      postGate: post.info,
      shot: fileShot(file, { side: "prototype", pair: pair.id, viewport: vp.id }),
      attempts: trail,
      quietMs: session.settleMs,
      settle: { viewport: vp.id, settledAtMs: session.settleMs, dismiss: session.dismiss ?? null },
    };
  }
  return { status: "blocked", reason: "proto-page-gate-never-passed", detail: `4 轮重采后仍未同时满足：rail 选中=${pair.moduleKey}、#wbView 处于 show、WB_TAB=${pair.page.viewKey}、#wbBody 内有 .s-wrap 且已铺开、活跃浮层=0`, attempts: trail };
}

/**
 * 实现侧 rail 一级项的真实 DOM 键解析。
 * 卡面/A1 清单里的 railKey 是**目录口径**（去掉 `wb.` 前缀后的 groupCode），
 * 而 WorkbenchShell 渲染的是 `:data-rail-key="group.groupCode"`（真实值形如 `wb.sales`），
 * 两者不能直接混用 ⇒ 这里以运行时真实 rail 清单为准解析，解析不到就返回 null 走诚实 BLOCKED。
 * 优先级：逐字相等 > `wb.` 前缀相等 > 文案等于模块名 > 键尾段相等。
 */
function IMPL_RAIL_KEY_RESOLVER(payload) {
  const items = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')];
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const keyed = items.map((el) => ({
    key: el.getAttribute("data-rail-key") ?? "",
    label: norm(el.textContent),
    visible: (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
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

/**
 * 二级列现场快照（实现侧）：整列的区域构成、目录卡标签与状态、真实区行、空态文案、当前 URL。
 * BLOCKED 记录必须带这张快照，否则复核时只看到「点不到」而看不到当时列里有什么。
 * 本页侧函数必须自包含：Playwright 只搬运函数体，模块作用域的自由变量在页面上下文里不存在。
 */
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

/**
 * 实现侧「页面是否真的到了并且真的画出来了」的行为门（卡 §三.A.2 同屏同状态口径）。
 * 只看 URL 不够：实测出现过 URL 已是业务页、但人工层没 shown（页面被 AI 面盖住/未渲染），
 * 采集器照样出帧 ⇒ 得到一张近乎纯白的证据图。门必须量行为：
 *   ① 壳层在；② URL 落在预期路由；③ `main[data-view="manual"].shown` 存在且有第一个子元素；
 *   ④ 该子元素有真实尺寸（≥240×120，业务页最小骨架）；⑤ 顶栏标题非空（页面身份已切换）。
 * 页内函数必须自包含（Playwright 只搬运函数体）。
 */
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
    emptyState: !!D.querySelector('[data-testid="menu-empty"]'),
    url: location.href.replace(/[?#].*$/, ""),
  };
}

/** 门未过时的现场取证：三层主面各自的状态（shown/尺寸/子节点/文本量），供 BLOCKED 记录如实带回 */
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

async function captureImplementationPair(pair, page, vp, ctxState) {
  // 每个模块都从默认工作台重新进入：上一模块的页面态/滚动位置不能带入下一模块的证据
  // 每个配对都重新进入默认工作台：上一配对的二级列状态/滚动位置/路由都不能带入下一配对的证据
  {
    await page.goto(ORIGIN, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector('[data-testid="wb-shell"]', { timeout: 30000 });
    ctxState.railReady = await page
      .waitForFunction(
        () => {
          const real = [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)')].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none";
          });
          return document.querySelector('[data-testid="rail"] [data-rail-skeleton="true"]') === null && real.length > 0;
        },
        null,
        { timeout: 30000, polling: 400 },
      )
      .then(() => true)
      .catch(() => false);
    ctxState.reloaded = vp.id;
    ctxState.enteredModule = null;
  }
  const railHit = await page.evaluate(IMPL_RAIL_KEY_RESOLVER, { railKey: pair.moduleRailKey, moduleName: pair.moduleName });
  if (!railHit.resolved) {
    return {
      status: "blocked",
      reason: "impl-rail-entry-missing",
      detail: `实现侧真实 rail 清单里解析不到模块「${pair.moduleName}」（目录口径 railKey=${pair.moduleRailKey}）`,
      live: { url: page.url(), skeleton: null, items: railHit.inventory },
    };
  }
  try {
    await page.locator(`[data-testid="rail"] [data-rail-key='${railHit.resolved}']`).first().click({ timeout: 8000 });
  } catch (e) {
    // 点不到 rail 一级项 ⇒ 如实 BLOCKED，并把当下真实的 rail 清单/骨架数/URL 一并带回，便于复核到达路径
    const live = await page
      .evaluate(() => ({
        url: location.href,
        shell: !!document.querySelector('[data-testid="wb-shell"]'),
        skeleton: document.querySelectorAll('[data-testid="rail"] [data-rail-skeleton="true"]').length,
        items: [...document.querySelectorAll('[data-testid="rail"] .wb-rail-item')].map((el) => ({
          key: el.getAttribute("data-rail-key"),
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 20),
          cls: [...el.classList].join(".").slice(0, 60),
          w: Math.round(el.getBoundingClientRect().width),
        })),
      }))
      .catch(() => null);
    return {
      status: "blocked",
      reason: "impl-rail-entry-missing",
      detail: `rail 里点不到 [data-rail-key='${railHit.resolved}']（等就绪=${ctxState.railReady === false ? "超时" : "OK"}）：${String(e).slice(0, 160)}`,
      live,
    };
  }
  ctxState.enteredModule = pair.moduleRailKey;
  ctxState.domRailKey = railHit.resolved;
  await page.waitForTimeout(1100);
  // 进入模块后先给二级列拍一张「真实快照」：后续任何点击失败/路由未变都要把它带进 BLOCKED 记录，
  // 这样复核时看得到当时目录里到底有哪些项、是否 pending、页面停在哪，而不是只知道「点不到」。
  const navSnap = await page.evaluate(SECOND_NAV_SNAPSHOT).catch(() => null);

  const beforeUrl = page.url();
  let clicked = null;
  let gate = null;
  const attemptTrail = [];
  /*
    到达路径按「真实人工入口优先」排序：
      ① real-zone `.sn-row`（账号真实菜单桥，人工模式的本职入口）
      ② sub-zone `.sn-card[data-plan-label]`（AI 计划预览卡，wired 时才同样跳路由）
    旧实现先点 ②：实测 sub-zone 卡集合是随 AI 底座状态变化的（底座不通时是另一批「待接入」标签），
    点中了却不跳路由 ⇒ 记成 `impl-route-did-not-change`，把采集器自己的选择器优先级问题
    误报成业务入口不可达。人工入口覆盖矩阵判的是 ①，所以 ① 必须先行。
  */
  const strategies = [
    { via: "real-zone", pick: (label) => page.locator(`[data-testid="second-nav-real-zone"] .sn-row:has-text("${label}")`).first() },
    { via: "proto-slot", pick: (label) => page.locator(`[data-testid="second-nav-sub-zone"] [data-plan-label="${label}"]:not([disabled])`).first() },
  ];
  for (const st of strategies) {
    for (const label of pair.implCandidates) {
      const card = st.pick(label);
      if ((await card.count()) > 0) {
        try {
          await card.click({ timeout: 8000 });
          clicked = { via: st.via, label };
        } catch (e) {
          attemptTrail.push(`${st.via}/${label} 点击异常：${String(e).slice(0, 120)}`);
        }
        break;
      }
    }
    if (clicked) break;
  }
  if (!clicked) {
    const labels = navSnap ? { cards: navSnap.cards.map((c) => c.label), rows: navSnap.rows.map((r) => r.text) } : await page.evaluate(() => ({
      cards: [...document.querySelectorAll('[data-testid="second-nav-sub-zone"] [data-plan-label]')].map((e) => e.getAttribute("data-plan-label")),
      rows: [...document.querySelectorAll('[data-testid="second-nav-real-zone"] .sn-row')].map((e) => (e.textContent || "").trim()),
    }));
    return {
      status: "blocked",
      reason: "impl-entry-unreachable",
      detail: `实现侧二级列里点不到「${pair.implCandidates.join("/")}」（目录 ${labels.cards.length} 项、真实区 ${labels.rows.length} 项）`,
      labels,
      navSnap,
      trail: attemptTrail,
    };
  }
  /*
    到达判定 = 行为门（IMPL_PAINT_GATE），不是 URL。
    URL 变了但人工层没画出来时，旧实现照样出帧 ⇒ 得到一张近乎纯白的「证据」。
    门未过就如实 BLOCKED，并把三层主面的现场快照 + 一张标注 blocked 的图一起带回。
  */
  let arrived = false;
  for (let round = 1; round <= 2; round += 1) {
    try {
      await page.waitForFunction(IMPL_PAINT_GATE, { routePath: pair.page.routePath }, { timeout: 12000, polling: 300 });
      arrived = true;
      break;
    } catch {
      gate = await page.evaluate(IMPL_PAINT_GATE, { routePath: pair.page.routePath }).catch(() => null);
      attemptTrail.push(`第 ${round} 轮行为门未过（${gate ? `shell=${gate.shell} manualShown=${gate.manualShown} root=${gate.pageRootClass ?? "∅"} box=${gate.pageRootBox ?? "∅"} title="${gate.title}" path=${gate.path}` : "门读数抛错"}）`);
      if (round === 1) {
        // 兜底重一次：换个到达策略（真实区没跳就试计划卡，反之亦然），仍失败才判不可达
        const other = strategies.find((s) => s.via !== clicked.via);
        for (const label of pair.implCandidates) {
          const card = other.pick(label);
          if ((await card.count()) > 0) {
            await card.click({ timeout: 8000 }).catch(() => {});
            clicked = { via: other.via, label, retry: true };
            break;
          }
        }
      }
    }
  }
  const urlNow = page.url();
  if (!arrived) {
    const live = await page.evaluate(IMPL_VIEWS_SNAPSHOT).catch(() => null);
    const blockedShot = path.join(OUT, "shots", `parity-impl-blocked-${pair.moduleKey}-${pair.page.viewKey}-${vp.id}.png`);
    await page.screenshot({ path: blockedShot, fullPage: false }).catch(() => {});
    return {
      status: "blocked",
      reason: beforeUrl === urlNow ? "impl-route-did-not-change" : "impl-page-not-painted",
      detail: beforeUrl === urlNow
        ? `点击后 URL 未变（${urlNow}），预期 ${pair.page.routePath}`
        : `URL 已到 ${urlNow} 但业务页没画出来（预期 ${pair.page.routePath} 的人工层有真实尺寸且顶栏标题非空）`,
      clicked,
      navSnap,
      gate,
      live,
      shot: blockedShot,
      trail: attemptTrail,
      afterClick: await page.evaluate(SECOND_NAV_SNAPSHOT).catch(() => null),
    };
  }
  await page.waitForTimeout(1200);
  const modals = await dismissActiveModals(page, IMPL_MODAL_SELECTORS, "implementation");
  const file = path.join(OUT, "shots", `parity-impl-${pair.moduleKey}-${pair.page.viewKey}-${vp.id}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const readings = await page.evaluate(
    (payload) => {
      const reader = new Function(`return (${payload.readerSrc})`)();
      const nav = new Function(`return (${payload.navSrc})`)();
      const inv = new Function(`return (${payload.invSrc})`)();
      return { regions: reader(payload.readerCfg), nav: nav(payload.navCfg), inventory: inv(payload.inventoryCfg) };
    },
    {
      readerSrc: PAGE_REGION_READER.toString(),
      navSrc: NAV_STATE_READER.toString(),
      invSrc: CLASS_INVENTORY.toString(),
      readerCfg: {
        sideKey: "impl",
        contract: contractFor(pair.panelType),
        fontRoles: FONT_ROLES,
        topTitleSel: ".wb-top .wb-top-title",
        // 读数限定到 <router-view/> 渲染出的业务页根，避免把壳层/AI 面板的容器算进页面区块
        rootSel: IMPL_PAGE_ROOT_SELS,
        fallbackToDocument: false,
      },
      navCfg: {
        railItemSel: '[data-testid="rail"] .wb-rail-item:not(.wb-rail-set):not(.is-rail-skeleton)',
        railKeyAttr: "data-rail-key",
        onClass: "on",
        subTitleSel: '[data-testid="second-nav-sub-title"]',
        subCardSel: '[data-testid="second-nav-sub-zone"] .sn-card',
        skeletonSel: '[data-testid="rail"] [data-rail-skeleton="true"]',
      },
      inventoryCfg: { panelSel: null, rootSel: null, extraRootSels: IMPL_PAGE_ROOT_SELS },
    },
  );
  const postModals = await page.evaluate(ACTIVE_MODAL_SCANNER, IMPL_MODAL_SELECTORS);
  const finalGate = await page.evaluate(IMPL_PAINT_GATE, { routePath: pair.page.routePath }).catch(() => null);
  /*
    出帧后的行为门是「这张图/这组读数到底是不是业务页」的最后一条证据链，必须 fail-closed：
    到达判定只在点击后轮询过一次，页面若在截图~读数之间被重建（灰度回滚分支、checkWebUpdate 触发的整页刷新、
    异步 chunk 报错后 Vue 卸载），读数会退回整屏口径 ⇒ 差异表每一行都失去页面基准，却仍标 captured。
    ⇒ 门在出帧时不过，就如实判 BLOCKED（带现场快照 + blocked 帧），不把整屏读数当页面证据（卡 §三.B fail-closed）。
  */
  if (finalGate && finalGate.ok !== true) {
    const live = await page.evaluate(IMPL_VIEWS_SNAPSHOT).catch(() => null);
    const blockedShot = path.join(OUT, "shots", `parity-impl-blocked-${pair.moduleKey}-${pair.page.viewKey}-${vp.id}.png`);
    await page.screenshot({ path: blockedShot, fullPage: false }).catch(() => {});
    return {
      status: "blocked",
      reason: "impl-paint-gate-failed-after-shot",
      detail: `出帧后行为门不过（shell=${finalGate.shell} manualShown=${finalGate.manualShown} root=${finalGate.pageRootClass ?? "∅"} box=${finalGate.pageRootBox ?? "∅"} title="${finalGate.title}" path=${finalGate.path}）⇒ 读数落在整屏口径，不作页面视觉证据`,
      navSnap,
      gate: finalGate,
      live,
      shot: blockedShot,
      trail: attemptTrail,
      afterClick: await page.evaluate(SECOND_NAV_SNAPSHOT).catch(() => null),
    };
  }
  return {
    status: "captured",
    readings,
    arrived,
    clicked,
    modals,
    postActive: postModals.length,
    // 出帧真相：页面根/尺寸/顶栏标题都取自行为门，复核者能确认量的是业务页而不是整屏
    paint: finalGate,
    pageRootClass: finalGate?.pageRootClass ?? null,
    pageRootBox: finalGate?.pageRootBox ?? null,
    topTitle: finalGate?.title ?? null,
    shot: fileShot(file, { side: "implementation", pair: pair.id, viewport: vp.id }),
  };
}

try {
  await startBackend();
  await startVite();
  auth = await loginViaProxy();
  browser = await chromium.launch({ executablePath: CHROME, headless: true });

  for (const vp of viewports) {
    /* 原型侧：每个页面配对一条全新的时间轴（reload + 静默等待 + 真实点击）⇒ 无跨页状态污染 */
    const { ctx: pctx, page: ppage } = await newPage(browser, vp, null);
    /* 实现侧：同一登录态上下文内逐模块走查（真实点击 ⇒ 状态延续），换模块时回到默认工作台重进 */
    const implCtx = await newPage(browser, vp, auth);
    if (implCtx) {
      implCtx.page.on("pageerror", (e) => {
        const msg = redactText(String(e)).slice(0, 240);
        errors.push(`实现侧页面未捕获异常（${vp.id}）：${msg}`);
      });
    }
    const ctxState = { enteredModule: null, reloaded: null };
    const navSeen = {};
    /* 原型侧静默会话：同一视口内只在首帧付一次「演示任务跑完 + 浮层清零」的成本 */
    const protoSession = { settled: null, settleMs: null, dismiss: null };

    for (const pair of plan.filter((p) => p.viewport.id === vp.id)) {
      const proto = await capturePrototypePair(pair, ppage, vp, protoSession);
      let impl = { status: "not-attempted" };
      if (proto.status === "captured" && implCtx) {
        impl = await captureImplementationPair(pair, implCtx.page, vp, ctxState).catch((e) => ({ status: "blocked", reason: "impl-capture-throw", detail: redactText(String(e)).slice(0, 240) }));
      }

      const rec = {
        id: pair.id,
        moduleKey: pair.moduleKey,
        moduleRailKey: pair.moduleRailKey,
        moduleName: pair.moduleName,
        viewport: vp.id,
        panelType: pair.panelType,
        page: pair.page,
        status: proto.status === "captured" && impl.status === "captured" ? "captured" : "blocked",
        prototype: null,
        implementation: null,
        nav: { prototype: proto.readings?.nav ?? null, implementation: impl.readings?.nav ?? null },
        diff: null,
        block: proto.status !== "captured" ? { reason: proto.reason, detail: proto.detail, live: proto.live ?? proto.cards ?? null, navSnap: proto.navSnap ?? null, owner: "墨（WORKBENCH-13B 采集器）", followUp: "WORKBENCH-13B §三.A.2/A.5：原型侧真实点击路径或版式契约需复核" } : impl.status !== "captured" ? { reason: impl.reason, detail: impl.detail, live: impl.live ?? impl.labels ?? null, clicked: impl.clicked ?? null, navSnap: impl.navSnap ?? null, afterClick: impl.afterClick ?? null, owner: "墨（WORKBENCH-13B）", followUp: "WORKBENCH-13B §三.B：该入口的导航到达路径需复核或诚实 BLOCKED" } : null,
        shots: { prototype: proto.shot ?? null, implementation: impl.shot ?? null },
        attempts: { prototype: proto.attempts ?? [], implementation: impl.modals?.trail ?? [] },
      };

      if (rec.status === "captured") {
        const protoRegions = proto.readings.regions;
        const implRegions = impl.readings.regions;
        const contract = contractFor(pair.panelType);
        /* 说明作用域由窄到宽、越具体越优先（"*" < module/* < <module>/<page>@* < pair.id），
           值可为字符串或 {text,maxAbsDelta}（只解释 ≤maxAbsDelta 的幅度，越界照旧判红）⇒ 见 lib 的 mergeDeviationNotes/resolveNote。 */
        const notes = mergeDeviationNotes(NOTES, { moduleKey: pair.moduleKey, pairId: pair.id });
        const rows = buildPageDiffTable(protoRegions, implRegions, notes, contract);
        const sigProto = pageStateSignature(protoRegions, { viewport: vp.id, moduleKey: pair.moduleKey, pageKey: pair.page.viewKey, panelType: pair.panelType, overlays: proto.postGate?.actives?.length ?? 0 }, contract);
        const sigImpl = pageStateSignature(implRegions, { viewport: vp.id, moduleKey: pair.moduleKey, pageKey: pair.page.viewKey, panelType: pair.panelType, overlays: impl.postActive ?? 0 }, contract);
        /* 两层签名（卡 §三.A.3）：
           · shared（expect=both 的部位 + 视口 + 页面 + 浮层数）⇒ **相等性判据**：不同页 / 有浮层 / 页面没画出来必然打破它。
           · full（含 expect=either 的版式相关部位）⇒ 只入证据供复核：一侧有 KPI、另一侧没有属差异表豁免面，
             不是「两张帧拍的不是同一状态」（calib 实测：全部配对都因 statistics/tableCell 位数不同而假判状态不符）。 */
        const sigProtoShared = pageStateSignature(protoRegions, { viewport: vp.id, moduleKey: pair.moduleKey, pageKey: pair.page.viewKey, panelType: pair.panelType, overlays: proto.postGate?.actives?.length ?? 0 }, contract, { sharedOnly: true });
        const sigImplShared = pageStateSignature(implRegions, { viewport: vp.id, moduleKey: pair.moduleKey, pageKey: pair.page.viewKey, panelType: pair.panelType, overlays: impl.postActive ?? 0 }, contract, { sharedOnly: true });
        /** rail 选中态（卡 §三.A.4 点名）：模块项必须真的带 .on，实现侧还要落到 F2/F3 认定的实色主蓝 + 白字 */
        const railOf = (nav, key) => (nav.rail ?? []).find((x) => x.key === key) ?? null;
        const pRailItem = railOf(proto.readings.nav, pair.moduleKey);
        const iRailItem = railOf(impl.readings.nav, pair.moduleRailKey);
        rec.railSelected = {
          prototype: pRailItem ? { on: pRailItem.on, backgroundColor: normalizeColor(pRailItem.backgroundColor), color: normalizeColor(pRailItem.color), rect: { x: pRailItem.x, y: pRailItem.y, width: pRailItem.width, height: pRailItem.height } } : null,
          implementation: iRailItem ? { on: iRailItem.on, backgroundColor: normalizeColor(iRailItem.backgroundColor), color: normalizeColor(iRailItem.color), rect: { x: iRailItem.x, y: iRailItem.y, width: iRailItem.width, height: iRailItem.height } } : null,
          expectOn: true,
          expectBackground: RAIL_SELECTED_BG,
          expectForeground: RAIL_SELECTED_FG,
        };
        rec.prototype = {
          overflowX: protoRegions.__page.overflowX,
          topTitle: protoRegions.__page.topTitle,
          url: protoRegions.__page.url,
          activeOverlays: proto.postGate?.actives?.length ?? null,
          railOn: proto.readings.nav.railOn,
          subCount: proto.readings.nav.subCount,
          panelCls: proto.gate?.panelCls ?? "",
          panelSize: proto.gate ? `${proto.gate.panelW}×${proto.gate.panelH}` : "",
          protoTab: proto.gate?.tab ?? null,
          expectTab: pair.page.viewKey,
          protoBusy: proto.gate?.busy ?? null,
          protoCurMod: proto.gate?.curMod ?? null,
          wbShow: proto.gate?.wbShow ?? null,
          dockExists: proto.gate?.dockExists ?? null,
          quietMs: proto.quietMs,
          settle: proto.settle ?? null,
          captureVia: "file:// 原型自身时序静默态 + 真实点击 rail/二级卡；零注入、零 DOM 改写",
        };
        rec.implementation = {
          overflowX: implRegions.__page.overflowX,
          topTitle: implRegions.__page.topTitle,
          url: implRegions.__page.url,
          // 读数层：量的是业务页根（不是整屏）⇒ 复核者能看出差异表每一行的基准容器
          readScope: implRegions.__page.scopeRootSel,
          readScopeClass: implRegions.__page.scopeClass,
          readScopeBox: implRegions.__page.scopeBox,
          readScopeFallback: implRegions.__page.scopeFallback,
          uiuxInject: implRegions.__page.uiuxInject,
          routeArrived: impl.arrived,
          clickedVia: impl.clicked?.via,
          clickedLabel: impl.clicked?.label,
          activeOverlays: impl.postActive,
          overlays: { bootActive: impl.modals?.bootActive ?? [], finalActive: impl.modals?.finalActive ?? null, stable: impl.modals?.stable ?? null },
          railOn: impl.readings.nav.railOn,
          subCount: impl.readings.nav.subCount,
          // 行为门终态（出帧那一刻人工层确实画着业务页，而不只是 URL 变了）
          paintGate: impl.paint ?? null,
          pageRootClass: impl.pageRootClass ?? null,
          pageRootBox: impl.pageRootBox ?? null,
        };
        rec.entry = pair.implEntry ? { menuCode: pair.implEntry.menuCode, navStatus: pair.implEntry.navStatus, railKey: pair.implEntry.railKey, catalogKey: pair.implEntry.catalogKey, title: pair.implEntry.title, path: pair.implEntry.path } : null;
        /**
         * 逐区「两侧各命中了哪个元素」：差异表只写数值，复核者要能看出这一行量的是不是同一层，
         * 否则选择器落错层就会造出无法解释的红（13B 校准期实测：原型 toolbarActions 命中 .btn2 归一后 999 圆角，
         * 看着像「实现少 900px」，其实是层没错、值取错口径）。零成本、进证据。
         */
        rec.regionSel = Object.fromEntries(contract.map((r) => [r.key, { proto: protoRegions[r.key]?.selector ?? null, impl: implRegions[r.key]?.selector ?? null, protoCount: protoRegions[r.key]?.itemCount ?? null, implCount: implRegions[r.key]?.itemCount ?? null, protoPick: protoRegions[r.key]?.pickMode ?? null, implPick: implRegions[r.key]?.pickMode ?? null }]));
        rec.inventories = { prototype: proto.readings.inventory, implementation: impl.readings.inventory };
        rec.regionMetrics = { prototype: slimRegions(protoRegions), implementation: slimRegions(implRegions) };
        rec.rhythm = [
          ...findPageRhythmViolations(protoRegions, pair.panelType).map((v) => ({ ...v, side: "prototype" })),
          ...findPageRhythmViolations(implRegions, pair.panelType).map((v) => ({ ...v, side: "implementation" })),
        ];
        rec.fonts = findFontHierarchyViolations(protoRegions.__fonts, implRegions.__fonts);
        /* 节奏差与字体差并进同一张差异表 ⇒ 与几何差共用 修复 / 豁免 / 阻断 通道（卡 §三.A.7 要求
           「每一条不一致都要有去向」）。红与不红由说明文件的 verdict 决定，门禁不再各自硬编码一类红。 */
        rows.push(...buildRhythmRows(rec.rhythm, notes), ...buildFontRows(rec.fonts, notes));
        rec.diff = {
          rows,
          offSpec: findPageOffSpec(rows),
          explained: findPageExplained(rows),
          blocked: findPageBlocked(rows),
          exempted: findPageExempted(rows),
          stats: pageGatedStats(rows),
        };
        rec.signatures = {
          prototype: sigProto,
          implementation: sigImpl,
          equal: sigProtoShared === sigImplShared,
          shared: { prototype: sigProtoShared, implementation: sigImplShared, equal: sigProtoShared === sigImplShared },
          fullDiff: diffStateSignatures(sigProto, sigImpl),
          note: "相等性判据 = shared 层（expect=both 的部位 + 视口 + 页面 + 零活跃浮层）；full 位向量逐侧入证据，版式相关部位（either）的有无差由差异表按「缺一不判红」豁免。",
        };
        rec.signatureDiff = diffStateSignatures(sigProto, sigImpl);        frames.push(
          rec.shots?.prototype ? { ...rec.shots.prototype, viewport: vp.id, pair: rec.id, side: "prototype", screen: `proto:${rec.id}`, overflowX: rec.prototype.overflowX } : null,
          rec.shots?.implementation ? { ...rec.shots.implementation, viewport: vp.id, pair: rec.id, side: "implementation", screen: `impl:${rec.id}`, overflowX: rec.implementation.overflowX } : null,
        );
        log(`[${vp.id}] ${pair.moduleName}/${pair.page.pageName}（${pair.panelType}）⇒ 判红 ${rec.diff.offSpec.length} 行 · 待裁定 ${rec.diff.blocked.length} 行 · 门禁 ${rec.diff.stats.exact}/${rec.diff.stats.gated} 逐字节一致 · 节奏 ${rec.rhythm.length} · 字体 ${rec.fonts.length} · 签名 ${rec.signatures.equal ? "一致" : "不一致"}`);
        if (!navSeen[`${pair.moduleKey}`]) {
          navSeen[pair.moduleKey] = true;
          moduleNav.push({
            moduleKey: pair.moduleKey,
            moduleRailKey: pair.moduleRailKey,
            moduleName: pair.moduleName,
            viewport: vp.id,
            prototype: { railOn: proto.readings.nav.railOn, title: proto.readings.nav.subTitle, count: proto.readings.nav.subCount, labels: proto.readings.nav.subLabels },
            implementation: { railOn: impl.readings.nav.railOn, title: impl.readings.nav.subTitle, count: impl.readings.nav.subCount, labels: impl.readings.nav.subLabels, disabled: impl.readings.nav.subDisabledCount },
          });
        }
      } else {
        log(`[${vp.id}] ${pair.moduleName}/${pair.page.pageName} ⇒ BLOCKED（${rec.block?.reason ?? impl.reason ?? proto.reason}）：${String(rec.block?.detail ?? "").slice(0, 120)}`);
      }
      pairs.push(rec);
    }
    await pctx.close();
    if (implCtx) await implCtx.ctx.close();
  }
} catch (e) {
  exitCode = 1;
  aborted = redactText(String(e)).slice(0, 400);
  errors.push(aborted);
  console.error(`13B 并排采集器异常：${aborted}`);
  console.error(`后端日志尾部：${redactText(backendTail.join("").slice(-1200))}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (!KEEP_SERVERS) await stopAll().catch(() => {});
}

/* ────────────────────────── 门禁与产物 ────────────────────────── */

/**
 * 分批合并（官方全量 93 配对 ≈ 15 分钟，单进程不宜跑这么久 ⇒ 按模块分片，逐片写进同一证据目录）。
 * WB13_MERGE=1 时：读上一片的 measure/wb13b-module-parity.json，把**本片未覆盖到的配对**并进当前数组，
 * 本片同 id 配对覆盖旧片（重采即以最新帧为准）。
 * 合并只搬运既有读数，不生成任何配对：mode / 原型 SHA / 契约指纹三者任一不符 ⇒ 拒绝合并并如实记一条 error，
 * 绝不把探针片混进官方片，也不把旧原型的帧留在总账里。
 */
/**
 * 重算判定档只需要 exists / visible / selector / itemCount / metrics；
 * `candidates`（落空时的候选别名）与 `__fonts` 是采集期诊断，不入证据 JSON，免得体积翻倍。
 */
function slimRegions(readings = {}) {
  return Object.fromEntries(
    Object.entries(readings)
      .filter(([key]) => key !== "__fonts")
      .map(([key, v]) => [key, { exists: v?.exists, visible: v?.visible, selector: v?.selector, itemCount: v?.itemCount, metrics: v?.metrics ?? {} }]),
  );
}

/**
 * 旧片配对用**当前**的书面解释重算判定档。
 * 几何读数取旧片那次采集（同 CSS 口径下的事实），处置档（explained / blocked / off-spec）永远跟说明文件走
 * ⇒ 改一行解释不必重开浏览器重采；没有 regionMetrics 的旧配对（加存这层之前留下的证据）原样保留。
 */
function rescorePreviousPair(p) {
  const rm = p.regionMetrics;
  if (!rm?.prototype || !rm?.implementation) return false;
  const notes = mergeDeviationNotes(NOTES, { moduleKey: p.moduleKey, pairId: p.id });
  const rows = buildPageDiffTable(rm.prototype, rm.implementation, notes, contractFor(p.panelType));
  // 节奏能从冻结的 regionMetrics 重算；字体差只存了差行本身（__fonts 属诊断层，不入证据 JSON）⇒ 拿旧差行重新处置即可
  p.rhythm = [
    ...findPageRhythmViolations(rm.prototype, p.panelType).map((v) => ({ ...v, side: "prototype" })),
    ...findPageRhythmViolations(rm.implementation, p.panelType).map((v) => ({ ...v, side: "implementation" })),
  ];
  rows.push(...buildRhythmRows(p.rhythm, notes), ...buildFontRows(p.fonts ?? [], notes));
  p.diff = {
    rows,
    offSpec: findPageOffSpec(rows),
    explained: findPageExplained(rows),
    blocked: findPageBlocked(rows),
    exempted: findPageExempted(rows),
    stats: pageGatedStats(rows),
    rescoredFrom: p.diff?.stats ? "previous-chunk" : null,
  };
  return true;
}

function mergePreviousChunk(intendedMode) {
  if (process.env.WB13_MERGE !== "1") return;
  const prevFile = path.join(OUT, "measure", "wb13b-module-parity.json");
  if (!existsSync(prevFile)) return;
  let prev = null;
  try {
    prev = JSON.parse(readFileSync(prevFile, "utf8"));
  } catch (e) {
    errors.push(`分批合并跳过：旧片 JSON 不可解析（${String(e).slice(0, 120)}）`);
    return;
  }
  if (prev?.schema !== "wb13b-module-parity/v1") {
    errors.push("分批合并跳过：旧片 schema 不是 wb13b-module-parity/v1");
    return;
  }
  if (prev?.mode !== intendedMode) {
    errors.push(`分批合并跳过：旧片 mode=${prev?.mode} 与本片 ${intendedMode} 不同（探针证据不得混入官方证据）`);
    return;
  }
  if (prev?.prototypeSource?.sha256 !== protoSha) {
    errors.push("分批合并跳过：旧片原型 SHA 与本片不一致（真相源换了，旧配对作废）");
    return;
  }
  const seen = new Set(pairs.map((p) => p.id));
  let addedPairs = 0;
  let rescored = 0;
  for (const p of prev.pairs ?? []) {
    if (seen.has(p.id)) continue;
    if (p.status === "captured" && rescorePreviousPair(p)) rescored += 1;
    pairs.push(p);
    addedPairs += 1;
  }
  const moduleKeys = new Set(modules.map((m) => m.key));
  for (const m of prev.modules ?? []) if (!moduleKeys.has(m.key)) modules.push(m);
  const vpIds = new Set(viewports.map((v) => v.id));
  for (const v of prev.viewportSpecs ?? []) if (!vpIds.has(v.id)) viewports.push(v);
  const planIds = new Set(plan.map((p) => p.id));
  for (const id of prev.planIds ?? []) if (!planIds.has(id)) plan.push({ id, mergedFromChunk: true });
  const navKeys = new Set(moduleNav.map((n) => n.moduleKey));
  for (const n of prev.moduleNav ?? []) if (!navKeys.has(n.moduleKey)) moduleNav.push(n);
  frames.push(...(prev.shotFrames ?? []));
  log(`分批合并：并入旧片配对 ${addedPairs} 条（本片新采 ${pairs.length - addedPairs} 条）· 按当前说明重算判定 ${rescored} 条 · 累计模块 ${modules.size ?? modules.length} 个`);
}

mergePreviousChunk(PROBE_ONLY ? "probe" : "collect");

const violations = collectModuleParityViolations({
  aborted,
  pairs,
  modules,
  viewports,
  requiredModules: modules.map((m) => m.key),
});
// 探针模式：照常算门禁写进证据，但不把它转成退出码 —— 探针的产物是类名清单，不是结论
if (!PROBE_ONLY) for (const v of violations) errors.push(`门禁判红：${JSON.stringify(v).slice(0, 300)}`);
const clipped = findClippedA(frames.filter(Boolean));
for (const c of clipped) errors.push(`帧横向裁切（§三.C.14）：${JSON.stringify(c)}`);
const allShots = pairs.flatMap((p) => [p.shots?.prototype, p.shots?.implementation].filter(Boolean));
const reused = findReusedFrames(allShots);

const bundle = {
  schema: "wb13b-module-parity/v1",
  card: "WORKBENCH-13B-WORKBENCH-MODULE-VISUAL-PARITY-01",
  generatedAt: new Date().toISOString(),
  mode: PROBE_ONLY ? "probe" : "collect",
  prototypeSource: { file: PROTO_FILE.replace(/\\/g, "/"), url: PROTO_URL, sha256: protoSha, shaMatchesCard: protoSha === PROTO_SHA_EXPECT },
  planSources: { pageModel: MODEL_FILE.replace(/\\/g, "/"), entryInventory: INVENTORY_FILE.replace(/\\/g, "/"), deviationNotes: existsSync(NOTES_FILE) ? NOTES_FILE.replace(/\\/g, "/") : null },
  contract: { regions: PAGE_CONTRACT.map((r) => ({ key: r.key, label: r.label, proto: r.proto, impl: r.impl, gate: r.gate, expect: r.expect, types: r.types })) },
  viewports: viewports.map((v) => v.id),
  viewportSpecs: viewports,
  modules,
  summary: {
    planned: plan.length,
    captured: pairs.filter((p) => p.status === "captured").length,
    blocked: pairs.filter((p) => p.status === "blocked").length,
    gateRed: violations.length,
    offSpecRows: pairs.reduce((n, p) => n + (p.diff?.offSpec?.length ?? 0), 0),
    // 待裁定行＝超容差但本单不改（差值来自后端字段／业务列数／视图结构）。既不并进判红，也不计成一致，
    // 逐条带 owner 写进回传卡，交凌舟裁定归属（卡 §三.A.7 的 blocked 处置）。
    pendingRulingRows: pairs.reduce((n, p) => n + (p.diff?.blocked?.length ?? 0), 0),
    explainedRows: pairs.reduce((n, p) => n + (p.diff?.explained?.length ?? 0), 0),
    exemptRows: pairs.reduce((n, p) => n + (p.diff?.exempted?.length ?? 0), 0),
    gated: pairs.reduce((n, p) => n + (p.diff?.stats?.gated ?? 0), 0),
    gatedExact: pairs.reduce((n, p) => n + (p.diff?.stats?.exact ?? 0), 0),
    maxAbsDelta: pairs.reduce((m, p) => Math.max(m, p.diff?.stats?.maxAbsDelta ?? 0), 0),
    signatureMismatch: pairs.filter((p) => p.signatures && p.signatures.equal !== true).length,
    rhythmViolations: pairs.reduce((n, p) => n + (p.rhythm?.length ?? 0), 0),
    fontViolations: pairs.reduce((n, p) => n + (p.fonts?.length ?? 0), 0),
    reusedFrames: reused.map((f) => ({ file: f.file, pair: f.pair, side: f.side, viewport: f.viewport, sha256: f.sha256 })),
    perModule: modules.map((m) => ({
      moduleKey: m.key,
      captured: pairs.filter((p) => p.moduleKey === m.key && p.status === "captured").length,
      blocked: pairs.filter((p) => p.moduleKey === m.key && p.status === "blocked").length,
      offSpec: pairs.filter((p) => p.moduleKey === m.key).reduce((n, p) => n + (p.diff?.offSpec?.length ?? 0), 0),
    })),
    blockedReasons: [...new Set(pairs.filter((p) => p.status === "blocked").map((p) => p.block?.reason ?? "unknown"))],
  },
  moduleNav,
  planIds: plan.map((p) => p.id),
  pairs,
  violations,
  errors,
  network: { failures: netFailures.slice(0, 60), failureCount: netFailures.length, okEndpoints: [...okUrls.keys()].slice(0, 60) },
  shotFrames: frames.filter(Boolean),
  aborted,
};
writeFileSync(path.join(OUT, "measure", "wb13b-module-parity.json"), JSON.stringify(bundle, null, 2) + "\n", "utf8");
writeFileSync(path.join(OUT, "logs", "wb13b-module-parity-harness.json"), JSON.stringify({ harnessLog, backendTail: backendTail.join("").slice(-8000), ports: { BACKEND_PORT, WEB_PORT } }, null, 2) + "\n", "utf8");
if (!PROBE_ONLY) writeFileSync(path.join(here, "fixtures", "wb13b-module-parity.json"), JSON.stringify({ ...bundle, pairs: bundle.pairs.map((p) => { const { regionMetrics, ...rest } = p; return { ...rest, readingsDropped: true }; }) }, null, 2) + "\n", "utf8");

/* 人读差异表：逐模块逐页判红行 + 覆盖率总账 */
const md = [];
md.push("# WORKBENCH-13B §三.A.2/3/4 逐模块「原型 ⇄ 实现」并排差异表\n");
md.push(`- 原型：\`${PROTO_FILE.replace(/\\/g, "/")}\` · SHA256 \`${protoSha}\`（卡面一致：${protoSha === PROTO_SHA_EXPECT}）`);
md.push(`- 视口档：${viewports.map((v) => v.id).join(" / ")}（两档各采各的帧，SHA 去重机器核对）`);
md.push(`- 计划配对 ${bundle.summary.planned} · 完成 ${bundle.summary.captured} · 诚实阻断 ${bundle.summary.blocked} · 门禁判红 ${bundle.summary.gateRed}`);
md.push(`- 门禁指标 ${bundle.summary.gated} 项，逐字节一致 ${bundle.summary.gatedExact} 项，超容差判红 ${bundle.summary.offSpecRows} 行，待裁定 ${bundle.summary.pendingRulingRows} 行，已书面解释 ${bundle.summary.explainedRows} 行，结构性豁免 ${bundle.summary.exemptRows} 行`);
md.push(`- 最大偏差 ${bundle.summary.maxAbsDelta}px（卡 §三.A.6：≤±1px，颜色逐字节）· 状态签名不符 ${bundle.summary.signatureMismatch} · 节奏违规 ${bundle.summary.rhythmViolations} · 字体层级差 ${bundle.summary.fontViolations}\n`);
md.push("## 一、逐模块覆盖");
md.push("| 模块 | railKey | 版式分布 | 完成 | 阻断 | 判红行 | 门禁一致率 | 最大偏差 |");
md.push("| --- | --- | --- | ---: | ---: | ---: | --- | ---: |");
for (const m of modules) {
  const ps = pairs.filter((p) => p.moduleKey === m.key);
  const types = [...new Set(ps.map((p) => p.panelType))].join("/");
  const gated = ps.reduce((n, p) => n + (p.diff?.stats?.gated ?? 0), 0);
  const exact = ps.reduce((n, p) => n + (p.diff?.stats?.exact ?? 0), 0);
  const maxDelta = ps.reduce((mx, p) => Math.max(mx, p.diff?.stats?.maxAbsDelta ?? 0), 0);
  md.push(`| ${m.name} | ${m.railKey} | ${types || "—"} | ${ps.filter((p) => p.status === "captured").length} | ${ps.filter((p) => p.status === "blocked").length} | ${ps.reduce((n, p) => n + (p.diff?.offSpec?.length ?? 0), 0)} | ${exact}/${gated} | ${maxDelta} |`);
}
md.push("\n## 二、诚实阻断（卡 §三.B.4：未对齐的入口不得标 PASS）\n");
md.push("| 配对 | 原因 | 说明 | 责任人 | 后续卡 |");
md.push("| --- | --- | --- | --- | --- |");
for (const p of pairs.filter((x) => x.status === "blocked")) {
  md.push(`| ${p.id} | ${p.block?.reason ?? "—"} | ${String(p.block?.detail ?? "").replace(/\|/g, "/").slice(0, 160)} | ${p.block?.owner ?? "—"} | ${p.block?.followUp ?? "—"} |`);
}
md.push("\n## 三、判红行逐条（超容差或结构缺失）\n");
md.push("| 配对 | 区域 | 指标 | 原型 | 实现 | 差值 | 容差 | 卡段 |");
md.push("| --- | --- | --- | --- | --- | ---: | ---: | --- |");
for (const p of pairs) {
  for (const r of p.diff?.offSpec ?? []) {
    md.push(`| ${p.id} | ${r.region} | ${r.metric} | ${r.prototype} | ${r.impl} | ${r.delta ?? "—"} | ${r.tolerance ?? "—"} | ${r.card} |`);
  }
}
md.push("\n## 三·补 待裁定行（差值真实存在，但改它要动本单禁区 ⇒ blocked 处置，附归属）\n");
md.push("| 配对 | 区域 | 指标 | 原型 | 实现 | 差值 | 归属/裁定人 | 说明 |");
md.push("| --- | --- | --- | --- | --- | ---: | --- | --- |");
for (const p of pairs) {
  for (const r of p.diff?.blocked ?? []) {
    md.push(`| ${p.id} | ${r.region} | ${r.metric} | ${r.prototype} | ${r.impl} | ${r.delta ?? "—"} | ${r.owner || "—"} | ${String(r.note).replace(/\|/g, "/").slice(0, 120)} |`);
  }
}
md.push("\n## 四、超容差但已书面解释（留在证据里，不抹平）\n");
md.push("| 配对 | 区域 | 指标 | 原型 | 实现 | 差值 | 解释 |");
md.push("| --- | --- | --- | --- | --- | ---: | --- |");
for (const p of pairs) {
  for (const r of p.diff?.explained ?? []) {
    md.push(`| ${p.id} | ${r.region} | ${r.metric} | ${r.prototype} | ${r.impl} | ${r.delta ?? "—"} | ${String(r.note).replace(/\|/g, "/").slice(0, 120)} |`);
  }
}
md.push("\n## 五、结构性豁免（原型独有 / 实现独有 / 版式相关）\n");
md.push("| 配对 | 区域 | 原型 | 实现 | 判定 | 依据 |");
md.push("| --- | --- | --- | --- | --- | --- |");
for (const p of pairs) {
  for (const r of p.diff?.exempted ?? []) {
    md.push(`| ${p.id} | ${r.region} | ${r.prototype} | ${r.impl} | ${r.verdict} | ${r.card} |`);
  }
}
md.push("\n## 六、逐页明细\n");
md.push("| 配对 | 版式 | 原型面板类 | 原型模态 | 实现模态 | 溢出X(原/实) | 标题(原/实) | 到达方式 | 并排帧 SHA（前 12） |");
md.push("| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |");
for (const p of pairs.filter((x) => x.status === "captured")) {
  md.push(
    `| ${p.id} | ${p.panelType} | ${p.prototype.panelCls || "—"} | ${p.prototype.activeOverlays} | ${p.implementation.activeOverlays} | ${p.prototype.overflowX}/${p.implementation.overflowX} | ${p.prototype.topTitle}/${p.implementation.topTitle} | ${p.implementation.clickedVia} | ${p.shots.prototype.sha256.slice(0, 12)} / ${p.shots.implementation.sha256.slice(0, 12)} |`,
  );
}
md.push("\n## 七、二级列实态对照（每模块首次进入时读数）\n");
md.push("| 模块 | 视口 | 原型选中/标题/卡数 | 实现选中/标题/卡数(禁用) | 文案一致 |");
md.push("| --- | --- | --- | --- | --- |");
for (const n of moduleNav) {
  const same = (n.prototype.labels ?? []).join("|") === (n.implementation.labels ?? []).join("|");
  md.push(`| ${n.moduleName} | ${n.viewport} | ${n.prototype.railOn.join(",") || "∅"}/${n.prototype.title}/${n.prototype.count} | ${n.implementation.railOn.join(",") || "∅"}/${n.implementation.title}/${n.implementation.count}(${n.implementation.disabled}) | ${same ? "✓" : "✗"} |`);
}
md.push("\n## 八、门禁判红明细\n");
for (const v of violations) md.push(`- ${JSON.stringify(v)}`);
writeFileSync(path.join(OUT, "measure", "wb13b-module-parity.md"), md.join("\n") + "\n", "utf8");

console.log(`\n采集完成：配对 ${bundle.summary.captured}/${bundle.summary.planned}（阻断 ${bundle.summary.blocked}）· 门禁判红 ${violations.length} 项`);
console.log(`证据：${path.join(OUT, "measure", "wb13b-module-parity.json")}`);
if (!existsSync(NOTES_FILE)) console.log(`提示：偏差书面解释文件不存在 ⇒ 所有超容差项按 §三.A.6/7 直接判红：${NOTES_FILE}`);
process.exit(errors.length ? 1 : exitCode);
