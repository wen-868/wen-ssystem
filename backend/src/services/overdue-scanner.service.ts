import { query } from "../shared/db";
import logger from "../shared/logger";

/** 租户ID行 */
interface TenantIdRow {
  tenant_id: string;
}

async function getAllActiveTenants(): Promise<string[]> {
  const rows = await query<TenantIdRow>(
    "SELECT DISTINCT tenant_id FROM t_sys_user WHERE status = 1"
  );
  return rows.map((r) => r.tenant_id).filter(Boolean);
}

export async function scanOverdueCreditBills(tenantId?: string): Promise<number> {
  let tenantIds: string[] = [];
  if (tenantId) {
    tenantIds = [tenantId];
  } else {
    tenantIds = await getAllActiveTenants();
  }

  let totalAffected = 0;

  for (const tid of tenantIds) {
    const result = await query(
      `UPDATE t_sale_bill
       SET collection_status = 'OVERDUE', updated_at = NOW()
       WHERE tenant_id = ?
         AND sale_type = 'CREDIT'
         AND due_date IS NOT NULL
         AND due_date < CURDATE()
         AND collection_status IN ('UNPAID', 'PARTIAL')
         AND business_status = 'CREATED'`,
      [tid]
    );

    const affectedRows = (result as { affectedRows?: number } | null)?.affectedRows || 0;
    totalAffected += affectedRows;

    if (affectedRows > 0) {
      logger.info(`[OverdueScanner] 租户 ${tid}: 标记 ${affectedRows} 笔赊销单为超期`);
    }
  }

  return totalAffected;
}

export function startOverdueScanner() {
  scanOverdueCreditBills().catch(err => {
    logger.error("[OverdueScanner] 启动扫描失败:", err);
  });

  const interval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) {
      scanOverdueCreditBills().catch(err => {
        logger.error("[OverdueScanner] 定时扫描失败:", err);
      });
    }
  }, 60 * 1000);

  logger.info("[OverdueScanner] 超期检测定时任务已启动");

  return () => clearInterval(interval);
}
