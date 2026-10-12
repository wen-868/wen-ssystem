import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import crypto from "node:crypto";
import { logCoverage, logViolations, logIncomplete, type ScannedRoute } from "./a11y-gate-log";

/**
 * saas-admin（总后台）无障碍扫描（WCAG 2.1 AA，axe-core）—— S3-137
 *
 * ─── 为什么本文件之前是"默认 skip 的就绪件" ───
 *   S3-53 时判定：saas-admin 登录页带**一次性图形验证码**（`GET /platform/auth/captcha`），
 *   自动化无法"填出"验证码 ⇒ 浏览器 axe 进不了场，于是整体 skip，
 *   saas-admin 的 a11y 只由 `scripts/contrast-check.cjs`（纯计算、不覆盖真实渲染）兜底。
 *
 * ─── S3-137 的解法：不破解验证码，而是**绕过验证码** ───
 *   路由守卫（`saas-admin/src/router/index.ts:306`）只判断
 *   `localStorage.platform_token` 是否**非空**，并不校验 JWT ⇒ 只要注入一个非空 token 就能进场。
 *   ⇒ 本文件用 `addInitScript` 在页面加载前写入一枚**合法签名的 platform_admin JWT**
 *     （HS256 / issuer=zhixiang-platform / audience=zhixiang-platform-client / type=platform_admin），
 *     让列表页的业务请求也尽量通过 `requirePlatformAuth`，而不是止步 401。
 *   🔴 这不是"伪造登录绕过鉴权"——这是**用测试密钥签发的、后端会正常校验通过的令牌**，
 *     且只打到本地 mock 后端（密闭性见下），与破解生产验证码无关。
 *
 * ─── 密闭性（S3-59.1 范式，本单验收②）───
 *   ① 经 saas-admin dev server（5174）代理访问 `/api/platform/health`，
 *      响应必须带 mock 专属标记 `"mode":"mock-db"`（生产响应永不吐该字段）；
 *   ② 扫描全程监听 request，任何**非 127.0.0.1/localhost** 的请求都记入 external 并判失败
 *      ——"没打到线上"要能被证伪，而不是靠"我配置过了"这句话。
 *
 * ─── 取样稳定化（沿用 S3-61 / A-5 修法，防中间帧伪影）───
 *   axe 会在 <transition> 淡入中间帧采样，读到 opacity∈(0,1) 的过渡色，产生 color-contrast 伪影。
 *   故 analyze() 前：等 getAnimations() 无 running → 注入 transition/animation:none → 等两帧。
 *   走到兜底打 `[saas-a11y][降级]` 标记，正常打 `[saas-a11y][稳定化-正常]`，二者互斥可 grep。
 *
 * ─── 标签与分层 ───
 *   用例名带 `@a11y @saas`：
 *   · required 的 e2e job 跑 `--grep-invert @a11y` ⇒ 本文件被排除，不会堵任何 PR；
 *   · 观察期 a11y job：admin-web 10 次用 `--grep @a11y --grep-invert @saas`，
 *     saas-admin 3 次用 `--grep @saas`，互不干扰。
 *   🔴 断言与 admin-web 完全一致（critical/serious = 0），**不降级**；不关 color-contrast。
 */

const SAAS_BASE = process.env.SAAS_ADMIN_BASE_URL || "http://127.0.0.1:5174";
const JWT_SECRET = process.env.E2E_JWT_SECRET || "e2e-secret";

/** 手写 HS256：避免引入 jsonwebtoken 的 CJS/类型负担，且算法与后端 verify 完全同源 */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function signPlatformAdminJwt(): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: 1,
    type: "platform_admin",
    username: "ci-a11y-probe",
    iss: "zhixiang-platform",
    aud: "zhixiang-platform-client",
    iat: now,
    exp: now + 3600,
  };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

type SettleStatus = { degraded: string | null };

