/**
 * 零售库存扣减原语
 *
 * ⚠️ **业务约束（业主 2026-09-22 提醒：「要扣减库存，库存就变成负数，这是业务逻辑，要谨慎」）**
 * 1. **结构上不可能扣成负数**：「库存是否足够」被放进**同一条 UPDATE 的 WHERE**里，
 *    由数据库在行锁下原子判定；`affectedRows !== 1` 即视为失败，**不写任何数据**。
 * 2. **禁止在本文件之外手写 `stock = stock - ?`** —— 那会绕过上面的保证。
 * 3. **批量扣减在同一事务内**：任一项不足 ⇒ 整体回滚，绝不留下"部分扣减"。
 * 4. `sales_count`（累计销量）回退用 `GREATEST(..., 0)` 兜底，避免出现负销量。
 *
 * 修掉的两个原实现隐患（2026-09-22）：
 * - 原 `deductStock` 用 `SELECT ... FOR UPDATE` + 独立 `UPDATE`，**两段不在同一事务**（autocommit 下锁立即释放）
 *   ⇒ 并发下两个请求都能通过 `stock >= qty` 检查，**库存被扣成负数**（TOCTOU）。
 * - 原 `batchDeductStock` **无事务** ⇒ 中途失败会留下部分扣减（账实不符）。
 *
 * 现状：即时零售接单路径按业主裁定为「**仅告警**」，**不调用本文件的扣减**（见 shortage-handler.service.ts / S3-79）。
 * 本文件保留给"本地零售单"等**明确需要扣库存**的场景；使用前请先确认业务口径。
 */
import { query, queryOneWithTenant, transaction, connExecute } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";
import logger from "../../shared/logger";

// ==================== 类型定义 ====================

/** 零售商品库存行 */
interface RetailProductStockRow {
  id: number;
  stock: number;
  status?: string | number;
}

/** 库存不足（批量扣减里用于触发整体回滚） */
export class InsufficientStockError extends Error {
  constructor(public readonly productId: number) {
    super(`库存不足或商品不存在: productId=${productId}`);
    this.name = "InsufficientStockError";
  }
}

/**
 * 单条原子扣减：`stock >= ?` 与 `stock = stock - ?` 在同一条语句里判定与执行。
 * 返回 true 表示确实扣掉了 1 行；false 表示库存不足 / 商品不存在 / 数量非法（**均未写数据**）。
 */
const DEDUCT_SQL = `UPDATE t_retail_product
     SET stock = stock - ?, sales_count = sales_count + ?
   WHERE id = ? AND tenant_id = ? AND stock >= ?`;

/** 回退：加回库存，销量用 GREATEST 兜底防负数 */
const RESTORE_SQL = `UPDATE t_retail_product
     SET stock = stock + ?, sales_count = GREATEST(sales_count - ?, 0)
   WHERE id = ? AND tenant_id = ?`;

/** 从写入结果里取 affectedRows（兼容 mysql2 的 ResultSetHeader 与已被归一化为数组的两种形状） */
function affectedRowsOf(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as ResultSetHeader | undefined)?.affectedRows ?? 0);
}

function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

/** 单条扣减（原子、失败不写数据） */
export async function deductStock(productId: number, quantity: number, tenantId: string): Promise<boolean> {
  if (!isValidQuantity(quantity)) {
    logger.warn(`[inventory] 非法扣减数量，已拒绝: productId=${productId} quantity=${quantity}`);
    return false;
  }
  const result = await query(DEDUCT_SQL, [quantity, quantity, productId, tenantId, quantity]);
  return affectedRowsOf(result) === 1;
}

/** 回退单条库存 */
export async function restoreStock(productId: number, quantity: number, tenantId: string) {
  if (!isValidQuantity(quantity)) {
    logger.warn(`[inventory] 非法回退数量，已拒绝: productId=${productId} quantity=${quantity}`);
    return;
  }
  await query(RESTORE_SQL, [quantity, quantity, productId, tenantId]);
}

/**
 * 批量扣减（**同一事务**：任一不足则整体回滚）
 * @returns success=false + failedProductId 时，**没有任何一条被扣减**
 */
export async function batchDeductStock(
  items: Array<{ productId: number; quantity: number }>,
  tenantId: string
): Promise<{ success: boolean; failedProductId?: number }> {
  try {
    await transaction(async (conn) => {
      for (const item of items) {
        if (!isValidQuantity(item.quantity)) throw new InsufficientStockError(item.productId);
        const [res] = await connExecute<ResultSetHeader>(conn, DEDUCT_SQL, [
          item.quantity,
          item.quantity,
          item.productId,
          tenantId,
          item.quantity,
        ]);
        if (Number(res?.affectedRows ?? 0) !== 1) throw new InsufficientStockError(item.productId);
      }
    });
    return { success: true };
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      logger.warn(`[inventory] 批量扣减失败并已整体回滚: ${err.message}`);
      return { success: false, failedProductId: err.productId };
    }
    throw err;
  }
}

/** 批量回退（逐条；回退方向不会造成负数库存） */
export async function batchRestoreStock(items: Array<{ productId: number; quantity: number }>, tenantId: string) {
  for (const item of items) {
    await restoreStock(item.productId, item.quantity, tenantId);
  }
}

/** 读取库存状态（只读） */
export async function getStockStatus(productId: number, tenantId: string) {
  return queryOneWithTenant<RetailProductStockRow>(
    "SELECT id, stock, status FROM t_retail_product WHERE id = ? AND tenant_id = ?",
    [productId, tenantId],
    tenantId
  );
}
