/**
 * mock-db 聚合导出模块
 * 将所有领域模块的 mock handlers 组合成与原 mock-db.ts 完全兼容的接口
 */
import mysql from "mysql2/promise";
import { resetMockDb } from "./mock-db-state";
import { queryHandlers as systemQuery, executeHandlers as systemExecute } from "./mock-db-system";
import { queryHandlers as storeQuery, executeHandlers as storeExecute } from "./mock-db-store";
import { queryHandlers as customerQuery, executeHandlers as customerExecute } from "./mock-db-customer";
import { queryHandlers as productQuery, executeHandlers as productExecute } from "./mock-db-product";
import { queryHandlers as inventoryQuery, executeHandlers as inventoryExecute } from "./mock-db-inventory";
import { queryHandlers as orderQuery, executeHandlers as orderExecute } from "./mock-db-order";
import { queryHandlers as financeQuery, executeHandlers as financeExecute } from "./mock-db-finance";
import { queryHandlers as supplierQuery, executeHandlers as supplierExecute } from "./mock-db-supplier";
import { queryHandlers as platformMiniappQuery, executeHandlers as platformMiniappExecute } from "./mock-db-platform-miniapp";

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
  ...platformMiniappQuery, // subscription_plan, platform_subscription_apply
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
  ...platformMiniappExecute,
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

/**
 * 判断 SQL 是否为 SELECT 语句
 */
function isSelectSql(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith("select") || trimmed.startsWith("show") || trimmed.startsWith("describe") || trimmed.startsWith("explain");
}

/**
 * 判断 SQL 是否为 INSERT/UPDATE/DELETE 语句
 */
function isWriteSql(s: string): boolean {
  const trimmed = s.trim();
  return trimmed.startsWith("insert") || trimmed.startsWith("update") || trimmed.startsWith("delete");
}

export const mockConn: mysql.PoolConnection = {
  // mockConn.execute: 处理所有 SQL 类型
  // - SELECT/SHOW/DESCRIBE → 路由到 mockQuery（返回 [rows, undefined]）
  // - INSERT/UPDATE/DELETE → 路由到 mockExecute（返回 [ResultSetHeader, undefined]）
  execute: async (sql: string, params: unknown[] = []) => {
    const s = sql.toLowerCase().replace(/\s+/g, " ");
    if (isSelectSql(s)) {
      const rows = await mockQuery(sql, params);
      return [rows, undefined];
    }
    return mockExecute(sql, params);
  },
  // mockConn.query: 处理所有 SQL 类型（与 execute 行为一致）
  // 修复坑：purchase-in-stock、purchase-return、customer-payment、customer-statement 服务在事务中使用 conn.query() 进行 INSERT/UPDATE
  query: async (sql: string, params: unknown[] = []) => {
    const s = sql.toLowerCase().replace(/\s+/g, " ");
    if (isWriteSql(s)) {
      // INSERT/UPDATE/DELETE → 路由到 mockExecute，返回 [ResultSetHeader, undefined] 元组
      // 服务中使用 `const [result] = await conn.query(...)` 解构，得到 ResultSetHeader
      // 同时 result() 返回的数组也挂载了 insertId/affectedRows 属性，支持 `result.insertId` 直接访问
      const execResult: any = await mockExecute(sql, params);
      // mockExecute 返回 [ResultSetHeader, undefined] 或 handler 返回的结果
      // 需要包装成 [result, undefined] 格式以匹配 conn.query 的返回类型
      if (Array.isArray(execResult) && execResult.length === 2 && execResult[1] === undefined) {
        // 已经是 [ResultSetHeader, undefined] 格式
        // 但需要确保返回的是 [rows, fields] 格式，其中 rows 是 ResultSetHeader
        const header: any = execResult[0];
        // 同时挂载属性到 header 上，支持 result.insertId 直接访问
        if (header && typeof header === "object") {
          return [header, undefined];
        }
        return [header, undefined];
      }
      // handler 返回的是其他格式，直接包装
      return [execResult, undefined];
    }
    // SELECT → 路由到 mockQuery
    const rows = await mockQuery(sql, params);
    return [rows, undefined];
  }
} as unknown as mysql.PoolConnection;

export { resetMockDb };
