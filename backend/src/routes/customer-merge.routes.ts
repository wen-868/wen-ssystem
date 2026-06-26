import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as ctrl from "../controllers/customer-merge.controller.js";

export const customerMergeRouter = Router();
customerMergeRouter.get("/duplicates", requireAuthWithTenant, ctrl.detectDuplicates);
customerMergeRouter.get("/duplicate-groups", requireAuthWithTenant, ctrl.getDuplicateGroups);
customerMergeRouter.get("/:customerId/relations", requireAuthWithTenant, ctrl.getCustomerRelations);
customerMergeRouter.post("/merge", requireAuthWithTenant, ctrl.mergeCustomers);