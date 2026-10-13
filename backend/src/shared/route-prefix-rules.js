/**
 * ── S3-189 ③：重复前缀 / 真重复端点的**唯一判据 + 唯一白名单**（共享模块）────────────
 *
 * 【为什么是 .js 而不是 .ts】
 *   本模块要同时被两处调用：
 *     ① 启动期：`backend/src/shared/auto-routes.ts`（TS，编译进 `dist/`，随部署产物上生产）；
 *     ② 独立门禁脚本：`backend/scripts/guard-route-prefix.mjs`（纯 `node` 直跑，CI 里不依赖编译产物）。
 *   `.mjs` 脚本无法 import TS 源；而生产部署只同步 `backend/dist`（`deploy/deploy-production.sh:86`），
 *   启动期也无法 import `backend/scripts/**`（不会上生产）。故把这份**纯数据 + 纯函数**放在
 *   `src/shared/` 下的普通 ESM `.js`（`backend/package.json` 的 `type: module` 使其即 ESM），
 *   随 `tsc`（`allowJs`）一起进 `dist/`，两侧各自 import 同一份文件 ⇒ **不存在第二套判据**。
 *
 * 【本文件不得 import 任何东西】——它要能被裸 `node` 直接加载（脚本侧），保持零依赖。
 *
 * 【判据拆成两类，避免把合法写法一起打死】
 *   ① **真重复端点**：同 method + 同完整路径被多个路由文件注册 ⇒ 后者永不执行（死代码）
 *      ⇒ **一律阻断，无白名单**（见 classifyRoutePrefixes().duplicateEndpoints）。
 *   ② **重复前缀**：多个路由文件共用同一 prefix。多数是合法的（如 19 个文件共用
 *      `/api/admin`，路径段互不重叠）⇒ 必须**逐条登记理由**后才能放行；
 *      未登记的重复前缀一律阻断（见 classifyRoutePrefixes().unlistedDuplicatePrefixes）。
 *
 * 【白名单可见性】启动日志与门禁脚本都会**逐条打印**在用的白名单条目（前缀 + 次数 + 理由），
 *   CI 日志可直接看到，不是只在源码里躺着。真重复端点检测为 0 是每条放行条目的机器证据。
 *
 * 【维护约定】新增/下线共用同一前缀的路由文件时无需改本表（理由按前缀登记，不按文件快照）；
 *   新增**未登记**的重复前缀 ⇒ 启动即失败、门禁脚本即红，报错里给出"请登记理由或改名"的处置指引。
 */

