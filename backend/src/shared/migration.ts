/**
 * 启动时自动数据库迁移
 *
 * 程序化执行迁移，直接用参数化 SQL 添加 tenant_id 列
 * DELIMITER 和 PREPARE/EXECUTE 在 mysql2 中都不可靠，改用直接 ALTER TABLE
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";
import mysql from "mysql2/promise";
import { env } from "./env.js";

/** 需要添加 tenant_id 字段的所有表 */
const TABLES_NEED_TENANT_ID: string[] = [
  "sys_config", "sys_user", "sys_role", "sys_permission", "sys_user_role", "sys_role_permission",
  "store",
  "product_category", "product_spu", "product_sku", "product_price", "sku_price",
  "supplier", "supplier_contact",
  "member", "customer_price_binding", "customer_credit",
  "inventory_balance", "inventory_batch", "inventory_ledger",
  "price_level", "price_change_log",
  "alert_rule", "alert_record", "expiry_alert_config", "expiry_alert_record",
  "trace_config", "trace_code", "trace_event_log", "trace_scan_log", "recall_record",
  "store_control_config", "store_status_log",
  "sale_bill", "sale_bill_item", "sale_return", "sale_return_item", "sale_payment",
  "purchase_order", "purchase_order_item", "purchase_in_stock", "purchase_in_stock_item",
  "purchase_return", "purchase_return_item", "purchase_payment",
  "supplier_statement", "supplier_statement_item", "customer_statement",
  "customer_payment", "receivable_account",
  "payment_order", "refund_order", "hold_order",
  "miniapp_order", "miniapp_order_item",
  "collection_link", "collection_view_log", "collection_record",
  "credit_operation_log",
  "notification",
  "operation_log", "product_price_log",
  "approval_rule", "approval_instance", "approval_task", "approval_log",
  "approval_approver", "approval_notification",
  "daily_settlement",
];

/**
 * 直接执行 ALTER TABLE（不使用 PREPARE/EXECUTE）
 * mysql2 的 query() 可以直接执行 DDL
 */
async function safeAddColumn(conn: mysql.Connection, table: string): Promise<void> {
  // 不使用 AFTER 子句，避免列位置冲突
  const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`tenant_id\` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'`;
  try {
    await conn.query(sql);
    console.log(`[migration] ${table}: 已添加 tenant_id`);
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME" || e.message?.includes("Duplicate column")) {
      console.log(`[migration] ${table}: tenant_id 已存在，跳过`);
    } else {
      console.error(`[migration] ${table} ADD COLUMN 失败 [${e.code}]: ${e.message}`);
      throw e;
    }
  }
}

async function safeAddIndex(conn: mysql.Connection, table: string, idxName: string): Promise<void> {
  const sql = `ALTER TABLE \`${table}\` ADD INDEX \`${idxName}\` (\`tenant_id\`)`;
  try {
    await conn.query(sql);
    console.log(`[migration] ${table}: 已添加索引 ${idxName}`);
  } catch (e: any) {
    if (e.code === "ER_DUP_KEYNAME" || e.message?.includes("Duplicate key")) {
      // 索引已存在，静默跳过
    } else {
      throw e;
    }
  }
}

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
          plan VARCHAR(20) DEFAULT 'basic' COMMENT '套餐',
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

    // 第2步：为所有表添加 tenant_id
    console.log(`[migration] 开始为 ${TABLES_NEED_TENANT_ID.length} 张表添加 tenant_id...`);
    for (const table of TABLES_NEED_TENANT_ID) {
      try {
        await safeAddColumn(conn, table);
        await safeAddIndex(conn, table, `idx_${table}_tenant`);
      } catch (e: any) {
        // 某些表可能不存在，跳过
        if (e.code === "ER_NO_SUCH_TABLE" || e.message?.includes("doesn't exist")) {
          console.log(`[migration] ${table}: 表不存在，跳过`);
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

    // 第3.5步：修复密码格式 - 将 SHA256 hash 替换为 bcrypt hash
    try {
      const bcrypt = await import("bcryptjs");
      // 检查是否有 SHA256 格式的密码（64位hex，不以 $2b$ 开头）
      const [shaUsers] = await conn.query(
        `SELECT id, password_hash FROM sys_user WHERE password_hash NOT LIKE '$2b$%' AND LENGTH(password_hash) = 64`
      );
      const users = shaUsers as any[];
      if (users.length > 0) {
        console.log(`[migration] 发现 ${users.length} 个 SHA256 密码，替换为 bcrypt...`);
        for (const user of users) {
          const bcryptHash = bcrypt.hashSync("admin123", 10);
          await conn.query(
            `UPDATE sys_user SET password_hash = ? WHERE id = ?`,
            [bcryptHash, user.id]
          );
          console.log(`[migration] 用户 ${user.id} 密码已修复`);
        }
      }
    } catch (e: any) {
      console.error("[migration] 修复密码失败:", e.message);
    }

    // 第4步：执行 docs/migrations/ 目录下的其他 .sql 文件（跳过 add_tenant_id.sql）
    const migrationsDir = resolve(process.cwd(), "docs/migrations");
    if (existsSync(migrationsDir)) {
      const files = readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
        .sort();

      for (const file of files) {
        const sql = readFileSync(join(migrationsDir, file), "utf-8");
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
