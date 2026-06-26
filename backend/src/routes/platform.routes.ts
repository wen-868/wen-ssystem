import { Router } from "express";
import * as platformController from "../controllers/platform/platform.controller.js";

export const platformRouter = Router();

// 数据总览
platformRouter.get("/overview", platformController.getOverview);

// 租户管理
platformRouter.get("/tenants", platformController.listTenants);
platformRouter.get("/tenants/:tenantId", platformController.getTenantDetail);
platformRouter.post("/tenants", platformController.createTenant);
platformRouter.put("/tenants/:tenantId", platformController.updateTenant);

// 平台管理员
platformRouter.get("/admins", platformController.listAdmins);
platformRouter.post("/admins", platformController.createAdmin);
platformRouter.put("/admins/:id/status", platformController.updateAdminStatus);

// 订阅管理
platformRouter.get("/subscriptions", platformController.listSubscriptions);
platformRouter.post("/subscriptions", platformController.createSubscription);

// 系统配置
platformRouter.get("/configs", platformController.listConfigs);
platformRouter.put("/configs/:key", platformController.updateConfig);

// 操作日志
platformRouter.get("/audit-logs", platformController.listAuditLogs);
