#!/usr/bin/env node
/**
 * G3 门禁 · guard:route-auth（S3-176 B0）
 *
 * 防的是什么（根因）：鉴权有两个挂法 —— `routeConfig.auth` 声明式（auto-routes 统一挂
 *   认证 + CSRF）与「auth:"none" + 端点内联 requirePlatformAuth」。后者**会绕过 CSRF**：
 *   2026-10-01 的 P0 就是这么产生的（platform-msg-config 6 端点、tenant applications 审批端点）。
 *   只修那几处 ⇒ 下次新人照着"内联"写法再写一遍 ⇒ 又复发。
 *   ⇒ 本门禁把"绕过统一挂载"变成**机械红**，而不是靠人记得。
 *
 * 规则：
 *   R1 凡含写方法（post/put/patch/delete）的路由文件，`routeConfig.auth` 不得为 "none"，
 *      除非在 NONE_ALLOWLIST 里。B0b 要求每个登记项**逐条回答三问**：
 *        ① 该文件里哪些端点必须是公开的、为什么；② 该文件里其余写端点是否已挂「认证 + csrfMiddleware」；
 *        ③ 为什么不能改 routeConfig.auth 声明式。
 *   R2 `auth: "none"` 的文件里，**已过鉴权的写端点**必须能到达 csrfMiddleware —— 判据
 *      **精确到端点**（B0b/B0c 升级；旧版本是文件级，见下）：
 *        · 「已过鉴权」＝ (i) 该写端点**同一行**内联挂了 requireAuth / requireAuthWithTenant /
 *          requirePlatformAuth；或 (ii) 该端点路径落在本文件一条
 *          `router.use(<scope>, <认证中间件>)` 的作用域内（mount 在端点之前注册、scope 是路径前缀）。
 *        · 合规 ＝ (a) **同一行**含 csrfMiddleware；或 (b) **同 scope 成对挂载**
 *          `router.use(<scope>, 认证)` ＋ `router.use(<scope>, csrfMiddleware)`（scope 逐字相同）。
 *          本项目既有合规写法：retail-announcement.routes.ts:34-35、tenant-register.routes.ts:25、
 *          platform-auth.routes.ts:46。
 *        · 未过鉴权的公开写端点（回调 / 登录 / 注册 / 申请）不在范围内 —— 没有登录态就没有可校验的
 *          CSRF 令牌（csrfMiddleware 对未认证请求本身放行，见 middleware/csrf.ts:39-42）。
 *        · 仍排除导入行与注释行；仍只对 auth:"none" 的文件生效。
 *   ⚠️ 已知边界（本版有意接受，写在明处不藏着）：`requireStoreAuth`
 *      （= [...requireAuthWithTenant, 门店校验]，middleware/store-auth.ts:5-14）与 `requireWxAuth`
 *      （微信自有令牌，middleware/wechat-auth.ts）这类**自定义包装中间件**不在 R2 的三种声明名之内
 *      ⇒ 本门禁**看不穿**它们内部的挂载。instant-retail-store.routes.ts / wechat.routes.ts 的真实
 *      CSRF 状况已由 B0b 登记为「范围外发现」——**登记不等于合规**，不表示它们被本门禁守住了。
 *
 * 用法：node backend/scripts/guard-route-auth.mjs     退出码 0=绿 / 1=红
 *
 * 反测（2026-10-12 B0c，两侧原始输出见 docs/tasks/cards/R101-B0b-B0c-阿坚-回传.md）：
 *   A 只摘掉 payment.routes.ts `/orders` 那一行的 csrfMiddleware（`/refunds` 保留）
 *     ⇒ 旧**文件级**判据 exit 0（不红，盲区实测复现）／新**端点级**判据 exit 1 并指出该行；
 *   B 只摘掉 retail-announcement.routes.ts 的 `use("/admin", csrfMiddleware)`（认证那句保留）
 *     ⇒ 新判据 exit 1（成对挂载被判成对）。
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(HERE, "..", "src", "routes");

/**
 * auth:"none" 白名单（B0b：14 个文件逐条登记 + B0 遗留样例 1 个）。
 * 每条必须回答「① 哪些端点必须公开 + ② 其余写端点的认证/CSRF 现状 + ③ 为什么不能改声明式」。
 * ⚠️ 本清单是**显式豁免台账**，不是"合规证明"：③ / ② 中记录的真实缺口一律另列「范围外发现」。
 */
