/**
 * ============================================================================
 * 即时零售接口预留模块
 * Instant Retail Interface Stub Module
 * ============================================================================
 *
 * 本模块为酒类库存管理系统的即时零售（O2O）平台接入提供统一的 HTTP 路由层，
 * 涵盖京东秒送、美团外卖、饿了么三大主流平台的订单推送、配置管理和门店操作。
 *
 * 当前状态：接口预留 / 模拟实现
 *   - 各平台真实接入时，需要：
 *     1. 在平台开发者后台申请 appKey / appSecret，填入本系统对应平台配置；
 *     2. 在 `../services/instant-retail/adapters/` 下完善对应平台的适配器实现
 *        （签名验签、订单/商品字段映射、Token 刷新等）；
 *     3. 将平台提供的 webhook 地址指向本服务的 `/api/instant-retail/webhook/{platform}`；
 *     4. 根据平台文档调整 `verifyWebhook()` 和 `parseUnifiedOrder()` 的具体逻辑。
 *
 * 路由分组：
 *   - /webhook/*      : 公开端点，供平台服务器推送调用，无需认证
 *   - /admin/*        : 管理后台端点，需要 requireAuthWithTenant（后台管理员 Token）
 *   - /store/*        : 门店操作端点，需要 storeAuth（门店员工 Token）
 *
 * 数据库表依赖（需提前创建）：
 *   - platform_order   : 存储各平台推送的原始订单数据
 *   - platform_config  : 存储各门店的平台接入凭证与配置
 *   - miniapp_order    : 内部小程序订单表（平台订单映射为内部订单时写入）
 * ============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";
import { makeBizNo } from "../shared/id.js";
import { getAdapter, parsePlatformType, parseUnifiedOrder } from "../services/instant-retail/adapters/index.js";
import type { PlatformType, PlatformCredentials } from "../services/instant-retail/types.js";

export const instantRetailRouter = Router();

/* ────────────────────────────────────────────────────────────────────────────
 * 辅助函数
 * ──────────────────────────────────────────────────────────────────────────── */

/** 构造脱敏后的平台配置响应 */
function maskConfig(config: any) {
  if (!config) return null;
  return {
    ...config,
    appSecret: config.appSecret ? "***" : undefined,
    accessToken: config.accessToken ? "***" : undefined,
    refreshToken: config.refreshToken ? "***" : undefined
  };
}

/** 从数据库读取平台配置（完整字段） */
async function getPlatformConfig(platform: PlatformType, storeId?: string | number, tenantId?: string): Promise<PlatformCredentials | null> {
  const conditions: string[] = ["platform = ?"];
  const params: unknown[] = [platform];
  if (storeId) {
    conditions.push("store_id = ?");
    params.push(String(storeId));
  }
  if (tenantId) {
    conditions.push("tenant_id = ?");
    params.push(tenantId);
  }
  const sql = `SELECT * FROM platform_config WHERE ${conditions.join(" AND ")} LIMIT 1`;
  const row = await queryOne<any>(sql, params);
  if (!row) return null;
  return {
    platform: row.platform as PlatformType,
    storeId: String(row.store_id ?? ""),
    appKey: String(row.app_key ?? ""),
    appSecret: String(row.app_secret ?? ""),
    merchantId: String(row.merchant_id ?? ""),
    accessToken: String(row.access_token ?? ""),
    refreshToken: String(row.refresh_token ?? ""),
    tokenExpireAt: row.token_expire_at ? new Date(row.token_expire_at) : new Date(),
    enabled: Boolean(row.enabled ?? 1),
    configJson: row.config_json ? (typeof row.config_json === "string" ? JSON.parse(row.config_json) : row.config_json) : null
  };
}

/** 门店认证中间件（复用 requireAuthWithTenant 并校验 storeId） */
const storeAuth = (req: any, res: any, next: any) => {
  const handlers = Array.isArray(requireAuthWithTenant) ? requireAuthWithTenant : [requireAuthWithTenant];
  let i = 0;
  const nextHandler = () => {
    if (i < handlers.length) {
      const handler = handlers[i++];
      handler(req, res, nextHandler);
    } else {
      if (!req.user) {
        res.status(401).json({ code: "401", message: "未登录" });
        return;
      }
      if (!req.user.storeId && !req.user.roles?.includes("SUPER_ADMIN")) {
        res.status(403).json({ code: "403", message: "无门店权限" });
        return;
      }
      next();
    }
  };
  nextHandler();
};

