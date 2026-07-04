import { Router } from "express";
import { requireAuthWithTenant } from "../shared/auth.js";
import * as service from "../services/admin/unit-group.service.js";

export const unitGroupRouter = Router();

// 单位组列表
unitGroupRouter.get("/", requireAuthWithTenant, async (req, res) => {
  try {
    const data = await service.listGroups((req as any).tenantId, {
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json({ code: "0", data });
  } catch (e: any) {
    res.status(500).json({ code: "1", message: e.message });
  }
});

// 获取单个单位组
unitGroupRouter.get("/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const data = await service.getGroup(Number(req.params.id), (req as any).tenantId);
    res.json({ code: "0", data });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ code: "1", message: e.message });
  }
});

// 创建单位组
unitGroupRouter.post("/", requireAuthWithTenant, async (req, res) => {
  try {
    const data = await service.createGroup(req.body, (req as any).tenantId);
    res.json({ code: "0", data });
  } catch (e: any) {
    res.status(500).json({ code: "1", message: e.message });
  }
});

// 更新单位组
unitGroupRouter.put("/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const data = await service.updateGroup(Number(req.params.id), req.body, (req as any).tenantId);
    res.json({ code: "0", data });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ code: "1", message: e.message });
  }
});

// 删除单位组
unitGroupRouter.delete("/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const data = await service.deleteGroup(Number(req.params.id), (req as any).tenantId);
    res.json({ code: "0", data });
  } catch (e: any) {
    res.status(e.statusCode || 500).json({ code: "1", message: e.message });
  }
});