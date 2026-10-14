/**
 * 【临时取证 · 跑完即删，不入库】S3-195：把 9 个门店路由文件的「对外 URL 清单」写成 JSON，
 * 用于收窄前/后的 URL 逐字对照（同一份文件在 `S3-195-base`（收窄前）与 `S3-195`（收窄后）各跑一次）。
 *
 * 用 `import * as` + 运行时取 `routeConfigs ?? routeConfig`，故同一份文件在两棵树上都能跑。
 * 输出路径由环境变量 S3_195_DUMP_OUT 指定。
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
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

describe("S3-195 临时取证", () => {
  it("导出 9 个门店路由文件的对外 URL 清单", () => {
    const rows: any[] = [];
    for (const [file, mod] of MODULES) {
      for (const cfg of configsOf(mod)) {
        const endpoints: string[] = [];
        for (const layer of ((cfg.router as any).stack ?? []) as any[]) {
          if (!layer?.route) continue;
          for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
            if (!enabled) continue;
            const p = layer.route.path ?? "";
            endpoints.push(`${method.toUpperCase()} ${p === "/" ? cfg.prefix : `${cfg.prefix}${p}`}`);
          }
        }
        rows.push({ file, prefix: cfg.prefix, auth: cfg.auth ?? "(默认)", endpoints });
      }
    }
    const out = process.env.S3_195_DUMP_OUT;
    if (out) writeFileSync(out, JSON.stringify(rows, null, 1), "utf8");
    expect(rows.length).toBeGreaterThan(0);
  });
});