/* ────────────────────────────────────────────────────────────────────────────
 * 1. Webhook 接收端点（无需认证）
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 处理平台 Webhook 推送的通用流程
 * a. 读取请求体中的原始数据
 * b. 调用对应适配器的 verifyWebhook() 验证签名
 * c. 解析平台订单数据，转换为 UnifiedOrder
 * d. 存入 platform_order 表（通过 query 调用 SQL）
 * e. 如果订单状态是已支付，创建对应的 miniapp_order（模拟映射到内部订单系统）
 * f. 返回平台要求的响应格式
 */
async function handleWebhook(platform: PlatformType, req: any, res: any) {
  const rawBody = req.body ?? {};
  const signature = String(req.headers["x-signature"] ?? req.headers["signature"] ?? req.query.sign ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? req.query.timestamp ?? "");

  // 读取平台配置以获取验签所需凭证
  const config = await getPlatformConfig(platform);
  if (!config) {
    // 无配置时仍返回成功，避免平台重试风暴；但记录日志
    console.warn(`[Webhook] ${platform} 无配置，跳过处理`);
    return res.json(buildWebhookResponse(platform, true));
  }

  const adapter = getAdapter(platform, config);

  // b. 验签
  const verifyResult = await adapter.verifyWebhook(rawBody, signature, timestamp);
  if (!verifyResult.valid) {
    console.warn(`[Webhook] ${platform} 验签失败`, { signature, timestamp });
    return res.status(400).json(buildWebhookResponse(platform, false, "验签失败"));
  }

  // c. 解析为统一订单
  const unified = parseUnifiedOrder(platform, verifyResult.payload ?? rawBody);

  // d. 存入 platform_order + e. 创建内部 miniapp_order，用事务包裹
  await transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO platform_order
         (platform_order_id, platform, store_id, status, order_data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         order_data_json = VALUES(order_data_json),
         updated_at = NOW()`,
      [
        unified.platformOrderId,
        platform,
        unified.storeId,
        unified.status,
        JSON.stringify(rawBody)
      ]
    );

    // e. 如果已支付，创建内部 miniapp_order（模拟映射）
    if (unified.status === "ACCEPTED" || unified.status === "PENDING") {
      const [existingRows] = await conn.query<any[]>(
        `SELECT order_no FROM miniapp_order WHERE order_no = ? LIMIT 1`,
        [unified.orderId]
      );
      if (existingRows.length === 0) {
        await conn.execute(
          `INSERT INTO miniapp_order
             (order_no, store_id, customer_type, fulfillment_type, order_status, pay_status,
              payable_amount, receiver_name, receiver_mobile, receiver_address, remark, created_at)
           VALUES (?, ?, 'RETAIL', 'DELIVERY', 'PENDING_PAYMENT', 'UNPAID',
                   ?, ?, ?, ?, ?, NOW())`,
          [
            unified.orderId,
            unified.storeId || config.storeId || "1",
            unified.payAmount,
            unified.address.name,
            unified.address.phone,
            `${unified.address.province}${unified.address.city}${unified.address.district}${unified.address.detail}`,
            unified.remark ?? null
          ]
        );
        // 写入订单商品项
        for (const item of unified.items) {
          await conn.execute(
            `INSERT INTO miniapp_order_item
               (order_no, sku_id, sku_name, qty, reserved_qty, unit_price, price_type, subtotal_amount)
             VALUES (?, ?, ?, ?, ?, ?, 'RETAIL', ?)`,
            [
              unified.orderId,
              item.localSkuId || 0,
              item.name,
              item.quantity,
              item.quantity,
              item.unitPrice,
              item.totalPrice
            ]
          );
        }
      }
    }
  });

  // f. 返回平台要求的响应格式
  return res.json(buildWebhookResponse(platform, true));
}

/** 构造平台要求的 Webhook 响应 */
function buildWebhookResponse(platform: PlatformType, success: boolean, message?: string) {
  if (platform === "JD") {
    return success ? { code: "0", message: message ?? "success" } : { code: "1", message: message ?? "error" };
  }
  if (platform === "MEITUAN") {
    return success ? { data: "OK" } : { data: "FAIL", message: message ?? "error" };
  }
  if (platform === "ELEME") {
    return success ? { code: "200", message: message ?? "success" } : { code: "500", message: message ?? "error" };
  }
  return { code: success ? "0" : "1", message: message ?? (success ? "success" : "error") };
}

instantRetailRouter.post("/webhook/jd", asyncHandler(async (req, res) => {
  await handleWebhook("JD", req, res);
}));

instantRetailRouter.post("/webhook/meituan", asyncHandler(async (req, res) => {
  await handleWebhook("MEITUAN", req, res);
}));

instantRetailRouter.post("/webhook/eleme", asyncHandler(async (req, res) => {
  await handleWebhook("ELEME", req, res);
}));

/* ────────────────────────────────────────────────────────────────────────────
 * 2. 管理后台配置端点（需要 requireAuthWithTenant）
 * ──────────────────────────────────────────────────────────────────────────── */

const adminRouter = Router();
instantRetailRouter.use("/admin/instant-retail", requireAuthWithTenant, adminRouter);

/** GET /admin/instant-retail/platforms — 获取当前门店支持的平台列表及启用状态 */
adminRouter.get("/platforms", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rows = await query<any>(
    `SELECT platform, store_id AS storeId, enabled, merchant_id AS merchantId, updated_at AS updatedAt
     FROM platform_config
     WHERE tenant_id = ?
     ORDER BY platform`,
    [tenantId]
  );
  const allPlatforms = ["JD", "MEITUAN", "ELEME"];
  const records = allPlatforms.map((p) => {
    const found = rows.find((r: any) => r.platform === p);
    return {
      platform: p,
      enabled: !!found?.enabled,
      storeId: found?.storeId ?? null,
      merchantId: found?.merchantId ?? null,
      configured: !!found
    };
  });
  res.json(ok({ records }));
}));

/** GET /admin/instant-retail/configs — 获取所有平台配置（敏感字段脱敏） */
adminRouter.get("/configs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const rows = await query<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config
     WHERE tenant_id = ?
     ORDER BY platform`,
    [tenantId]
  );
  const records = rows.map((r: any) => maskConfig(r));
  res.json(ok({ records }));
}));

