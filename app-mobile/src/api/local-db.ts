/**
 * 本地数据库业务层 — 4 个业务 Db 类 + SyncWatermarkDb
 *
 * 提供 5 个业务 Db 类，封装 SQLite 操作层，对齐 R51 方案 1.3 节：
 *  - LocalProductDb     商品 SKU（含价格/库存冗余）的 CRUD + 增量变更应用
 *  - LocalMemberDb      客户的 CRUD + 增量变更应用
 *  - LocalSaleDraftDb   销售单草稿的创建/状态更新/待同步查询
 *  - LocalInventoryDb   库存快照的 CRUD + 增量变更应用
 *  - SyncWatermarkDb    同步水位（4 个 since 字段）的读取/更新
 *
 * 数据结构对齐阿坚后端 delta-sync.service.ts：
 *  - ProductDeltaData / InventoryDeltaData / MemberDeltaData
 *  - SyncDeltaResponse.changes[].action: UPSERT / DELETE / STATUS_CHANGE
 *
 * @author 阿澈
 */

import { execute, query, transaction } from '@/native/sqlite'

// ====================== 类型定义（对齐后端 delta-sync.service.ts） ======================

/**
 * 商品增量数据 — 对齐后端 ProductDeltaData
 */
export interface ProductDeltaData {
    skuId: number
    spuId: number
    skuCode: string
    barcode: string | null
    skuName: string
    volume: string | null
    packaging: string | null
    baseUnit: string
    boxUnit: string
    boxRatio: number
    temperature: string
    traceEnabled: number
    status: number
    spuName: string
    categoryId: number
    categoryName: string | null
    brandName: string | null
    mainImage: string | null
    retailPrice: number
    wholesalePrice: number | null
    costPrice: number
    miniappPrice: number | null
    storePrice: number | null
    availableQty: number
    warningThreshold: number
    updatedAt: string
}

/**
 * 库存增量数据 — 对齐后端 InventoryDeltaData
 */
export interface InventoryDeltaData {
    storeId: number
    skuId: number
    skuName: string | null
    stockType: string
    physicalQty: number
    lockedQty: number
    availableQty: number
    updatedAt: string
}

/**
 * 客户增量数据 — 对齐后端 MemberDeltaData
 */
export interface MemberDeltaData {
    memberId: number
    name: string | null
    mobile: string
    customerType: string
    settlementType: string
    points: number
    levelCode: string | null
    status: number
    updatedAt: string
}

/**
 * 变更动作类型 — 对齐后端 SyncDeltaResponse.changes[].action
 */
export type DeltaAction = 'UPSERT' | 'DELETE' | 'STATUS_CHANGE'

/**
 * 通用增量变更条目
 */
export interface DeltaChange<T> {
    action: DeltaAction
    skuId: number
    spuId: number
    data?: T
}

// ====================== 销售单草稿类型 ======================

/** 销售单草稿状态 */
export type DraftStatus = 'DRAFT' | 'PENDING_SYNC' | 'SYNCED' | 'SYNC_FAILED'

/**
 * 销售单草稿明细（与后端 OfflineOrderItem 对齐）
 */
export interface SaleDraftItem {
    skuId: number
    skuName: string
    boxQty: number
    bottleQty: number
    totalBottleQty: number
    unitPrice: number
    priceType: string
    subtotalAmount: number
}

/**
 * 销售单草稿创建参数
 */
export interface SaleDraftCreateInput {
    draftNo: string
    customerName?: string
    customerMobile?: string
    customerId?: number
    items: SaleDraftItem[]
    totalAmount: number
    remark?: string
    status?: DraftStatus
    tenantId: string
}

/**
 * 销售单草稿查询结果（数据库行映射）
 */
export interface SaleDraftRecord {
    id: number
    draftNo: string
    customerName: string | null
    customerMobile: string | null
    customerId: number | null
    itemsJson: string
    totalAmount: number
    remark: string | null
    status: DraftStatus
    createdAt: string
    syncedAt: string | null
    errorMsg: string | null
    tenantId: string
}

// ====================== 同步水位类型 ======================

/**
 * 同步水位记录（单行，id 固定为 1）
 */
