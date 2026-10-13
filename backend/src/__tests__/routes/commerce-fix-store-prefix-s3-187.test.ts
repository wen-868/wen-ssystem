/**
 * S3-187 B 回归测试 · commerce-fix.routes.ts 不再「前缀级」覆盖整个 /api/store/**
 *
 * 防的是什么：该文件原先以 `{ prefix: "/api/store", auth: "requireAuthWithTenant" }` 注册，
 * auto-routes 会编译成 `app.use("/api/store", 认证, 租户, CSRF, router)` ⇒ **它不拥有**、
 * 甚至**不存在**的子路径也先过认证+CSRF：实测整机下
 *   POST /api/store/members/register（auth:"none" 的会员自助注册）、
 *   POST /api/store/hardware/callbacks/cloud-speaker/:tenantId（auth:"none" 的服务商回调）
 * 都被拦成 401。且覆盖面取决于**文件名排序**，改名即静默改变全局防护面。
 *
 * 本用例按「只挂本文件的 routeConfigs」取证（与整机隔离），这样前缀级副作用才可见：
 *   · 修前：/api/store/members/register ⇒ 401（被本文件拦）；
 *   · 修后：⇒ 404（本文件与该路径无关，不再拦）。
 * 正向防护同时锁定：本文件真正拥有的 /api/store/coupons/verify-records 仍须 401。
 */
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { routeConfigs } from "../../routes/commerce-fix.routes";
import { getAuthMiddlewares } from "../../shared/auto-routes";

const app = express();
app.use(express.json());
for (const config of routeConfigs) {
  app.use(config.prefix, ...getAuthMiddlewares(config.auth), config.router);
}

describe("S3-187 B · commerce-fix 前缀收窄为「自己拥有的路径段」", () => {
  it("两条配置的前缀是显式声明（不再出现根前缀 /api/store）", () => {
    expect(routeConfigs.map((c) => c.prefix)).toEqual(["/api/admin", "/api/store/coupons"]);
  });

  it("正向：自己拥有的端点仍受认证保护（无凭证 ⇒ 401）", async () => {
    const store = await request(app).get("/api/store/coupons/verify-records");
    expect(store.status).toBe(401);

    const admin = await request(app).get("/api/admin/fund-transactions");
    expect(admin.status).toBe(401);
  });

  it("反向：它不拥有的 /api/store/** 路径不再被本文件套认证（修前是 401，现在是 404 = 与本文件无关）", async () => {
    // 会员自助注册（member-register.routes.ts，auth:"none"）
    const register = await request(app).post("/api/store/members/register").send({ phone: "13800138000" });
    expect(register.status, "会员注册不应被 commerce-fix 的前缀级认证拦成 401").toBe(404);

    // 服务商回调（hardware-callback.routes.ts，auth:"none"）
    const callback = await request(app).post("/api/store/hardware/callbacks/cloud-speaker/t1").send({});
    expect(callback.status, "硬件回调不应被 commerce-fix 的前缀级认证拦成 401").toBe(404);

    // 不存在的子路径
    const ghost = await request(app).get("/api/store/no-such-path");
    expect(ghost.status).toBe(404);
  });
});