export const DUPLICATE_PREFIX_ALLOWLIST = {
  // 每条的机器证据：本轮启动实测「同 method + 同完整路径」重复注册为 **0 项**
  // （即这些文件共用前缀但路径段不重叠）；若哪天变成真重复，① 会在启动时先一步阻断。
  "/api/admin":
    "工作台根前缀，按业务模块拆文件（销售/采购/库存/客户/报表/员工/系统…）各自挂 /api/admin 根下，路径段互不重叠。" +
    "合并成单文件会得到一个上万行的巨型路由文件，与「一模块一路由文件」的既有拆分相悖；真重复端点检测为 0，故放行。",
  "/api/store":
    "门店端根前缀（历史条目）。S3-195 已把原先以根前缀注册的 9 个文件逐个收窄到「自己拥有的路径段」" +
    "（store.routes / store-dashboard / store-hardware / store-inventory / store-order / store-receivable /" +
    " store-sale-bill / store-shift / store-trace）⇒ 当前**已无文件**以本前缀注册，" +
    "`POST /api/store/no-such-path` 由 401 回到 404。本条保留作回归记录，不再构成放行理由：" +
    "若再有文件以根前缀注册，会先被『根前缀共享告警』点名，并应改按自有路径段注册。",
  "/api/admin/marketing":
    "营销中心按玩法分文件（券/秒杀/满减/拼团/积分/阶梯规则/计算），共用 /api/admin/marketing 子前缀；" +
    "每个玩法是个独立小模块，路径段互不重叠。",
  "/api/admin/inventory":
    "库存域按单据类型分文件（成本/报损报溢/盘盈亏），共用 /api/admin/inventory 子前缀；路径段互不重叠。",
  "/api/platform":
    "平台端根前缀，由 platform.routes.ts（总览/管理员）、platform-msg-config.routes.ts（消息配置）、" +
    "platform-error-log.routes.ts（错误日志）三个既有文件共用；路径段互不重叠。",
  "/api/platform/billing":
    "计费域按能力分文件（欠费策略/账单对账），共用 /api/platform/billing 子前缀；路径段互不重叠（C4-1 回传卡已报备过该计数+1）。",
  "/api/admin/instant-retail":
    "即时零售后台：ops 文件承载订单/货架/配送/评价/对账/报表，platform 文件承载三方平台配置/店铺配置/商品/分类/轮播；" +
    "共用子前缀但路径段互不重叠（同前缀的两处 /shelf 真重复已于 S3-179 删除死代码）。",
  "/api/admin/reports":
    "报表域：report.routes.ts（标准报表）与 custom-report-v2.routes.ts（自定义报表 v2）共用子前缀；路径段互不重叠。",
  "/api/miniapp":
    "小程序端根前缀：miniapp.routes.ts（主链路）与 aftersale.routes.ts（售后的 miniapp 分支）共用；路径段互不重叠" +
    "（aftersale 用 routeConfigs 注册 miniapp/auth-none + admin 两条配置，见 guard:route-auth 的登记）。",
  // ↓ S3-187 新增；S3-189 把本表从 auto-routes.ts 搬进本文件时**原样带过来**（rebase 冲突处置，
  //   凌舟 2026-10-14：条目与理由逐字保留，不做语义改写）。
  "/api/store/coupons":
    "门店优惠券子前缀：store-coupon.routes.ts（门店侧券列表/详情/核销：/、/:id、/verify、/manual-verify）与" +
    "commerce-fix.routes.ts（核销**记录**查询 /verify-records）共用。S3-187 前 commerce-fix 以根前缀" +
    "「/api/store」注册，把整个 /api/store/**（含它不拥有的路径与不存在的子路径）都套上认证+CSRF，实测把" +
    "/api/store/members/register、/api/store/hardware/callbacks/* 两个 auth:none 端点拦成 401；" +
    "现按「只声明自己拥有的路径段」收窄到本前缀。两条配置路径段互不重叠，真重复端点 0 项（启动日志逐条打印）。",
  "/api/monitor":
    "监控域：monitor-system.routes.ts（系统指标）与 monitor-slow-query.routes.ts（慢查询）共用子前缀；路径段互不重叠。",
  "/api/platform/monitor":
    "平台监控域：platform-monitor.routes.ts（主）与 platform-monitor-ops.routes.ts（运维补充）共用子前缀；路径段互不重叠。",
  // ↓ S3-195 新增：收窄后 store.routes.ts 的会员段与 member-register.routes.ts 在同一前缀下并存
  "/api/store/members":
    "门店会员段：store.routes.ts（会员列表/管理/详情/积分/明细/订单，全部需登录）与" +
    "member-register.routes.ts（POST /sms-code、POST /register 两条**公开**注册端点，auth:\"none\"）共用。" +
    "S3-195 把 store.routes 从根前缀 `/api/store` 收窄到本条后，两者路径段仍互不重叠" +
    "（store.routes 拥有 `/`、`/manage`、`/:id(\\d+)`…；member-register 拥有 `/register`、`/sms-code`），" +
    "真重复端点 0 项。**挂载顺序是契约的一部分**：auto-routes 按文件名排序注册，`member-register.routes.ts`" +
    "排在 `store.routes.ts` 之前 ⇒ 两条公开端点先被前者接走，不会被后者的认证+CSRF 波及" +
    "（由 src/__tests__/routes/store-prefix-narrowing-s3-195.test.ts 的整机挂载用例锁死）。",
};

/**
 * ── S3-195 ③：「根前缀被多文件共享」的**告警**判据（只出声、不判红）────────────────────
 *
 * 【为什么要有】以**根前缀**（形如 `/api/store`、`/api/admin`）注册的文件，
 *   `app.use(前缀, 认证+CSRF, router)` 会把**整段** `/api/xxx/**`（含该文件不拥有的路径、
 *   乃至根本不存在的子路径）都先套上认证 + CSRF ⇒ 兄弟文件里的 `auth:"none"` 公开端点会被拦成
 *   401、不存在的路径会回 401 而不是 404（S3-187 实测 `/api/store/members/register`、
 *   `/api/store/hardware/callbacks/*`；S3-195 全量收窄后 `/api/store` 已无声明方）。
 *   这类写法**不违反**既有判据（路径段互不重叠即「合法共享前缀」），所以不能判红；
 *   但它每次都靠人记得去核，故在此**机器出声**，避免下次再靠人记。
 *
 * 【口径】只对 `/api/xxx` 这种**根前缀**（直接子段）出声；更深的共享前缀（如 `/api/store/coupons`、
 *   `/api/admin/marketing`）不受本条约束 —— 它们的覆盖范围本就只到自己的业务段。
 */
