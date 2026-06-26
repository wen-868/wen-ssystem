import { Router } from "express";
import * as ctrl from "../controllers/share.controller.js";

export const shareRouter = Router();

shareRouter.get("/collections/:token", ctrl.getCollectionLink);
shareRouter.post("/collections/:token/pay", ctrl.payCollection);