async function waitForVisualSettled(page: Page): Promise<SettleStatus> {
  const cap = await page.evaluate(() => {
    const doc = document as Document & { getAnimations?: () => Animation[] };
    if (typeof doc.getAnimations !== "function") return "unsupported";
    try {
      const anims = doc.getAnimations();
      const n = anims.filter((a) => a.playState === "running").length;
      return n > 0 ? `running=${n}` : "idle";
    } catch {
      return "throw";
    }
  });

  let degraded: string | null = null;
  if (cap === "unsupported" || cap === "throw") {
    degraded = cap === "unsupported" ? "getAnimations 在当前环境不可用" : "getAnimations 调用抛错";
  } else {
    try {
      await page.waitForFunction(
        () => {
          const doc = document as Document & { getAnimations?: () => Animation[] };
          const getAnims = doc.getAnimations;
          if (typeof getAnims !== "function") return true;
          try {
            const anims = getAnims.call(doc);
            return !anims.some((a) => a.playState === "running");
          } catch {
            return true;
          }
        },
        undefined,
        { timeout: 5_000, polling: 50 }
      );
    } catch {
      degraded = `等待动画静止超时（探测时 ${cap}）`;
    }
  }

  await page.addStyleTag({
    content: "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const step = () => {
          frames += 1;
          if (frames >= 2) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      })
  );
  return { degraded };
}

/**
 * 打印违规的**元素身份**（验收①：不接受只有类型名）。
 * 每个违规打印：type / impact / 节点总数 / 前 MAX_NODES 个节点的 target 选择器 + html 片段 + axe data。
 *
 * 为什么从 3 提到 6（凌舟回卡 §四·遗留②）：
 *    观察期实测单页最多 10 节点（#/packages），只打 3 个不足以定位「新增那一批」——
 *    修复后若从 10 降到 5，只打 3 个根本看不出少了哪几个。
 *    超出部分显式标注「其余 N 个省略」，避免把截断误读成全部（可观测性不能靠省略制造假象）。
 */
// ③ 违规定位（type/impact/节点数 + 每节点 target+html+axeData）已抽到 e2e/a11y-gate-log.ts，
//    与 admin-web 共用同一实现（输出形状不变：前缀 `[saas-a11y] <tag> …`）。
//    本文件此前的 MAX_NODES/logViolations 为就地实现，S3-59③ 收口时改为共用，
//    避免两端各写一份、其中一份悄悄退化（同一类"两份实现走样"是本项目的已知踩坑形状）。

/**
 * ─── S3-59 ②：覆盖清单（扫了哪些页面、哪些没扫）───
 * 缺陷二：门禁只报"有没有违规"，不报"扫了哪些页面" ⇒「没扫到」与「扫了没问题」不可区分。
 * 清单来源是 saas-admin 路由表的**声明**（只读源码文本），未扫路由逐条列出、不允许静默省略。
 */
const SAAS_ROUTER_SRC = "saas-admin/src/router/index.ts";
const SAAS_SCANNED: ScannedRoute[] = [
  { path: "/#/login", name: "登录页", by: "登录页无 critical/serious 违规" },
  { path: "/#/tenants", name: "租户列表", by: "列表页 /tenants 无 critical/serious 违规" },
  { path: "/#/packages", name: "套餐列表", by: "列表页 /packages 无 critical/serious 违规" },
  { path: "/#/subscriptions", name: "订阅列表", by: "列表页 /subscriptions 无 critical/serious 违规" },
];
const SAAS_UNSCANNED_REASON =
  "本次浏览器 axe 扫描只覆盖上列 4 个路由；其余路由属未覆盖面（S3-59 缺陷二），" +
  "不因本次取样为绿而视为通过；其中部分页面仍受【一次性图形验证码 / 多级详情】限制，" +
  "由 scripts/contrast-check.cjs 的对比度矩阵降级覆盖（S3-53 已登记为降级、不是已覆盖）。";

/** 打印覆盖清单（每个 worker 进程只打一次）并断言清单自身完整 —— 读不到源码 ⇒ 不给假绿。 */
let saasCoveragePrinted = false;
function ensureSaasCoverage(): void {
  if (saasCoveragePrinted) return;
  saasCoveragePrinted = true;
  const cov = logCoverage("saas-a11y", SAAS_ROUTER_SRC, SAAS_SCANNED, SAAS_UNSCANNED_REASON);
  expect(cov.readError, `覆盖清单不可用（读不到 ${SAAS_ROUTER_SRC}）：${cov.readError}`).toBeNull();
  const declared = new Set(cov.declared);
  const stale = cov.scanned.filter((p) => !declared.has(p));
  expect(stale, `本次扫描的路由未在路由表中声明（清单可能已过期）：${stale.join(",")}`).toEqual([]);
}

