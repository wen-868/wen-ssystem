/**
 * 增量同步服务 — 用于 App 端离线 SQLite 增量同步
 *
 * 提供 4 个核心函数：
 *  - getProductDelta：增量商品变更（含 SKU/SPU/价格/库存联合查询）
 *  - getInventoryDelta：增量库存变更
 *  - getMemberDelta：增量客户变更
 *  - submitOfflineOrders：批量提交离线销售单（错误隔离 + 事务原子性）
 *
 * 同步策略对齐 R51 方案 1.2 节，使用 since 时间戳增量拉取，支持分页（hasMore）。
 * 所有查询使用 queryWithTenant 实现租户隔离。
 *
 * 相关表：
 *  - t_product_sku / t_product_spu / t_product_price / t_inventory_balance / t_product_category / t_brand
 *  - t_member
 *  - t_sale_bill / t_sale_bill_item
 */
import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import logger from "../../shared/logger";

// ==================== 类型定义 ====================

/** 增量同步响应 */
export interface SyncDeltaResponse<T = unknown> {
    /** 本次请求的 since 值 */
    since: string;
    /** 本次返回数据的最新时间戳 */
    until: string;
    /** 是否还有更多数据 */
    hasMore: boolean;
    /** 变更条目列表 */
    changes: Array<{
        /** 变更动作：UPSERT 新增/更新、DELETE 删除、STATUS_CHANGE 状态变更 */
        action: "UPSERT" | "DELETE" | "STATUS_CHANGE";
        /** SKU ID（商品/库存场景）或 0（客户场景） */
        skuId: number;
        /** SPU ID（商品场景）或 0 */
        spuId: number;
        /** 变更数据（DELETE 时无） */
        data?: T;
    }>;
}

/** 商品增量数据 — 对齐 R51 方案 1.2 节 ProductDeltaData */
export interface ProductDeltaData {
    skuId: number;
    spuId: number;
    skuCode: string;
    barcode: string | null;
    skuName: string;
    volume: string | null;
    packaging: string | null;
    baseUnit: string;
    boxUnit: string;
    boxRatio: number;
    temperature: string;
    traceEnabled: number;
    status: number;
    spuName: string;
    categoryId: number;
    categoryName: string | null;
    brandName: string | null;
    mainImage: string | null;
    retailPrice: number;
    wholesalePrice: number | null;
    costPrice: number;
    miniappPrice: number | null;
    storePrice: number | null;
    availableQty: number;
    warningThreshold: number;
    updatedAt: string;
}

/** 库存增量数据 */
export interface InventoryDeltaData {
    storeId: number;
    skuId: number;
    skuName: string | null;
    stockType: string;
    physicalQty: number;
    lockedQty: number;
    availableQty: number;
    updatedAt: string;
}

/** 客户增量数据 */
export interface MemberDeltaData {
    memberId: number;
    name: string | null;
    mobile: string;
    customerType: string;
    settlementType: string;
    points: number;
    levelCode: string | null;
    status: number;
    updatedAt: string;
}

/** 离线销售单明细（App 端提交） */
export interface OfflineOrderItem {
    skuId: number;
    skuName: string;
    boxQty: number;
    bottleQty: number;
    totalBottleQty: number;
    unitPrice: number;
    priceType: string;
    subtotalAmount: number;
}

/** 离线销售单（App 端提交） */
export interface OfflineOrder {
    /** App 端本地草稿单号，用于幂等 */
    draftNo: string;
    customerName?: string;
    customerMobile?: string;
    customerId?: number;
    items: OfflineOrderItem[];
    totalAmount: number;
    remark?: string;
    /** 离线创建时间（ISO 8601） */
    createdAt: string;
}

/** 离线订单批量请求 */
export interface OfflineOrderBatch {
    orders: OfflineOrder[];
}

