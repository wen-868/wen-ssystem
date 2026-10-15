import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

// S3-222（客户域接线 · B2 批 4）：本文件 6 条写端点按「使用者已持码」接线，
// 落地码 = 台账 §三.2 建议码（customer:create / customer:edit），全部为 079 既有码。
import { requirePermission } from "../middleware/rbac-auth";

import * as customerController from "../controllers/admin/customer.controller";
import * as memberController from "../controllers/admin/member.controller";
import * as lifecycleController from "../controllers/admin/customer-lifecycle.controller";

export const adminCustomerRouter = Router();

// ============ 客户管理 ============
adminCustomerRouter.get("/members", customerController.listMembers);
adminCustomerRouter.post("/members", requirePermission("customer:create"), customerController.createCustomer);
adminCustomerRouter.get("/members/stats", customerController.getCustomerStats);
adminCustomerRouter.get("/members/:id/purchase-stats", customerController.getCustomerPurchaseStats);
adminCustomerRouter.get("/members/:id", customerController.getCustomerDetail);
adminCustomerRouter.put("/members/:id", requirePermission("customer:edit"), customerController.updateCustomer);
adminCustomerRouter.put("/members/:id/disable", requirePermission("customer:edit"), customerController.disableCustomer);
adminCustomerRouter.put("/members/:id/assign-staff", requirePermission("customer:edit"), customerController.assignStaffToCustomer);
adminCustomerRouter.get("/members/:id/price-history", customerController.getCustomerPriceHistory);
adminCustomerRouter.get("/members/:id/sale-bills", customerController.listCustomerSaleBills);
adminCustomerRouter.get("/members/:id/payments", customerController.listCustomerPayments);
adminCustomerRouter.get("/members/:id/statements", customerController.listCustomerStatements);

// ============ Phase 7: 会员体系 & 生命周期 ============
// 注：台账 §三.2 把本行判为「公开端点」，实际本文件 `routeConfig.auth = requireAuthWithTenant`
//（见文件末）⇒ 本行**需要登录**，属管理面（后台「会员体系」页注册会员），故照管理面接线。
adminCustomerRouter.post("/members/register", requirePermission("customer:create"), memberController.registerMember);
adminCustomerRouter.get("/members/:id/member-card", memberController.getMemberCard);
adminCustomerRouter.put("/members/:id/member-level", requirePermission("customer:edit"), memberController.updateMemberLevel);
adminCustomerRouter.get("/members/benefits", memberController.getMemberBenefits);
adminCustomerRouter.get("/members/lifecycle/stages", lifecycleController.getLifecycleStages);
adminCustomerRouter.get("/members/lifecycle/trend", lifecycleController.getLifecycleTrend);
adminCustomerRouter.get("/members/lifecycle/detail", lifecycleController.getLifecycleDetail);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminCustomerRouter,
  auth: "requireAuthWithTenant",
};
