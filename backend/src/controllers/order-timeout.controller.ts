import { asyncHandler } from "../shared/async-handler.js";
import { ok } from "../shared/response.js";
import * as service from "../services/admin/order-timeout.service.js";

export const listConfigs = asyncHandler(async (req, res) => {
  const result = await service.listConfigs(req.tenantId!);
  res.json(ok(result));
});

export const createConfig = asyncHandler(async (req, res) => {
  const result = await service.createConfig({
    orderType: req.body.orderType,
    timeoutType: req.body.timeoutType,
    timeoutMinutes: req.body.timeoutMinutes,
    action: req.body.action,
    enabled: req.body.enabled,
    description: req.body.description,
  }, req.tenantId!);
  res.json(ok(result));
});

export const updateConfig = asyncHandler(async (req, res) => {
  const result = await service.updateConfig(
    Number(req.params.id),
    {
      orderType: req.body.orderType,
      timeoutType: req.body.timeoutType,
      timeoutMinutes: req.body.timeoutMinutes,
      action: req.body.action,
      enabled: req.body.enabled,
      description: req.body.description,
    },
    req.tenantId!
  );
  res.json(ok(result));
});

export const deleteConfig = asyncHandler(async (req, res) => {
  await service.deleteConfig(Number(req.params.id), req.tenantId!);
  res.json(ok({ message: "删除成功" }));
});

export const listLogs = asyncHandler(async (req, res) => {
  const result = await service.listLogs({
    page: Number(req.query.page || 1),
    pageSize: Number(req.query.pageSize || 20),
    tenantId: req.tenantId!,
    result: req.query.result as string | undefined,
    dateStart: req.query.dateStart as string | undefined,
    dateEnd: req.query.dateEnd as string | undefined,
  });
  res.json(ok(result));
});

export const getStatistics = asyncHandler(async (req, res) => {
  const result = await service.getStatistics(req.tenantId!);
  res.json(ok(result));
});