/** GET /admin/instant-retail/configs/:platform — 获取指定平台配置 */
adminRouter.get("/configs/:platform", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platform = parsePlatformType(req.params.platform);
  const row = await queryOne<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config WHERE platform = ? AND tenant_id = ? LIMIT 1`,
    [platform, tenantId]
  );
  if (!row) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  res.json(ok(maskConfig(row)));
}));

/** POST /admin/instant-retail/configs — 创建/更新平台配置 */
adminRouter.post("/configs", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const body = z.object({
    platform: z.string(),
    storeId: z.string().optional(),
    appKey: z.string().optional(),
    appSecret: z.string().optional(),
    merchantId: z.string().optional(),
    configJson: z.record(z.unknown()).nullable().optional()
  }).parse(req.body);

  const platform = parsePlatformType(body.platform);
  const existing = await queryOne<any>(
    `SELECT id FROM platform_config WHERE platform = ? AND tenant_id = ? LIMIT 1`,
    [platform, tenantId]
  );

  if (existing) {
    await query(
      `UPDATE platform_config
       SET store_id = ?, app_key = ?, app_secret = ?, merchant_id = ?, config_json = ?, updated_at = NOW()
       WHERE platform = ? AND tenant_id = ?`,
      [
        body.storeId ?? existing.store_id ?? "",
        body.appKey ?? existing.app_key ?? "",
        body.appSecret ?? existing.app_secret ?? "",
        body.merchantId ?? existing.merchant_id ?? "",
        body.configJson ? JSON.stringify(body.configJson) : existing.config_json ?? null,
        platform,
        tenantId
      ]
    );
  } else {
    await query(
      `INSERT INTO platform_config
         (platform, store_id, app_key, app_secret, merchant_id, config_json, enabled, created_at, updated_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), ?)`,
      [
        platform,
        body.storeId ?? "",
        body.appKey ?? "",
        body.appSecret ?? "",
        body.merchantId ?? "",
        body.configJson ? JSON.stringify(body.configJson) : null,
        tenantId
      ]
    );
  }

  const row = await queryOne<any>(
    `SELECT id, platform, store_id AS storeId, app_key AS appKey, app_secret AS appSecret,
            merchant_id AS merchantId, enabled, config_json AS configJson,
            created_at AS createdAt, updated_at AS updatedAt
     FROM platform_config WHERE platform = ? AND tenant_id = ? LIMIT 1`,
    [platform, tenantId]
  );
  res.json(ok(maskConfig(row)));
}));

/** POST /admin/instant-retail/configs/:platform/test — 测试连接 */
adminRouter.post("/configs/:platform/test", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platform = parsePlatformType(req.params.platform);
  const config = await getPlatformConfig(platform, undefined, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  try {
    const result = await adapter.authenticate();
    res.json(ok({ platform, connected: true, tokenUpdated: !!result.accessToken }));
  } catch (err: any) {
    res.status(502).json({ code: "502", message: `连接失败: ${err.message}` });
  }
}));

/** POST /admin/instant-retail/configs/:platform/sync-orders — 手动同步订单 */
adminRouter.post("/configs/:platform/sync-orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platform = parsePlatformType(req.params.platform);
  const config = await getPlatformConfig(platform, undefined, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const result = await adapter.syncOrders(req.body);
  // 将同步到的订单写入 platform_order，用事务包裹
  await transaction(async (conn) => {
    for (const order of result.orders) {
      await conn.execute(
        `INSERT INTO platform_order
           (platform_order_id, platform, store_id, status, order_data_json, created_at, updated_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           order_data_json = VALUES(order_data_json),
           updated_at = NOW()`,
        [
          order.platformOrderId,
          platform,
          order.storeId,
          order.status,
          JSON.stringify(order.platformRawData ?? {}),
          tenantId
        ]
      );
    }
  });
  res.json(ok({ platform, synced: result.orders.length, hasMore: result.hasMore }));
}));

/** POST /admin/instant-retail/configs/:platform/sync-products — 手动同步商品 */
adminRouter.post("/configs/:platform/sync-products", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platform = parsePlatformType(req.params.platform);
  const config = await getPlatformConfig(platform, undefined, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const result = await adapter.syncProducts(req.body);
  res.json(ok({ platform, synced: result.products.length, hasMore: result.hasMore }));
}));

/** DELETE /admin/instant-retail/configs/:platform — 删除平台配置 */
adminRouter.delete("/configs/:platform", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platform = parsePlatformType(req.params.platform);
  await query(`DELETE FROM platform_config WHERE platform = ? AND tenant_id = ?`, [platform, tenantId]);
  res.json(ok({ platform, deleted: true }));
}));

/* ────────────────────────────────────────────────────────────────────────────
 * 3. 门店端查询端点（需要 storeAuth）
 * ──────────────────────────────────────────────────────────────────────────── */

const storeRouter = Router();
instantRetailRouter.use("/store/instant-retail", storeAuth, storeRouter);

/** GET /store/instant-retail/orders — 查询当前门店的即时零售订单 */
storeRouter.get("/orders", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const storeId = req.user?.storeId ?? null;
  const platform = req.query.platform ? String(req.query.platform) : null;

  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (storeId) {
    conditions.push("store_id = ?");
    params.push(String(storeId));
  }
  if (platform) {
    conditions.push("platform = ?");
    params.push(parsePlatformType(platform));
  }

  const where = conditions.join(" AND ");
  const records = await query<any>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_order
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await queryOne<any>(
    `SELECT COUNT(*) AS total FROM platform_order WHERE ${where}`,
    params
  );
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

/** GET /store/instant-retail/orders/:platformOrderId — 查询订单详情 */
storeRouter.get("/orders/:platformOrderId", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const order = await queryOne<any>(
    `SELECT platform_order_id AS platformOrderId, platform, store_id AS storeId,
            status, order_data_json AS orderDataJson, created_at AS createdAt, updated_at AS updatedAt
     FROM platform_order WHERE platform_order_id = ? AND tenant_id = ? LIMIT 1`,
    [req.params.platformOrderId, tenantId]
  );
  if (!order) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  res.json(ok(order));
}));

/** POST /store/instant-retail/orders/:platformOrderId/confirm — 确认接单 */
storeRouter.post("/orders/:platformOrderId/confirm", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platformOrderId = req.params.platformOrderId;
  const row = await queryOne<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? AND tenant_id = ? LIMIT 1`,
    [platformOrderId, tenantId]
  );
  if (!row) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfig(platform, row.storeId, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.confirmOrder(platformOrderId);
  if (success) {
    await query(
      `UPDATE platform_order SET status = 'ACCEPTED', updated_at = NOW() WHERE platform_order_id = ? AND tenant_id = ?`,
      [platformOrderId, tenantId]
    );
  }
  res.json(ok({ platformOrderId, success, status: "ACCEPTED" }));
}));