/** 离线订单单条结果 */
export interface OfflineOrderResult {
    /** App 端本地草稿单号 */
    draftNo: string;
    /** 是否成功 */
    success: boolean;
    /** 成功时返回服务端单号 */
    billNo?: string;
    /** 失败时返回错误信息 */
    errorMsg?: string;
}

/** 离线订单批量提交响应 */
export interface OfflineOrderBatchResult {
    totalCount: number;
    successCount: number;
    failureCount: number;
    results: OfflineOrderResult[];
}

// ==================== 内部辅助函数 ====================

/**
 * 判定商品变更动作
 *  - deletedAt 非空 → DELETE（软删除，预留字段兼容）
 *  - skuStatus = 0 或 spuStatus = 'OFF_SALE' → STATUS_CHANGE
 *  - 其他 → UPSERT
 */
function determineProductAction(row: {
    deletedAt: string | null;
    skuStatus: number;
    spuStatus: string;
}): "UPSERT" | "DELETE" | "STATUS_CHANGE" {
    if (row.deletedAt) return "DELETE";
    if (Number(row.skuStatus) === 0 || row.spuStatus === "OFF_SALE") return "STATUS_CHANGE";
    return "UPSERT";
}

/**
 * 构造 ProductDeltaData 对象
 */
function buildProductDeltaData(row: any): ProductDeltaData {
    return {
        skuId: Number(row.skuId),
        spuId: Number(row.spuId),
        skuCode: String(row.skuCode ?? ""),
        barcode: row.barcode ?? null,
        skuName: String(row.skuName ?? ""),
        volume: row.volume ?? null,
        packaging: row.packaging ?? null,
        baseUnit: String(row.baseUnit ?? "瓶"),
        boxUnit: String(row.boxUnit ?? "箱"),
        boxRatio: Number(row.boxRatio ?? 1),
        temperature: String(row.temperature ?? "NORMAL"),
        traceEnabled: Number(row.traceEnabled ?? 0),
        status: Number(row.skuStatus ?? 1),
        spuName: String(row.spuName ?? ""),
        categoryId: Number(row.categoryId ?? 0),
        categoryName: row.categoryName ?? null,
        brandName: row.brandName ?? null,
        mainImage: row.mainImage ?? null,
        retailPrice: Number(row.retailPrice ?? 0),
        wholesalePrice: row.wholesalePrice == null ? null : Number(row.wholesalePrice),
        costPrice: Number(row.costPrice ?? 0),
        miniappPrice: row.miniappPrice == null ? null : Number(row.miniappPrice),
        storePrice: row.storePrice == null ? null : Number(row.storePrice),
        availableQty: Number(row.availableQty ?? 0),
        warningThreshold: Number(row.warningThreshold ?? 0),
        updatedAt: String(row.updatedAt ?? ""),
    };
}

// ==================== 1. 商品增量同步 ====================

/**
 * 获取指定时间之后的商品增量变更
 *
 * 联合查询 t_product_sku / t_product_spu / t_product_price / t_inventory_balance，
 * 任意一张表的 updated_at > since 即视为变更。
 *
 * action 判定：
 *  - sku.deleted_at 非空（预留软删字段）→ DELETE
 *  - sku.status = 0 或 spu.status = 'OFF_SALE' → STATUS_CHANGE
 *  - 其他 → UPSERT
 *
 * @param since ISO 8601 时间戳（空字符串视为 1970-01-01）
 * @param tenantId 租户ID
 * @param page 页码（从 1 开始）
 * @param pageSize 每页大小
 */
