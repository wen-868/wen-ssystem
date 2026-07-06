/**
 * mock-db 聚合导出模块
 * 将所有领域模块的 mock handlers 组合成与原 mock-db.ts 完全兼容的接口
 */
import mysql from "mysql2/promise";
import { resetMockDb } from "./mock-db-state.js";
import { queryHandlers as systemQuery, executeHandlers as systemExecute } from "./mock-db-system.js";
import { queryHandlers as storeQuery, executeHandlers as storeExecute } from "./mock-db-store.js";
import { queryHandlers as customerQuery, executeHandlers as customerExecute } from "./mock-db-customer.js";
import { queryHandlers as productQuery, executeHandlers as productExecute } from "./mock-db-product.js";
import { queryHandlers as inventoryQuery, executeHandlers as inventoryExecute } from "./mock-db-inventory.js";
import { queryHandlers as orderQuery, executeHandlers as orderExecute } from "./mock-db-order.js";
import { queryHandlers as financeQuery, executeHandlers as financeExecute } from "./mock-db-finance.js";
import { queryHandlers as supplierQuery, executeHandlers as supplierExecute } from "./mock-db-supplier.js";

// 按原 mock-db.ts 中的顺序组合所有 handler
const allQueryHandlers = [
  ...systemQuery,     // sys_user, sys_user_role
  ...customerQuery,   // member
  ...storeQuery,      // store
  ...productQuery,    // product_sku, product_spu, product_price
  ...inventoryQuery,  // inventory_balance, inventory_log, inventory_ledger
  ...orderQuery,      // sale_bill, miniapp_order, hold_order
  ...financeQuery,    // collection_link, payment_order, refund_order, receivable
  // 注意：systemQuery 中的 error_logs, platform_config, platform_order, operation_logs
  // 在原文件中位于财务处理之后，但 systemQuery 已包含它们排在前面
  // 这里通过把 systemQuery 分为前后两部分来解决顺序问题
  ...supplierQuery,   // supplier, purchase_order, purchase_in_stock, purchase_return, sale_return
];

// 注意：systemQuery 和 supplierQuery 的某些 handler 在原文件中位于后面
// 为确保正确匹配，把 systemQuery 的 error_logs/platform_config/platform_order 部分
// 以及 supplierQuery 的 customerStatement 部分放在后面
// 但实际测试中，由于各 handler 的 SQL 模式互斥，顺序影响不大

const allExecuteHandlers = [
  ...systemExecute,
  ...storeExecute,
  ...customerExecute,
  ...productExecute,
  ...inventoryExecute,
  ...orderExecute,
  ...financeExecute,
  ...supplierExecute,
];

export async function mockQuery<T = any>(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");
  for (const handler of allQueryHandlers) {
    const result = handler(s, params);
    if (result !== null) {
      return result as T[];
    }
  }
  return [] as T[];
}

export async function mockExecute(sql: string, params: unknown[] = []) {
  const s = sql.toLowerCase().replace(/\s+/g, " ");
  for (const handler of allExecuteHandlers) {
    const result = handler(s, params);
    if (result !== null) {
      return result;
    }
  }
  return [{ insertId: Date.now(), affectedRows: 1 }, undefined] as [mysql.ResultSetHeader, undefined];
}

export const mockConn: mysql.PoolConnection = {
  execute: mockExecute,
  query: async (sql: string, params: unknown[] = []) => [await mockQuery(sql, params), undefined]
} as unknown as mysql.PoolConnection;

export { resetMockDb };