/** POST /store/instant-retail/orders/:platformOrderId/start-delivery — 开始配送 */
storeRouter.post("/orders/:platformOrderId/start-delivery", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platformOrderId = req.params.platformOrderId;
  const row = await queryOne<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? AND tenant_id = ? LIMIT 1`,
    [platformOrderId, tenantId]
  );
  if (!row) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfig(platform, row.storeId, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.startDelivery(platformOrderId, req.body);
  if (success) {
    await query(
      `UPDATE platform_order SET status = 'DELIVERING', updated_at = NOW() WHERE platform_order_id = ? AND tenant_id = ?`,
      [platformOrderId, tenantId]
    );
  }
  res.json(ok({ platformOrderId, success, status: "DELIVERING" }));
}));

/** POST /store/instant-retail/orders/:platformOrderId/complete-delivery — 完成配送 */
storeRouter.post("/orders/:platformOrderId/complete-delivery", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platformOrderId = req.params.platformOrderId;
  const row = await queryOne<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? AND tenant_id = ? LIMIT 1`,
    [platformOrderId, tenantId]
  );
  if (!row) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfig(platform, row.storeId, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.completeDelivery(platformOrderId);
  if (success) {
    await query(
      `UPDATE platform_order SET status = 'COMPLETED', updated_at = NOW() WHERE platform_order_id = ? AND tenant_id = ?`,
      [platformOrderId, tenantId]
    );
  }
  res.json(ok({ platformOrderId, success, status: "COMPLETED" }));
}));

