import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/order-timeout.service.js";

export const listConfigs = asyncHandler(async (req, res) => {
  const result = await service.getConfigs(req.tenantId!);
  res.json(ok(result));
});

export const createConfig = asyncHandler(async (req, res) => {
  const result = await service.createConfig(req.tenantId!, {
    orderType: req.body.orderType,
    timeoutType: req.body.timeoutType,
    timeoutMinutes: req.body.timeoutMinutes,
    action: req.body.action,
    enabled: req.body.enabled,
    description: req.body.description,
  });
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const result = await service.updateConfig(req.tenantId!, Number(req.params.id), {
      orderType: req.body.orderType,
      timeoutType: req.body.timeoutType,
      timeoutMinutes: req.body.timeoutMinutes,
      action: req.body.action,
      enabled: req.body.enabled,
      description: req.body.description,
  });
  res.json(ok(result));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  await service.deleteConfig(req.tenantId!, Number(req.params.id));
  res.json(ok({ message: "删除成功" }));
});

export const listLogs = asyncHandler(async (req, res) => {
  const result = await service.getLogs(req.tenantId!, {
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    result: req.query.result as string || "",
    dateStart: req.query.dateStart as string || "",
    dateEnd: req.query.dateEnd as string || "",
  });
  res.json(ok(result));
});

export const getStatistics = asyncHandler(async (req, res) => {
  const result = await service.getStatistics(req.tenantId!);
  res.json(ok(result));
});