import { Router } from "express";
import { z } from "zod";
import { requireAuthWithTenant } from "../shared/auth.js";
import { asyncHandler } from "../shared/async-handler.js";
import { query, queryOne } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const sysConfigRouter = Router();

// ========== 获取所有配置（按分组返回） ==========
sysConfigRouter.get("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const records = await query<any>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM sys_config
     WHERE tenant_id = ?
     ORDER BY config_group, id`,
    [tenantId]
  );
  // 按分组组织
  const grouped: Record<string, any[]> = {};
  for (const r of records) {
    const group = r.configGroup || "other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(r);
  }
  res.json(ok({ all: records, grouped }));
}));

// ========== 获取指定分组配置 ==========
sysConfigRouter.get("/:group", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const group = z.string().min(1).parse(req.params.group);
  const records = await query<any>(
    `SELECT id, config_key AS configKey, config_value AS configValue,
            config_group AS configGroup, description, updated_at AS updatedAt
     FROM sys_config
     WHERE config_group = ? AND tenant_id = ?
     ORDER BY id`,
    [group, tenantId]
  );
  res.json(ok(records));
}));

// ========== 批量更新配置 ==========
sysConfigRouter.put("/batch", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.array(z.object({
    config_key: z.string().min(1),
    config_value: z.string()
  })).min(1).parse(req.body);

  // 逐条更新
  for (const item of body) {
    const existing = await queryOne<any>(
      "SELECT id FROM sys_config WHERE config_key = ? AND tenant_id = ?",
      [item.config_key, tenantId]
    );
    if (existing) {
      await query(
        `UPDATE sys_config SET config_value = ? WHERE config_key = ? AND tenant_id = ?`,
        [item.config_value, item.config_key, tenantId]
      );
    } else {
      await query(
        `INSERT INTO sys_config (config_key, config_value, config_group, description, tenant_id)
         VALUES (?, ?, 'other', '', ?)`,
        [item.config_key, item.config_value, tenantId]
      );
    }
  }

  res.json(ok({ updated: body.length }));
}));

// ========== 新增配置项 ==========
sysConfigRouter.post("/", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    config_key: z.string().min(1),
    config_value: z.string().default(""),
    config_group: z.string().min(1),
    description: z.string().optional().default("")
  }).parse(req.body);

  await query(
    `INSERT INTO sys_config (config_key, config_value, config_group, description, tenant_id)
     VALUES (?, ?, ?, ?, ?)`,
    [body.config_key, body.config_value, body.config_group, body.description, tenantId]
  );

  res.json(ok({ configKey: body.config_key }));
}));