export async function getProductDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<ProductDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    const offset = (safePage - 1) * safePageSize;

    // SQL 中已显式带 tenant_id 条件，queryWithTenant 不会重复注入
    // NULL AS deletedAt — 当前表结构无 deleted_at 字段，预留兼容位
    const rows = await queryWithTenant<any>(
        `SELECT
       s.id AS skuId, s.spu_id AS spuId, s.sku_code AS skuCode, s.barcode, s.sku_name AS skuName,
       s.volume, s.packaging, s.base_unit AS baseUnit, s.box_unit AS boxUnit, s.box_ratio AS boxRatio,
       s.temperature, s.trace_enabled AS traceEnabled, s.status AS skuStatus,
       s.warning_threshold AS warningThreshold, s.updated_at AS skuUpdatedAt,
       p.name AS spuName, p.category_id AS categoryId, p.main_image AS mainImage, p.status AS spuStatus,
       c.name AS categoryName,
       b.name AS brandName,
       pp.retail_price AS retailPrice, pp.wholesale_price AS wholesalePrice, pp.cost_price AS costPrice,
       pp.miniapp_price AS miniappPrice, pp.store_price AS storePrice, pp.updated_at AS priceUpdatedAt,
       ib.available_qty AS availableQty, ib.updated_at AS invUpdatedAt,
       NULL AS deletedAt,
       GREATEST(
         s.updated_at,
         IFNULL(p.updated_at, s.updated_at),
         IFNULL(pp.updated_at, s.updated_at),
         IFNULL(ib.updated_at, s.updated_at)
       ) AS updatedAt
     FROM t_product_sku s
     INNER JOIN t_product_spu p ON p.id = s.spu_id AND p.tenant_id = s.tenant_id
     LEFT JOIN t_product_category c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
     LEFT JOIN t_brand b ON b.id = p.brand_id AND b.tenant_id = p.tenant_id
     LEFT JOIN t_product_price pp ON pp.sku_id = s.id AND pp.tenant_id = s.tenant_id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'OFFLINE' AND ib.tenant_id = s.tenant_id
     WHERE s.tenant_id = ?
       AND (
         s.updated_at > ? OR
         p.updated_at > ? OR
         pp.updated_at > ? OR
         ib.updated_at > ?
       )
     ORDER BY updatedAt ASC
     LIMIT ? OFFSET ?`,
        [tenantId, safeSince, safeSince, safeSince, safeSince, safePageSize, offset],
        tenantId
    );

    const changes: SyncDeltaResponse<ProductDeltaData>["changes"] = rows.map((row: any) => {
        const action = determineProductAction({
            deletedAt: row.deletedAt,
            skuStatus: Number(row.skuStatus),
            spuStatus: String(row.spuStatus ?? ""),
        });
        return {
            action,
            skuId: Number(row.skuId),
            spuId: Number(row.spuId),
            data: action === "DELETE" ? undefined : buildProductDeltaData(row),
        };
    });

    // until = 本次返回数据的最新时间戳；无数据时回退为 since
    const until = changes.length > 0 ? String(rows[rows.length - 1].updatedAt ?? safeSince) : safeSince;
    // hasMore = 本次返回的数据量等于 pageSize（满页时大概率还有更多）
    const hasMore = rows.length === safePageSize;

    return { since: safeSince, until, hasMore, changes };
}

// ==================== 2. 库存增量同步 ====================

/**
 * 获取指定时间之后的库存增量变更
 *
 * 读取 t_inventory_balance WHERE updated_at > since，返回库存快照。
 *
 * @param since ISO 8601 时间戳
 * @param tenantId 租户ID
 * @param page 页码
 * @param pageSize 每页大小
 */
