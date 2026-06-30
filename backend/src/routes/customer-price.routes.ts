import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as customerPriceController from "../controllers/admin/customer-price.controller.js";

export const customerPriceRouter = Router();

customerPriceRouter.get("/", requireAuthWithTenant, customerPriceController.listCustomerPrices);
customerPriceRouter.post("/", requireAuthWithTenant, customerPriceController.createCustomerPrice);
customerPriceRouter.put("/:id", requireAuthWithTenant, customerPriceController.updateCustomerPrice);
customerPriceRouter.delete("/:id", requireAuthWithTenant, customerPriceController.deleteCustomerPrice);