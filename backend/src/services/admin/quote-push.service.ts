/**
 * 一键报价推送服务
 *
 * 功能：
 * 1. 按分类/品牌/价格等级筛选商品，生成报价单
 * 2. 计算客户最优价（结合客户绑定价格等级、阶梯价）
 * 3. 生成报价单PDF/图片/链接
 * 4. 支持推送给客户（短信通知/小程序消息/生成分享链接）
 * 5. 报价单有效期管理
 * 6. 客户查看记录追踪
 */

import { query, queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db.js";
import { makeBizNo } from "../../shared/id.js";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface QuoteFilter {
  customerId?: number;
  categoryId?: number;
  brand?: string;
  keyword?: string;
  priceLevelId?: number;
  minPrice?: number;
  maxPrice?: number;
  skuIds?: number[];
}

export interface QuoteItem {
  skuId: number;
  skuName: string;
  skuCode: string;
  barcode?: string;
  unit: string;
  originalPrice: number;
  quotePrice: number;
  discountRate: number;
  minQty: number;
  imageUrl?: string;
}

export interface QuoteCreateParams {
  customerId: number;
  title: string;
  remark?: string;
  validDays: number;
  items: Array<{
    skuId: number;
    quotePrice: number;
    minQty: number;
  }>;
}

export interface QuoteDetail {
  id: number;
  quoteNo: string;
  title: string;
  customerId: number;
  customerName: string;
  customerPhone?: string;
  status: string;
  validDays: number;
  expireAt?: Date;
  totalAmount: number;
  totalSku: number;
  remark?: string;
  items: QuoteItem[];
  viewCount: number;
  shareUrl?: string;
  createdAt: Date;
  createdBy: number;
}

export interface QuotePushParams {
  channels: Array<"sms" | "miniapp" | "email">;
  notifyText?: string;
}

// ─── 生成报价单（预览） ───────────────────────────────────────

/**
 * 根据筛选条件生成报价预览（不保存）
 */
export async function previewQuote(
  filter: QuoteFilter,
  tenantId: string
): Promise<{
  customerName: string;
  priceLevel: string;
  itemCount: number;
  totalAmount: number;
  items: QuoteItem[];
}> {
  const conditions: string[] = ["s.tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filter.categoryId) {
    conditions.push("s.category_id = ?");
    params.push(filter.categoryId);
  }
  if (filter.brand) {
    conditions.push("s.brand = ?");
    params.push(filter.brand);
  }
  if (filter.keyword) {
    conditions.push("(s.name LIKE ? OR sk.sku_name LIKE ? OR sk.barcode LIKE ?)");
    const like = `%${filter.keyword}%`;
    params.push(like, like, like);
  }
  if (filter.skuIds && filter.skuIds.length > 0) {
    conditions.push("sk.id IN (?)");
    params.push(filter.skuIds);
  }

  const where = conditions.join(" AND ");

  // 获取客户绑定的价格等级
  let priceLevelId: number | null = null;
  let levelName = "零售价";
  let customerName = "";

  if (filter.customerId) {
    const customer = await queryOneWithTenant<any>(
      `SELECT m.id, m.name, cpb.price_level_id, pl.level_name
       FROM member m
       LEFT JOIN t_customer_price_binding cpb
         ON cpb.customer_id = m.id AND cpb.status = 'APPROVED' AND cpb.tenant_id = m.tenant_id
       LEFT JOIN t_price_level pl ON pl.id = cpb.price_level_id AND pl.tenant_id = m.tenant_id
       WHERE m.id = ? AND m.tenant_id = ?`,
      [filter.customerId, tenantId],
      tenantId
    );

    if (customer) {
      customerName = customer.name;
      priceLevelId = customer.price_level_id;
      levelName = customer.level_name || "零售价";
    }
  }

  if (filter.priceLevelId) {
    priceLevelId = filter.priceLevelId;
    const level = await queryOneWithTenant<any>(
      "SELECT level_name FROM t_price_level WHERE id = ? AND tenant_id = ?",
      [filter.priceLevelId, tenantId],
      tenantId
    );
    if (level) levelName = level.level_name;
  }

  // 查询SKU及其最优价格
  const rows = await queryWithTenant<any>(
    `SELECT sk.id AS skuId, sk.sku_name AS skuName, sk.sku_code AS skuCode,
            sk.barcode, s.unit, s.main_image AS imageUrl,
            pp.retail_price AS retailPrice,
            pp.wholesale_price AS wholesalePrice,
            pp.cost_price AS costPrice
     FROM t_product_sku sk
     JOIN t_product_spu s ON s.id = sk.spu_id AND s.tenant_id = sk.tenant_id
     JOIN t_product_price pp ON pp.sku_id = sk.id AND pp.tenant_id = sk.tenant_id
     WHERE ${where}
     ORDER BY sk.id DESC
     LIMIT 200`,
    params,
    tenantId
  );

  const items: QuoteItem[] = [];
  let totalAmount = 0;

  for (const row of rows) {
    const originalPrice = Number(row.retailPrice ?? 0);
    let quotePrice = originalPrice;

    // 如果客户有绑定价格等级，从 sku_price 表查对应等级的阶梯价
    if (priceLevelId) {
      const levelPrice = await queryOneWithTenant<any>(
        `SELECT price FROM t_sku_price
         WHERE sku_id = ? AND price_level_id = ? AND status = 1 AND tenant_id = ?
         ORDER BY min_qty ASC
         LIMIT 1`,
        [row.skuId, priceLevelId, tenantId],
        tenantId
      );
      if (levelPrice) {
        quotePrice = Number(levelPrice.price);
      }
    }

    const discountRate = originalPrice > 0
      ? Number(((originalPrice - quotePrice) / originalPrice * 100).toFixed(2))
      : 0;

    items.push({
      skuId: row.skuId,
      skuName: row.skuName,
      skuCode: row.skuCode,
      barcode: row.barcode,
      unit: row.unit || "件",
      originalPrice,
      quotePrice,
      discountRate,
      minQty: 1,
      imageUrl: row.imageUrl
    });

    totalAmount += quotePrice;
  }

  return {
    customerName,
    priceLevel: levelName,
    itemCount: items.length,
    totalAmount: Number(totalAmount.toFixed(2)),
    items
  };
}

// ─── 创建报价单 ───────────────────────────────────────────────

/**
 * 创建正式报价单
 */
export async function createQuote(
  params: QuoteCreateParams,
  operatorId: number,
  tenantId: string
): Promise<{ quoteId: number; quoteNo: string; shareUrl: string }> {
  const result = await transaction(async (conn) => {
    const quoteNo = makeBizNo("QT");
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + params.validDays);

    // 获取客户信息
    const [customerRows] = await conn.query<any[]>(
      "SELECT name, phone FROM member WHERE id = ? AND tenant_id = ?",
      [params.customerId, tenantId]
    );
    const customer = customerRows[0];

    // 计算总金额
    let totalAmount = 0;
    const itemsWithPrice: Array<{ skuId: number; skuName: string; quotePrice: number; minQty: number }> = [];

    for (const item of params.items) {
      const [skuRows] = await conn.query<any[]>(
        "SELECT sku_name FROM t_product_sku WHERE id = ? AND tenant_id = ?",
        [item.skuId, tenantId]
      );
      if (skuRows.length > 0) {
        itemsWithPrice.push({
          skuId: item.skuId,
          skuName: skuRows[0].sku_name,
          quotePrice: item.quotePrice,
          minQty: item.minQty
        });
        totalAmount += item.quotePrice;
      }
    }

    // 插入报价单主表
    const [quoteResult] = await conn.query<any>(
      `INSERT INTO customer_quote
       (quote_no, title, customer_id, customer_name, customer_phone, status,
        valid_days, expire_at, total_amount, total_sku, remark,
        created_by, share_token, tenant_id)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, UUID(), ?)`,
      [
        quoteNo,
        params.title,
        params.customerId,
        customer?.name || "",
        customer?.phone || null,
        params.validDays,
        expireAt,
        Number(totalAmount.toFixed(2)),
        itemsWithPrice.length,
        params.remark || null,
        operatorId,
        tenantId
      ]
    );

    const quoteId = quoteResult.insertId as number;

    // 插入报价单明细
    for (const item of itemsWithPrice) {
      await conn.query(
        `INSERT INTO customer_quote_item
         (quote_id, sku_id, sku_name, quote_price, min_qty, sort_order, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quoteId, item.skuId, item.skuName, item.quotePrice, item.minQty, 0, tenantId]
      );
    }

    // 生成分享URL
    const [tokenRows] = await conn.query<any[]>(
      "SELECT share_token AS shareToken FROM customer_quote WHERE id = ? AND tenant_id = ?",
      [quoteId, tenantId]
    );

    return {
      quoteId,
      quoteNo,
      shareToken: tokenRows[0]?.shareToken
    };
  });

  const shareUrl = `/quote/share/${result.shareToken}`;

  return {
    quoteId: result.quoteId,
    quoteNo: result.quoteNo,
    shareUrl
  };
}

// ─── 报价单列表 ───────────────────────────────────────────────

/**
 * 报价单列表
 */
export async function listQuotes(
  page: number,
  pageSize: number,
  tenantId: string,
  filters?: {
    customerId?: number;
    status?: string;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["tenant_id = ?"];
  const params: unknown[] = [tenantId];

  if (filters?.customerId) {
    conditions.push("customer_id = ?");
    params.push(filters.customerId);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.keyword) {
    conditions.push("(quote_no LIKE ? OR title LIKE ? OR customer_name LIKE ?)");
    const like = `%${filters.keyword}%`;
    params.push(like, like, like);
  }
  if (filters?.startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(filters.endDate);
  }

  const where = conditions.join(" AND ");

  const rows = await queryWithTenant<any>(
    `SELECT id, quote_no AS quoteNo, title, customer_id AS customerId,
            customer_name AS customerName, status,
            valid_days AS validDays, expire_at AS expireAt,
            total_amount AS totalAmount, total_sku AS totalSku,
            view_count AS viewCount, created_at AS createdAt
     FROM customer_quote
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<any>(
    `SELECT COUNT(*) AS total FROM customer_quote WHERE ${where}`,
    params,
    tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records: rows
  };
}

// ─── 报价单详情 ───────────────────────────────────────────────

/**
 * 报价单详情
 */
export async function getQuoteDetail(quoteId: number, tenantId: string): Promise<QuoteDetail | null> {
  const quote = await queryOneWithTenant<any>(
    `SELECT q.id, q.quote_no AS quoteNo, q.title, q.customer_id AS customerId,
            q.customer_name AS customerName, q.customer_phone AS customerPhone,
            q.status, q.valid_days AS validDays, q.expire_at AS expireAt,
            q.total_amount AS totalAmount, q.total_sku AS totalSku,
            q.remark, q.view_count AS viewCount, q.share_token AS shareToken,
            q.created_at AS createdAt, q.created_by AS createdBy
     FROM customer_quote q
     WHERE q.id = ? AND q.tenant_id = ?`,
    [quoteId, tenantId],
    tenantId
  );

  if (!quote) return null;

  const items = await queryWithTenant<any>(
    `SELECT qi.id, qi.sku_id AS skuId, qi.sku_name AS skuName,
            qi.quote_price AS quotePrice, qi.min_qty AS minQty,
            sk.barcode, sk.sku_code AS skuCode, s.unit, s.main_image AS imageUrl
     FROM customer_quote_item qi
     LEFT JOIN t_product_sku sk ON sk.id = qi.sku_id AND sk.tenant_id = qi.tenant_id
     LEFT JOIN t_product_spu s ON s.id = sk.spu_id AND s.tenant_id = sk.tenant_id
     WHERE qi.quote_id = ? AND qi.tenant_id = ?
     ORDER BY qi.sort_order ASC, qi.id ASC`,
    [quoteId, tenantId],
    tenantId
  );

  return {
    ...quote,
    items: items.map((item: any) => ({
      skuId: item.skuId,
      skuName: item.skuName,
      skuCode: item.skuCode,
      barcode: item.barcode,
      unit: item.unit || "件",
      originalPrice: 0,
      quotePrice: Number(item.quotePrice),
      discountRate: 0,
      minQty: item.minQty,
      imageUrl: item.imageUrl
    })),
    shareUrl: `/quote/share/${quote.shareToken}`
  };
}

// ─── 推送报价单 ───────────────────────────────────────────────

/**
 * 推送报价单给客户
 */
export async function pushQuote(
  quoteId: number,
  params: QuotePushParams,
  tenantId: string
): Promise<{
  success: boolean;
  quoteNo: string;
  channels: string[];
  customerPhone?: string;
  shareUrl: string;
}> {
  const quote = await queryOneWithTenant<any>(
    `SELECT id, quote_no, customer_name, customer_phone, share_token, status
     FROM customer_quote WHERE id = ? AND tenant_id = ?`,
    [quoteId, tenantId],
    tenantId
  );

  if (!quote) {
    throw Object.assign(new Error("报价单不存在"), { statusCode: 404 });
  }

  if (quote.status !== "ACTIVE") {
    throw Object.assign(new Error("报价单状态异常，无法推送"), { statusCode: 400 });
  }

  const shareUrl = `/quote/share/${quote.share_token}`;
  const channels: string[] = [];

  // 模拟各渠道推送
  for (const channel of params.channels) {
    switch (channel) {
      case "sms":
        if (quote.customer_phone) {
          // TODO: 接入真实短信服务
          // 短信内容：【XX酒行】尊敬的客户，您有新的报价单，点击查看：{shareUrl}
          channels.push("sms");
        }
        break;
      case "miniapp":
        // TODO: 接入小程序订阅消息
        channels.push("miniapp");
        break;
      case "email":
        // TODO: 接入邮件服务
        channels.push("email");
        break;
    }
  }

  // 记录推送日志
  await queryWithTenant(
    `INSERT INTO customer_quote_push_log
     (quote_id, channel, content, target, status, tenant_id)
     VALUES (?, ?, ?, ?, 'SUCCESS', ?)`,
    [quoteId, params.channels.join(","), params.notifyText || "", quote.customer_phone || "", tenantId],
    tenantId
  );

  return {
    success: true,
    quoteNo: quote.quote_no,
    channels,
    customerPhone: quote.customer_phone,
    shareUrl
  };
}

// ─── 客户查看报价单（分享链接） ───────────────────────────────

/**
 * 通过分享令牌查看报价单（无需登录）
 */
export async function viewQuoteByToken(shareToken: string): Promise<QuoteDetail | null> {
  const rows = await query<any>(
    `SELECT q.id, q.quote_no AS quoteNo, q.title, q.customer_name AS customerName,
            q.status, q.valid_days AS validDays, q.expire_at AS expireAt,
            q.total_amount AS totalAmount, q.total_sku AS totalSku,
            q.remark, q.view_count AS viewCount, q.tenant_id AS tenantId
     FROM customer_quote q WHERE q.share_token = ? LIMIT 1`,
    [shareToken]
  );
  const quote = rows[0] || null;

  if (!quote) return null;

  // 增加浏览次数
  await queryWithTenant(
    "UPDATE customer_quote SET view_count = view_count + 1 WHERE id = ? AND tenant_id = ?",
    [quote.id, quote.tenantId],
    quote.tenantId
  );

  const items = await queryWithTenant<any>(
    `SELECT qi.sku_id AS skuId, qi.sku_name AS skuName,
            qi.quote_price AS quotePrice, qi.min_qty AS minQty,
            sk.barcode, s.unit, s.main_image AS imageUrl
     FROM customer_quote_item qi
     LEFT JOIN t_product_sku sk ON sk.id = qi.sku_id AND sk.tenant_id = qi.tenant_id
     LEFT JOIN t_product_spu s ON s.id = sk.spu_id AND s.tenant_id = sk.tenant_id
     WHERE qi.quote_id = ? AND qi.tenant_id = ?
     ORDER BY qi.sort_order ASC, qi.id ASC`,
    [quote.id, quote.tenantId],
    quote.tenantId
  );

  return {
    id: quote.id,
    quoteNo: quote.quoteNo,
    title: quote.title,
    customerId: 0,
    customerName: quote.customerName,
    status: quote.status,
    validDays: quote.validDays,
    expireAt: quote.expireAt,
    totalAmount: Number(quote.totalAmount),
    totalSku: quote.totalSku,
    remark: quote.remark,
    items: items.map((item: any) => ({
      skuId: item.skuId,
      skuName: item.skuName,
      skuCode: "",
      barcode: item.barcode,
      unit: item.unit || "件",
      originalPrice: 0,
      quotePrice: Number(item.quotePrice),
      discountRate: 0,
      minQty: item.minQty,
      imageUrl: item.imageUrl
    })),
    viewCount: Number(quote.viewCount) + 1,
    createdAt: new Date(),
    createdBy: 0
  };
}

// ─── 取消报价单 ───────────────────────────────────────────────

/**
 * 取消报价单
 */
export async function cancelQuote(quoteId: number, tenantId: string) {
  const existing = await queryOneWithTenant<any>(
    "SELECT id, status FROM customer_quote WHERE id = ? AND tenant_id = ?",
    [quoteId, tenantId],
    tenantId
  );

  if (!existing) {
    throw Object.assign(new Error("报价单不存在"), { statusCode: 404 });
  }

  if (existing.status === "CANCELLED") {
    return { quoteId, cancelled: true };
  }

  await queryWithTenant(
    "UPDATE customer_quote SET status = 'CANCELLED', updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [quoteId, tenantId],
    tenantId
  );

  return { quoteId, cancelled: true };
}
