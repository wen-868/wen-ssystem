import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as receiptController from "../controllers/admin/receipt.controller.js";

export const receiptRouter = Router();
receiptRouter.post("/", requireAuthWithTenant, receiptController.createReceipt);
receiptRouter.get("/", requireAuthWithTenant, receiptController.listReceipts);
receiptRouter.get("/:receiptNo", requireAuthWithTenant, receiptController.getReceiptDetail);
receiptRouter.post("/:receiptNo/writeoff", requireAuthWithTenant, receiptController.writeoffReceipt);
receiptRouter.post("/:receiptNo/void", requireAuthWithTenant, receiptController.voidReceipt);