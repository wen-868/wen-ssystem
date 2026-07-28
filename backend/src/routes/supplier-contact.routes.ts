import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import { asyncHandler } from "../middleware/async-handler";
import * as controller from "../controllers/admin/supplier-contact.controller";

export const supplierContactRouter = Router();

// 按供应商ID查询联系人列表
supplierContactRouter.get("/supplier/:supplierId", asyncHandler(controller.listContacts));
// 获取联系人详情
supplierContactRouter.get("/:id", asyncHandler(controller.getContact));
// 新增供应商联系人
supplierContactRouter.post("/supplier/:supplierId", asyncHandler(controller.createContact));
// 修改供应商联系人
supplierContactRouter.put("/:id", asyncHandler(controller.updateContact));
// 删除供应商联系人
supplierContactRouter.delete("/:id", asyncHandler(controller.deleteContact));

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
    prefix: "/api/admin/supplier-contacts",
    router: supplierContactRouter,
    auth: "requireAuthWithTenant",
};