/** 密闭性：经 saas-admin dev server 代理的 /api 必须落在本地 mock（带 mode:mock-db） */
async function assertSealedToMock(page: Page): Promise<void> {
  const res = await page.request.get(`${SAAS_BASE}/api/platform/health`);
  const body = await res.text();
  console.log(`[saas-a11y][密闭性] GET ${SAAS_BASE}/api/platform/health → ${res.status()} ${body.slice(0, 200)}`);
  expect(
    body.includes('"mode":"mock-db"'),
    `密闭性破坏：经 saas-admin(5174) 代理的 /api 未带 mock 标记（mode:mock-db），可能回落生产`
  ).toBe(true);
}

test.describe("saas-admin 无障碍扫描（WCAG 2.1 AA）", () => {
  test("登录页无 critical/serious 违规 @a11y @saas", async ({ page }) => {
    // ⚠️ saas-admin 用 **hash 路由**（createWebHashHistory，见 router/index.ts:23）：
    //    写 `/login` 会落到空 hash → 被守卫重定向到 #/dashboard，取样对象就错了。
    await page.goto(`${SAAS_BASE}/#/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2_000);
    ensureSaasCoverage();

    const st = await waitForVisualSettled(page);
    console.log(
      st.degraded
        ? `[saas-a11y][降级] 登录页：${st.degraded}`
        : "[saas-a11y][稳定化-正常] 登录页：已确认无 running 动画 + 过渡/动画已禁用"
    );

    await assertSealedToMock(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const criticalSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""));
    console.log(
      `[saas-a11y] 登录页: total=${results.violations.length}, critical/serious=${criticalSerious.length}` +
        (criticalSerious.length ? `, types=${criticalSerious.map((v) => v.id).join(",")}` : "")
    );
    logViolations("saas-a11y", "登录页", criticalSerious);
    logIncomplete("saas-a11y", "登录页", results);
    expect(criticalSerious.length).toBe(0);
  });

  // 核心列表页：租户 / 套餐 / 订阅。进场靠注入 platform_token（见文件头说明）。
  for (const route of ["/tenants", "/packages", "/subscriptions"]) {
    test(`列表页 ${route} 无 critical/serious 违规 @a11y @saas`, async ({ page }) => {
      // 密闭性：全程监听，任何非本地请求都要被抓出来
      const external: string[] = [];
      page.on("request", (req) => {
        try {
          const host = new URL(req.url()).hostname;
          if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(host)) external.push(req.url());
        } catch {
          /* 相对 URL / data: 等，忽略 */
        }
      });

      // 注入登录态：路由守卫只看 platform_token 非空；这里给的是**合法签名**的 JWT
      const token = signPlatformAdminJwt();
      await page.addInitScript((t) => {
        localStorage.setItem("platform_token", t as string);
      }, token);

      // hash 路由：必须写成 /#/tenants（见登录页用例注释）
      await page.goto(`${SAAS_BASE}/#${route}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3_000); // SPA 渲染等待（S3-63 同款：不加等待会取到空 DOM）
      console.log(`[saas-a11y] route=${route} url=${page.url()}`);
      ensureSaasCoverage();

      const st = await waitForVisualSettled(page);
      console.log(
        st.degraded
          ? `[saas-a11y][降级] ${route}：${st.degraded}`
          : `[saas-a11y][稳定化-正常] ${route}：已确认无 running 动画 + 过渡/动画已禁用`
      );

      await assertSealedToMock(page);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const criticalSerious = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""));
      console.log(
        `[saas-a11y] ${route}: total=${results.violations.length}, critical/serious=${criticalSerious.length}` +
          (criticalSerious.length ? `, types=${criticalSerious.map((v) => v.id).join(",")}` : "")
      );
      logViolations("saas-a11y", route, criticalSerious);

      // 密闭性收口：扫描期间不得有任何外部域名请求
      console.log(
        external.length === 0
          ? `[saas-a11y][密闭性] ${route} ✅ 扫描期间外部域名请求 0 条`
          : `[saas-a11y][密闭性] ${route} ❌ 外部请求 ${external.length} 条：${external.slice(0, 3).join(" | ")}`
      );
      expect(external, `${route} 扫描期间出现外部域名请求，密闭性被破坏`).toEqual([]);

      logIncomplete("saas-a11y", route, results);
      expect(criticalSerious.length).toBe(0);
    });
  }
});
