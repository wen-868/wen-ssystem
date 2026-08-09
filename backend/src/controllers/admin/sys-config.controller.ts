import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as service from "../../services/admin/sys-config.service";
import { z } from "zod";

export const getAllConfigs = asyncHandler(async (req, res) => {
  const result = await service.getAllConfigs(req.tenantId!);
  res.json(ok(result));
});

export const getConfigByGroup = asyncHandler(async (req, res) => {
  const group = z.string().min(1).parse(req.params.group);
  const records = await service.getConfigByGroup(group, req.tenantId!);
  res.json(ok(records));
});

export const batchUpdateConfigs = asyncHandler(async (req, res) => {
  const body = z.array(z.object({
    config_key: z.string().min(1),
    config_value: z.string()
  })).min(1).parse(req.body);

  const result = await service.batchUpdateConfigs(body, req.tenantId!);
  res.json(ok(result));
});

export const createConfig = asyncHandler(async (req, res) => {
  const body = z.object({
    config_key: z.string().min(1),
    config_value: z.string().default(""),
    config_group: z.string().min(1),
    description: z.string().optional().default("")
  }).parse(req.body);

  const result = await service.createConfig(body, req.tenantId!);
  res.json(ok(result));
});

/** 邮件配置测试 */
export const testMail = asyncHandler(async (req, res) => {
  const result = await service.testMailConfig(req.tenantId!);
  res.json(ok(result));
});

/** 手动数据库备份 */
export const manualBackup = asyncHandler(async (req, res) => {
  const result = await service.manualBackup();
  res.json(ok(result));
});
