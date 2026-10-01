import { describe, it, expect, vi } from "vitest";
import type { Express } from "express";
import { resolve } from "path";
import { readdirSync } from "fs";

vi.mock("../../shared/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../middleware/auth", () => ({
  requireAuth: vi.fn(),
  requireAuthWithTenant: [vi.fn(), vi.fn()],
  requirePlatformAuth: vi.fn(),
}));

import { setupRoutes, inferPrefix, getAuthMiddlewares } from "../../shared/auto-routes";

const fixturesDir = resolve(__dirname, "../fixtures/routes");

// ============================================================================
// S3-133-F1｜case1 的固定清单（治本）
//
// 【为什么用硬编码字面量】
//   原判据只校验「setupRoutes 不抛异常 + app.use 调用数是 number」——两者恒真，
//   而 setupRoutes 对单文件导入失败是 try/catch + continue（auto-routes.ts L98-103），
//   所以**任何真实注册失败都不会让它变红**（= 零信号门禁，见 S3-133 评估 REVERSE-A）。
//   现将判据改为把「运行时扫描结果」与下面这批**冻结的字面量**做比对：
//     · 清单在本卡实施时由一次性真跑快照生成，之后作为常量固定；
//     · 运行时绝不用「当前扫描结果」去生成清单（那会退化成自证、恒绿）。
//
// 【维护约定】新增/下线路由文件时，按护栏报错提示同步更新这三处 + 错误文案所述位置：
//     EXPECTED_PREFIXES / EXPECTED_FILES / EXPECTED_REGISTRATION_COUNT
// ============================================================================

/**
 * 必须被注册的前缀清单（159 条，去重后；旧注释写 155 条属存量笔误，本次实测运行期 159 条并同步）。
 * 由 `setupRoutes` 真实扫描 src/routes/ 一次性快照生成。
 */
