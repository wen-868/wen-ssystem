import { Router } from "express";
import multer from "multer";
import type { RouteConfig } from "../shared/auto-routes";

import * as ctrl from "../controllers/admin/miniapp-config.controller";

export const miniappConfigRouter = Router();

// .key 上传密钥：内存存储 + 扩展名校验（5MB 上限，服务层再校验 2MB 业务上限）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/\.key$/i.test(file.originalname || "")) {
      cb(Object.assign(new Error("请上传微信公众平台生成的 .key 上传密钥文件"), { statusCode: 400 }));
      return;
    }
    cb(null, true);
  },
});

miniappConfigRouter.get("/configs", ctrl.listConfigs);
miniappConfigRouter.get("/configs/:platform", ctrl.getConfig);
miniappConfigRouter.put("/configs/:platform", ctrl.saveConfig);
miniappConfigRouter.get("/templates", ctrl.listTemplates);
miniappConfigRouter.get("/templates/:id", ctrl.getTemplate);
miniappConfigRouter.post("/packages", ctrl.generatePackage);
miniappConfigRouter.get("/packages/:id/download", ctrl.downloadPackage);
miniappConfigRouter.get("/publish-logs", ctrl.listPublishLogs);
miniappConfigRouter.post("/upload-key", upload.single("key"), ctrl.uploadKey);
miniappConfigRouter.get("/key-status", ctrl.getKeyStatus);
miniappConfigRouter.post("/publish", ctrl.publish);

export const routeConfig: RouteConfig = {
  prefix: "/api/miniapp-config",
  router: miniappConfigRouter,
  auth: "requireAuthWithTenant",
};