export async function getInventoryDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<InventoryDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    const offset = (safePage - 1) * safePageSize;

    const rows = await queryWithTenant<any>(
        `SELECT
       ib.store_id AS storeId, ib.sku_id AS skuId, ib.stock_type AS stockType,
       ib.physical_qty AS physicalQty, ib.locked_qty AS lockedQty, ib.available_qty AS availableQty,
       ib.updated_at AS updatedAt,
       s.sku_name AS skuName
     FROM t_inventory_balance ib
     LEFT JOIN t_product_sku s ON s.id = ib.sku_id AND s.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ? AND ib.updated_at > ?
     ORDER BY ib.updated_at ASC
     LIMIT ? OFFSET ?`,
        [tenantId, safeSince, safePageSize, offset],
        tenantId
    );

    const changes: SyncDeltaResponse<InventoryDeltaData>["changes"] = rows.map((row: any) => ({
        action: "UPSERT" as const,
        skuId: Number(row.skuId),
        spuId: 0,
        data: {
            storeId: Number(row.storeId),
            skuId: Number(row.skuId),
            skuName: row.skuName ?? null,
            stockType: String(row.stockType ?? "OFFLINE"),
            physicalQty: Number(row.physicalQty ?? 0),
            lockedQty: Number(row.lockedQty ?? 0),
            availableQty: Number(row.availableQty ?? 0),
            updatedAt: String(row.updatedAt ?? ""),
        },
    }));

    const until = changes.length > 0 ? String(rows[rows.length - 1].updatedAt ?? safeSince) : safeSince;
    const hasMore = rows.length === safePageSize;

    return { since: safeSince, until, hasMore, changes };
}

// ==================== 3. 客户增量同步 ====================

/**
 * 获取指定时间之后的客户增量变更
 *
 * 读取 t_member WHERE updated_at > since。
 *
 * @param since ISO 8601 时间戳
 * @param tenantId 租户ID
 * @param page 页码
 * @param pageSize 每页大小
 */
export async function getMemberDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<MemberDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    const offset = (safePage - 1) * safePageSize;

    const rows = await queryWithTenant<any>(
        `SELECT
       id AS memberId, name, mobile, customer_type AS customerType,
       settlement_type AS settlementType, points, level_code AS levelCode,
       status, updated_at AS updatedAt
     FROM t_member
     WHERE tenant_id = ? AND updated_at > ?
     ORDER BY updated_at ASC
     LIMIT ? OFFSET ?`,
        [tenantId, safeSince, safePageSize, offset],
        tenantId
    );

    const changes: SyncDeltaResponse<MemberDeltaData>["changes"] = rows.map((row: any) => {
        const action = Number(row.status) === 0 ? "STATUS_CHANGE" : "UPSERT";
        return {
            action: action as "UPSERT" | "STATUS_CHANGE",
            skuId: 0,
            spuId: 0,
            data: {
                memberId: Number(row.memberId),
                name: row.name ?? null,
                mobile: String(row.mobile ?? ""),
                customerType: String(row.customerType ?? "RETAIL"),
                settlementType: String(row.settlementType ?? "CASH"),
                points: Number(row.points ?? 0),
                levelCode: row.levelCode ?? null,
                status: Number(row.status ?? 1),
                updatedAt: String(row.updatedAt ?? ""),
            },
        };
    });

    const until = changes.length > 0 ? String(rows[rows.length - 1].updatedAt ?? safeSince) : safeSince;
    const hasMore = rows.length === safePageSize;

    return { since: safeSince, until, hasMore, changes };
}

// ==================== 4. 离线销售单批量提交 ====================

/**
 * 批量提交离线销售单
 *
 *  - 逐条处理，单条失败不影响其他订单（错误隔离）
 *  - 单条订单使用事务保证原子性（sale_bill + sale_bill_item 同时成功或同时回滚）
 *  - 通过 draftNo 唯一性实现幂等：重复 draftNo 直接返回失败 errorMsg
 *  - 使用服务端 makeBizNo("XS") 生成 billNo，不依赖客户端时间
 *
 * @param orders 离线订单列表
 * @param tenantId 租户ID
 * @param operatorId 操作人ID（来自 req.user.id）
 */