const EXPECTED_PREFIXES: readonly string[] = [
  "/api/admin", "/api/admin/alerts", "/api/admin/approval", "/api/admin/archive",
  "/api/admin/auth", "/api/admin/bank-accounts", "/api/admin/brands", "/api/admin/commission",
  "/api/admin/credits", "/api/admin/customer-merge", "/api/admin/customer-prices",
  "/api/admin/customer-types", "/api/admin/customer-visits", "/api/admin/dashboard",
  "/api/admin/data-permissions", "/api/admin/data-transfer", "/api/admin/demo",
  "/api/admin/expenses", "/api/admin/export", "/api/admin/instant-retail", "/api/admin/inventory",
  "/api/admin/inventory-batch", "/api/admin/inventory-share", "/api/admin/library",
  "/api/admin/marketing", "/api/admin/marketing/dashboard", "/api/admin/marketing/gift-rules",
  "/api/admin/marketing/limited-discounts", "/api/admin/marketing/materials",
  "/api/admin/marketing/points-mall", "/api/admin/members", "/api/admin/members/care",
  "/api/admin/members/segments", "/api/admin/members/tags", "/api/admin/menus",
  "/api/admin/monitor", "/api/admin/notifications", "/api/admin/operation-logs",
  "/api/admin/order-timeout", "/api/admin/payments-new", "/api/admin/positions",
  "/api/admin/prices", "/api/admin/print", "/api/admin/product-reviews",
  "/api/admin/product-tags", "/api/admin/products/categories", "/api/admin/purchase-contracts",
  "/api/admin/purchase-in-stocks", "/api/admin/purchase-orders", "/api/admin/purchase-payments",
  "/api/admin/purchase-plans", "/api/admin/purchase-returns", "/api/admin/push",
  "/api/admin/quote-push", "/api/admin/receipts", "/api/admin/receivables",
  "/api/admin/reconciliation", "/api/admin/report-permissions", "/api/admin/reports",
  "/api/admin/retail-announcements", "/api/admin/retail-cart", "/api/admin/sale-returns",
  "/api/admin/sms-templates", "/api/admin/stock-checks", "/api/admin/stock-warnings",
  "/api/admin/store-control", "/api/admin/store-value-cards", "/api/admin/supplier-contacts",
  "/api/admin/supplier-statements", "/api/admin/suppliers", "/api/admin/sys-config",
  "/api/admin/sys-users", "/api/admin/system", "/api/admin/system/audit-logs",
  "/api/admin/system/roles", "/api/admin/tenant-usage", "/api/admin/trace",
  "/api/admin/transfer-orders", "/api/admin/transfers", "/api/admin/unit-groups",
  "/api/admin/units", "/api/admin/warehouses", "/api/app", "/api/custom-report",
  "/api/department", "/api/instant-retail", "/api/marketing-asset", "/api/marketing/bargain",
  "/api/marketing/group-buy", "/api/marketing/seckill", "/api/miniapp", "/api/miniapp-config",
  "/api/miniapp-order-sync", "/api/miniapp/cart", "/api/miniapp/marketing",
  "/api/miniapp/notifications", "/api/miniapp/trace", "/api/miniapp/wechat", "/api/monitor",
  "/api/open/library", "/api/padmin", "/api/pay", "/api/payment-config", "/api/platform",
  "/api/platform-miniapp", "/api/platform/admins", "/api/platform/ai", "/api/platform/ai-billing",
  "/api/platform/agents", "/api/platform/announcements", "/api/platform/applications",
  "/api/platform/audit-logs",
  "/api/platform/auth", "/api/platform/billing", "/api/platform/channel-reports",
  "/api/platform/config",
  "/api/platform/dashboard", "/api/platform/library", "/api/platform/monitor",
  "/api/platform/notifications", "/api/platform/open", "/api/platform/permissions",
  "/api/platform/plans", "/api/platform/promo-codes", "/api/platform/referral-ledger",
  "/api/platform/reconciliation",
  "/api/platform/reports/export",
  "/api/platform/reviews", "/api/platform/roles", "/api/platform/settlements",
  "/api/platform/subscription-applies", "/api/platform/subscriptions-management",
  "/api/platform/support", "/api/platform/templates", "/api/platform/tenants",
  "/api/platform/tenants-management", "/api/points-mall", "/api/quote-share",
  "/api/retail-announcement", "/api/retail-consumer-address", "/api/saas/subscriptions",
  "/api/saas/tenants", "/api/seckill", "/api/share", "/api/store", "/api/store/control",
  "/api/store/coupons", "/api/store/customer-payments", "/api/store/customer-statements",
  "/api/store/hardware", "/api/store/instant-retail", "/api/store/members",
  "/api/store/sale-returns", "/api/store/stock-checks", "/api/store/transfers", "/api/sync",
  "/api/system", "/api/tenant", "/api/user-session",
];

/**
 * src/routes/ 下的路由文件清单（189 个）。
 * 用于「新增文件护栏」：目录里新出现的 *.routes.ts 若不在此清单/豁免表内 ⇒ 判红。
 */
