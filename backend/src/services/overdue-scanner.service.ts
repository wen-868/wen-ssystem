import { query } from "../shared/db.js";

/**
 * 扫描超期的赊销销售单
 * 将 collection_status 从 PARTIAL 更新为 OVERDUE
 */
export async function scanOverdueCreditBills(): Promise<number> {
  const result = await query(
    `UPDATE sale_bill
     SET collection_status = 'OVERDUE', updated_at = NOW()
     WHERE sale_type = 'CREDIT'
       AND due_date IS NOT NULL
       AND due_date < CURDATE()
       AND collection_status IN ('UNPAID', 'PARTIAL')
       AND business_status = 'CREATED'`
  );

  const affectedRows = (result as any)?.affectedRows || 0;

  if (affectedRows > 0) {
    console.log(`[OverdueScanner] 标记 ${affectedRows} 笔赊销单为超期`);
  }

  return affectedRows;
}

/**
 * 启动超期检测定时任务
 * 每天凌晨 1 点执行
 */
export function startOverdueScanner() {
  // 启动时立即执行一次
  scanOverdueCreditBills().catch(err => {
    console.error("[OverdueScanner] 启动扫描失败:", err);
  });

  // 每天凌晨 1 点执行
  const interval = setInterval(() => {
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) {
      scanOverdueCreditBills().catch(err => {
        console.error("[OverdueScanner] 定时扫描失败:", err);
      });
    }
  }, 60 * 1000); // 每分钟检查一次

  console.log("[OverdueScanner] 超期检测定时任务已启动");

  return () => clearInterval(interval);
}
