import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as tagController from "../controllers/admin/customer-tag.controller.js";

export const customerTagRouter = Router();
customerTagRouter.get("/", requireAuthWithTenant, tagController.listTags);
customerTagRouter.post("/", requireAuthWithTenant, tagController.createTag);
customerTagRouter.put("/:id", requireAuthWithTenant, tagController.updateTag);
customerTagRouter.delete("/:id", requireAuthWithTenant, tagController.deleteTag);
customerTagRouter.post("/:id/tags", requireAuthWithTenant, tagController.addCustomerTag);
customerTagRouter.delete("/:id/tags/:tagId", requireAuthWithTenant, tagController.removeCustomerTag);
customerTagRouter.get("/:id/profile", requireAuthWithTenant, tagController.getCustomerProfile);