const EXPECTED_FILES: readonly string[] = [
  "admin-auth.routes.ts", "admin-bill-history.routes.ts", "admin-credit.routes.ts",
  "admin-customer.routes.ts", "admin-finance.routes.ts", "admin-inventory.routes.ts",
  "admin-library.routes.ts", "admin-marketing-calculation.routes.ts",
  "admin-marketing-coupon.routes.ts", "admin-marketing-flash-sale.routes.ts",
  "admin-marketing-full-reduction.routes.ts", "admin-marketing-group-buy.routes.ts",
  "admin-marketing-points.routes.ts", "admin-marketing-stack-rule.routes.ts",
  "admin-order.routes.ts", "admin-platform-announcement.routes.ts",
  "admin-platform-audit-log.routes.ts", "admin-platform-settlement.routes.ts",
  "admin-product.routes.ts", "admin-quote-push.routes.ts", "admin-report.routes.ts",
  "admin-staff.routes.ts", "admin-store.routes.ts", "admin-system.routes.ts",
  "admin-tenant-usage.routes.ts", "aftersale.routes.ts", "ai-billing.routes.ts",
  "ai-platform.routes.ts", "alert.routes.ts", "approval.routes.ts", "archive.routes.ts",
  "audit.routes.ts", "avatar.routes.ts", "bank-account.routes.ts", "billing-config.routes.ts",
  "brand.routes.ts", "cart.routes.ts", "category.routes.ts", "commerce-fix.routes.ts",
  "commission.routes.ts", "community-marketing.routes.ts", "credit.routes.ts",
  "custom-report-v2.routes.ts", "custom-report.routes.ts", "customer-care.routes.ts",
  "customer-merge.routes.ts", "customer-payment.routes.ts", "customer-price.routes.ts",
  "customer-segment.routes.ts", "customer-statement.routes.ts", "customer-tag.routes.ts",
  "customer-type.routes.ts", "customer-visit.routes.ts", "dashboard.routes.ts",
  "data-permission.routes.ts", "data-transfer.routes.ts", "demo.routes.ts",
  "department.routes.ts", "error-log.routes.ts", "expense.routes.ts", "export.routes.ts",
  "feedback.routes.ts", "hardware-callback.routes.ts", "instant-retail-admin-ops.routes.ts",
  "instant-retail-admin-platform.routes.ts", "instant-retail-store.routes.ts",
  "instant-retail-webhook.routes.ts", "inventory-batch.routes.ts", "inventory-cost.routes.ts",
  "inventory-loss-gain.routes.ts", "inventory-profit-loss.routes.ts", "inventory-share.routes.ts",
  "marketing-asset.routes.ts", "marketing-dashboard.routes.ts", "marketing-gift-rule.routes.ts",
  "marketing-limited-discount.routes.ts", "marketing-material.routes.ts",
  "marketing-miniapp.routes.ts", "marketing-points-mall.routes.ts", "member-register.routes.ts",
  "menu-permission.routes.ts", "miniapp-config.routes.ts", "miniapp-order-sync.routes.ts",
  "miniapp.routes.ts", "monitor-slow-query.routes.ts", "monitor-system.routes.ts",
  "monitor.routes.ts", "notification.routes.ts", "open-library.routes.ts",
  "operation-log.routes.ts", "order-exception.routes.ts", "order-timeout.routes.ts",
  "payment-config.routes.ts", "payment-new.routes.ts", "payment.routes.ts",
  "platform-agent.routes.ts", "platform-app-version.routes.ts", "platform-applications.routes.ts",
  "platform-auth.routes.ts",
  "platform-billing-arrears.routes.ts", "platform-billing.routes.ts",
  "platform-channel-report.routes.ts", "platform-config.routes.ts",
  "platform-dashboard.routes.ts", "platform-error-log.routes.ts",
  "platform-export-task.routes.ts", "platform-library.routes.ts", "platform-miniapp.routes.ts",
  "platform-monitor-ops.routes.ts", "platform-monitor.routes.ts", "platform-msg-config.routes.ts",
  "platform-notification.routes.ts", "platform-open.routes.ts", "platform-plans.routes.ts",
  "platform-promo-code.routes.ts", "platform-reconciliation.routes.ts",
  "platform-referral-ledger.routes.ts",
  "platform-review.routes.ts", "platform-role.routes.ts",
  "platform-subscription-applies.routes.ts", "platform-templates.routes.ts",
  "platform-tenant.routes.ts", "platform-ticket.routes.ts", "platform.routes.ts",
  "points-mall.routes.ts", "points.routes.ts", "position.routes.ts", "price.routes.ts",
  "print.routes.ts", "product-bundle.routes.ts", "product-marketing-tag.routes.ts",
  "product-review.routes.ts", "purchase-contract.routes.ts", "purchase-in-stock.routes.ts",
  "purchase-payment.routes.ts", "purchase-plan.routes.ts", "purchase-return.routes.ts",
  "purchase.routes.ts", "push.routes.ts", "rbac.routes.ts", "receipt.routes.ts",
  "receivable.routes.ts", "reconciliation.routes.ts", "report-permissions.routes.ts",
  "report.routes.ts", "retail-announcement.routes.ts", "retail-announcements-admin.routes.ts",
  "retail-cart.routes.ts", "retail-consumer-address.routes.ts", "saas-subscription.routes.ts",
  "saas-tenant.routes.ts", "sale-return.routes.ts", "seckill.routes.ts", "share.routes.ts",
  "sms-template.routes.ts", "stock-check.routes.ts", "stock-warning.routes.ts",
  "store-control.routes.ts", "store-coupon.routes.ts", "store-dashboard.routes.ts",
  "store-hardware.routes.ts", "store-inventory.routes.ts", "store-order.routes.ts",
  "store-receivable.routes.ts", "store-sale-bill.routes.ts", "store-shift.routes.ts",
  "store-trace.routes.ts", "store-value-card.routes.ts", "store.routes.ts",
  "subscription.routes.ts", "supplier-contact.routes.ts", "supplier-statement.routes.ts",
  "supplier.routes.ts", "sync.routes.ts", "sys-config.routes.ts", "sys-user.routes.ts",
  "system.routes.ts", "tag.routes.ts", "tenant-register.routes.ts", "tenant.routes.ts",
  "trace.routes.ts", "transfer-order.routes.ts", "transfer.routes.ts", "unit-group.routes.ts",
  "unit.routes.ts", "user-session.routes.ts", "warehouse.routes.ts", "wechat.routes.ts",
  "workbench.routes.ts",
];

