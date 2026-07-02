import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/miniapp.controller.js";
import * as cartCtrl from "../controllers/admin/cart.controller.js";

export const miniappRouter = Router();
miniappRouter.post("/login", ctrl.devLogin);
miniappRouter.post("/auth/login", ctrl.devAuthLogin);
miniappRouter.get("/profile", requireAuthWithTenant, ctrl.getProfile);
miniappRouter.get("/products", requireAuthWithTenant, ctrl.getProducts);
miniappRouter.post("/orders", requireAuthWithTenant, ctrl.createOrder);
miniappRouter.get("/orders", requireAuthWithTenant, ctrl.getOrders);
miniappRouter.get("/orders/:orderNo", requireAuthWithTenant, ctrl.getOrderDetail);
miniappRouter.post("/orders/:orderNo/confirm-receipt", requireAuthWithTenant, ctrl.confirmReceipt);
miniappRouter.get("/statements", requireAuthWithTenant, ctrl.getStatements);
miniappRouter.get("/statements/:id", requireAuthWithTenant, ctrl.getStatementDetail);

// 零售购物车
miniappRouter.post("/retail-cart/add", requireAuthWithTenant, cartCtrl.addToRetailCart);
miniappRouter.delete("/retail-cart/:skuId", requireAuthWithTenant, cartCtrl.removeFromRetailCart);
miniappRouter.put("/retail-cart/:skuId", requireAuthWithTenant, cartCtrl.updateRetailCartItem);
miniappRouter.get("/retail-cart", requireAuthWithTenant, cartCtrl.getRetailCart);