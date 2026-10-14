/**
 * S3-195 · 门店路由「根前缀统一治理」的契约锁（收口总清单第 51 项）
 *
 * 背景：门店 9 个路由文件原先都以**根前缀** `/api/store` 声明式注册 ⇒
 *   `app.use("/api/store", 认证+CSRF, router)` 把**整段** `/api/store/**`（含自己不拥有的路径、
 *   乃至不存在的子路径）先套上认证 + CSRF：
 *     · `POST /api/store/no-such-path` 回 **401**（未登录）而不是 **404**（路由不存在）。
 *     兄弟文件里的 `auth:"none"` 公开端点（`/api/store/members/register`、`/api/store/hardware/callbacks/*`）
 *     是否被拦，取决于 auto-routes 按文件名排序的**挂载顺序**（S3-187 修 commerce-fix 时实测被拦成 401）。
 *
 * 本单把 9 个文件收窄为「只声明自己拥有的路径段」（9 条 → 31 条注册），本用例锁死两件事：
 *   ① 对外 URL **逐字不变**（76 条，收窄前后对照见 `_s3198-evidence/urls-{before,after}.json`）；
 *   ② 整机挂载后 `/api/store/**` 下**不存在**的前缀级认证覆盖：不存在的路径回 404，
 *      而自有路径的认证、兄弟文件的公开端点行为保持不变。
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { setupRoutes } from "../../shared/auto-routes";
import * as storeRoutes from "../../routes/store.routes";
import * as dashboardRoutes from "../../routes/store-dashboard.routes";
import * as hardwareRoutes from "../../routes/store-hardware.routes";
import * as inventoryRoutes from "../../routes/store-inventory.routes";
import * as orderRoutes from "../../routes/store-order.routes";
import * as receivableRoutes from "../../routes/store-receivable.routes";
import * as saleBillRoutes from "../../routes/store-sale-bill.routes";
import * as shiftRoutes from "../../routes/store-shift.routes";
import * as traceRoutes from "../../routes/store-trace.routes";

const MODULES: Array<[string, any]> = [
  ["store.routes.ts", storeRoutes],
  ["store-dashboard.routes.ts", dashboardRoutes],
  ["store-hardware.routes.ts", hardwareRoutes],
  ["store-inventory.routes.ts", inventoryRoutes],
  ["store-order.routes.ts", orderRoutes],
  ["store-receivable.routes.ts", receivableRoutes],
  ["store-sale-bill.routes.ts", saleBillRoutes],
  ["store-shift.routes.ts", shiftRoutes],
  ["store-trace.routes.ts", traceRoutes],
];

/** 收窄**前**（9 条根前缀注册）的对外 URL 快照：收窄不许改动其中任何一条 */
const EXPECTED_URLS: readonly string[] = [
  "DELETE /api/store/hold-orders/:holdNo",
  "GET /api/store/activities",
  "GET /api/store/banners",
  "GET /api/store/batches/:id",
  "GET /api/store/batches/:id/trace",
  "GET /api/store/categories",
  "GET /api/store/collection-links",
  "GET /api/store/daily-sales",
  "GET /api/store/dashboard",
  "GET /api/store/hardware/box-config",
  "GET /api/store/hardware/configs",
  "GET /api/store/hold-orders",
  "GET /api/store/info",
  "GET /api/store/inventory",
  "GET /api/store/inventory/alerts",
  "GET /api/store/inventory/logs",
  "GET /api/store/me",
  "GET /api/store/members",
  "GET /api/store/members/:id(\\d+)",
  "GET /api/store/members/:id(\\d+)/orders",
  "GET /api/store/members/:id(\\d+)/points",
  "GET /api/store/members/:id(\\d+)/points/logs",
  "GET /api/store/members/manage",
  "GET /api/store/orders",
  "GET /api/store/orders/:orderNo",
  "GET /api/store/payment-orders",
  "GET /api/store/payment/channels",
  "GET /api/store/product-categories",
  "GET /api/store/products",
  "GET /api/store/products/:spuId",
  "GET /api/store/products/:spuId/batches",
  "GET /api/store/products/:spuId/tags",
  "GET /api/store/receivables",
  "GET /api/store/refund-orders",
  "GET /api/store/sale-bills",
  "GET /api/store/sale-bills/:billNo",
  "GET /api/store/sale-bills/overdue",
  "GET /api/store/sale-bills/overdue/check",
  "GET /api/store/search/hot",
  "GET /api/store/shift/current",
  "GET /api/store/shift/history",
  "GET /api/store/shifts",
  "GET /api/store/shifts/:shiftNo",
  "GET /api/store/shifts/:shiftNo/check",
  "GET /api/store/shifts/:shiftNo/sales",
  "GET /api/store/tag-groups",
  "GET /api/store/tags",
  "POST /api/store/hardware/box-config/test",
  "POST /api/store/hardware/box/pay",
  "POST /api/store/hardware/cloud-speaker/announce",
  "POST /api/store/hardware/configs/:category/test",
  "POST /api/store/hardware/unionpay/test",
  "POST /api/store/hold-orders",
  "POST /api/store/hold-orders/:holdNo/restore",
  "POST /api/store/inventory/adjust",
  "POST /api/store/members/manage",
  "POST /api/store/orders/:orderNo/accept",
  "POST /api/store/orders/:orderNo/cancel",
  "POST /api/store/orders/:orderNo/complete-delivery",
  "POST /api/store/orders/:orderNo/reject",
  "POST /api/store/orders/:orderNo/start-delivery",
  "POST /api/store/receivables/:receivableNo/payment",
  "POST /api/store/sale-bills",
  "POST /api/store/sale-bills/:billNo/collection-link",
  "POST /api/store/sale-bills/:billNo/offline-payment",
  "POST /api/store/sale-bills/:billNo/pay-by-code",
  "POST /api/store/sale-bills/:billNo/payment",
  "POST /api/store/shift/settle",
  "POST /api/store/shifts",
  "POST /api/store/shifts/:shiftNo/check",
  "POST /api/store/shifts/:shiftNo/close",
  "POST /api/store/trace/verify",
  "PUT /api/store/hardware/box-config",
  "PUT /api/store/hardware/configs/:category",
  "PUT /api/store/inventory/alerts/:skuId/threshold",
  "PUT /api/store/members/:id(\\d+)",
];

