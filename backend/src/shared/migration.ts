/**
 * 启动时自动数据库迁移
 *
 * 程序化执行迁移，不依赖 SQL 文件中的 DELIMITER/存储过程语法
 * DELIMITER 是 MySQL CLI 专属命令，mysql2 驱动不支持
 */
import { existsSync } from "fs";
import { resolve } from "path";
import mysql from "mysql2/promise";
import { env } from "./env.js";

/** 需要添加 tenant_id 字段的所有表 */
const TABLES_NEED_TENANT_ID: string[] = [
  // 系统配置表
  "sys_config", "sys_user", "sys_role", "sys_permission", "sys_user_role", "sys_role_permission",
  // 门店相关
  "store",
  // 商品相关
  "product_category", "product_spu", "product_sku", "product_price", "sku_price",
  // 供应商相关
  "supplier", "supplier_contact",
  // 客户相关
  "member", "customer_price_binding", "customer_credit",
  // 库存相关
  "inventory_balance", "inventory_batch", "inventory_ledger",
  // 价格相关
  "price_level", "price_change_log",
  // 预警相关
  "alert_rule", "alert_record", "expiry_alert_config", "expiry_alert_record",
  // 溯源相关
  "trace_config", "trace_code", "trace_event_log", "trace_scan_log", "recall_record",
  // 门店控制相关
  "store_control_config", "store_status_log",
  // 销售相关
  "sale_bill", "sale_bill_item", "sale_return", "sale_return_item", "sale_payment",
  // 采购相关
  "purchase_order", "purchase_order_item", "purchase_in_stock", "purchase_in_stock_item",
  "purchase_return", "purchase_return_item", "purchase_payment",
  // 结算对账相关
  "supplier_statement", "supplier_statement_item", "customer_statement",
  "customer_payment", "receivable_account",
  // 支付相关
  "payment_order", "refund_order", "hold_order",
  // 小程序相关
  "miniapp_order", "miniapp_order_item",
  // 分享收款相关
  "collection_link", "collection_view_log", "collection_record",
  // 信用相关
  "credit_operation_log",
  // 通知相关
  "notification",
  // 日志相关
  "operation_log", "product_price_log",
  // 审批流程相关
  "approval_rule", "approval_instance", "approval_task", "approval_log",
  "approval_approver", "approval_notification",
  // 每日结算
  "daily_settlement",
];

export async function runMigrations(): Promise<void> {
  if (env.USE_MOCK_DB) return;

  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      multipleStatements: true,
      connectTimeout: 10000,
    });
  } catch (e: any) {
    console.error("[migration] 数据库连接失败，跳过迁移:", e.message);
    return;
  }

  try {
    // 第1步：创建 tenant 表
    console.log("[migration] 创建 tenant 表...");
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS tenant (
          id VARCHAR(36) PRIMARY KEY COMMENT '租户ID（UUID）',
          name VARCHAR(100) NOT NULL COMMENT '租户名称（公司名）',
          contact_name VARCHAR(50) COMMENT '联系人',
          contact_phone VARCHAR(20) COMMENT '联系电话',
          plan VARCHAR(20) DEFAULT 'basic' COMMENT '套餐：basic/professional/enterprise',
          status TINYINT DEFAULT 1 COMMENT '1=正常 0=停用',
          expire_at DATETIME COMMENT '到期时间',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_tenant_status (status),
          INDEX idx_tenant_expire (expire_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表'
      `);
    } catch (e: any) {
      console.error("[migration] 创建 tenant 表失败:", e.message);
    }

    // 插入默认租户
    try {
      await conn.query(`
        INSERT INTO tenant (id, name, contact_name, contact_phone, plan, status)
        VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `);
    } catch (e: any) {
      console.error("[migration] 插入默认租户失败:", e.message);
    }

    // 第2步：检查并添加 tenant_id 列
    console.log(`[migration] 开始为 ${TABLES_NEED_TENANT_ID.length} 张表添加 tenant_id...`);
    for (const table of TABLES_NEED_TENANT_ID) {
      try {
        // 检查列是否存在
        const [rows] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'`,
          [env.DB_NAME, table]
        );
        const count = (rows as any)[0]?.cnt ?? 0;

        if (Number(count) === 0) {
          // 用 SET @sql + PREPARE/EXECUTE 来添加列
          const alterSql = `ALTER TABLE \`${table}\` ADD COLUMN \`tenant_id\` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID' AFTER \`id\``;
          await conn.query("SET @sql = ?", [alterSql]);
          await conn.query("PREPARE stmt FROM @sql");
          await conn.query("EXECUTE stmt");
          await conn.query("DEALLOCATE PREPARE stmt");
          console.log(`[migration] ${table}: 已添加 tenant_id`);
        } else {
          console.log(`[migration] ${table}: tenant_id 已存在，跳过`);
        }

        // 添加索引
        const idxName = `idx_${table}_tenant`;
        const [idxRows] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [env.DB_NAME, table, idxName]
        );
        const idxCount = (idxRows as any)[0]?.cnt ?? 0;

        if (Number(idxCount) === 0) {
          const idxSql = `ALTER TABLE \`${table}\` ADD INDEX \`${idxName}\` (\`tenant_id\`)`;
          await conn.query("SET @sql = ?", [idxSql]);
          await conn.query("PREPARE stmt FROM @sql");
          await conn.query("EXECUTE stmt");
          await conn.query("DEALLOCATE PREPARE stmt");
          console.log(`[migration] ${table}: 已添加索引 ${idxName}`);
        }
      } catch (e: any) {
        if (e.message?.includes("Duplicate") || e.code === "ER_DUP_FIELDNAME" || e.code === "ER_DUP_KEYNAME") {
          console.log(`[migration] ${table}: 已存在，跳过`);
        } else {
          console.error(`[migration] ${table} 迁移失败:`, e.message);
        }
      }
    }

    // 第3步：更新已有数据的 tenant_id
    try {
      await conn.query(`UPDATE sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''`);
      await conn.query(`UPDATE store SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''`);
      console.log("[migration] 已更新默认租户数据");
    } catch (e: any) {
      console.error("[migration] 更新默认租户数据失败:", e.message);
    }

    // 第4步：执行 docs/migrations/ 目录下的其他 .sql 文件（跳过 add_tenant_id.sql，已由上面处理）
    const migrationsDir = resolve(process.cwd(), "docs/migrations");
    if (existsSync(migrationsDir)) {
      const { readdirSync: rs, readFileSync: rf } = await import("fs");
      const { join: j } = await import("path");
      const files = rs(migrationsDir).filter((f: string) => f.endsWith(".sql") && f !== "add_tenant_id.sql").sort();

      for (const file of files) {
        const sql = rf(j(migrationsDir, file), "utf-8");
        console.log(`[migration] 执行外部迁移: ${file}`);
        try {
          await conn.query(sql);
          console.log(`[migration] ${file} 完成`);
        } catch (e: any) {
          if (e.message?.includes("Duplicate") || e.message?.includes("already exists")) {
            console.log(`[migration] ${file}: 已执行过，跳过`);
          } else {
            console.error(`[migration] ${file} 失败:`, e.message);
          }
        }
      }
    }

    console.log("[migration] 所有迁移完成");
  } catch (e: any) {
    console.error("[migration] 迁移过程出错:", e.message);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}
