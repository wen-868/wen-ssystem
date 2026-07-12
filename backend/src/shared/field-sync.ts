/**
 * 分字段定向同步中间件
 *
 * 核心能力：当源表字段变更时，自动将变更字段同步到所有关联的目标表，
 * 而不是全量同步整条记录，提升同步效率和精准度。
 *
 * 使用方式：
 * 1. 在 SYNC_CONFIG 中注册字段同步映射
 * 2. 在 Service 层的 UPDATE 操作后调用 syncChangedFields()
 * 3. 可选：在 Controller 层使用 fieldSyncMiddleware 自动拦截
 */

import logger from "./logger";
import { queryWithTenant } from "./db";

// ─── 类型定义 ─────────────────────────────────────────────────

export interface FieldSyncMapping {
  /** 源表名 */
  sourceTable: string;
  /** 源字段名 */
  sourceField: string;
  /** 目标表名 */
  targetTable: string;
  /** 目标字段名 */
  targetField: string;
  /** 关联键（源表主键=目标表外键，如 spu_id, sku_id, supplier_id） */
  joinKey: string;
  /** 目标表额外条件（可选，如 "status = 1"） */
  condition?: string;
  /** 说明 */
  description: string;
}

export interface SyncResult {
  /** 同步的目标表名 */
  targetTable: string;
  /** 同步的字段名 */
  targetField: string;
  /** 影响行数 */
  affectedRows: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// ─── 字段同步映射配置 ─────────────────────────────────────────

/**
 * 全量字段同步映射注册表
 * 定义：源表.字段 → 目标表.字段 的同步关系
 */
export const SYNC_MAPPINGS: FieldSyncMapping[] = [
  // ── 商品 SPU → SKU ──
  {
    sourceTable: "product_spu",
    sourceField: "product_name",
    targetTable: "product_sku",
    targetField: "product_name",
    joinKey: "spu_id",
    description: "商品名称同步：SPU → SKU"
  },
  {
    sourceTable: "product_spu",
    sourceField: "category_id",
    targetTable: "product_sku",
    targetField: "category_id",
    joinKey: "spu_id",
    description: "商品分类同步：SPU → SKU"
  },
  {
    sourceTable: "product_spu",
    sourceField: "brand",
    targetTable: "product_sku",
    targetField: "brand",
    joinKey: "spu_id",
    description: "品牌同步：SPU → SKU"
  },
  {
    sourceTable: "product_spu",
    sourceField: "unit",
    targetTable: "product_sku",
    targetField: "unit",
    joinKey: "spu_id",
    description: "单位同步：SPU → SKU"
  },
  {
    sourceTable: "product_spu",
    sourceField: "status",
    targetTable: "product_sku",
    targetField: "status",
    joinKey: "spu_id",
    description: "商品状态同步：SPU → SKU"
  },

  // ── 商品 SPU → 销售明细 ──
  {
    sourceTable: "product_spu",
    sourceField: "product_name",
    targetTable: "sale_bill_item",
    targetField: "product_name",
    joinKey: "spu_id",
    description: "商品名称同步：SPU → 销售明细"
  },
  {
    sourceTable: "product_spu",
    sourceField: "unit",
    targetTable: "sale_bill_item",
    targetField: "unit",
    joinKey: "spu_id",
    description: "单位同步：SPU → 销售明细"
  },

  // ── 商品 SPU → 采购明细 ──
  {
    sourceTable: "product_spu",
    sourceField: "product_name",
    targetTable: "purchase_order_item",
    targetField: "product_name",
    joinKey: "spu_id",
    description: "商品名称同步：SPU → 采购明细"
  },
  {
    sourceTable: "product_spu",
    sourceField: "unit",
    targetTable: "purchase_order_item",
    targetField: "unit",
    joinKey: "spu_id",
    description: "单位同步：SPU → 采购明细"
  },

  // ── 商品 SPU → 库存 ──
  {
    sourceTable: "product_spu",
    sourceField: "product_name",
    targetTable: "inventory_balance",
    targetField: "product_name",
    joinKey: "spu_id",
    description: "商品名称同步：SPU → 库存余额"
  },
  {
    sourceTable: "product_spu",
    sourceField: "category_id",
    targetTable: "inventory_balance",
    targetField: "category_id",
    joinKey: "spu_id",
    description: "商品分类同步：SPU → 库存余额"
  },

  // ── 商品分类 → SPU ──
  {
    sourceTable: "product_category",
    sourceField: "category_name",
    targetTable: "product_spu",
    targetField: "category_name",
    joinKey: "category_id",
    description: "分类名称同步：category → SPU"
  },

  // ── 商品分类 → SKU ──
  {
    sourceTable: "product_category",
    sourceField: "category_name",
    targetTable: "product_sku",
    targetField: "category_name",
    joinKey: "category_id",
    description: "分类名称同步：category → SKU"
  },

  // ── 供应商 → 采购订单 ──
  {
    sourceTable: "supplier",
    sourceField: "supplier_name",
    targetTable: "purchase_order",
    targetField: "supplier_name",
    joinKey: "supplier_id",
    condition: "status IN ('DRAFT', 'PENDING', 'APPROVED')",
    description: "供应商名称同步：supplier → 采购订单"
  },
  {
    sourceTable: "supplier",
    sourceField: "contact_person",
    targetTable: "purchase_order",
    targetField: "supplier_contact",
    joinKey: "supplier_id",
    condition: "status IN ('DRAFT', 'PENDING')",
    description: "供应商联系人同步：supplier → 采购订单"
  },

  // ── 供应商 → SPU ──
  {
    sourceTable: "supplier",
    sourceField: "supplier_name",
    targetTable: "product_spu",
    targetField: "supplier_name",
    joinKey: "supplier_id",
    description: "供应商名称同步：supplier → SPU"
  },

  // ── 客户 → 销售单 ──
  {
    sourceTable: "member",
    sourceField: "name",
    targetTable: "sale_bill",
    targetField: "customer_name",
    joinKey: "customer_id",
    condition: "status IN ('DRAFT', 'PENDING', 'CONFIRMED')",
    description: "客户名称同步：member → 销售单"
  },
  {
    sourceTable: "member",
    sourceField: "phone",
    targetTable: "sale_bill",
    targetField: "customer_phone",
    joinKey: "customer_id",
    condition: "status IN ('DRAFT', 'PENDING')",
    description: "客户电话同步：member → 销售单"
  },

  // ── 门店 → 用户 ──
  {
    sourceTable: "store",
    sourceField: "store_name",
    targetTable: "sys_user",
    targetField: "store_name",
    joinKey: "store_id",
    description: "门店名称同步：store → 用户"
  },
  {
    sourceTable: "store",
    sourceField: "status",
    targetTable: "sys_user",
    targetField: "store_status",
    joinKey: "store_id",
    description: "门店状态同步：store → 用户"
  },

  // ── 价格等级 → SKU价格 ──
  {
    sourceTable: "price_level",
    sourceField: "level_name",
    targetTable: "sku_price",
    targetField: "price_level_name",
    joinKey: "price_level_id",
    description: "价格等级名称同步：price_level → sku_price"
  },
];

// ─── 核心同步引擎 ─────────────────────────────────────────────

/**
 * 获取指定源表的所有字段映射
 */
export function getFieldMappings(sourceTable: string, sourceField?: string): FieldSyncMapping[] {
  return SYNC_MAPPINGS.filter(m => {
    if (sourceField) {
      return m.sourceTable === sourceTable && m.sourceField === sourceField;
    }
    return m.sourceTable === sourceTable;
  });
}

/**
 * 获取指定表的全部同步映射（按源表分组）
 */
export function getSyncGraph(): Record<string, FieldSyncMapping[]> {
  const graph: Record<string, FieldSyncMapping[]> = {};
  for (const mapping of SYNC_MAPPINGS) {
    const key = `${mapping.sourceTable}.${mapping.sourceField}`;
    if (!graph[key]) graph[key] = [];
    graph[key].push(mapping);
  }
  return graph;
}

/**
 * 检测变更字段
 * @param updates 更新数据（如 req.body）
 * @param existing 现有数据（更新前的记录）
 * @returns 变更的字段名列表
 */
export function detectChangedFields<T extends Record<string, any>>(
  updates: Partial<T>,
  existing: T
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined && updates[key] !== existing[key]) {
      changed.push(key);
    }
  }
  return changed;
}

