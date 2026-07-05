import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/unit-group.service.js";

export const unitGroupRouter = Router();

// 单位组列表
unitGroupRouter.get("/", asyncHandler(async (req: any, res: any) => {
  const data = await service.listGroups(req.tenantId, {
    keyword: req.query.keyword as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json(ok(data));
}));

// 获取单个单位组
unitGroupRouter.get("/:id", asyncHandler(async (req: any, res: any) => {
  const data = await service.getGroup(Number(req.params.id), req.tenantId);
  res.json(ok(data));
}));

// 创建单位组
unitGroupRouter.post("/", asyncHandler(async (req: any, res: any) => {
  const data = await service.createGroup(req.body, req.tenantId);
  res.json(ok(data));
}));

// 更新单位组
unitGroupRouter.put("/:id", asyncHandler(async (req: any, res: any) => {
  const data = await service.updateGroup(Number(req.params.id), req.body, req.tenantId);
  res.json(ok(data));
}));

// 删除单位组
unitGroupRouter.delete("/:id", asyncHandler(async (req: any, res: any) => {
  const data = await service.deleteGroup(Number(req.params.id), req.tenantId);
  res.json(ok(data));
}));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin/unit-groups",
  router: unitGroupRouter,
  auth: "none",
};