/** POST /store/instant-retail/orders/:platformOrderId/cancel — 取消订单 */
storeRouter.post("/orders/:platformOrderId/cancel", asyncHandler(async (req, res) => {
  const tenantId = req.tenantId!;
  const platformOrderId = req.params.platformOrderId;
  const body = z.object({ reason: z.string().optional() }).parse(req.body);
  const row = await queryOne<any>(
    `SELECT platform, store_id AS storeId, status FROM platform_order WHERE platform_order_id = ? AND tenant_id = ? LIMIT 1`,
    [platformOrderId, tenantId]
  );
  if (!row) {
    res.status(404).json({ code: "404", message: "订单不存在" });
    return;
  }
  const platform = parsePlatformType(row.platform);
  const config = await getPlatformConfig(platform, row.storeId, tenantId);
  if (!config) {
    res.status(404).json({ code: "404", message: "平台配置不存在" });
    return;
  }
  const adapter = getAdapter(platform, config);
  const success = await adapter.cancelOrder(platformOrderId, body.reason);
  if (success) {
    await query(
      `UPDATE platform_order SET status = 'CANCELLED', updated_at = NOW() WHERE platform_order_id = ? AND tenant_id = ?`,
      [platformOrderId, tenantId]
    );
  }
  res.json(ok({ platformOrderId, success, status: "CANCELLED" }));
}));