const NONE_ALLOWLIST = {
  // ── B0 遗留样例（已登记，作为写法参考） ──
  "tenant-register.routes.ts":
    "① 必须公开：POST /register（租户自助注册）、POST /register/sms-code（注册短信验证码）、" +
    "GET /register/config（注册配置）—— 未注册访客调用，不能要求登录。" +
    " ② 其余写端点：审核分支的 POST /applications/:id/approve、POST /applications/:id/reject 已由 " +
    "L25 `tenantRegisterRouter.use(\"/applications\", requirePlatformAuth, csrfMiddleware)` 成对挂载（认证 + CSRF 同 scope 一行）。" +
    " ③ 不能改声明式：同一文件混有公开注册端点，改 routeConfig.auth 会把公开注册面一起套鉴权（注册入口直接 401）。",

  // ── B0b：14 个 auth:"none" 的文件 ──
  "aftersale.routes.ts":
    "① 必须公开：无 —— 本文件用 routeConfigs 注册两条配置（L66 miniapp auth:\"none\" / L67 admin auth:\"requireAuthWithTenant\"），" +
    "miniapp 分支的读、写端点都要登录态，没有任何公开端点；本条登记的是 miniapp 分支用「auth:none + 端点内联挂载」的既有写法。" +
    " ② 其余写端点：miniapp 分支 4 个写端点（L24 POST /aftersales、L31 .../:aftersaleNo/cancel、L33 .../return-logistics、L38 .../rate）" +
    "均**同行**挂 `requireAuthWithTenant, csrfMiddleware`（S3-177 补）；admin 分支 5 个写端点（L46 approve、L48 reject、L53 confirm-receipt、" +
    "L55 inspect、L60 complete）不在本配置内，由 L67 的 `auth:\"requireAuthWithTenant\"` 声明式统一挂载认证 + CSRF。" +
    " ③ 不能改声明式：本文件是「双配置同文件」（miniapp + admin 两条 routeConfigs 共用同一模块），miniapp 分支的 auth 已被既有单测 " +
    "`backend/src/__tests__/routes/aftersale.test.ts:16` 断言为 \"none\"；B0a 本单红线限定只碰这 3 个文件、不动业务代码，故以端点内联补齐 CSRF。" +
    "改声明式须同批改单测契约，属扩大改动范围（另立批次）。",

  "hardware-callback.routes.ts":
    "① 必须公开：POST /callbacks/cloud-speaker/:tenantId、POST /callbacks/box/:tenantId —— 收银硬件（云喇叭 / 收款盒子）服务商按配置的 " +
    "notify_url 回调，请求方是服务商服务器，无登录态、无浏览器会话（文件头 L5-8 已注明）。" +
    " ② 其余写端点：无（文件内仅这两条回调，L11-12，由 controller 自行做服务商侧校验）。" +
    " ③ 不能改声明式：整文件皆为外部服务商回调；挂 requireAuthWithTenant 会把正常回调打成 401，挂 csrfMiddleware 会打成 403" +
    "（回调方不会带 x-csrf-token）。",

  "instant-retail-store.routes.ts":
    "① 必须公开：无 —— 6 条端点全部过门店鉴权（L9 `instantRetailStoreRouter.use(...requireStoreAuth)`）。本条登记的是" +
    "「auth:none + 自有挂载」这一形态本身（非公开端点）。" +
    " ② 其余写端点：4 个写端点（L17-L20 .../confirm、.../cancel、.../start-delivery、.../complete-delivery）**已补 `csrfMiddleware`**" +
    "（S3-178；认证来自 L10 `use(...requireStoreAuth)` = [...requireAuthWithTenant, 门店校验]，见 middleware/store-auth.ts:5-14）。" +
    "另注（前缀撞车，S3-178 回传卡 §七.4 / S3-187 B）：以**根前缀** `/api/store` 注册的文件（store.routes.ts 等 store-*.routes.ts）" +
    "其声明式认证+CSRF 仍会**前缀级**前置覆盖本前缀下的全部路径，故本文件的审计判据在整机 HTTP 上分辨不出（不存在的子路径也 403）。" +
    "`commerce-fix.routes.ts` 原先就是这种写法，S3-187 已把它收窄到 `/api/store/coupons`（只覆盖自己拥有的路径段）。" +
    " ③ 不能改声明式：门店校验（`req.user.storeId`，store-auth.ts:8-13）无法用 routeConfig.auth 的三个取值表达；" +
    "改声明式只能覆盖 requireAuth* 家族，门店校验要么重复注册（认证中间件跑两遍）要么丢失（功能回退）。",

  "instant-retail-webhook.routes.ts":
    "① 必须公开：POST /webhook/jd、POST /webhook/meituan、POST /webhook/eleme —— 京东 / 美团 / 饿了么平台服务端推送，" +
    "无登录态（L7-9 注释「Webhook 接收端点（无需认证）」）。" +
    " ② 其余写端点：无（文件内仅这 3 条）。" +
    " ③ 不能改声明式：全部为外部平台回调；挂鉴权 ⇒ 平台回调 401，挂 csrfMiddleware ⇒ 平台回调 403（回调方无会话、无 x-csrf-token）。",

  "marketing-miniapp.routes.ts":
    "① 必须公开：小程序消费者侧的**匿名浏览**面（GET /coupons/available、/full-reductions/active、/full-reductions/available、" +
    "/flash-sales/active、/group-buys/active、/group-buys/teams/:teamId）—— 未登录也要能浏览营销内容；" +
    "**注意**：`/coupons/my`、`/points/my`、`/points/my-records` 是「我的」数据，自 S3-178 / S3-187 起**需登录态**，不再属公开面。" +
    " ② 其余写端点：需登录态的端点已**同行**挂 `requireAuthWithTenant`（写端点再挂 `csrfMiddleware`），" +
    "并由消费者侧 `bindSelfIdentity` 绑定登录态身份（客户端自带 `userId` 与登录态不一致 ⇒ 403；S3-178 已落地）。" +
    "**S3-187 更新**：三条写端点按契约改为**带参路径**（`/coupons/:templateId/claim`、`/flash-sale/:id/buy`、" +
    "`/group-buy/:teamId/join`，原写法无路径参数 ⇒ controller 读到 NaN ⇒ 业务层恒 404）；`GET /points/my` 的身份改取登录态，" +
    "原「读不存在的路由参数、恒 NaN」的遗留已消除（S3-178 回传卡 §七.2 结项）。" +
    " ③ 不能改声明式：本 router 同时承载公开浏览面与需登录态端点，声明式会无差别套鉴权、把未登录浏览一起打成 401；" +
    "故按**端点级**挂载收口（S3-178）。",

  "member-register.routes.ts":
    "① 必须公开：POST /sms-code（注册短信验证码）、POST /register（会员自助注册）—— 未注册用户调用，必须无鉴权。" +
    " ② 其余写端点：无（文件内仅这两条，L8-9）。" +
    " ③ 不能改声明式：注册与验证码是未注册访客的入口，改声明式会要求登录 ⇒ 会员注册入口直接死。",

  "miniapp.routes.ts":
    "① 必须公开：POST /login（简化登录，未登录时取 profile，L17）、POST /pay/notify（微信支付回调，微信服务器直调，L42-44 已注明" +
    "必须保持「无鉴权 + 无 CSRF」）。" +
    " ② 其余写端点：router 内所有已登录写端点均**同行**挂 `requireAuthWithTenant, csrfMiddleware`（认证在前）——L26-29 购物车、" +
    "L32/35/36/37/40 订单、L50 储值卡充值、L54/56/57/58/59 用户与地址、L64 优惠券核销、L72 会员券、L75/76 用户设置、L83-96 批发。" +
    " ③ 不能改声明式：同一文件混有公开端点（登录 / 微信支付回调），改 routeConfig.auth 会把公开面一起套鉴权 ⇒ 登录 401、支付回调 403。",

  "payment.routes.ts":
    "① 必须公开：POST /wx/callback（微信支付回调，微信服务器直调；L18-19 已注明必须保持「无鉴权 + 无 CSRF」）。" +
    " ② 其余写端点：L17 POST /orders、L21 POST /refunds 均**同行**挂 `requireAuthWithTenant, csrfMiddleware, requirePermission(\"finance:create\")`。" +
    " ③ 不能改声明式：同文件含公开回调面，改声明式会把 /wx/callback 套上鉴权 ⇒ 微信回调 401/403，资金链路断。",

  "platform-app-version.routes.ts":
    "① 必须公开：GET /version/:platform（客户端版本检查）—— App 启动 / 升级检查在未登录态也要能查；本文件的 auth:\"none\" 只属于 " +
    "L24 那条 `{ prefix: \"/api/app\", auth: \"none\" }` 配置。" +
    " ② 其余写端点：`appVersionAdminRouter` 的 7 个写端点（L13/14/16/17/18/20/21）不在本配置内，由 L28 第二条配置 " +
    "`{ prefix: \"/api/padmin\", auth: \"requirePlatformAuth\" }` 声明式统一挂载认证 + CSRF。" +
    " ③ 不能改声明式：本文件是双配置，把 L24 改成鉴权会让未登录客户端的版本检查 401；且 L25-27 注释记录管理端不能并到 " +
    "`/api/platform` 前缀（`app.use(prefix, mw, router)` 会拦掉同前缀下的总台登录）。",

  "platform-auth.routes.ts":
    "① 必须公开：GET /captcha（图形验证码，L23-24）、POST /login（平台登录，L37-43）、POST /mfa/verify（登录二次验证，凭短时效挑战令牌、" +
    "无登录态，L79-80）。" +
    " ② 其余写端点：L46 POST /admin/create、L76/77/78 POST /mfa/setup|confirm|disable 均**同行**挂 `requirePlatformAuth, csrfMiddleware`（认证在前）。" +
    " ③ 不能改声明式：验证码 / 登录 / MFA 挑战验证必须无鉴权，改声明式（requirePlatformAuth）会让总台无法登录。",

  "platform-miniapp.routes.ts":
    "① 必须公开：GET /plans（套餐浏览）、POST /subscriptions（提交订阅申请，配 subscribeLimiter IP 限流）、GET /subscriptions/me（查本人申请）" +
    "—— 面向未登录访客与潜在客户（L19-30 注释逐条注明 auth: none / 公开）。" +
    " ② 其余写端点：无（文件内唯一写端点 POST /subscriptions 本身就是公开申请入口）。" +
    " ③ 不能改声明式：改声明式会让未注册访客无法浏览套餐 / 提交申请；且该写端点无登录态、`req.user` 不存在，" +
    "挂 csrfMiddleware 等于不生效（middleware/csrf.ts:39-42 对未认证请求直接放行），真正的防护是 IP 限流。",

  "retail-announcement.routes.ts":
    "① 必须公开：GET /miniapp/retail-announcements（消费者按门店查看公告，无登录，L25）。" +
    " ② 其余写端点：admin 分支 3 个写端点（L38 POST、L39 PUT、L40 DELETE）由 L34 " +
    "`retailAnnouncementRouter.use(\"/admin\", requireAuthWithTenant)` + L35 `use(\"/admin\", csrfMiddleware)` **同 scope 成对挂载**覆盖。" +
    " ③ 不能改声明式：同文件混有公开消费者端点（改声明式会把 miniapp 公开面一起套鉴权）；L43-44 注释记录改声明式会与 auto-routes " +
    "全局认证中间件形成双重注册（踩坑[69]）。",

  "share.routes.ts":
    "① 必须公开：GET /collections/:token、GET /collections/:token/page、POST /collections/:token/pay（买家凭一次性分享 token 付款，" +
    "付款人是未登录的外部买家）、POST /collections/:token/wx-notify（微信支付回调；controller 内以微信签名验证 + 解密，非登录态）。" +
    " ② 其余写端点：无（两条写端点均为公开面：付款与支付回调）。" +
    " ③ 不能改声明式：收款链接面向未登录买家、以 token 为凭据，改声明式会让分享收款链接失效（401）；回调挂 CSRF 会 403" +
    "（微信无 x-csrf-token）。",

  "wechat.routes.ts":
    "① 必须公开：POST /auth/login（微信 code2Session 换登录态）—— 登录入口本身必须公开（未登录时调用）。" +
    " ② 其余写端点：POST /auth/decrypt-phone、PUT /auth/profile、POST /auth/bind、POST /auth/unbind 由 `requireWxAuth` 保护" +
    "（微信自有令牌：Bearer + JWT 内 wxUserId/openid，middleware/wechat-auth.ts）——该中间件名**不在本门禁的三种声明名内**，" +
    "R2 判据看不穿（本门禁的已知边界，仍成立）；**S3-187 E 已按裁定方案 A 补实**：`requireWxAuth` 校验通过后同时设" +
    "`req.user`（最小可用形状，id = 微信用户 id）与 `req.tenantId`，4 个写端点同行挂 `csrfMiddleware`（认证在前），" +
    "并由登录响应下发 `csrfToken`；两侧行为由 `src/__tests__/routes/wechat-csrf-s3-187.test.ts` 锁定" +
    "（缺 CSRF ⇒ 403 / 带对 ⇒ 到业务层；反测：摘掉 `req.user` 赋值 ⇒ 缺 CSRF 的请求变 200）。" +
    "⚠️ 本文件的 CSRF 状况**仍不由本门禁守护**（它看不穿 `requireWxAuth`），故以用例锁死，不以登记当合规。" +
    " ③ 不能改声明式：本前缀用微信自有令牌体系，routeConfig.auth 的三个取值都不对应这套凭证；改声明式等于换鉴权体系（越界改动）。",
};