export interface SyncWatermarkRecord {
    id: number
    productSince: string
    priceSince: string
    inventorySince: string
    memberSince: string
    lastFullSync: string | null
}

/** 同步水位可更新字段 */
export type WatermarkField = 'product_since' | 'price_since' | 'inventory_since' | 'member_since' | 'last_full_sync'

// ====================== 工具函数 ======================

/**
 * 将 ISO 时间字符串转为本地图表存储格式（保留 ISO 8601）
 */
function toLocalTimestamp(iso: string | null | undefined): string {
    if (!iso) return new Date().toISOString()
    return iso
}

// ====================== 1. LocalProductDb ======================

/**
 * 本地商品 SKU 数据库操作类
 *
 * 表：local_product_sku
 * UNIQUE: (sku_id, tenant_id)
 */
export class LocalProductDb {
    /**
     * 按条码查询商品（扫码场景）
     *
     * 对齐后端 product.service.ts 的 s.barcode LIKE ? 搜索
     *
     * @param barcode  商品条码
     * @param tenantId 租户 ID
     * @returns 商品信息，未找到返回 null
     */
    static async findByBarcode(barcode: string, tenantId: string): Promise<ProductDeltaData | null> {
        if (!barcode || !tenantId) return null
        const rows = await query<LocalProductRow>(
            `SELECT * FROM local_product_sku WHERE barcode = ? AND tenant_id = ? AND status = 1 LIMIT 1`,
            [barcode, tenantId]
        )
        return rows.length > 0 ? mapRowToProduct(rows[0]) : null
    }

    /**
     * 关键词搜索商品（名称/skuCode/barcode 模糊匹配）
     *
     * @param keyword  关键词
     * @param tenantId 租户 ID
     * @param page     页码（从 1 开始）
     * @param pageSize 每页大小
     * @returns 商品列表 + 总数
     */
    static async search(
        keyword: string,
        tenantId: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<{ list: ProductDeltaData[]; total: number }> {
        const safePage = Math.max(1, Number(page) || 1)
        const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20))
        const offset = (safePage - 1) * safePageSize
        const likeKeyword = `%${keyword || ''}%`

