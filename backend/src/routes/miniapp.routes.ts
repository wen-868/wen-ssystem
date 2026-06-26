import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/miniapp.controller.js";

export const miniappRouter = Router();
miniappRouter.post("/login", ctrl.devLogin);
miniappRouter.post("/auth/login", ctrl.devAuthLogin);
miniappRouter.get("/profile", ctrl.getProfile);
miniappRouter.get("/products", ctrl.getProducts);
miniappRouter.post("/orders", requireAuthWithTenant, ctrl.createOrder);
miniappRouter.get("/orders", requireAuthWithTenant, ctrl.getOrders);
miniappRouter.get("/orders/:orderNo", requireAuthWithTenant, ctrl.getOrderDetail);
miniappRouter.post("/orders/:orderNo/confirm-receipt", requireAuthWithTenant, ctrl.confirmReceipt);
miniappRouter.get("/statements", requireAuthWithTenant, ctrl.getStatements);
miniappRouter.get("/statements/:id", requireAuthWithTenant, ctrl.getStatementDetail);