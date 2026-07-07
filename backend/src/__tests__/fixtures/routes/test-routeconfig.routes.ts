import { Router } from "express";

// 优先级 2：导出单个 routeConfig
export const testRouteConfig = Router();
testRouteConfig.get("/", (req, res) => res.json({ ok: true }));

export const routeConfig = {
  prefix: "/api/test-routeconfig",
  router: testRouteConfig,
  auth: "none" as const,
};
