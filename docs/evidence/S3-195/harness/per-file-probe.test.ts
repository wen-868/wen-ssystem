/**
 * 【临时取证 · 跑完即删，不入库】S3-195：**逐文件**收窄前/后行为对照。
 * 同一份文件在 `S3-195-base`（收窄前）与 `S3-195`（收窄后）各跑一次 —— 每个文件单独成应用，
 * 只挂它自己的 routeConfig(s) + 生产同款认证中间件（getAuthMiddlewares），然后探四条路径：
 *   ① 不存在的子路径 `/api/store/no-such-path`
 *   ② 兄弟文件的公开注册端点 `/api/store/members/register`
 *   ③ 兄弟文件的公开回调端点 `/api/store/hardware/callbacks/cloud-speaker/t-195`
 *   ④ 本文件自己的第一条端点（不带令牌）
 * 输出：S3_195_PROBE_OUT 指定的 JSON。
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import { getAuthMiddlewares } from "../../shared/auto-routes";
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

function configsOf(mod: any): any[] {
  if (Array.isArray(mod.routeConfigs)) return mod.routeConfigs;
  if (mod.routeConfig) return [mod.routeConfig];
  return [];
}

function buildApp(cfgs: any[]) {
  const app = express();
  app.use(express.json());
  for (const cfg of cfgs) app.use(cfg.prefix, ...getAuthMiddlewares(cfg.auth), cfg.router);
  return app;
}

describe("S3-195 逐文件探针（临时）", () => {
  it("逐文件四条探针", async () => {
    const rows: any[] = [];
    for (const [file, mod] of MODULES) {
      const cfgs = configsOf(mod);
      const app = buildApp(cfgs);

      // 本文件自己的第一条端点（从 router 栈里取，不带令牌）
      let own: { method: string; url: string } | null = null;
      for (const cfg of cfgs) {
        for (const layer of ((cfg.router as any).stack ?? []) as any[]) {
          if (!layer?.route) continue;
          const method = Object.keys(layer.route.methods ?? {}).find((m) => layer.route.methods[m]);
          if (!method) continue;
          const p = layer.route.path ?? "";
          own = { method, url: p === "/" ? cfg.prefix : `${cfg.prefix}${p}` };
          break;
        }
        if (own) break;
      }

      const probes: any[] = [];
      const call = async (label: string, method: "post" | "get", url: string) => {
        const res = method === "post" ? await request(app).post(url).send({}) : await request(app).get(url);
        probes.push({ label, method: method.toUpperCase(), url, status: res.status });
      };

      await call("不存在的子路径", "post", "/api/store/no-such-path");
      await call("兄弟文件公开注册端点", "post", "/api/store/members/register");
      await call("兄弟文件公开回调端点", "post", "/api/store/hardware/callbacks/cloud-speaker/t-195");
      if (own) await call("本文件自有端点（无令牌）", own.method as "post" | "get", own.url);

      rows.push({
        file,
        prefixes: cfgs.map((c) => c.prefix),
        ownEndpoint: own,
        probes,
      });
    }
    const out = process.env.S3_195_PROBE_OUT;
    if (out) writeFileSync(out, JSON.stringify(rows, null, 1), "utf8");
    expect(rows.length).toBe(9);
  }, 120000);
});