/**
 * 豁免表：确认**不注册任何前缀**的路由文件（如仅导出工具函数的文件）。
 * 当前为空——本次快照中 189 个文件无一例外都贡献了 ≥1 条注册。
 * 新增豁免需在评审时说明理由，避免用它把「注册失败」洗白。
 */
const EXEMPT_FILES: readonly string[] = [];

/**
 * 注册总数基线（= app.use 被调用的次数）。
 * 当前 routes/ 下 189 个文件共产生 203 条注册（C6-3-2b 新增 platform-referral-ledger.routes.ts 与
 * platform-channel-report.routes.ts 后由 201 递增）。
 *
 * 【这条为什么能补 toContain 的盲区】
 *   多个文件共享同一前缀（如 /api/store、/api/admin 各被多文件注册），
 *   单个共享文件掉线时该前缀仍被其他文件注册 ⇒ toContain 抓不到；
 *   但注册总数必然下降 ⇒ 本条必红。因快照中**每个文件都贡献 ≥1 条注册**，故总数守恒等价于「无文件掉线」。
 */
const EXPECTED_REGISTRATION_COUNT = 203;

/**
 * 耗时基线告警（治标 ②）
 * BASELINE_MEDIAN_MS：本用例耗时的历史中位数。
 *   本机（2026-09-27 实测 3 次）中位数 ≈ 44.5s；凌舟机空闲基线 18.18s。
 *   ⇒ 该常量**需按 CI 机器实测中位数校准**；不同机器请勿直接沿用。
 * 超过中位数 ${BASELINE_WARN_FACTOR} 倍时输出 warn（**只告警、不判失败**），用于在真正超时之前提前发现劣化。
 */
const BASELINE_MEDIAN_MS = 44500;
const BASELINE_WARN_FACTOR = 3;

/** 真实路由目录（与原用例「扫描 routes/ 目录」同一范围，**不得**因提速而缩小） */
const realRoutesDir = resolve(__dirname, "../../routes");

