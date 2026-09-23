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
import type { RowDataPacket } from "mysql2";

// ==================== 数据库行接口定义 ====================

/** 商品增量查询行 — 联合 t_product_sku / t_product_spu / t_product_price / t_inventory_balance */
interface ProductDeltaRow {
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
    skuStatus: number;
    warningThreshold: number;
    skuUpdatedAt: string | Date;
    spuName: string;
    categoryId: number;
    mainImage: string | null;
    spuStatus: string;
    categoryName: string | null;
    brandName: string | null;
    retailPrice: number | string;
    wholesalePrice: number | string | null;
    costPrice: number | string;
    miniappPrice: number | string | null;
    storePrice: number | string | null;
    priceUpdatedAt: string | Date | null;
    availableQty: number;
    invUpdatedAt: string | Date | null;
    deletedAt: string | null;
    updatedAt: string | Date;
}

/** 库存增量查询行 — t_inventory_balance JOIN t_product_sku */
interface InventoryDeltaRow {
    storeId: number;
    skuId: number;
    stockType: string;
    physicalQty: number;
    lockedQty: number;
    availableQty: number;
    updatedAt: string | Date;
    skuName: string | null;
}

/** 客户增量查询行 — t_member */
interface MemberDeltaRow {
    memberId: number;
    name: string | null;
    mobile: string;
    customerType: string;
    settlementType: string;
    points: number;
    levelCode: string | null;
    status: number;
    updatedAt: string | Date;
}

/** 销售单草稿查重行 — 用于离线订单幂等检查 */
interface SaleBillDraftRow {
    billNo: string;
}

