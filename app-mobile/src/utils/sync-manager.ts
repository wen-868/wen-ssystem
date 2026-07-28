/**
 * 同步流程管理器 — 实现 R51 方案 1.3 节离线同步流程
 *
 * 核心功能：
 *  1. syncAll()              — 全量增量同步（商品/库存/客户），并提交待同步草稿
 *  2. submitPendingDrafts()  — 提交待同步草稿（status=PENDING_SYNC 或 SYNC_FAILED）
 *  3. onAppLaunch()          — App 启动时触发同步（检测网络状态）
 *  4. onNetworkResume()      — 网络恢复时触发同步
 *  5. startBackgroundSync()  — 后台同步（每 5 分钟 + 前台恢复时）
 *  6. stopBackgroundSync()   — 停止后台同步
 *
 * 同步流程（对齐方案 1.3 节）：
 *  ```
 *  App 启动
 *    │
 *    ├─ 有网络 → 增量同步
 *    │    ├─ 读取 sync_watermark 各 since 字段
 *    │    ├─ GET /api/sync/products/delta?since={product_since}
 *    │    ├─ GET /api/sync/inventory/delta?since={inventory_since}
 *    │    ├─ GET /api/sync/members/delta?since={member_since}
 *    │    ├─ 应用变更到本地 SQLite
 *    │    ├─ 更新 sync_watermark
 *    │    └─ 提交离线销售单 POST /api/sync/offline-orders
 *    │
 *    ├─ 无网络 → 仅读取本地 SQLite（开单写 local_sale_draft，status=DRAFT）
 *    │
 *    └─ 后台同步（每 5 分钟 + 前台恢复时）
 *         └─ 静默增量同步，不阻塞 UI
 *  ```
 *
 * @author 阿澈
 */

import { initDatabase } from '@/native/sqlite'
import {
    LocalProductDb,
    LocalMemberDb,
    LocalSaleDraftDb,
    LocalInventoryDb,
    SyncWatermarkDb,
    type SaleDraftRecord,
    type SaleDraftItem,
} from '@/api/local-db'
import {
    getProductDelta,
    getInventoryDelta,
    getMemberDelta,
    submitOfflineOrders,
    type OfflineOrder,
    type OfflineOrderResult,
    type SyncDeltaResponse,
    type ProductDeltaResponse,
    type InventoryDeltaResponse,
    type MemberDeltaResponse,
} from '@/api/sync'
import { getTenant } from '@/api/storage'

// ====================== 类型定义 ======================

/**
 * 同步结果（对齐方案 1.3 节）
 */
export interface SyncResult {
    /** 整体是否成功（任一环节失败都标记为 false，但部分数据可能已成功） */
    success: boolean
    /** 商品变更条数 */
    productChanges: number
    /** 库存变更条数 */
    inventoryChanges: number
    /** 客户变更条数 */
    memberChanges: number
    /** 提交的离线销售单条数 */
    draftSubmitted: number
    /** 草稿提交成功条数 */
    draftSuccess: number
    /** 草稿提交失败条数 */
    draftFailed: number
    /** 错误信息列表（每条错误的简要描述） */
    errors: string[]
}

/**
 * 后台同步配置
 */
export interface BackgroundSyncConfig {
    /** 同步间隔（毫秒），默认 5 分钟 */
    interval?: number
    /** 是否启用前台恢复时触发同步，默认 true */
    syncOnResume?: boolean
}

// ====================== 常量定义 ======================

/** 默认后台同步间隔：5 分钟 */
const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000

/** 单次 delta 拉取的最大页数（防止无限循环） */
const MAX_DELTA_PAGES = 50

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 100

// ====================== 内部状态 ======================

/** 后台同步定时器 */
let backgroundTimer: ReturnType<typeof setInterval> | null = null

/** 当前是否正在同步（防止并发） */
let syncing = false

/** 上一次同步结果 */
let lastSyncResult: SyncResult | null = null

// ====================== 工具函数 ======================

/**
 * 获取当前租户 ID
 * @returns 当前租户 ID，未登录返回空字符串
 */
function getCurrentTenantId(): string {
    const tenant = getTenant()
    return tenant ? String(tenant.id) : ''
}

/**
 * 创建空的 SyncResult
 */
function emptySyncResult(): SyncResult {
    return {
        success: true,
        productChanges: 0,
        inventoryChanges: 0,
        memberChanges: 0,
        draftSubmitted: 0,
        draftSuccess: 0,
        draftFailed: 0,
        errors: [],
    }
}

/**
 * 检测网络是否可用
 * @returns 网络类型为 none 时返回 false，其他返回 true
 */
function checkNetworkAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        try {
            uni.getNetworkType({
                success: (res: any) => {
                    const networkType = String(res?.networkType ?? 'none')
                    resolve(networkType !== 'none' && networkType !== 'unknown')
                },
                fail: () => resolve(false),
            })
        } catch {
            resolve(false)
        }
    })
}

// ====================== 核心同步逻辑 ======================

/**
 * 全量增量同步
 *
 * 流程：
 *  1. 读取 sync_watermark
 *  2. 调用 3 个 delta 端点（products/inventory/members），处理 hasMore 分页
 *  3. 应用变更到本地 SQLite
 *  4. 更新 sync_watermark
 *  5. 提交离线销售单（如有 PENDING_SYNC）
 *
 * 幂等：重复调用安全（同步中再次调用会被排队跳过）
 *
 * @returns 同步结果
 *
 * @example
 * ```ts
 * const result = await syncAll()
 * if (!result.success) {
 *   // 同步失败：处理 result.errors（记录日志或上报监控）
 * }
 * ```
 */
export async function syncAll(): Promise<SyncResult> {
    // 防止并发同步
    if (syncing) {
        const result = emptySyncResult()
        result.errors.push('已有同步任务在执行，跳过本次')
        return result
    }

    const tenantId = getCurrentTenantId()
    if (!tenantId) {
        const result = emptySyncResult()
        result.errors.push('未登录或租户信息缺失，跳过同步')
        return result
    }

    syncing = true
    const result = emptySyncResult()

    try {
        // 确保数据库已初始化
        await initDatabase()

        // 1. 读取同步水位
        const watermark = await SyncWatermarkDb.get()

        // 2. 商品增量同步（处理分页）
        try {
            const productCount = await syncProductsDelta(watermark.productSince, tenantId)
            result.productChanges = productCount
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            result.errors.push(`商品同步失败: ${msg}`)
            result.success = false
        }

        // 3. 库存增量同步（处理分页）
        try {
            const invCount = await syncInventoryDelta(watermark.inventorySince, tenantId)
            result.inventoryChanges = invCount
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            result.errors.push(`库存同步失败: ${msg}`)
            result.success = false
        }

        // 4. 客户增量同步（处理分页）
        try {
            const memberCount = await syncMembersDelta(watermark.memberSince, tenantId)
            result.memberChanges = memberCount
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            result.errors.push(`客户同步失败: ${msg}`)
            result.success = false
        }

        // 5. 提交待同步草稿（即使增量同步部分失败也尝试提交）
        try {
            const draftResult = await submitPendingDrafts(tenantId)
            result.draftSubmitted = draftResult.submitted
            result.draftSuccess = draftResult.success
            result.draftFailed = draftResult.failed
            if (draftResult.errors.length > 0) {
                result.errors.push(...draftResult.errors)
                // 草稿提交错误不视为整体失败（部分成功也算可接受）
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            result.errors.push(`草稿提交失败: ${msg}`)
            result.success = false
        }

        // 6. 更新 last_full_sync（仅在全部成功时）
        if (result.success) {
            await SyncWatermarkDb.update('last_full_sync', new Date().toISOString())
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`同步异常: ${msg}`)
        result.success = false
    } finally {
        syncing = false
        lastSyncResult = result
    }

    return result
}

/**
 * 商品增量同步（处理分页）
 *
 * @param since    起始时间戳
 * @param tenantId 租户 ID
 * @returns 已应用的变更条数
 */
async function syncProductsDelta(since: string, tenantId: string): Promise<number> {
    let totalApplied = 0
    let currentSince = since
    let hasMore = true
    let page = 1

    while (hasMore && page <= MAX_DELTA_PAGES) {
        const res: ProductDeltaResponse = await getProductDelta(currentSince, {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
        })
        if (res.changes && res.changes.length > 0) {
            await LocalProductDb.applyDelta(res.changes, tenantId)
            totalApplied += res.changes.length
        }
        // 更新水位到本次返回的 until
        if (res.until && res.until !== currentSince) {
            await SyncWatermarkDb.update('product_since', res.until)
            currentSince = res.until
        }
        hasMore = !!res.hasMore
        page++
    }

    return totalApplied
}

/**
 * 库存增量同步（处理分页）
 *
 * @param since    起始时间戳
 * @param tenantId 租户 ID
 * @returns 已应用的变更条数
 */
async function syncInventoryDelta(since: string, tenantId: string): Promise<number> {
    let totalApplied = 0
    let currentSince = since
    let hasMore = true
    let page = 1

    while (hasMore && page <= MAX_DELTA_PAGES) {
        const res: InventoryDeltaResponse = await getInventoryDelta(currentSince, {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
        })
        if (res.changes && res.changes.length > 0) {
            await LocalInventoryDb.applyDelta(res.changes, tenantId)
            totalApplied += res.changes.length
        }
        if (res.until && res.until !== currentSince) {
            await SyncWatermarkDb.update('inventory_since', res.until)
            currentSince = res.until
        }
        hasMore = !!res.hasMore
        page++
    }

    return totalApplied
}

/**
 * 客户增量同步（处理分页）
 *
 * @param since    起始时间戳
 * @param tenantId 租户 ID
 * @returns 已应用的变更条数
 */
async function syncMembersDelta(since: string, tenantId: string): Promise<number> {
    let totalApplied = 0
    let currentSince = since
    let hasMore = true
    let page = 1

    while (hasMore && page <= MAX_DELTA_PAGES) {
        const res: MemberDeltaResponse = await getMemberDelta(currentSince, {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
        })
        if (res.changes && res.changes.length > 0) {
            await LocalMemberDb.applyDelta(res.changes, tenantId)
            totalApplied += res.changes.length
        }
        if (res.until && res.until !== currentSince) {
            await SyncWatermarkDb.update('member_since', res.until)
            currentSince = res.until
        }
        hasMore = !!res.hasMore
        page++
    }

    return totalApplied
}

// ====================== 草稿提交 ======================

/**
 * 提交待同步草稿
 *
 * 流程：
 *  1. 查询 local_sale_draft 中 status=PENDING_SYNC 或 SYNC_FAILED 的草稿
 *  2. 调用 POST /api/sync/offline-orders 批量提交
 *  3. 根据返回结果更新状态：
 *     - success=true  → status=SYNCED，记录 synced_at
 *     - success=false → status=SYNC_FAILED，记录 error_msg
 *
 * @param tenantId 租户 ID（可选，默认从 storage 读取）
 * @returns 提交结果统计
 */
export async function submitPendingDrafts(
    tenantId?: string
): Promise<{ submitted: number; success: number; failed: number; errors: string[] }> {
    const tid = tenantId ?? getCurrentTenantId()
    if (!tid) {
        return { submitted: 0, success: 0, failed: 0, errors: ['未登录或租户信息缺失'] }
    }

    // 1. 查询待同步草稿
    const pendingDrafts = await LocalSaleDraftDb.listPending(tid)
    if (pendingDrafts.length === 0) {
        return { submitted: 0, success: 0, failed: 0, errors: [] }
    }

    // 2. 转换为后端接口格式
    const orders: OfflineOrder[] = pendingDrafts.map((draft) => mapDraftToOfflineOrder(draft))

    // 3. 调用后端批量提交
    let results: OfflineOrderResult[]
    try {
        const batchResult = await submitOfflineOrders(orders)
        results = batchResult.results || []
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // 网络错误：所有草稿标记为 SYNC_FAILED
        for (const draft of pendingDrafts) {
            await LocalSaleDraftDb.updateStatus(draft.draftNo, 'SYNC_FAILED', msg, tid)
        }
        return {
            submitted: pendingDrafts.length,
            success: 0,
            failed: pendingDrafts.length,
            errors: [`批量提交请求失败: ${msg}`],
        }
    }

    // 4. 根据返回结果更新状态
    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (const r of results) {
        if (r.success) {
            await LocalSaleDraftDb.updateStatus(r.draftNo, 'SYNCED', undefined, tid)
            successCount++
        } else {
            const errMsg = r.errorMsg || '服务端处理失败'
            await LocalSaleDraftDb.updateStatus(r.draftNo, 'SYNC_FAILED', errMsg, tid)
            failedCount++
            errors.push(`${r.draftNo}: ${errMsg}`)
        }
    }

    // 兜底：results 数量不足时（不应发生，但防御性处理），将未处理的草稿标记为失败
    if (results.length < pendingDrafts.length) {
        const processedDraftNos = new Set(results.map((r) => r.draftNo))
        for (const draft of pendingDrafts) {
            if (!processedDraftNos.has(draft.draftNo)) {
                await LocalSaleDraftDb.updateStatus(
                    draft.draftNo,
                    'SYNC_FAILED',
                    '服务端未返回该草稿的处理结果',
                    tid
                )
                failedCount++
                errors.push(`${draft.draftNo}: 服务端未返回处理结果`)
            }
        }
    }

    return {
        submitted: pendingDrafts.length,
        success: successCount,
        failed: failedCount,
        errors,
    }
}

/**
 * 草稿记录 → 离线订单（后端接口格式）
 */
function mapDraftToOfflineOrder(draft: SaleDraftRecord): OfflineOrder {
    let items: SaleDraftItem[] = []
    try {
        const parsed = JSON.parse(draft.itemsJson)
        if (Array.isArray(parsed)) {
            items = parsed as SaleDraftItem[]
        }
    } catch {
        // itemsJson 解析失败时传空数组，后端会返回失败结果
        items = []
    }

    return {
        draftNo: draft.draftNo,
        customerName: draft.customerName ?? undefined,
        customerMobile: draft.customerMobile ?? undefined,
        customerId: draft.customerId ?? undefined,
        items,
        totalAmount: draft.totalAmount,
        remark: draft.remark ?? undefined,
        createdAt: draft.createdAt,
    }
}

// ====================== 生命周期钩子 ======================

/**
 * App 启动时触发
 *
 * 流程：
 *  1. 检测网络状态
 *  2. 有网络 → 触发 syncAll（静默，不阻塞 UI）
 *  3. 无网络 → 仅初始化本地数据库，不触发同步
 *
 * 应在 App.vue 的 onLaunch 中调用。
 *
 * @example
 * ```ts
 * // App.vue
 * import { onLaunch } from '@dcloudio/uni-app'
 * import { onAppLaunch } from '@/utils/sync-manager'
 *
 * onLaunch(() => {
 *   onAppLaunch()
 * })
 * ```
 */
export async function onAppLaunch(): Promise<void> {
    // 始终先初始化本地数据库（无网络也需要读取本地数据）
    try {
        await initDatabase()
    } catch (err) {
        console.error('[sync-manager] 初始化本地数据库失败:', err)
    }

    // 检测网络状态
    const hasNetwork = await checkNetworkAvailable()
    if (!hasNetwork) {
        return
    }

    // 有网络 → 静默触发同步（不阻塞 UI，不弹 toast）
    syncAll().catch((err) => {
        console.error('[sync-manager] 启动同步失败:', err)
    })
}

/**
 * 网络恢复时触发
 *
 * 应在 uni.onNetworkStatusChange 监听网络恢复时调用。
 *
 * @example
 * ```ts
 * uni.onNetworkStatusChange((res) => {
 *   if (res.isConnected) {
 *     onNetworkResume()
 *   }
 * })
 * ```
 */
export async function onNetworkResume(): Promise<void> {
    try {
        await syncAll()
    } catch (err) {
        console.error('[sync-manager] 网络恢复同步失败:', err)
    }
}

// ====================== 后台同步 ======================

/**
 * 启动后台同步
 *
 * 流程：
 *  1. 启动定时器，每 interval 毫秒触发一次 syncAll
 *  2. 监听 App 前台恢复事件（uni.onAppShow），触发 syncAll
 *
 * 注意：重复调用会先停止已有定时器再启动新的。
 *
 * @param config 后台同步配置
 *
 * @example
 * ```ts
 * // App.vue onLaunch
 * startBackgroundSync({ interval: 5 * 60 * 1000 })
 * ```
 */
export function startBackgroundSync(config?: BackgroundSyncConfig): void {
    // 先停止已有的后台同步
    stopBackgroundSync()

    const interval = config?.interval ?? DEFAULT_SYNC_INTERVAL

    // 启动定时同步
    backgroundTimer = setInterval(() => {
        // 异步触发，不阻塞定时器
        syncAll().catch((err) => {
            console.error('[sync-manager] 后台定时同步失败:', err)
        })
    }, interval)

    // 监听 App 前台恢复（仅注册一次，重复调用不重复注册）
    if (config?.syncOnResume !== false) {
        try {
            uni.onAppShow(() => {
                syncAll().catch((err) => {
                    console.error('[sync-manager] 前台恢复同步失败:', err)
                })
            })
        } catch (err) {
            console.error('[sync-manager] 注册 onAppShow 失败:', err)
        }
    }
}

/**
 * 停止后台同步
 *
 * 应在 App 退出或用户登出时调用。
 */
export function stopBackgroundSync(): void {
    if (backgroundTimer) {
        clearInterval(backgroundTimer)
        backgroundTimer = null
    }
}

// ====================== 辅助函数 ======================

/**
 * 获取上一次同步结果
 *
 * @returns 上一次同步结果，未同步过返回 null
 */
export function getLastSyncResult(): SyncResult | null {
    return lastSyncResult
}

/**
 * 当前是否正在同步
 *
 * @returns 同步状态
 */
export function isSyncing(): boolean {
    return syncing
}

/**
 * 强制触发一次同步（无视 syncing 状态）
 *
 * 主要用于用户手动触发"立即同步"场景。
 *
 * @returns 同步结果
 */
export async function forceSync(): Promise<SyncResult> {
    // 强制重置 syncing 标记
    syncing = false
    return syncAll()
}

// ====================== 导出 ======================

export {
    DEFAULT_SYNC_INTERVAL,
}
