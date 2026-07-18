import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requireAuthWithTenant } from "../middleware/auth";
import * as customerController from "../controllers/admin/customer.controller";
import * as memberController from "../controllers/admin/member.controller";
import * as lifecycleController from "../controllers/admin/customer-lifecycle.controller";

export const adminCustomerRouter = Router();

// ============ 客户管理 ============
adminCustomerRouter.get("/members", requireAuthWithTenant, customerController.listMembers);
adminCustomerRouter.post("/members", requireAuthWithTenant, customerController.createCustomer);
adminCustomerRouter.get("/members/stats", requireAuthWithTenant, customerController.getCustomerStats);
adminCustomerRouter.get("/members/:id/purchase-stats", requireAuthWithTenant, customerController.getCustomerPurchaseStats);
adminCustomerRouter.get("/members/:id", requireAuthWithTenant, customerController.getCustomerDetail);
adminCustomerRouter.put("/members/:id", requireAuthWithTenant, customerController.updateCustomer);
adminCustomerRouter.put("/members/:id/disable", requireAuthWithTenant, customerController.disableCustomer);
adminCustomerRouter.put("/members/:id/assign-staff", requireAuthWithTenant, customerController.assignStaffToCustomer);
adminCustomerRouter.get("/members/:id/price-history", requireAuthWithTenant, customerController.getCustomerPriceHistory);
adminCustomerRouter.get("/members/:id/sale-bills", requireAuthWithTenant, customerController.listCustomerSaleBills);
adminCustomerRouter.get("/members/:id/payments", requireAuthWithTenant, customerController.listCustomerPayments);
adminCustomerRouter.get("/members/:id/statements", requireAuthWithTenant, customerController.listCustomerStatements);

// ============ Phase 7: 会员体系 & 生命周期 ============
adminCustomerRouter.post("/members/register", requireAuthWithTenant, memberController.registerMember);
adminCustomerRouter.get("/members/:id/member-card", requireAuthWithTenant, memberController.getMemberCard);
adminCustomerRouter.put("/members/:id/member-level", requireAuthWithTenant, memberController.updateMemberLevel);
adminCustomerRouter.get("/members/benefits", requireAuthWithTenant, memberController.getMemberBenefits);
adminCustomerRouter.get("/members/lifecycle/stages", requireAuthWithTenant, lifecycleController.getLifecycleStages);
adminCustomerRouter.get("/members/lifecycle/trend", requireAuthWithTenant, lifecycleController.getLifecycleTrend);
adminCustomerRouter.get("/members/lifecycle/detail", requireAuthWithTenant, lifecycleController.getLifecycleDetail);

// ========== 路由自动发现配置 ==========
export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: adminCustomerRouter,
  auth: "requireAuthWithTenant",
};