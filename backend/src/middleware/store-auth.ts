import type { RequestHandler } from "express";
import { requireAuthWithTenant } from "./auth";
import { fail } from "../shared/response";

export const requireStoreAuth: RequestHandler[] = [
  ...requireAuthWithTenant,
  (req: any, res: any, next: any) => {
    if (!req.user.storeId && !req.user.roles?.includes("SUPER_ADMIN")) {
      res.status(403).json(fail("无门店权限", "403"));
      return;
    }
    next();
  },
];
