import { Router } from "express";
import { requireAuth } from "../shared/auth.js";
import * as ctrl from "../controllers/admin/retail-consumer-address.controller.js";

export const consumerAddressRouter = Router();

consumerAddressRouter.get("/miniapp/addresses", requireAuth, ctrl.listAddresses);
consumerAddressRouter.post("/miniapp/addresses", requireAuth, ctrl.createAddress);
consumerAddressRouter.put("/miniapp/addresses/:id", requireAuth, ctrl.updateAddress);
consumerAddressRouter.delete("/miniapp/addresses/:id", requireAuth, ctrl.deleteAddress);
consumerAddressRouter.put("/miniapp/addresses/:id/default", requireAuth, ctrl.setDefault);