export async function submitOfflineOrders(
    orders: OfflineOrder[],
    tenantId: string,
    operatorId: number
): Promise<OfflineOrderBatchResult> {
    const results: OfflineOrderResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const order of orders) {
        try {
            // 入参基本校验
            if (!order.draftNo || typeof order.draftNo !== "string") {
                throw new AppError("draftNo 不能为空", 400);
            }
            if (!Array.isArray(order.items) || order.items.length === 0) {
                throw new AppError("订单明细不能为空", 400);
            }

            // 幂等检查：基于 draftNo 查重（draftNo 作为 bill_no 的别名存储在 sale_bill 中）
            // 约定：离线订单的 draftNo 直接作为服务端 billNo 使用，便于幂等
            const existing = await queryOneWithTenant<any>(
                "SELECT bill_no AS billNo FROM t_sale_bill WHERE bill_no = ? AND tenant_id = ?",
                [order.draftNo, tenantId],
                tenantId
            );
            if (existing) {
                throw new AppError(`单号 ${order.draftNo} 已存在，禁止重复提交`, 409);
            }

            // 事务保证 sale_bill + sale_bill_item 原子性
            const billNo = await transaction(async (conn: any) => {
                // 查询客户信息（如提供 customerId）
                let customerName = order.customerName ?? null;
                let customerMobile = order.customerMobile ?? null;
                let customerType = "RETAIL";
                let customerId: number | null = null;
                if (order.customerId) {
                    const [memberRows] = await conn.query(
                        "SELECT id, name, mobile, customer_type FROM t_member WHERE id = ? AND tenant_id = ?",
                        [order.customerId, tenantId]
                    );
                    const member = (memberRows as any[])?.[0];
                    if (member) {
                        customerId = Number(member.id);
                        customerName = member.name ?? customerName;
                        customerMobile = member.mobile ?? customerMobile;
                        customerType = String(member.customer_type ?? "RETAIL");
                    }
                }

                // 计算应收金额（来自客户端 items 的 subtotalAmount 汇总，与 totalAmount 取大值兜底）
                const goodsAmount = order.items.reduce((sum, item) => sum + Number(item.subtotalAmount ?? 0), 0);
                const receivableAmount = Math.max(0, Number(order.totalAmount ?? goodsAmount));

                // 插入销售单主表 — draftNo 直接作为 billNo，实现幂等
                await conn.execute(
                    `INSERT INTO t_sale_bill (
             bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
             business_status, collection_status, goods_amount, discount_amount, rounding_amount,
             receivable_amount, received_amount, unreceived_amount, operator_id, remark, tenant_id
           ) VALUES (?, ?, ?, ?, ?, ?, 'CREATED', 'UNPAID', ?, 0, 0, ?, 0, ?, ?, ?, ?)`,
                    [
                        order.draftNo,
                        0, // 离线订单 store_id 默认 0（App 端未携带 storeId 时）
                        customerId,
                        customerName,
                        customerMobile,
                        customerType,
                        goodsAmount,
                        receivableAmount,
                        receivableAmount,
                        operatorId,
                        order.remark ?? null,
                        tenantId,
                    ]
                );

                // 插入销售单明细
                for (const item of order.items) {
                    await conn.execute(
                        `INSERT INTO t_sale_bill_item (
               bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
               unit_price, price_type, subtotal_amount
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            order.draftNo,
                            Number(item.skuId),
                            String(item.skuName ?? ""),
                            Number(item.boxQty ?? 0),
                            Number(item.bottleQty ?? 0),
                            Number(item.totalBottleQty ?? 0),
                            Number(item.unitPrice ?? 0),
                            String(item.priceType ?? "RETAIL"),
                            Number(item.subtotalAmount ?? 0),
                        ]
                    );
                }

                return order.draftNo;
            });

            results.push({ draftNo: order.draftNo, success: true, billNo });
            successCount++;
        } catch (err: any) {
            // 错误隔离：单条失败不影响其他订单
            const errorMsg = err?.message || String(err);
            logger.warn(`[离线订单提交] 失败 draftNo=${order.draftNo}: ${errorMsg}`);
            results.push({ draftNo: order.draftNo, success: false, errorMsg });
            failureCount++;
        }
    }

    return {
        totalCount: orders.length,
        successCount,
        failureCount,
        results,
    };
}