const AUTH_MIDDLEWARES = ["requireAuthWithTenant", "requirePlatformAuth", "requireAuth"];
const AUTH_RE = new RegExp(`\\b(${AUTH_MIDDLEWARES.join("|")})\\b`);
const CSRF_RE = /\bcsrfMiddleware\b/;
const WRITE_METHODS = ["post", "put", "patch", "delete"];
const WRITE_LINE_RE = new RegExp(`\\.(${WRITE_METHODS.join("|")})\\s*\\(`);
const rules = [];

/** 字符下标 → 1-based 行号 */
function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

/** 取一段文本里的第一个字符串字面量（单行路由路径 / mount scope） */
function firstStringLiteral(text) {
  const m = /["']([^"'\n]*)["']/.exec(text);
  return m ? m[1] : null;
}

/** 从 `(` 处按括号配平取出整段调用实参文本（跳过字符串字面量；上限 4000 字符防跑飞） */
function callText(src, openIdx, cap = 4000) {
  let depth = 0;
  const end = Math.min(src.length, openIdx + cap);
  for (let i = openIdx; i < end; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      i++;
      while (i < end) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === ch) break;
        i++;
      }
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx, end);
}

/** Express `router.use(scope, mw)` 的作用域语义：scope 是否为 path 的前缀 */
function covers(scope, path) {
  return path === scope || path.startsWith(`${scope}/`);
}