        const countRows = await query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM local_product_sku
             WHERE tenant_id = ? AND status = 1
             AND (sku_name LIKE ? OR sku_code LIKE ? OR barcode LIKE ? OR spu_name LIKE ?)`,
            [tenantId, likeKeyword, likeKeyword, likeKeyword, likeKeyword]
        )
        const total = Number(countRows[0]?.total ?? 0)

        const rows = await query<LocalProductRow>(
            `SELECT * FROM local_product_sku
             WHERE tenant_id = ? AND status = 1
             AND (sku_name LIKE ? OR sku_code LIKE ? OR barcode LIKE ? OR spu_name LIKE ?)
             ORDER BY sku_name ASC
             LIMIT ? OFFSET ?`,
            [tenantId, likeKeyword, likeKeyword, likeKeyword, likeKeyword, safePageSize, offset]
        )
        return {
            list: rows.map(mapRowToProduct),
            total,
        }
    }

    /**
     * 批量插入/更新商品（用于首次全量同步或批量同步）
     *
     * 使用 INSERT OR REPLACE 语义，UNIQUE(sku_id, tenant_id) 冲突时替换。
     *
     * @param items    商品增量数据列表
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async bulkUpsert(items: ProductDeltaData[], tenantId: string): Promise<number> {
        if (!items || items.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const item of items) {
                await tx.execute(
                    `INSERT OR REPLACE INTO local_product_sku (
              id, sku_id, spu_id, sku_code, barcode, sku_name, volume, packaging,
              base_unit, box_unit, box_ratio, temperature, trace_enabled, status,
              spu_name, category_id, category_name, brand_name, main_image,
              retail_price, wholesale_price, cost_price, miniapp_price, store_price,
              available_qty, warning_threshold, server_updated_at, local_updated_at, is_dirty, tenant_id
            ) VALUES (
              (SELECT id FROM local_product_sku WHERE sku_id = ? AND tenant_id = ?),
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?, datetime('now'), 0, ?
            )`,
                    [
                        item.skuId, tenantId,
                        item.skuId, item.spuId, item.skuCode, item.barcode, item.skuName, item.volume,
                        item.baseUnit, item.boxUnit, item.boxRatio, item.temperature, item.traceEnabled, item.status,
                        item.spuName, item.categoryId, item.categoryName, item.brandName, item.mainImage,
                        item.retailPrice, item.wholesalePrice ?? 0, item.costPrice, item.miniappPrice ?? 0, item.storePrice ?? 0,
                        item.availableQty, item.warningThreshold, item.updatedAt, tenantId,
                    ]
                )
                count++
            }
        })
        return count
    }

    /**
     * 应用增量变更（来自后端 /api/sync/products/delta）
     *
     * 根据 action 处理：
     *  - UPSERT:        bulkUpsert 单条
     *  - DELETE:        DELETE FROM local_product_sku WHERE sku_id = ? AND tenant_id = ?
     *  - STATUS_CHANGE: UPDATE local_product_sku SET status = ?, server_updated_at = ? WHERE sku_id = ? AND tenant_id = ?
     *
     * @param changes  增量变更列表
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async applyDelta(changes: DeltaChange<ProductDeltaData>[], tenantId: string): Promise<number> {
        if (!changes || changes.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const change of changes) {
                if (change.action === 'DELETE') {
                    await tx.execute(
                        `DELETE FROM local_product_sku WHERE sku_id = ? AND tenant_id = ?`,
                        [change.skuId, tenantId]
                    )
                } else if (change.action === 'STATUS_CHANGE' && change.data) {
                    await tx.execute(
                        `UPDATE local_product_sku SET status = ?, server_updated_at = ?, local_updated_at = datetime('now') WHERE sku_id = ? AND tenant_id = ?`,
                        [change.data.status, change.data.updatedAt, change.skuId, tenantId]
                    )
                } else if (change.action === 'UPSERT' && change.data) {
                    const item = change.data
                    await tx.execute(
                        `INSERT OR REPLACE INTO local_product_sku (
                  id, sku_id, spu_id, sku_code, barcode, sku_name, volume, packaging,
                  base_unit, box_unit, box_ratio, temperature, trace_enabled, status,
                  spu_name, category_id, category_name, brand_name, main_image,
                  retail_price, wholesale_price, cost_price, miniapp_price, store_price,
                  available_qty, warning_threshold, server_updated_at, local_updated_at, is_dirty, tenant_id
                ) VALUES (
                  (SELECT id FROM local_product_sku WHERE sku_id = ? AND tenant_id = ?),
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, datetime('now'), 0, ?
                )`,
                        [
                            item.skuId, tenantId,
                            item.skuId, item.spuId, item.skuCode, item.barcode, item.skuName, item.volume,
                            item.baseUnit, item.boxUnit, item.boxRatio, item.temperature, item.traceEnabled, item.status,
                            item.spuName, item.categoryId, item.categoryName, item.brandName, item.mainImage,
                            item.retailPrice, item.wholesalePrice ?? 0, item.costPrice, item.miniappPrice ?? 0, item.storePrice ?? 0,
                            item.availableQty, item.warningThreshold, item.updatedAt, tenantId,
                        ]
                    )
                }
                count++
            }
        })
        return count
    }

    /**
     * 查询本地库存（用于离线开单校验库存）
     *
     * @param skuId    SKU ID
     * @param tenantId 租户 ID
     * @returns 本地可用库存数量（无记录返回 0）
     */
    static async getStock(skuId: number, tenantId: string): Promise<number> {
        if (!skuId || !tenantId) return 0
        const rows = await query<{ available_qty: number }>(
            `SELECT available_qty FROM local_product_sku WHERE sku_id = ? AND tenant_id = ? LIMIT 1`,
            [skuId, tenantId]
        )
        return rows.length > 0 ? Number(rows[0].available_qty ?? 0) : 0
    }
}

/** 本地商品行类型（snake_case，对应数据库字段） */
interface LocalProductRow {
    id: number
    sku_id: number
    spu_id: number
    sku_code: string | null
    barcode: string | null
    sku_name: string
    volume: string | null
    packaging: string | null
    base_unit: string
    box_unit: string
    box_ratio: number
    temperature: string
    trace_enabled: number
    status: number
    spu_name: string | null
    category_id: number | null
    category_name: string | null
    brand_name: string | null
    main_image: string | null
    retail_price: number
    wholesale_price: number
    cost_price: number
    miniapp_price: number
    store_price: number
    available_qty: number
    warning_threshold: number
    server_updated_at: string | null
    local_updated_at: string | null
    is_dirty: number
    tenant_id: string
}

/** 数据库行 → ProductDeltaData 映射 */
function mapRowToProduct(row: LocalProductRow): ProductDeltaData {
    return {
        skuId: Number(row.sku_id),
        spuId: Number(row.spu_id),
        skuCode: String(row.sku_code ?? ''),
        barcode: row.barcode ?? null,
        skuName: String(row.sku_name ?? ''),
        volume: row.volume ?? null,
        packaging: row.packaging ?? null,
        baseUnit: String(row.base_unit ?? '瓶'),
        boxUnit: String(row.box_unit ?? '箱'),
        boxRatio: Number(row.box_ratio ?? 1),
        temperature: String(row.temperature ?? 'NORMAL'),
        traceEnabled: Number(row.trace_enabled ?? 0),
        status: Number(row.status ?? 1),
        spuName: String(row.spu_name ?? ''),
        categoryId: Number(row.category_id ?? 0),
        categoryName: row.category_name ?? null,
        brandName: row.brand_name ?? null,
        mainImage: row.main_image ?? null,
        retailPrice: Number(row.retail_price ?? 0),
        wholesalePrice: row.wholesale_price ?? null,
        costPrice: Number(row.cost_price ?? 0),
        miniappPrice: row.miniapp_price ?? null,
        storePrice: row.store_price ?? null,
        availableQty: Number(row.available_qty ?? 0),
        warningThreshold: Number(row.warning_threshold ?? 0),
        updatedAt: row.server_updated_at ?? row.local_updated_at ?? '',
    }
}

// ====================== 2. LocalMemberDb ======================

/**
 * 本地客户数据库操作类
 *
 * 表：local_member
 * UNIQUE: member_id
 */
export class LocalMemberDb {
    /**
     * 按手机号查询客户
     *
     * @param phone    手机号
     * @param tenantId 租户 ID
     * @returns 客户信息，未找到返回 null
     */
    static async findByPhone(phone: string, tenantId: string): Promise<MemberDeltaData | null> {
        if (!phone || !tenantId) return null
        const rows = await query<LocalMemberRow>(
            `SELECT * FROM local_member WHERE phone = ? AND tenant_id = ? AND status = 1 LIMIT 1`,
            [phone, tenantId]
        )
        return rows.length > 0 ? mapRowToMember(rows[0]) : null
    }

    /**
     * 关键词搜索客户（名称/手机号模糊匹配）
     *
     * @param keyword  关键词
     * @param tenantId 租户 ID
     * @param page     页码
     * @param pageSize 每页大小
     */
    static async search(
        keyword: string,
        tenantId: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<{ list: MemberDeltaData[]; total: number }> {
        const safePage = Math.max(1, Number(page) || 1)
        const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20))
        const offset = (safePage - 1) * safePageSize
        const likeKeyword = `%${keyword || ''}%`

        const countRows = await query<{ total: number }>(
            `SELECT COUNT(*) AS total FROM local_member
             WHERE tenant_id = ? AND status = 1
             AND (name LIKE ? OR phone LIKE ?)`,
            [tenantId, likeKeyword, likeKeyword]
        )
        const total = Number(countRows[0]?.total ?? 0)

        const rows = await query<LocalMemberRow>(
            `SELECT * FROM local_member
             WHERE tenant_id = ? AND status = 1
             AND (name LIKE ? OR phone LIKE ?)
             ORDER BY name ASC
             LIMIT ? OFFSET ?`,
            [tenantId, likeKeyword, likeKeyword, safePageSize, offset]
        )
        return {
            list: rows.map(mapRowToMember),
            total,
        }
    }

    /**
     * 批量插入/更新客户
     *
     * @param items    客户增量数据
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async bulkUpsert(items: MemberDeltaData[], tenantId: string): Promise<number> {
        if (!items || items.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const item of items) {
                await tx.execute(
                    `INSERT OR REPLACE INTO local_member (
              id, member_id, name, phone, customer_type, address, remark,
              level_code, debt_amount, status, local_updated_at, is_dirty, tenant_id
            ) VALUES (
              (SELECT id FROM local_member WHERE member_id = ?),
              ?, ?, ?, ?, NULL, NULL,
              ?, 0, ?, datetime('now'), 0, ?
            )`,
                    [
                        item.memberId,
                        item.memberId, item.name, item.mobile, item.customerType,
                        item.levelCode, item.status, tenantId,
                    ]
                )
                count++
            }
        })
        return count
    }

    /**
     * 应用增量变更
     *
     * @param changes  增量变更列表
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async applyDelta(changes: DeltaChange<MemberDeltaData>[], tenantId: string): Promise<number> {
        if (!changes || changes.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const change of changes) {
                // 客户场景下 change.skuId 实际是 memberId（后端复用字段，对齐 delta-sync.service.ts）
                const memberId = Number(change.skuId ?? change.data?.memberId ?? 0)
                if (change.action === 'DELETE') {
                    await tx.execute(
                        `DELETE FROM local_member WHERE member_id = ?`,
                        [memberId]
                    )
                } else if (change.action === 'STATUS_CHANGE' && change.data) {
                    await tx.execute(
                        `UPDATE local_member SET status = ?, level_code = ?, local_updated_at = datetime('now') WHERE member_id = ?`,
                        [change.data.status, change.data.levelCode, memberId]
                    )
                } else if (change.action === 'UPSERT' && change.data) {
                    const item = change.data
                    await tx.execute(
                        `INSERT OR REPLACE INTO local_member (
                  id, member_id, name, phone, customer_type, address, remark,
                  level_code, debt_amount, status, local_updated_at, is_dirty, tenant_id
                ) VALUES (
                  (SELECT id FROM local_member WHERE member_id = ?),
                  ?, ?, ?, ?, NULL, NULL,
                  ?, 0, ?, datetime('now'), 0, ?
                )`,
                        [
                            item.memberId,
                            item.memberId, item.name, item.mobile, item.customerType,
                            item.levelCode, item.status, tenantId,
                        ]
                    )
                }
                count++
            }
        })
        return count
    }
}

/** 本地客户行类型 */
interface LocalMemberRow {
    id: number
    member_id: number
    name: string | null
    phone: string | null
    customer_type: string
    address: string | null
    remark: string | null
    level_code: string | null
    debt_amount: number
    status: number
    local_updated_at: string | null
    is_dirty: number
    tenant_id: string
}

/** 数据库行 → MemberDeltaData 映射 */
function mapRowToMember(row: LocalMemberRow): MemberDeltaData {
    return {
        memberId: Number(row.member_id),
        name: row.name ?? null,
        mobile: String(row.phone ?? ''),
        customerType: String(row.customer_type ?? 'RETAIL'),
        settlementType: 'CASH', // 本地表未存储，默认 CASH
        points: 0, // 本地表未存储，默认 0
        levelCode: row.level_code ?? null,
        status: Number(row.status ?? 1),
        updatedAt: row.local_updated_at ?? '',
    }
}

// ====================== 3. LocalSaleDraftDb ======================

/**
 * 本地销售单草稿数据库操作类
 *
 * 表：local_sale_draft
 * UNIQUE: draft_no
 *
 * 状态流转：
 *  DRAFT        → 用户开单中
 *  PENDING_SYNC → 用户提交，等待网络同步
 *  SYNCED       → 服务端落库成功
 *  SYNC_FAILED  → 服务端返回错误（errorMsg 记录原因）
 */
export class LocalSaleDraftDb {
    /**
     * 创建草稿（默认 status=DRAFT）
     *
     * @param draft 草稿创建参数
     * @returns 创建的草稿 ID
     */
    static async create(draft: SaleDraftCreateInput): Promise<number> {
        const itemsJson = JSON.stringify(draft.items)
        const status: DraftStatus = draft.status ?? 'DRAFT'
        const result = await query<{ id: number }>(
            `INSERT INTO local_sale_draft (
        draft_no, customer_name, customer_mobile, customer_id, items_json,
        total_amount, remark, status, created_at, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?) RETURNING id`,
            [
                draft.draftNo,
                draft.customerName ?? null,
                draft.customerMobile ?? null,
                draft.customerId ?? null,
                itemsJson,
                draft.totalAmount,
                draft.remark ?? null,
                status,
                draft.tenantId,
            ]
        )
        // H5 内存实现支持 RETURNING；原生 SQLite 不支持时回退为查询
        if (result.length > 0 && result[0].id) {
            return Number(result[0].id)
        }
        // 回退方案：查最新插入的
        const fallback = await query<{ id: number }>(
            `SELECT id FROM local_sale_draft WHERE draft_no = ? AND tenant_id = ? LIMIT 1`,
            [draft.draftNo, draft.tenantId]
        )
        return fallback.length > 0 ? Number(fallback[0].id) : 0
    }

    /**
     * 更新草稿状态
     *
     * @param draftNo  草稿单号
     * @param status   新状态
     * @param errorMsg 错误信息（SYNC_FAILED 时填写）
     * @param tenantId 租户 ID
     */
    static async updateStatus(
        draftNo: string,
        status: DraftStatus,
        errorMsg?: string,
        tenantId?: string
    ): Promise<void> {
        const syncedAt = status === 'SYNCED' ? "datetime('now')" : 'NULL'
        const params: Array<string | number | null> = []
        let sql = `UPDATE local_sale_draft SET status = ?`
        params.push(status)
        if (status === 'SYNCED') {
            sql += `, synced_at = datetime('now')`
        } else if (status === 'SYNC_FAILED') {
            sql += `, error_msg = ?`
            params.push(errorMsg ?? null)
        } else if (status === 'PENDING_SYNC') {
            // 重置错误信息
            sql += `, error_msg = NULL`
        }
        sql += ` WHERE draft_no = ?`
        params.push(draftNo)
        if (tenantId) {
            sql += ` AND tenant_id = ?`
            params.push(tenantId)
        }
        // syncedAt 占位（已通过 SQL 字面量处理）
        void syncedAt
        await execute(sql, params)
    }

    /**
     * 查询待同步草稿（status=PENDING_SYNC 或 SYNC_FAILED）
     *
     * @param tenantId 租户 ID（可选，不传则查询所有租户）
     * @returns 草稿列表
     */
    static async listPending(tenantId?: string): Promise<SaleDraftRecord[]> {
        const params: Array<string> = []
        let sql = `SELECT * FROM local_sale_draft WHERE status IN ('PENDING_SYNC', 'SYNC_FAILED')`
        if (tenantId) {
            sql += ` AND tenant_id = ?`
            params.push(tenantId)
        }
        sql += ` ORDER BY created_at ASC`
        const rows = await query<LocalSaleDraftRow>(sql, params)
        return rows.map(mapRowToDraft)
    }

    /**
     * 按草稿单号查询
     *
     * @param draftNo 草稿单号
     * @returns 草稿记录，未找到返回 null
     */
    static async getByDraftNo(draftNo: string): Promise<SaleDraftRecord | null> {
        const rows = await query<LocalSaleDraftRow>(
            `SELECT * FROM local_sale_draft WHERE draft_no = ? LIMIT 1`,
            [draftNo]
        )
        return rows.length > 0 ? mapRowToDraft(rows[0]) : null
    }

    /**
     * 查询 DRAFT 状态草稿（用户未提交的草稿）
     *
     * @param tenantId 租户 ID（可选）
     * @returns 草稿列表
     */
    static async listDraft(tenantId?: string): Promise<SaleDraftRecord[]> {
        const params: Array<string> = []
        let sql = `SELECT * FROM local_sale_draft WHERE status = 'DRAFT'`
        if (tenantId) {
            sql += ` AND tenant_id = ?`
            params.push(tenantId)
        }
        sql += ` ORDER BY created_at DESC`
        const rows = await query<LocalSaleDraftRow>(sql, params)
        return rows.map(mapRowToDraft)
    }

    /**
     * 删除草稿（用户主动取消）
     *
     * @param draftNo 草稿单号
     */
    static async delete(draftNo: string): Promise<void> {
        await execute(`DELETE FROM local_sale_draft WHERE draft_no = ?`, [draftNo])
    }
}

/** 本地销售单草稿行类型 */
interface LocalSaleDraftRow {
    id: number
    draft_no: string
    customer_name: string | null
    customer_mobile: string | null
    customer_id: number | null
    items_json: string
    total_amount: number
    remark: string | null
    status: string
    created_at: string
    synced_at: string | null
    error_msg: string | null
    tenant_id: string
}

/** 数据库行 → SaleDraftRecord 映射 */
function mapRowToDraft(row: LocalSaleDraftRow): SaleDraftRecord {
    return {
        id: Number(row.id),
        draftNo: String(row.draft_no),
        customerName: row.customer_name,
        customerMobile: row.customer_mobile,
        customerId: row.customer_id,
        itemsJson: String(row.items_json),
        totalAmount: Number(row.total_amount ?? 0),
        remark: row.remark,
        status: row.status as DraftStatus,
        createdAt: row.created_at,
        syncedAt: row.synced_at,
        errorMsg: row.error_msg,
        tenantId: row.tenant_id,
    }
}

// ====================== 4. LocalInventoryDb ======================

/**
 * 本地库存快照数据库操作类
 *
 * 表：local_inventory_snapshot
 * UNIQUE: sku_id
 */
export class LocalInventoryDb {
    /**
     * 查询库存快照
     *
     * @param skuId SKU ID
     * @returns 库存快照，未找到返回 null
     */
    static async getSnapshot(skuId: number): Promise<InventoryDeltaData | null> {
        if (!skuId) return null
        const rows = await query<LocalInventoryRow>(
            `SELECT * FROM local_inventory_snapshot WHERE sku_id = ? LIMIT 1`,
            [skuId]
        )
        return rows.length > 0 ? mapRowToInventory(rows[0]) : null
    }

    /**
     * 批量插入/更新库存快照
     *
     * @param items    库存增量数据
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async bulkUpsert(items: InventoryDeltaData[], tenantId: string): Promise<number> {
        if (!items || items.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const item of items) {
                await tx.execute(
                    `INSERT OR REPLACE INTO local_inventory_snapshot (
              id, sku_id, available_qty, stock_type, store_id, synced_at, tenant_id
            ) VALUES (
              (SELECT id FROM local_inventory_snapshot WHERE sku_id = ?),
              ?, ?, ?, ?, ?, ?
            )`,
                    [
                        item.skuId,
                        item.skuId, item.availableQty, item.stockType, item.storeId || 0,
                        toLocalTimestamp(item.updatedAt), tenantId,
                    ]
                )
                count++
            }
        })
        return count
    }

    /**
     * 应用增量变更
     *
     * 库存场景 action 通常为 UPSERT（后端不支持库存 DELETE）
     *
     * @param changes  增量变更列表
     * @param tenantId 租户 ID
     * @returns 处理条数
     */
    static async applyDelta(changes: DeltaChange<InventoryDeltaData>[], tenantId: string): Promise<number> {
        if (!changes || changes.length === 0) return 0
        let count = 0
        await transaction(async (tx) => {
            for (const change of changes) {
                if (change.action === 'DELETE') {
                    await tx.execute(
                        `DELETE FROM local_inventory_snapshot WHERE sku_id = ?`,
                        [change.skuId]
                    )
                } else if (change.data) {
                    const item = change.data
                    await tx.execute(
                        `INSERT OR REPLACE INTO local_inventory_snapshot (
                  id, sku_id, available_qty, stock_type, store_id, synced_at, tenant_id
                ) VALUES (
                  (SELECT id FROM local_inventory_snapshot WHERE sku_id = ?),
                  ?, ?, ?, ?, ?, ?
                )`,
                        [
                            item.skuId,
                            item.skuId, item.availableQty, item.stockType, item.storeId || 0,
                            toLocalTimestamp(item.updatedAt), tenantId,
                        ]
                    )
                }
                count++
            }
        })
        return count
    }
}

/** 本地库存快照行类型 */
interface LocalInventoryRow {
    id: number
    sku_id: number
    available_qty: number
    stock_type: string
    store_id: number | null
    synced_at: string
    tenant_id: string
}

/** 数据库行 → InventoryDeltaData 映射 */
function mapRowToInventory(row: LocalInventoryRow): InventoryDeltaData {
    return {
        storeId: Number(row.store_id ?? 0),
        skuId: Number(row.sku_id),
        skuName: null,
        stockType: String(row.stock_type ?? 'OFFLINE'),
        physicalQty: Number(row.available_qty ?? 0),
        lockedQty: 0,
        availableQty: Number(row.available_qty ?? 0),
        updatedAt: row.synced_at ?? '',
    }
}

// ====================== 5. SyncWatermarkDb ======================

/**
 * 同步水位数据库操作类
 *
 * 表：sync_watermark（单行记录，id 固定为 1）
 * 维护 4 个 since 字段 + last_full_sync
 */
export class SyncWatermarkDb {
    /**
     * 获取当前水位
     *
     * @returns 水位记录（无记录时返回默认值）
     */
    static async get(): Promise<SyncWatermarkRecord> {
        const rows = await query<SyncWatermarkRowDb>(
            `SELECT * FROM sync_watermark WHERE id = 1 LIMIT 1`
        )
        if (rows.length === 0) {
            return {
                id: 1,
                productSince: '1970-01-01T00:00:00Z',
                priceSince: '1970-01-01T00:00:00Z',
                inventorySince: '1970-01-01T00:00:00Z',
                memberSince: '1970-01-01T00:00:00Z',
                lastFullSync: null,
            }
        }
        const r = rows[0]
        return {
            id: Number(r.id),
            productSince: String(r.product_since ?? '1970-01-01T00:00:00Z'),
            priceSince: String(r.price_since ?? '1970-01-01T00:00:00Z'),
            inventorySince: String(r.inventory_since ?? '1970-01-01T00:00:00Z'),
            memberSince: String(r.member_since ?? '1970-01-01T00:00:00Z'),
            lastFullSync: r.last_full_sync ?? null,
        }
    }

    /**
     * 更新某个水位字段
     *
     * @param field 字段名（product_since / price_since / inventory_since / member_since / last_full_sync）
     * @param since 时间戳（ISO 8601）
     */
    static async update(field: WatermarkField, since: string): Promise<void> {
        if (!field) return
        // 字段白名单校验
        const allowedFields: WatermarkField[] = [
            'product_since', 'price_since', 'inventory_since', 'member_since', 'last_full_sync',
        ]
        if (!allowedFields.includes(field)) {
            throw new Error(`非法水位字段: ${field}`)
        }
        await execute(
            `UPDATE sync_watermark SET ${field} = ? WHERE id = 1`,
            [since]
        )
    }

    /**
     * 批量更新水位（一次更新多个字段，原子操作）
     *
     * @param updates 字段 → 值映射
     */
    static async updateBatch(updates: Partial<Record<WatermarkField, string>>): Promise<void> {
        const allowedFields: WatermarkField[] = [
            'product_since', 'price_since', 'inventory_since', 'member_since', 'last_full_sync',
        ]
        const entries = Object.entries(updates).filter(
            ([k, v]) => allowedFields.includes(k as WatermarkField) && v !== undefined && v !== null
        ) as Array<[WatermarkField, string]>
        if (entries.length === 0) return

        await transaction(async (tx) => {
            for (const [field, value] of entries) {
                await tx.execute(
                    `UPDATE sync_watermark SET ${field} = ? WHERE id = 1`,
                    [value]
                )
            }
        })
    }
}

/** 同步水位行类型 */
interface SyncWatermarkRowDb {
    id: number
    product_since: string
    price_since: string
    inventory_since: string
    member_since: string
    last_full_sync: string | null
}

// ====================== 导出 ======================

export {
    toLocalTimestamp,
}