describe("auto-routes", () => {
  it(
    "应扫描 routes/ 目录并注册路由：固定前缀清单 toContain + 新增文件护栏 + 注册总数守恒",
    async () => {
      const mockUse = vi.fn();
      const mockApp = { use: mockUse } as unknown as Express;

      // setupRoutes 仍扫描**完整的** src/routes/ 目录（覆盖面不得低于原判据）
      const t0 = Date.now();
      await expect(setupRoutes(mockApp)).resolves.not.toThrow();
      const elapsed = Date.now() - t0;

      // ---------- 治标 ②：耗时基线告警（仅 warn，不判失败、不落盘、不新增仓库状态文件）----------
      const warnLine = BASELINE_MEDIAN_MS * BASELINE_WARN_FACTOR;
      if (elapsed > warnLine) {
        console.warn(
          `[auto-routes][耗时基线告警] 本用例耗时 ${elapsed}ms，已超过历史中位数 ${BASELINE_MEDIAN_MS}ms 的 ${BASELINE_WARN_FACTOR} 倍（告警线 ${warnLine}ms）。` +
            ` 请排查：① 是否引入新的重型依赖；② src/routes/ 目录是否膨胀；③ CI 机器是否被并发抢占。` +
            ` 若属合理增长，请以 CI 机器实测中位数更新 BASELINE_MEDIAN_MS。`
        );
      }

      const prefixes: string[] = mockUse.mock.calls.map((call: any[]) => call[0]);
      const registered = Array.from(new Set(prefixes));

      // ---------- 判据 1：固定前缀清单，逐条必须在注册结果中 ----------
      // 说明：清单是冻结的字面量（见上方常量区注释），不是由本次扫描结果反推，
      //      因此「某路由真的没注册上」会在这里变红 —— 这正是原 not.toThrow 做不到的。
      const missingPrefixes = EXPECTED_PREFIXES.filter((p) => !registered.includes(p));
      if (missingPrefixes.length > 0) {
        console.error(
          "[auto-routes] 以下前缀未被注册：\n  " + missingPrefixes.join("\n  ")
        );
      }
      expect(missingPrefixes).toEqual([]);

      // ---------- 判据 2：新增文件护栏 ----------
      // 新出现的 *.routes.ts 必须显式登记并补齐其前缀，否则判红，
      // 防止「新路由悄悄上线却没被注册」无人知晓。
      // 注：本判据须先于「总数守恒」执行——新增文件会同时让总数 +1，
      //     若总数断言先行，报错会落在总数上而掩盖「请加进清单」这条更可操作的提示。
      const scannedFiles = readdirSync(realRoutesDir).filter(
        (f) => f.endsWith(".routes.ts") || f.endsWith(".routes.js")
      );
      const unlistedFiles = scannedFiles.filter(
        (f) => !EXPECTED_FILES.includes(f) && !EXEMPT_FILES.includes(f)
      );
      if (unlistedFiles.length > 0) {
        console.error(
          "[auto-routes][新增文件护栏] 以下路由文件未纳入清单：\n  " +
            unlistedFiles.join("\n  ")
        );
      }
      expect(unlistedFiles).toEqual([]);

      // ---------- 判据 3：注册总数守恒（补 toContain 的共享前缀盲区）----------
      // 任何既有路由文件彻底掉线（典型：导入抛错被 auto-routes.ts L98-103 的 try/catch 吞掉）
      // 都会让总数下降，即使它原本贡献的是被多文件共享的前缀。
      const countDelta = prefixes.length - EXPECTED_REGISTRATION_COUNT;
      if (countDelta !== 0) {
        console.error(
          `[auto-routes] app.use 注册总数由基线 ${EXPECTED_REGISTRATION_COUNT} 变为 ${prefixes.length}（差值 ${countDelta > 0 ? "+" : ""}${countDelta}）。` +
            (countDelta < 0
              ? ` 有 ${-countDelta} 条注册丢失——极可能是某路由文件导入失败（其异常被 try/catch 吞掉，请查 logger.error「无法加载路由模块」）。`
              : ` 注册数增加——若确为新增路由，请同步更新 EXPECTED_PREFIXES / EXPECTED_FILES / EXPECTED_REGISTRATION_COUNT。`)
        );
      }
      expect(prefixes.length).toBe(EXPECTED_REGISTRATION_COUNT);
    },
    180000
  );

  it("routes/ 目录不存在时应跳过不抛出", async () => {
    // 通过传入不存在的目录模拟
    const mockApp = { use: vi.fn() } as unknown as Express;

    await expect(
      setupRoutes(mockApp, { routesDir: "/nonexistent/path/routes" })
    ).resolves.not.toThrow();
  });

  it("优先级1: routeConfigs 数组应注册多个路由", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 应该注册了 routeConfigs 数组中的 2 个路由
    // 以及 routeConfig 单个、singleRouter 推断的路由
    expect(mockUse.mock.calls.length).toBeGreaterThan(0);
  });

  it("优先级2: routeConfig 单个对象应注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 检查是否有 /api/test-routeconfig 被注册
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-routeconfig");
  });

  it("优先级1: routeConfigs 数组中的前缀都应注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-routecfgs-1");
    expect(prefixes).toContain("/api/test-routecfgs-2");
  });

  it("优先级3: 单个 Router 导出应从文件名推断 prefix", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-single-router.routes.ts → /api/test-single-router
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-single-router");
  });

  it(".routes.js 后缀文件应被扫描并注册", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-js-single.routes.js → /api/test-js-single
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).toContain("/api/test-js-single");
  });

  it("routeConfigs 中 prefix 为空的项应被跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // 空字符串 prefix 不应被注册
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("");
  });

  it("优先级4: 多个 Router 导出但无 routeConfigs 应跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-multi-router 不应注册任何路由（多个 Router 但无 routeConfigs）
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("/api/test-multi-router");
  });

  it("无 Router 导出的文件应跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    // test-no-router 不应注册任何路由
    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    expect(prefixes).not.toContain("/api/test-no-router");
  });

  it("router 为 undefined 的配置项应被跳过", async () => {
    const mockUse = vi.fn();
    const mockApp = { use: mockUse } as unknown as Express;

    await setupRoutes(mockApp, { routesDir: fixturesDir });

    const prefixes = mockUse.mock.calls.map((call: any[]) => call[0]);
    // router 为 undefined 的配置不应被注册
    expect(prefixes).not.toContain("/api/test-router-undefined");
    // 同文件中 router 有效的配置应正常注册
    expect(prefixes).toContain("/api/test-router-valid");
  });
});

