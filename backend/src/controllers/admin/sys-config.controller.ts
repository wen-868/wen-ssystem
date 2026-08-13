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

/** 备份历史列表（真实读取备份目录） */
export const listBackups = asyncHandler(async (req, res) => {
  const items = await service.listBackups();
  res.json(ok(items));
});

/** 下载备份文件 */
export const downloadBackup = asyncHandler(async (req, res) => {
  const name = z.string().min(1).parse(req.params.name);
  const full = service.resolveBackupPath(name);
  if (!full) {
    res.status(400).json({ success: false, code: "400", message: "非法备份文件名" });
    return;
  }
  const fs = require("fs");
  if (!fs.existsSync(full)) {
    res.status(404).json({ success: false, code: "404", message: "备份文件不存在" });
    return;
  }
  res.download(full);
});

/** 删除备份文件 */
export const deleteBackup = asyncHandler(async (req, res) => {
  const name = z.string().min(1).parse(req.params.name);
  await service.deleteBackupFile(name);
  res.json(ok({ name }));
});
