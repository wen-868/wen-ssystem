import type { RequestHandler } from "express";
import { queryOne, query } from "../shared/db";
import { fail } from "../shared/response";

// 扩展 Express.Request 类型，挂载 apiKeyId
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: number;
    }
  }
}

/**
 * Open API — API Key 认证中间件
 *
 * 验证流程：
 * 1. 从请求头 x-api-key 获取 API Key
 * 2. 查库校验 key 有效性及状态
 * 3. IP 白名单检查
 * 4. 日限额检查
 * 5. 计数 +1 并挂载 req.apiKeyId
 */
export const apiKeyAuth: RequestHandler = async (req, res, next) => {
  // 1. 获取 API Key
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    res.status(401).json(fail("缺少 API Key", "401"));
    return;
  }

  // 2. 查库校验
  const keyRecord = await queryOne<any>(
    "SELECT id, app_name, allowed_ips, daily_limit, today_count, status FROM t_library_api_key WHERE api_key = ? AND status = 1",
    [apiKey.trim()]
  );
  if (!keyRecord) {
    res.status(401).json(fail("API Key 无效或已禁用", "401"));
    return;
  }

  // 3. IP 白名单检查
  const allowedIps: string[] = keyRecord.allowed_ips
    ? JSON.parse(keyRecord.allowed_ips)
    : [];
  if (allowedIps.length > 0) {
    const clientIp = req.ip || "";
    const ipMatched = allowedIps.some(
      (ip) => ip === clientIp || ip === "*" || clientIp.startsWith(ip)
    );
    if (!ipMatched) {
      res.status(403).json(fail("IP 地址不在白名单中", "403"));
      return;
    }
  }

  // 4. 日限额检查
  if (keyRecord.daily_limit > 0 && keyRecord.today_count >= keyRecord.daily_limit) {
    res.status(429).json(fail("今日调用次数已达上限", "429"));
    return;
  }

  // 5. 计数 +1
  await query(
    "UPDATE t_library_api_key SET today_count = today_count + 1, last_called_at = NOW() WHERE id = ?",
    [keyRecord.id]
  );

  // 挂载 apiKeyId
  req.apiKeyId = keyRecord.id;

  next();
};