export const ROOT_PREFIX_RE = /^\/api\/[^/]+$/;

/** 从 `duplicatePrefixes` 里筛出根前缀（S3-195 ③ 的判据；纯函数，供启动期与门禁脚本共用） */
export function findSharedRootPrefixes(duplicatePrefixes) {
  return (duplicatePrefixes ?? []).filter((d) => ROOT_PREFIX_RE.test(d.prefix));
}

/**
 * 拼出端点的完整路径（prefix + 路由路径），并做两处归一：
 *  · 折叠重复斜杠、去掉末尾斜杠（`/api/x` + `/` ⇒ `/api/x`，与 Express 挂载语义一致）；
 *  · 参数名归一为 `:`（`/p/:id` 与 `/p/:userId` 在 Express 里匹配同一批 URL ⇒ 视为同一路径）。
 */
export function joinRoutePath(prefix, routePath) {
  const collapsed = `${prefix}/${routePath ?? ""}`.replace(/\/{2,}/g, "/");
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
  return (trimmed === "" ? "/" : trimmed).replace(/:[^/]+/g, ":");
}

/**
 * 检查入口的「重复前缀 / 真重复端点」判据（**纯函数**：只吃入口数组，不读文件、不碰 Express）。
 *
 * @param entries 入口数组，每项 = 一条 `prefix + router` 注册：
 *        · `prefix`        挂载前缀（逐字，如 "/api/admin"）
 *        · `file`          声明该配置的路由文件名（报错定位用）
 *        · `endpoints`     该 router 直接注册的端点（`"POST /api/x/y"` 形态，已由 joinRoutePath 归一）；
 *                          调用方拿不到子树时传 `[]`（并在 `nestedRouter` 上登记，不静默）
 *        · `nestedRouter`  该入口是否挂了子路由（子树端点不可知 ⇒ 只登记不静默）
 * @returns 与启动期报告同形：
 *        · `duplicatePrefixes`          重复前缀（含白名单内的），按文件数降序
 *        · `unlistedDuplicatePrefixes`  未登记的重复前缀（阻断项）
 *        · `duplicateEndpoints`         真重复端点（阻断项，无白名单）
 *        · `nestedRouterFiles`          挂了子路由的文件（已知边界，登记而不静默）
 */
export function classifyRoutePrefixes(entries) {
  const prefixFiles = new Map();
  const endpointFiles = new Map();
  const nestedRouterFiles = new Set();

  for (const entry of entries) {
    const filesOfPrefix = prefixFiles.get(entry.prefix) ?? [];
    filesOfPrefix.push(entry.file);
    prefixFiles.set(entry.prefix, filesOfPrefix);

    if (entry.nestedRouter) nestedRouterFiles.add(entry.file);

    for (const endpoint of entry.endpoints ?? []) {
      const filesOfEndpoint = endpointFiles.get(endpoint) ?? [];
      filesOfEndpoint.push(entry.file);
      endpointFiles.set(endpoint, filesOfEndpoint);
    }
  }

  const duplicatePrefixes = Array.from(prefixFiles.entries())
    .filter(([, files]) => files.length > 1)
    .map(([prefix, files]) => ({ prefix, files: [...files].sort() }))
    .sort((a, b) => b.files.length - a.files.length || a.prefix.localeCompare(b.prefix));

  const duplicateEndpoints = Array.from(endpointFiles.entries())
    .filter(([, files]) => files.length > 1)
    .map(([endpoint, files]) => ({ endpoint, files: [...files].sort() }))
    .sort((a, b) => a.endpoint.localeCompare(b.endpoint));

  return {
    duplicatePrefixes,
    unlistedDuplicatePrefixes: duplicatePrefixes.filter((d) => !(d.prefix in DUPLICATE_PREFIX_ALLOWLIST)),
    duplicateEndpoints,
    nestedRouterFiles: Array.from(nestedRouterFiles).sort(),
    /** S3-195 ③：根前缀被多文件共享（**只出声、不判红**，见 findSharedRootPrefixes 的说明） */
    sharedRootPrefixes: findSharedRootPrefixes(duplicatePrefixes),
  };
}
