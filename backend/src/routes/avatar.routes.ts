import { Router } from "express";
import multer from "multer";
import type { RouteConfig } from "../shared/auto-routes";
import { uploadAvatar } from "../controllers/admin/avatar.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname || "")) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error("请上传 jpg/png/gif/webp 图片"), { statusCode: 400 }));
    }
  },
});

export const avatarRouter = Router();

avatarRouter.post("/auth/avatar", upload.single("avatar"), uploadAvatar);

export const routeConfig: RouteConfig = {
  prefix: "/api/admin",
  router: avatarRouter,
  auth: "requireAuthWithTenant",
};
