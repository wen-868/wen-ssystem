/**
 * 存储容量检测中间件（R9-4）
 * 在文件上传接口前检查剩余存储容量，超限返回 code "1002"。
 */
import type { Request, Response, NextFunction } from "express";
import { queryOneWithTenant } from "../shared/db";
import { fail } from "../shared/response";
import logger from "../shared/logger";

export function storageGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId || req.headers["x-tenant-id"] as string;

      if (!tenantId) {
        return next();
      }

      // 查询租户存储配额
      const config = await queryOneWithTenant<Record<string, unknown>>(
        `SELECT storage_limit AS storageLimit, storage_limit_unit AS unit
         FROM tenant_config WHERE tenant_id = ? AND config_key = 'storage_limit'`,
        [tenantId],
        tenantId
      );

      // 默认 500MB 限制
      const limitBytes = config
        ? Number(config.storageLimit) * (config.unit === "GB" ? 1024 * 1024 * 1024 : 1024 * 1024)
        : 500 * 1024 * 1024;

      // 查询当前已使用存储空间
      const usage = await queryOneWithTenant<Record<string, unknown>>(
        `SELECT COALESCE(SUM(file_size), 0) AS usedBytes
         FROM upload_file WHERE tenant_id = ? AND status = 1`,
        [tenantId],
        tenantId
      );

      const usedBytes = Number(usage?.usedBytes ?? 0);

      if (usedBytes >= limitBytes) {
        res.status(400).json(fail("存储容量已满，请联系管理员升级套餐", "1002"));
        return;
      }

      (req as any).storageUsage = { usedBytes, limitBytes };
      next();
    } catch (err) {
      // 非关键路径，降级放行
      logger.warn("[storage-guard] 检查失败，降级放行:", err);
      next();
    }
  };
}