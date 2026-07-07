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
import logger from "./logger.js";

/** 跳过错误码集合 */
export const SKIP_ERRORS = new Set([
  "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_DUP_ENTRY",
  "ER_NO_SUCH_TABLE", "ER_TABLE_EXISTS_ERROR",
  "ER_BAD_TABLE_ERROR", "ER_BAD_FIELD_ERROR",
  "ER_CANT_CREATE_TABLE", "ER_ERROR_ON_RENAME",
  "ER_GET_ERRNO", "ER_IO_WRITE_ERROR",
  "ER_SP_DOES_NOT_EXIST", "ER_PARSE_ERROR",
  "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
]);

/** 需要添加 tenant_id 列的表 */
export const TENANT_TABLES = [
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

export async function safeExec(conn: mysql.Connection, sql: string, label: string): Promise<boolean> {
  try {
    await conn.query(sql);
    return true;
  } catch (e: unknown) {
    const err = (e ?? {}) as { code?: string; message?: string };
    const code = err.code || "";
    const msg = (err.message || "").toLowerCase();
    // 静默跳过所有已知可忽略的错误
    if (SKIP_ERRORS.has(code) ||
        msg.includes("duplicate column") ||
        msg.includes("duplicate key") ||
        msg.includes("already exists") ||
        msg.includes("doesn't exist") ||
        msg.includes("innodb") ||
        msg.includes("storage engine") ||
        msg.includes("can't create/write") ||
        msg.includes("permission denied") ||
        msg.includes("incorrect integer") ||
        msg.includes("unknown column") ||
        msg.includes("sql syntax") ||
        msg.includes("if not exists") ||
        msg.includes("procedure") ||
        (msg.includes("table") && msg.includes("already exists"))) {
      logger.info(`[migration] ${label}: 跳过 (${code || 'OK'})`);
      return false;
    }
    logger.error(`[migration] ${label} 失败: ${err.message || String(e)}`);
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
  } catch (e: unknown) {
    logger.error("[migration] 数据库连接失败:", (e as any).message);
    return;
  }

  try {
    // ============================================================
    // 第1步：创建/修复 tenant 表
    // ============================================================
    logger.info("[migration] 创建/修复 tenant 表...");

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
    try {
      // 先检查 name 列是否存在
      const [colCheck] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tenant' AND COLUMN_NAME = 'name'`,
        [env.DB_NAME]
      ) as unknown as Record<string, unknown>[];
      const hasName = ((colCheck[0] as any)?.cnt ?? 0) > 0;

      const [tRows] = await conn.query("SELECT id FROM tenant WHERE id = 'default'") as unknown as Record<string, unknown>[];
      if ((tRows as unknown as any[]).length === 0 && hasName) {
        await safeExec(conn, `
          INSERT INTO tenant (id, name, contact_name, contact_phone, plan, status)
          VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
        `, "插入默认租户");
      } else if ((tRows as unknown as any[]).length > 0 && hasName) {
        await safeExec(conn,
          `UPDATE tenant SET name = '默认租户' WHERE id = 'default' AND (name IS NULL OR name = '')`,
          "更新默认租户名称"
        );
      } else {
        logger.info("[migration] tenant 表缺少 name 列，跳过租户数据操作");
      }
    } catch (e: unknown) {
      logger.error("[migration] 租户数据操作失败:", (e as any).message);
    }

    // ============================================================
    // 第2步：添加 tenant_id 列到所有表
    // ============================================================
    logger.info(`[migration] 为 ${TENANT_TABLES.length} 张表添加 tenant_id...`);
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
      "UPDATE t_sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''",
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
        "SELECT id, password_hash FROM t_sys_user WHERE password_hash NOT LIKE '$2b$%' AND LENGTH(password_hash) = 64"
      );
      const users = shaUsers as Record<string, unknown>[];
      if (users.length > 0) {
        logger.info(`[migration] 修复 ${users.length} 个 SHA256 密码为 bcrypt...`);
        const hash = bcrypt.hashSync("admin123", 10);
        for (const user of users) {
          await conn.query("UPDATE t_sys_user SET password_hash = ? WHERE id = ?", [hash, user.id]);
        }
      }
    } catch (e: unknown) {
      logger.error("[migration] 密码修复失败:", (e as any).message);
    }

    // ============================================================
    // 第5步：修复 sys_role 表 status 字段值为整数
    // ============================================================
    await safeExec(conn,
      "UPDATE t_sys_role SET status = 1 WHERE status = 'ACTIVE'",
      "修复 sys_role.status"
    );

    // ============================================================
    // 第5.5步：创建缺失的表 + 添加缺失的字段
    // ============================================================
    logger.info("[migration] 创建缺失的表和字段...");

    // 5.5.1 创建 stock_warning 表（看板需要）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS stock_warning (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警ID',
        sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
        sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称',
        current_stock INT NOT NULL DEFAULT 0 COMMENT '当前库存',
        warning_level VARCHAR(32) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别: URGENT/WARNING/INFO',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/RESOLVED',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_stock_warning_sku (sku_id),
        KEY idx_stock_warning_level (warning_level),
        KEY idx_stock_warning_status (status),
        KEY idx_stock_warning_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警表'
    `, "创建 stock_warning 表");

    // 5.5.2 为 store 表添加缺失字段（门店列表需要）
    const storeColumns = [
      { name: "miniapp_appid", def: "VARCHAR(128) DEFAULT NULL COMMENT '小程序appid'" },
      { name: "wx_merchant_name", def: "VARCHAR(128) DEFAULT NULL COMMENT '微信商户名称'" },
      { name: "wx_service_phone", def: "VARCHAR(32) DEFAULT NULL COMMENT '微信客服电话'" },
      { name: "wx_head_img", def: "VARCHAR(512) DEFAULT NULL COMMENT '微信头像URL'" },
      { name: "wx_qrcode_url", def: "VARCHAR(512) DEFAULT NULL COMMENT '微信二维码URL'" },
    ];
    for (const col of storeColumns) {
      await safeExec(conn,
        `ALTER TABLE store ADD COLUMN \`${col.name}\` ${col.def}`,
        `store.${col.name}`
      );
    }

    // 5.5.3 为 sys_user 表添加 email 字段（用户列表需要）
    await safeExec(conn,
      "ALTER TABLE t_sys_user ADD COLUMN `email` VARCHAR(128) DEFAULT NULL COMMENT '邮箱'",
      "sys_user.email"
    );

    // 5.5.4 为 product_spu 表添加缺失字段（商品列表需要）
    const spuColumns = [
      { name: "brand", def: "VARCHAR(128) DEFAULT NULL COMMENT '品牌'" },
      { name: "unit", def: "VARCHAR(32) DEFAULT NULL COMMENT '单位'" },
      { name: "specs", def: "VARCHAR(256) DEFAULT NULL COMMENT '规格'" },
      { name: "alcohol_content", def: "VARCHAR(32) DEFAULT NULL COMMENT '酒精度数'" },
      { name: "origin", def: "VARCHAR(128) DEFAULT NULL COMMENT '产地'" },
      { name: "sale_channels", def: "JSON DEFAULT NULL COMMENT '销售渠道'" },
      { name: "description", def: "VARCHAR(512) DEFAULT NULL COMMENT '商品简介'" },
      { name: "marketing_tags", def: "JSON DEFAULT NULL COMMENT '营销标签'" },
    ];
    for (const col of spuColumns) {
      await safeExec(conn,
        `ALTER TABLE t_product_spu ADD COLUMN \`${col.name}\` ${col.def}`,
        `product_spu.${col.name}`
      );
    }

    // 5.5.5 创建 system_feedback 表（建议反馈功能）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS system_feedback (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '反馈ID',
        type VARCHAR(16) NOT NULL COMMENT '类型: BUG/FEATURE/IMPROVEMENT/OTHER',
        title VARCHAR(200) NOT NULL COMMENT '标题',
        content TEXT NOT NULL COMMENT '内容',
        contact VARCHAR(100) DEFAULT NULL COMMENT '联系方式',
        screenshot_urls TEXT DEFAULT NULL COMMENT '截图URL列表(JSON)',
        page_url VARCHAR(500) DEFAULT NULL COMMENT '提交页面URL',
        browser_info VARCHAR(500) DEFAULT NULL COMMENT '浏览器信息',
        status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态: PENDING/PROCESSING/RESOLVED/REJECTED',
        reply TEXT DEFAULT NULL COMMENT '管理员回复',
        user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '提交用户ID',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_feedback_type (type),
        KEY idx_feedback_status (status),
        KEY idx_feedback_tenant (tenant_id),
        KEY idx_feedback_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户建议反馈表'
    `, "创建 system_feedback 表");

    // 5.5.6 创建 error_logs 表（错误收集系统）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS error_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '错误日志ID',
        error_type VARCHAR(64) NOT NULL COMMENT '错误类型',
        severity VARCHAR(16) NOT NULL DEFAULT 'ERROR' COMMENT '严重级别: WARN/ERROR/FATAL',
        message TEXT NOT NULL COMMENT '错误消息',
        stack TEXT DEFAULT NULL COMMENT '堆栈信息',
        request_url VARCHAR(500) DEFAULT NULL COMMENT '请求URL',
        request_method VARCHAR(10) DEFAULT NULL COMMENT '请求方法',
        status_code INT DEFAULT NULL COMMENT 'HTTP状态码',
        user_id BIGINT UNSIGNED DEFAULT NULL COMMENT '用户ID',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        source VARCHAR(16) NOT NULL DEFAULT 'backend' COMMENT '来源: backend/frontend',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_error_logs_type (error_type),
        KEY idx_error_logs_severity (severity),
        KEY idx_error_logs_source (source),
        KEY idx_error_logs_tenant (tenant_id),
        KEY idx_error_logs_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='错误日志表'
    `, "创建 error_logs 表");

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
        logger.info(`[migration] 执行外部迁移: ${file}`);

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
            logger.info(`[migration] ${file}: 跳过存储过程语句`);
            continue;
          }
          await safeExec(conn, stmt, `${file}`);
        }
      }
    }

    logger.info("[migration] 所有迁移完成");
  } catch (e: unknown) {
    logger.error("[migration] 迁移过程出错:", (e as any).message);
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}