/** 离线订单客户信息查询行 */
interface MemberSyncRow extends RowDataPacket {
    id: number;
    name: string | null;
    mobile: string;
    customer_type: string;
}

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
function buildProductDeltaData(row: ProductDeltaRow): ProductDeltaData {
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

// ==================== 游标分页与时间归一化（S3-80） ====================

/** 探针多取 1 行：用于实测"是否还有下一页"（替代 rows.length === pageSize 的近似判断） */
const CURSOR_PROBE_EXTRA = 1;

/**
 * 兼容参数 `page` 的校验（正整数，缺省 1）
 *
 * 游标模式下 `since` 是唯一游标，`page` 不参与取数；本函数只保留调用契约与校验语义，
 * 归一化结果不进任何 SQL / 窗口计算。
 */
function normalizePage(page: number): void {
    void Math.max(1, Number(page) || 1);
}

/**
 * 归一化为 ISO 8601 UTC 字符串（YYYY-MM-DDTHH:mm:ss.sssZ）
 *
 * 底层驱动/表达式可能返回 JS `Date` 对象、ISO 字符串、MySQL DATETIME 文本（`YYYY-MM-DD HH:mm:ss`）
 * 或时间戳数字，一律归一化后再对外返回——客户端会把上一页的 `until` 原样作为下一页的 `since` 回传，
 * 非 ISO 8601 形态会被 `since` 校验拒绝（第 2 页必 400，翻页断链）。
 *
 * MySQL DATETIME 文本无时区标记：连接池 `timezone: "Z"`（config/database.ts）已约定按 UTC 处理，
 * 这里保持一致，避免同一条记录被读成两个不同时刻。
 */
function toIsoUtc(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === "number") {
        const fromNumber = new Date(value);
        return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
    }
    const text = String(value).trim();
    if (!text) return null;
    const mysqlDatetime = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/);
    if (mysqlDatetime) {
        const fraction = (mysqlDatetime[3] ?? ".").padEnd(4, "0").slice(0, 4);
        const fromMysql = new Date(`${mysqlDatetime[1]}T${mysqlDatetime[2]}${fraction}Z`);
        return Number.isNaN(fromMysql.getTime()) ? null : fromMysql.toISOString();
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** 游标分页所需的三个查询（每个 delta 接口按自己的表结构提供实现） */
interface DeltaCursorQueries<T> {
    /** 探针查询：按 (updated_at, id) 升序取 limit 条 */
    probe: (since: string, limit: number) => Promise<T[]>;
    /** 整页查询：取 updated_at <= boundary 的全部记录（同一 updated_at 整组不拆页） */
    fillTo: (since: string, boundary: string) => Promise<T[]>;
    /** 探针查询：updated_at > boundary 是否还有记录（hasMore 的真值） */
    hasAfter: (since: string, boundary: string) => Promise<boolean>;
    /** 读取该行的变更时间（updated_at，或商品联合查询的 GREATEST(...)） */
    changedAtOf: (row: T) => unknown;
}

/**
 * 游标分页取数：`since` 是唯一游标，`page` 不参与取数
 *
 * 历史缺陷（S3-80）：服务端 `LIMIT ? OFFSET ?` 叠加客户端"同一循环里 `page++` 且 `since = until`"
 * ⇒ 第 2 页起整页被跳过（永久丢数据）。改为游标后，仅凭 `hasMore` / `until` 即可连续翻页。
 *
 * 分页规则：
 *  1. 窗口 = `changed_at > since`，排序 `changed_at ASC, id ASC`；
 *  2. 探针多取 1 行实测 `hasMore`，不再用 `rows.length === pageSize` 近似；
 *  3. 第 pageSize 条与第 pageSize+1 条同刻 ⇒ 同刻组被切断 ⇒ 整组补齐（本页行数可大于 pageSize）；
 *  4. `until` = 本页最大 `changed_at`（本页无记录时 = 生效的 `since`），归一化为 ISO 8601。
 */
async function fetchDeltaCursorPage<T>(
    since: string,
    pageSize: number,
    queries: DeltaCursorQueries<T>
): Promise<{ rows: T[]; until: string; hasMore: boolean }> {
    const probeRows = await queries.probe(since, pageSize + CURSOR_PROBE_EXTRA);
    if (probeRows.length === 0) {
        return { rows: [], until: since, hasMore: false };
    }
    if (probeRows.length <= pageSize) {
        const until = toIsoUtc(queries.changedAtOf(probeRows[probeRows.length - 1])) ?? since;
        return { rows: probeRows, until, hasMore: false };
    }

    const boundary = toIsoUtc(queries.changedAtOf(probeRows[pageSize - 1]));
    // 同一 updated_at 的记录必须整组同页：第 pageSize+1 条与第 pageSize 条同刻 ⇒ 补齐整组
    if (boundary !== null && toIsoUtc(queries.changedAtOf(probeRows[pageSize])) === boundary) {
        const rows = await queries.fillTo(since, boundary);
        const hasMore = await queries.hasAfter(since, boundary);
        return { rows, until: boundary, hasMore };
    }

    // 第 pageSize+1 条更晚 ⇒ 本页正好 pageSize 条，且必还有更新的记录（探针实测）
    // boundary 为 null 属理论不可达（updated_at NOT NULL）；万一发生则保守不推进游标
    return { rows: probeRows.slice(0, pageSize), until: boundary ?? since, hasMore: true };
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
 * @param page 页码（从 1 开始）—— 兼容参数：仅校验，不参与取数（游标模式）
 * @param pageSize 每页大小
 */
export async function getProductDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<ProductDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    normalizePage(page);

    // 变更时间 = 四表 updated_at 的最大值；窗口/边界条件与 SELECT 别名共用同一表达式，避免口径漂移
    const changedAt = `GREATEST(
         s.updated_at,
         IFNULL(p.updated_at, s.updated_at),
         IFNULL(pp.updated_at, s.updated_at),
         IFNULL(ib.updated_at, s.updated_at)
       )`;
    // SQL 中已显式带 tenant_id 条件，queryWithTenant 不会重复注入
    // NULL AS deletedAt — 当前表结构无 deleted_at 字段，预留兼容位
    const deltaSelect = `SELECT
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
       ${changedAt} AS updatedAt`;
    const deltaFrom = `FROM t_product_sku s
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
       )`;

    // 游标取数：page 不参与；ORDER BY 补 id 次级键；同 updated_at 整组不拆页；hasMore 由探针实测
    const { rows, until, hasMore } = await fetchDeltaCursorPage<ProductDeltaRow>(
        safeSince,
        safePageSize,
        {
            probe: (cursorSince, limit) =>
                queryWithTenant<ProductDeltaRow>(
                    `${deltaSelect} ${deltaFrom} ORDER BY updatedAt ASC, s.id ASC LIMIT ?`,
                    [tenantId, cursorSince, cursorSince, cursorSince, cursorSince, limit],
                    tenantId
                ),
            fillTo: (cursorSince, boundary) =>
                queryWithTenant<ProductDeltaRow>(
                    `${deltaSelect} ${deltaFrom} AND ${changedAt} <= ? ORDER BY updatedAt ASC, s.id ASC`,
                    [tenantId, cursorSince, cursorSince, cursorSince, cursorSince, boundary],
                    tenantId
                ),
            hasAfter: async (cursorSince, boundary) => {
                const probeRows = await queryWithTenant<{ hasMoreRow: number }>(
                    `SELECT 1 AS hasMoreRow ${deltaFrom} AND ${changedAt} > ? LIMIT 1`,
                    [tenantId, cursorSince, cursorSince, cursorSince, cursorSince, boundary],
                    tenantId
                );
                return probeRows.length > 0;
            },
            changedAtOf: (row) => row.updatedAt,
        }
    );

    const changes: SyncDeltaResponse<ProductDeltaData>["changes"] = rows.map((row) => {
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
 * @param page 页码 —— 兼容参数：仅校验，不参与取数（游标模式）
 * @param pageSize 每页大小
 */
export async function getInventoryDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<InventoryDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    normalizePage(page);

    const deltaSelect = `SELECT
       ib.store_id AS storeId, ib.sku_id AS skuId, ib.stock_type AS stockType,
       ib.physical_qty AS physicalQty, ib.locked_qty AS lockedQty, ib.available_qty AS availableQty,
       ib.updated_at AS updatedAt,
       s.sku_name AS skuName`;
    const deltaFrom = `FROM t_inventory_balance ib
     LEFT JOIN t_product_sku s ON s.id = ib.sku_id AND s.tenant_id = ib.tenant_id
     WHERE ib.tenant_id = ? AND ib.updated_at > ?`;

    // 游标取数：page 不参与；ORDER BY 补 id 次级键；同 updated_at 整组不拆页；hasMore 由探针实测
    const { rows, until, hasMore } = await fetchDeltaCursorPage<InventoryDeltaRow>(
        safeSince,
        safePageSize,
        {
            probe: (cursorSince, limit) =>
                queryWithTenant<InventoryDeltaRow>(
                    `${deltaSelect} ${deltaFrom} ORDER BY ib.updated_at ASC, ib.id ASC LIMIT ?`,
                    [tenantId, cursorSince, limit],
                    tenantId
                ),
            fillTo: (cursorSince, boundary) =>
                queryWithTenant<InventoryDeltaRow>(
                    `${deltaSelect} ${deltaFrom} AND ib.updated_at <= ? ORDER BY ib.updated_at ASC, ib.id ASC`,
                    [tenantId, cursorSince, boundary],
                    tenantId
                ),
            hasAfter: async (cursorSince, boundary) => {
                const probeRows = await queryWithTenant<{ hasMoreRow: number }>(
                    `SELECT 1 AS hasMoreRow ${deltaFrom} AND ib.updated_at > ? LIMIT 1`,
                    [tenantId, cursorSince, boundary],
                    tenantId
                );
                return probeRows.length > 0;
            },
            changedAtOf: (row) => row.updatedAt,
        }
    );

    const changes: SyncDeltaResponse<InventoryDeltaData>["changes"] = rows.map((row) => ({
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
 * @param page 页码 —— 兼容参数：仅校验，不参与取数（游标模式）
 * @param pageSize 每页大小
 */
export async function getMemberDelta(
    since: string,
    tenantId: string,
    page: number = 1,
    pageSize: number = 100
): Promise<SyncDeltaResponse<MemberDeltaData>> {
    const safeSince = since || "1970-01-01T00:00:00Z";
    const safePageSize = Math.max(1, Math.min(500, Number(pageSize) || 100));
    normalizePage(page);

    const deltaSelect = `SELECT
       id AS memberId, name, mobile, customer_type AS customerType,
       settlement_type AS settlementType, points, level_code AS levelCode,
       status, updated_at AS updatedAt`;
    const deltaFrom = `FROM t_member
     WHERE tenant_id = ? AND updated_at > ?`;

    // 游标取数：page 不参与；ORDER BY 补 id 次级键；同 updated_at 整组不拆页；hasMore 由探针实测
    const { rows, until, hasMore } = await fetchDeltaCursorPage<MemberDeltaRow>(
        safeSince,
        safePageSize,
        {
            probe: (cursorSince, limit) =>
                queryWithTenant<MemberDeltaRow>(
                    `${deltaSelect} ${deltaFrom} ORDER BY updated_at ASC, id ASC LIMIT ?`,
                    [tenantId, cursorSince, limit],
                    tenantId
                ),
            fillTo: (cursorSince, boundary) =>
                queryWithTenant<MemberDeltaRow>(
                    `${deltaSelect} ${deltaFrom} AND updated_at <= ? ORDER BY updated_at ASC, id ASC`,
                    [tenantId, cursorSince, boundary],
                    tenantId
                ),
            hasAfter: async (cursorSince, boundary) => {
                const probeRows = await queryWithTenant<{ hasMoreRow: number }>(
                    `SELECT 1 AS hasMoreRow ${deltaFrom} AND updated_at > ? LIMIT 1`,
                    [tenantId, cursorSince, boundary],
                    tenantId
                );
                return probeRows.length > 0;
            },
            changedAtOf: (row) => row.updatedAt,
        }
    );

    const changes: SyncDeltaResponse<MemberDeltaData>["changes"] = rows.map((row) => {
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

    return { since: safeSince, until, hasMore, changes };
}

// ==================== 4. 离线销售单批量提交 ====================

/**
 * 批量提交离线销售单
 *
 *  - 逐条处理，单条失败不影响其他订单（错误隔离）
 *  - 单条订单使用事务保证原子性（sale_bill + sale_bill_item 同时成功或同时回滚）
 *  - 通过 draftNo 唯一性实现幂等：重复 draftNo 返回 success=true + 既有 billNo（幂等成功）
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
            const existing = await queryOneWithTenant<SaleBillDraftRow>(
                "SELECT bill_no AS billNo FROM t_sale_bill WHERE bill_no = ? AND tenant_id = ?",
                [order.draftNo, tenantId],
                tenantId
            );
            if (existing) {
                // 幂等成功：同一 draftNo 已落库（含"已写库但响应丢失"的重试场景），
                // 返回既有单号并记为成功，避免客户端把它标成 SYNC_FAILED 后无限重试。
                results.push({ draftNo: order.draftNo, success: true, billNo: String(existing.billNo) });
                successCount++;
                continue;
            }

            // 事务保证 sale_bill + sale_bill_item 原子性
            const billNo = await transaction(async (conn) => {
                // 查询客户信息（如提供 customerId）
                let customerName = order.customerName ?? null;
                let customerMobile = order.customerMobile ?? null;
                let customerType = "RETAIL";
                let customerId: number | null = null;
                if (order.customerId) {
                    const [memberRows] = await conn.query<MemberSyncRow[]>(
                        "SELECT id, name, mobile, customer_type FROM t_member WHERE id = ? AND tenant_id = ?",
                        [order.customerId, tenantId]
                    );
                    const member = memberRows?.[0];
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
               unit_price, price_type, subtotal_amount, tenant_id
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                            tenantId,
                        ]
                    );
                }

                return order.draftNo;
            });

            results.push({ draftNo: order.draftNo, success: true, billNo });
            successCount++;
        } catch (err: unknown) {
            // 错误隔离：单条失败不影响其他订单
            const errorMsg = err instanceof Error ? err.message : String(err);
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