function check(file, src) {
  const authMatch = /\bauth:\s*["']([A-Za-z]+)["']/.exec(src);
  const auth = authMatch ? authMatch[1] : null;
  const lines = src.split(/\r?\n/);
  const hasWrite = WRITE_LINE_RE.test(src);

  // R1：写方法 + auth:none ⇒ 必须显式登记为「公开端点」
  if (hasWrite && auth === "none" && !NONE_ALLOWLIST[file]) {
    rules.push(
      `${file}: 含写方法但 auth:"none" 且未登记为公开端点 ⇒ 该文件的写端点不经过 auto-routes 的 CSRF 挂载。` +
        ` 若确为公开端点（webhook/回调/注册/自有鉴权），请在 NONE_ALLOWLIST 里逐条写明理由` +
        `（① 哪些端点必须公开 + ② 其余写端点的认证/CSRF 现状 + ③ 为什么不能改声明式）；否则改 routeConfig.auth 声明式。`
    );
  }

  if (auth !== "none") return;

  // R2（新口径：逐端点）—— 旧版是"文件级"判据 `/\bcsrfMiddleware\b/.test(src)`：只要文件里出现过一次
  //   该标识就整文件判绿 ⇒ **只摘掉某一个端点的 csrfMiddleware 不会变红**，门禁抓不到它本该抓的那类
  //   回归（2026-10-12 实测复现）。新版按**端点**判定「认证 + CSRF 是否成对」，规则见文件头 R2 说明。

  // 1) 收集 `router.use(...)` 挂载：scope + 是否含认证中间件 / csrfMiddleware
  const mounts = [];
  const useRe = /\.use\s*\(/g;
  let um;
  while ((um = useRe.exec(src)) !== null) {
    const line = lineOf(src, um.index);
    if (/^\s*(import|\/\/|\*)/.test(lines[line - 1] || "")) continue; // 导入与注释不算挂载
    const text = callText(src, src.indexOf("(", um.index));
    mounts.push({
      line,
      scope: firstStringLiteral(text),
      hasAuth: AUTH_RE.test(text),
      hasCsrf: CSRF_RE.test(text),
    });
  }
  // 同 scope 成对挂载（认证 + CSRF，scope 逐字相同）
  const pairedScopes = new Set(
    mounts
      .filter((x) => x.hasAuth && x.scope)
      .map((x) => x.scope)
      .filter((scope) => mounts.some((x) => x.hasCsrf && x.scope === scope))
  );

  // 2) 逐写端点判定
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    if (/^\s*(import|\/\/|\*)/.test(raw)) return; // 导入与注释不算挂载
    if (!WRITE_LINE_RE.test(raw)) return;
    const path = firstStringLiteral(raw);
    const inlineAuth = AUTH_RE.test(raw);
    const coveringAuthMounts = path
      ? mounts.filter((x) => x.hasAuth && x.scope && x.line < lineNo && covers(x.scope, path))
      : [];
    // 未过鉴权的公开写端点（回调/登录/注册/申请）不在 R2 范围：没有登录态就没有可校验的 CSRF 令牌
    if (!inlineAuth && coveringAuthMounts.length === 0) return;
    if (CSRF_RE.test(raw)) return; // (a) 同一行带 csrfMiddleware
    const csrfUnderPath = path
      ? mounts.filter((x) => x.hasCsrf && x.scope && x.line < lineNo && covers(x.scope, path))
      : [];
    if (csrfUnderPath.length > 0) return; // (b) 该路径作用域内成对挂载了 csrfMiddleware
    if (inlineAuth && coveringAuthMounts.some((x) => pairedScopes.has(x.scope))) return; // (b) 覆盖本行路径的 scope 已成对
    const how = inlineAuth
      ? "同一行内联挂载了认证中间件，但**同一行没有 csrfMiddleware**"
      : `路径受 L${coveringAuthMounts[0].line} 的 use("${coveringAuthMounts[0].scope}", 认证中间件) 覆盖，` +
        `但同 scope 没有 use("${coveringAuthMounts[0].scope}", csrfMiddleware) 成对挂载`;
    rules.push(
      `${file}:${lineNo}: auth:"none" 的**写**端点 ${path || "?"}：${how} ⇒ 该写端点无 CSRF 防护（R2 逐端点判据）`
    );
  });
}

if (!existsSync(ROUTES_DIR)) {
  console.error(`找不到路由目录：${ROUTES_DIR}`);
  process.exit(1);
}

const files = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".routes.ts"));
for (const f of files) check(f, readFileSync(join(ROUTES_DIR, f), "utf8"));

console.log(`[guard:route-auth] 扫描 ${files.length} 个路由文件`);
if (rules.length > 0) {
  console.error(`\n❌ G3 违规 ${rules.length} 条：`);
  for (const r of rules) console.error(`   ${r}`);
  process.exit(1);
}
console.log(
  `✅ G3 通过：无「绕过声明式鉴权/CSRF」的路由文件（auth:"none" 的公开端点已登记 ${Object.keys(NONE_ALLOWLIST).length} 个文件）`
);