function configsOf(mod: any): Array<{ prefix: string; router: any; auth?: string }> {
  if (Array.isArray(mod.routeConfigs)) return mod.routeConfigs;
  if (mod.routeConfig) return [mod.routeConfig];
  return [];
}

function allConfigs() {
  return MODULES.flatMap(([file, mod]) => configsOf(mod).map((cfg) => ({ file, ...cfg })));
}

function urlsOfConfigs(): string[] {
  const urls: string[] = [];
  for (const cfg of allConfigs()) {
    for (const layer of ((cfg.router?.stack ?? []) as any[])) {
      if (!layer?.route) continue;
      for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
        if (!enabled) continue;
        const p = layer.route.path ?? "";
        urls.push(`${method.toUpperCase()} ${p === "/" ? cfg.prefix : `${cfg.prefix}${p}`}`);
      }
    }
  }
  return urls;
}

describe("S3-195 门店路由根前缀收窄", () => {
  it("对外 URL 与收窄前逐字相同（76 条：不增、不减、不重复）", () => {
    const urls = urlsOfConfigs();
    expect(urls.length).toBe(EXPECTED_URLS.length);
    expect(new Set(urls).size).toBe(EXPECTED_URLS.length);
    expect([...urls].sort()).toEqual([...EXPECTED_URLS].sort());
  });

  it("9 个文件均不再以根前缀 /api/store 注册；每条仍声明 requireAuthWithTenant（未放宽鉴权）", () => {
    const configs = allConfigs();
    expect(configs.length).toBe(31);
    expect(configs.map((c) => c.prefix)).not.toContain("/api/store");
    for (const cfg of configs) {
      expect(cfg.prefix.startsWith("/api/store/")).toBe(true);
      expect(cfg.auth).toBe("requireAuthWithTenant");
    }
  });

  describe("整机挂载后的行为（与生产同款 auto-routes 挂载）", () => {
    let app: express.Express;

    beforeAll(async () => {
      app = express();
      app.use(express.json());
      await setupRoutes(app);
    }, 120000);

    it("不存在的子路径 POST /api/store/no-such-path ⇒ 404（收窄前被根前缀的认证拦成 401）", async () => {
      const res = await request(app).post("/api/store/no-such-path").send({});
      expect(res.status).toBe(404);
    });

    it("自有路径的认证仍然生效：无令牌 GET /api/store/products ⇒ 401", async () => {
      const res = await request(app).get("/api/store/products");
      expect(res.status).toBe(401);
    });

    it("兄弟文件的公开注册端点不被前缀级认证波及：无令牌 POST /api/store/members/register ≠ 401/403", async () => {
      const res = await request(app).post("/api/store/members/register").send({});
      console.log("[S3-195] POST /api/store/members/register 无令牌 ⇒", res.status);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("兄弟文件的公开回调端点不被前缀级认证波及：无令牌 POST /api/store/hardware/callbacks/cloud-speaker/:tenantId ≠ 401/403", async () => {
      const res = await request(app).post("/api/store/hardware/callbacks/cloud-speaker/t-195").send({});
      console.log("[S3-195] POST /api/store/hardware/callbacks/cloud-speaker/t-195 无令牌 ⇒", res.status);
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
