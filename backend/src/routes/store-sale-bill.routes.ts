import { Router } from "express";
import type { RouteConfig } from "../shared/auto-routes";
import { requirePermission } from "../middleware/rbac-auth";
import * as saleBillController from "../controllers/store/sale-bill.controller";
export { storeSaleBillItemSchema, normalizeStoreSaleBillItem } from "../schemas/store-sale-bill";

export const storeSaleBillRouter = Router();
export const storePosChannelRouter = Router();

storeSaleBillRouter.get("/", saleBillController.listSaleBills);
storeSaleBillRouter.post("/", requirePermission("sale:create"), saleBillController.createSaleBill);
storeSaleBillRouter.get("/overdue", saleBillController.listOverdueBills);
storeSaleBillRouter.get("/overdue/check", saleBillController.checkOverdueBills);
storeSaleBillRouter.get("/:billNo", saleBillController.getSaleBillDetail);
storeSaleBillRouter.post("/:billNo/collection-link", saleBillController.createCollectionLink);
// S3-233（B 类收编第一批 · 销售域）：线下收款挂 `sale:create`（收款族按"页面角色含收银员 ⇒ 用覆盖收银员的码"）。
// 依据门 = permission-gates.ts 的 `sale-bill-offline-pay`（销售单详情页「线下收款」按钮，:163）。
// 同族先例：`POST /:billNo/pay-by-code`（:24，付款码收款）与 `POST /`（创建销售单）均为 `sale:create`。
storeSaleBillRouter.post("/:billNo/offline-payment", requirePermission("sale:create"), saleBillController.offlinePayment);
storeSaleBillRouter.post("/:billNo/payment", saleBillController.paymentOnSaleBill);
// S3-224（第 43 项 B2 批 6 · 销售域接线）：付款码收款挂 `sale:create`。
// 使用者 = admin-web `pos/CashierView.vue:1628`（页面 `router/index.ts:259` 角色含 **STORE_OPERATOR**）
// ⇒ 生产持有里只有 `sale:create` 覆盖收银员（`finance:payment` 不含收银员，`sale:edit/void` 亦不含）。
// ⚠️ 同文件 `POST /:billNo/payment` 被 G0 `NOT_IN_G0` 锁定（READONLY 仍 200）⇒ 本批不接；
// `/:billNo/collection-link`、`/:billNo/offline-payment` 有 app-mobile 写调用点（孤岛页 / 经首页快捷入口
// 无条件可达的 `pages/orders/orders.vue` → `pages-sub/order/sales/sale-detail.vue:172`）⇒ 使用者集合不可枚举（B 类）。
storeSaleBillRouter.post("/:billNo/pay-by-code", requirePermission("sale:create"), saleBillController.paySaleBillByCode);
storePosChannelRouter.get("/channels", saleBillController.listPosChannels);

// S3-195：原以**根前缀** `"/api/store"` 注册 ⇒ 整段 `/api/store/**` 先套认证 + CSRF。现按「只声明自己
//   拥有的路径段」拆成 `/api/store/sale-bills` 与 `/api/store/payment`，对外 URL 逐字不变
//   （`/overdue`、`/overdue/check` 两行仍排在 `/:billNo` 之前，顺序语义不变）。
export const routeConfigs: RouteConfig[] = [
  { prefix: "/api/store/sale-bills", router: storeSaleBillRouter, auth: "requireAuthWithTenant" },
  { prefix: "/api/store/payment", router: storePosChannelRouter, auth: "requireAuthWithTenant" },
];
