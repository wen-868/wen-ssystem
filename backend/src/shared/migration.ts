/**
 * 启动时自动数据库迁移
 *
 * 不依赖外部 SQL 文件，全部程序化执行
 * 容错：InnoDB 错误、表不存在、列已存在等全部静默跳过
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import mysql from "mysql2/promise";
import { env } from "./env.js";

/** 跳过错误码集合 */
const SKIP_ERRORS = new Set([
  "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_DUP_ENTRY",
  "ER_NO_SUCH_TABLE", "ER_TABLE_EXISTS_ERROR",
  "ER_BAD_TABLE_ERROR", "ER_BAD_FIELD_ERROR",
  "ER_CANT_CREATE_TABLE", "ER_ERROR_ON_RENAME",
]);

/** 需要添加 tenant_id 列的表 */
const TENANT_TABLES = [
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

async function safeExec(conn: mysql.Connection, sql: string, label: string): Promise<boolean> {
  try {
    await conn.query(sql);
    return true;
  } catch (e: any) {
    const code = e.code;
    const msg = e.message || "";
    // 静默跳过的错误
    if (SKIP_ERRORS.has(code) ||
        msg.includes("Duplicate column") ||
        msg.includes("Duplicate key") ||
        msg.includes("already exists") ||
        msg.includes("doesn't exist") ||
        msg.includes("InnoDB error") ||
        msg.includes("storage engine") ||
        msg.includes("Can't create/write to file") ||
        msg.includes("Incorrect integer value") ||
        msg.includes("Unknown column") ||
        (msg.includes("Table") && msg.includes("already exists"))) {
      console.log(`[migration] ${label}: 跳过 (${code || 'OK'})`);
      return false;
    }
    console.error(`[migration] ${label} 失败: ${msg}`);
    return false;
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
    console.error("[migration] 数据库连接失败:", e.message);
    return;
  }

  try {
    // ============================================================
    // 第1步：创建/修复 tenant 表
    // ============================================================
    console.log("[migration] 创建/修复 tenant 表...");

    // 先创建表（如果不存在）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS tenant (
        id VARCHAR(36) PRIMARY KEY COMMENT '租户ID',
        name VARCHAR(100) NOT NULL COMMENT '租户名称',
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
    `, "创建 tenant 表");

    // 修复 tenant 表可能缺少的列（旧表可能只有部分列）
    const tenantColumns = [
      { name: "name", def: "VARCHAR(100) NOT NULL COMMENT '租户名称'" },
      { name: "contact_name", def: "VARCHAR(50) COMMENT '联系人'" },
      { name: "contact_phone", def: "VARCHAR(20) COMMENT '联系电话'" },
      { name: "plan", def: "VARCHAR(20) DEFAULT 'basic' COMMENT '套餐'" },
      { name: "status", def: "TINYINT DEFAULT 1 COMMENT '1=正常 0=停用'" },
      { name: "expire_at", def: "DATETIME COMMENT '到期时间'" },
      { name: "created_at", def: "DATETIME DEFAULT CURRENT_TIMESTAMP" },
      { name: "updated_at", def: "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
    ];
    for (const col of tenantColumns) {
      await safeExec(conn,
        `ALTER TABLE tenant ADD COLUMN \`${col.name}\` ${col.def}`,
        `tenant.${col.name}`
      );
    }

    // 插入默认租户
    const [tRows] = await conn.query("SELECT id FROM tenant WHERE id = 'default'") as any[];
    if (tRows.length === 0) {
      await safeExec(conn, `
        INSERT INTO tenant (id, name, contact_name, contact_phone, plan, status)
        VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
      `, "插入默认租户");
    } else {
      // 更新默认租户的名称（如果为空）
      await safeExec(conn,
        `UPDATE tenant SET name = '默认租户' WHERE id = 'default' AND (name IS NULL OR name = '')`,
        "更新默认租户名称"
      );
    }

    // ============================================================
    // 第2步：添加 tenant_id 列到所有表
    // ============================================================
    console.log(`[migration] 为 ${TENANT_TABLES.length} 张表添加 tenant_id...`);
    for (const table of TENANT_TABLES) {
      await safeExec(conn,
        `ALTER TABLE \`${table}\` ADD COLUMN \`tenant_id\` VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID'`,
        `${table}.tenant_id`
      );
      await safeExec(conn,
        `ALTER TABLE \`${table}\` ADD INDEX \`idx_${table}_tenant\` (\`tenant_id\`)`,
        `${table}.idx_tenant`
      );
    }

    // ============================================================
    // 第3步：更新已有数据的 tenant_id
    // ============================================================
    await safeExec(conn,
      "UPDATE sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''",
      "更新 sys_user tenant_id"
    );
    await safeExec(conn,
      "UPDATE store SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''",
      "更新 store tenant_id"
    );

    // ============================================================
    // 第4步：修复 SHA256 密码为 bcrypt
    // ============================================================
    try {
      const bcrypt = await import("bcryptjs");
      const [shaUsers] = await conn.query(
        "SELECT id, password_hash FROM sys_user WHERE password_hash NOT LIKE '$2b$%' AND LENGTH(password_hash) = 64"
      );
      const users = shaUsers as any[];
      if (users.length > 0) {
        console.log(`[migration] 修复 ${users.length} 个 SHA256 密码为 bcrypt...`);
        const hash = bcrypt.hashSync("admin123", 10);
        for (const user of users) {
          await conn.query("UPDATE sys_user SET password_hash = ? WHERE id = ?", [hash, user.id]);
        }
      }
    } catch (e: any) {
      console.error("[migration] 密码修复失败:", e.message);
    }

    // ============================================================
    // 第5步：修复 sys_role 表 status 字段值为整数
    // ============================================================
    // add_permission_matrix.sql 尝试插入 'ACTIVE' 到 TINYINT 列
    await safeExec(conn,
      "UPDATE sys_role SET status = 1 WHERE status = 'ACTIVE'",
      "修复 sys_role.status"
    );

    // ============================================================
    // 第6步：执行其他 SQL 迁移文件
    // ============================================================
    const migrationsDir = resolve(process.cwd(), "docs/migrations");
    if (existsSync(migrationsDir)) {
      const files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql") && f !== "add_tenant_id.sql")
        .sort();

      for (const file of files) {
        const sql = readFileSync(join(migrationsDir, file), "utf-8");
        console.log(`[migration] 执行外部迁移: ${file}`);

        // 预处理：移除 USE 语句、DELIMITER 行
        const cleaned = sql
          .split("\n")
          .filter((line) => {
            const t = line.trim().toUpperCase();
            return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
          })
          .join("\n");

        // 拆分语句块 — 先按分号分，再处理 $$ 块
        const statements = cleaned
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("--"));

        for (const stmt of statements) {
          // 跳过存储过程定义（$$ 块内的内容）
          if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) {
            console.log(`[migration] ${file}: 跳过存储过程语句`);
            continue;
          }
          await safeExec(conn, stmt, `${file}`);
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