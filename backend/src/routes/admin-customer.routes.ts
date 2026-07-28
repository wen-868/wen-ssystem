import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";

import * as customerController from "../controllers/admin/customer.controller";
import * as memberController from "../controllers/admin/member.controller";
import * as lifecycleController from "../controllers/admin/customer-lifecycle.controller";

export const adminCustomerRouter = Router();

// ============ 客户管理 ============
adminCustomerRouter.get("/members", customerController.listMembers);
adminCustomerRouter.post("/members", customerController.createCustomer);
adminCustomerRouter.get("/members/stats", customerController.getCustomerStats);
adminCustomerRouter.get("/members/:id/purchase-stats", customerController.getCustomerPurchaseStats);
adminCustomerRouter.get("/members/:id", customerController.getCustomerDetail);
adminCustomerRouter.put("/members/:id", customerController.updateCustomer);
adminCustomerRouter.put("/members/:id/disable", customerController.disableCustomer);
adminCustomerRouter.put("/members/:id/assign-staff", customerController.assignStaffToCustomer);
adminCustomerRouter.get("/members/:id/price-history", customerController.getCustomerPriceHistory);
adminCustomerRouter.get("/members/:id/sale-bills", customerController.listCustomerSaleBills);
adminCustomerRouter.get("/members/:id/payments", customerController.listCustomerPayments);
adminCustomerRouter.get("/members/:id/statements", customerController.listCustomerStatements);

// ============ Phase 7: 会员体系 & 生命周期 ============
adminCustomerRouter.post("/members/register", memberController.registerMember);
adminCustomerRouter.get("/members/:id/member-card", memberController.getMemberCard);
adminCustomerRouter.put("/members/:id/member-level", memberController.updateMemberLevel);
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