// ========== inferPrefix ==========
describe("inferPrefix", () => {
  it("应从 .routes.ts 文件名推断前缀", () => {
    expect(inferPrefix("admin.routes.ts")).toBe("/api/admin");
    expect(inferPrefix("brand.routes.ts")).toBe("/api/brand");
  });

  it("应从 .routes.js 文件名推断前缀", () => {
    expect(inferPrefix("admin.routes.js")).toBe("/api/admin");
  });

  it("应处理带路径的文件名", () => {
    expect(inferPrefix("user-session.routes.ts")).toBe("/api/user-session");
  });
});

// ========== getAuthMiddlewares ==========
describe("getAuthMiddlewares", () => {
  it("requireAuth 应返回包含 requireAuth 和 csrfMiddleware 的数组", () => {
    const middlewares = getAuthMiddlewares("requireAuth");
    expect(Array.isArray(middlewares)).toBe(true);
    expect(middlewares.length).toBe(2);
  });

  it("requireAuthWithTenant 应返回中间件数组", () => {
    const middlewares = getAuthMiddlewares("requireAuthWithTenant");
    expect(Array.isArray(middlewares)).toBe(true);
  });

  it("requirePlatformAuth 应返回包含 requirePlatformAuth 和 csrfMiddleware 的数组", () => {
    const middlewares = getAuthMiddlewares("requirePlatformAuth");
    expect(Array.isArray(middlewares)).toBe(true);
    expect(middlewares.length).toBe(2);
  });

  it("none 应返回空数组", () => {
    const middlewares = getAuthMiddlewares("none");
    expect(middlewares).toEqual([]);
  });

  it("未指定 auth 应默认返回 requireAuthWithTenant", () => {
    const middlewares = getAuthMiddlewares(undefined);
    expect(Array.isArray(middlewares)).toBe(true);
  });
});
