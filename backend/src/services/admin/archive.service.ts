/**
 * 历史单据归档服务（R9-5）
 * 将超期历史单据迁移到归档表，释放主表查询压力。
 */
import { queryWithTenant, transaction } from "../../shared/db.js";

export interface ArchiveParams {
  tenantId: string;
  archiveDays: number;     // 超过多少天归档
  archiveType: "SALE_BILL" | "PURCHASE_ORDER" | "INVENTORY_LEDGER" | "ALL";
  dryRun: boolean;         // 试运行不实际移动数据
}

export interface ArchiveResult {
  archiveType: string;
  archivedCount: number;
  remainingCount: number;
  message: string;
}

/** 归档入口：根据类型批量归档历史数据 */
export async function archiveBillings(params: ArchiveParams): Promise<ArchiveResult[]> {
  const { tenantId, archiveDays, archiveType, dryRun } = params;
  const results: ArchiveResult[] = [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archiveDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const types = archiveType === "ALL"
    ? ["SALE_BILL", "PURCHASE_ORDER", "INVENTORY_LEDGER"] as const
    : [archiveType] as const;

  for (const type of types) {
    const result = await archiveByType(tenantId, type, cutoffStr, dryRun);
    results.push(result);
  }

  return results;
}

async function archiveByType(
  tenantId: string,
  type: ArchiveParams["archiveType"],
  cutoffDate: string,
  dryRun: boolean
): Promise<ArchiveResult> {
  const configs: Record<string, { sourceTable: string; archiveTable: string; dateField: string; statusCondition: string }> = {
    SALE_BILL: {
      sourceTable: "sale_bill",
      archiveTable: "sale_bill_archive",
      dateField: "created_at",
      statusCondition: "business_status IN ('COMPLETED', 'CANCELLED')"
    },
    PURCHASE_ORDER: {
      sourceTable: "purchase_order",
      archiveTable: "purchase_order_archive",
      dateField: "created_at",
      statusCondition: "status IN ('RECEIVED', 'CANCELLED')"
    },
    INVENTORY_LEDGER: {
      sourceTable: "inventory_ledger",
      archiveTable: "inventory_ledger_archive",
      dateField: "created_at",
      statusCondition: "1=1"
    }
  };

  const config = configs[type];
  if (!config) {
    return { archiveType: type, archivedCount: 0, remainingCount: 0, message: "不支持的归档类型" };
  }

  // 查询待归档数量
  const countResult = await queryWithTenant<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM ${config.sourceTable}
     WHERE tenant_id = ? AND ${config.statusCondition}
       AND DATE(${config.dateField}) < ?`,
    [tenantId, cutoffDate],
    tenantId
  );
  const toArchiveCount = Number(countResult[0]?.cnt ?? 0);

  if (dryRun) {
    return {
      archiveType: type,
      archivedCount: 0,
      remainingCount: toArchiveCount,
      message: `[试运行] 待归档 ${toArchiveCount} 条记录（${config.sourceTable} → ${config.archiveTable}）`
    };
  }

  if (toArchiveCount === 0) {
    return { archiveType: type, archivedCount: 0, remainingCount: 0, message: "无待归档数据" };
  }

  await transaction(async (conn) => {
    // 迁移主表数据到归档表
    await conn.execute(
      `INSERT INTO ${config.archiveTable}
       SELECT * FROM ${config.sourceTable}
       WHERE tenant_id = ? AND ${config.statusCondition}
         AND DATE(${config.dateField}) < ?`,
      [tenantId, cutoffDate]
    );

    // 迁移关联子表（如有）
    if (type === "SALE_BILL") {
      await conn.execute(
        `INSERT INTO sale_bill_item_archive
         SELECT sbi.* FROM sale_bill_item sbi
         INNER JOIN sale_bill sb ON sb.bill_no = sbi.bill_no
         WHERE sb.tenant_id = ? AND ${config.statusCondition}
           AND DATE(sb.${config.dateField}) < ?
           AND sbi.id NOT IN (SELECT id FROM sale_bill_item_archive)`,
        [tenantId, cutoffDate]
      );
    }

    if (type === "PURCHASE_ORDER") {
      await conn.execute(
        `INSERT INTO purchase_order_item_archive
         SELECT poi.* FROM purchase_order_item poi
         INNER JOIN purchase_order po ON po.order_no = poi.order_no
         WHERE po.tenant_id = ? AND ${config.statusCondition}
           AND DATE(po.${config.dateField}) < ?
           AND poi.id NOT IN (SELECT id FROM purchase_order_item_archive)`,
        [tenantId, cutoffDate]
      );
    }

    // 删除主表已归档数据
    if (type === "SALE_BILL") {
      await conn.execute(
        `DELETE FROM sale_bill_item
         WHERE bill_no IN (SELECT bill_no FROM sale_bill_archive WHERE tenant_id = ?)`,
        [tenantId]
      );
    }

    if (type === "PURCHASE_ORDER") {
      await conn.execute(
        `DELETE FROM purchase_order_item
         WHERE order_no IN (SELECT order_no FROM purchase_order_archive WHERE tenant_id = ?)`,
        [tenantId]
      );
    }

    await conn.execute(
      `DELETE FROM ${config.sourceTable}
       WHERE tenant_id = ? AND ${config.statusCondition}
         AND DATE(${config.dateField}) < ?`,
      [tenantId, cutoffDate]
    );
  });

  return {
    archiveType: type,
    archivedCount: toArchiveCount,
    remainingCount: 0,
    message: `已归档 ${toArchiveCount} 条记录`
  };
}