/**
 * 执行分字段定向同步
 *
 * @param sourceTable 源表名
 * @param sourceId 源记录ID
 * @param changedFields 变更的字段列表
 * @param tenantId 租户ID
 * @returns 同步结果列表
 */
export async function syncChangedFields(
  sourceTable: string,
  sourceId: number,
  changedFields: string[],
  tenantId: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const field of changedFields) {
    const mappings = getFieldMappings(sourceTable, field);

    for (const mapping of mappings) {
      try {
        let targetSql: string;
        let params: unknown[];

        if (mapping.sourceTable === mapping.targetTable && mapping.sourceField === mapping.targetField) {
          // 同表同字段，跳过（避免死循环）
          continue;
        }

        // 构建定向同步SQL：只更新目标表的一个字段
        targetSql = `
          UPDATE ${mapping.targetTable} t
          SET t.${mapping.targetField} = (
            SELECT s.${mapping.sourceField}
            FROM ${mapping.sourceTable} s
            WHERE s.id = ?
          )
          WHERE t.${mapping.joinKey} = ?
            AND t.tenant_id = ?
        `;
        params = [sourceId, sourceId, tenantId];

        if (mapping.condition) {
          targetSql += ` AND ${mapping.condition}`;
        }

        const result = await queryWithTenant<any>(targetSql, params, tenantId);

        results.push({
          targetTable: mapping.targetTable,
          targetField: mapping.targetField,
          affectedRows: (result as { affectedRows?: number } | null)?.affectedRows ?? 0,
          success: true
        });
      } catch (err: any) {
        results.push({
          targetTable: mapping.targetTable,
          targetField: mapping.targetField,
          affectedRows: 0,
          success: false,
          error: err.message
        });
        logger.error(`[FieldSync] 同步失败: ${mapping.sourceTable}.${mapping.sourceField} → ${mapping.targetTable}.${mapping.targetField}`, err.message);
      }
    }
  }

  return results;
}

/**
 * 单字段同步（用于显式指定需要同步的字段）
 */
export async function syncSingleField(
  sourceTable: string,
  sourceField: string,
  sourceId: number,
  tenantId: string
): Promise<SyncResult[]> {
  return syncChangedFields(sourceTable, sourceId, [sourceField], tenantId);
}

/**
 * 获取指定源表ID的所有下游同步目标
 * 返回：哪些表需要同步哪些字段
 */
export function getSyncTargets(
  sourceTable: string,
  changedFields: string[]
): Array<{ targetTable: string; targetField: string; description: string }> {
  const targets: Array<{ targetTable: string; targetField: string; description: string }> = [];

  for (const field of changedFields) {
    const mappings = getFieldMappings(sourceTable, field);
    for (const m of mappings) {
      targets.push({
        targetTable: m.targetTable,
        targetField: m.targetField,
        description: m.description
      });
    }
  }

  return targets;
}