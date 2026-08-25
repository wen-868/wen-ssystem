/**
 * 启动时自动数据库迁移
 *
 * 不依赖外部 SQL 文件，全部程序化执行
 * 容错：InnoDB 错误、表不存在、列已存在等全部静默跳过
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import mysql from "mysql2/promise";
import { env } from "./env";
import logger from "./logger";
import { seedData } from "./seed-data";

/** 在多个候选路径中查找 SQL 文件 */
function findSqlFile(fileName: string) {
  const candidates = [
    resolve(process.cwd(), "docs/migrations", fileName),
    resolve(process.cwd(), "docs", fileName),
    resolve(process.cwd(), "../docs/migrations", fileName),
    resolve(process.cwd(), "../docs", fileName),
    resolve(process.cwd(), "../../docs/migrations", fileName),
    resolve(process.cwd(), "../../docs", fileName),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`找不到数据库脚本 ${fileName}，已尝试：${candidates.join(", ")}`);
  }
  return found;
}

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

/** 需要添加 tenant_id 列的表（全部 t_ 前缀） */
export const TENANT_TABLES = [
  "t_sys_config", "t_sys_user", "t_sys_role", "t_sys_permission", "t_sys_user_role", "t_sys_role_permission",
  "t_store",
  "t_product_category", "t_product_spu", "t_product_sku", "t_product_price", "t_sku_price",
  "t_brand", // 070_品牌表.sql 迁移，商品JOIN依赖
  "t_supplier", "t_supplier_contact",
  "t_member", "t_customer_type", "t_customer_price_binding", "t_customer_credit",
  "t_inventory_balance", "t_inventory_batch", "t_inventory_ledger",
  "t_price_level", "t_price_change_log",
  "t_alert_rule", "t_alert_record", "t_expiry_alert_config", "t_expiry_alert_record",
  "t_trace_config", "t_trace_code", "t_trace_event_log", "t_trace_scan_log", "t_recall_record",
  "t_store_control_config", "t_store_status_log",
  "t_sale_bill", "t_sale_bill_item", "t_sale_return", "t_sale_return_item", "t_sale_payment",
  "t_purchase_order", "t_purchase_order_item", "t_purchase_in_stock", "t_purchase_in_stock_item",
  "t_purchase_return", "t_purchase_return_item", "t_purchase_payment",
  "t_supplier_statement", "t_supplier_statement_item", "t_customer_statement",
  "t_customer_payment", "t_receivable_account",
  "t_payment_order", "t_refund_order", "t_hold_order",
  "t_miniapp_order", "t_miniapp_order_item",
  "t_collection_link", "t_collection_view_log", "t_collection_record",
  "t_credit_operation_log",
  "t_notification",
  "t_operation_log", "t_product_price_log",
  "t_approval_rule", "t_approval_instance", "t_approval_task", "t_approval_log",
  "t_approval_approver", "t_approval_notification",
  "t_daily_settlement",
  "t_stock_warning", // 5.5.1 新建看板预警表
];

/** 跳过错误消息模式集合 */
export const SKIP_PATTERNS = [
  "duplicate column", "duplicate key", "already exists", "doesn't exist",
  "innodb", "storage engine", "can't create/write", "permission denied",
  "incorrect integer", "unknown column", "sql syntax", "if not exists",
  "procedure",
];

/** 给 SQL 语句中的表名加 t_ 前缀 */
export function addTablePrefix(sql: string): string {
  let result = sql;
  const patterns = [
    /(CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)([a-z_][a-z0-9_]*)/gi,
    /(ALTER\s+TABLE\s+)([a-z_][a-z0-9_]*)/gi,
    /(INSERT\s+INTO\s+)([a-z_][a-z0-9_]*)/gi,
    // 仅匹配语句开头的 UPDATE（防止误伤 ON UPDATE CURRENT_TIMESTAMP / ON DUPLICATE KEY UPDATE col）
    /((?:^|\n)\s*UPDATE\s+)([a-z_][a-z0-9_]*)/gim,
    /(DELETE\s+FROM\s+)([a-z_][a-z0-9_]*)/gi,
    /(FROM\s+)([a-z_][a-z0-9_]*)/gi,
    /(JOIN\s+)([a-z_][a-z0-9_]*)/gi,
    /(INTO\s+)([a-z_][a-z0-9_]*)/gi,
    /(RENAME\s+TABLE\s+)([a-z_][a-z0-9_]*)/gi,
    /(DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?)([a-z_][a-z0-9_]*)/gi,
  ];
  for (const pattern of patterns) {
    result = result.replace(pattern, (match, prefix, tableName) => {
      if (tableName.startsWith("t_") || tableName.startsWith("information_schema") || tableName.startsWith("mysql")) {
        return match;
      }
      return prefix + "t_" + tableName;
    });
  }
  return result;
}

export async function safeExec(conn: mysql.Connection, sql: string, label: string): Promise<boolean> {
  try {
    await conn.query(sql);
    return true;
  } catch (e: unknown) {
    const err = (e ?? {}) as { code?: string; message?: string };
    const code = err.code || "";
    const msg = (err.message || "").toLowerCase();
    // 静默跳过所有已知可忽略的错误（"already exists" 等已在 SKIP_PATTERNS 中覆盖）
    const shouldSkip = SKIP_ERRORS.has(code)
      || SKIP_PATTERNS.some((p) => msg.includes(p));
    if (shouldSkip) {
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
    // 第0步：创建核心系统表（如果不存在）
    // ============================================================
    logger.info("[migration] 检查/创建核心系统表...");

    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_sys_user (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL COMMENT '用户名',
        password_hash VARCHAR(255) NOT NULL COMMENT '密码hash',
        real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
        email VARCHAR(128) DEFAULT NULL COMMENT '邮箱',
        phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
        store_id INT UNSIGNED DEFAULT NULL COMMENT '所属门店ID',
        status TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=正常 0=禁用',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        login_fail_count INT DEFAULT 0 COMMENT '登录失败次数',
        locked_until DATETIME DEFAULT NULL COMMENT '锁定截止时间',
        last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
        default_homepage VARCHAR(50) DEFAULT NULL COMMENT '默认首页',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_username_tenant (username, tenant_id),
        KEY idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表'
    `, "创建 t_sys_user 表");

    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_sys_role (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        role_code VARCHAR(50) NOT NULL COMMENT '角色编码',
        role_name VARCHAR(50) NOT NULL COMMENT '角色名称',
        description VARCHAR(255) DEFAULT NULL COMMENT '角色描述',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_role_code_tenant (role_code, tenant_id),
        KEY idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色表'
    `, "创建 t_sys_role 表");

    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_sys_user_role (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL COMMENT '用户ID',
        role_id INT UNSIGNED NOT NULL COMMENT '角色ID',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_role_tenant (user_id, role_id, tenant_id),
        KEY idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表'
    `, "创建 t_sys_user_role 表");

    // ============================================================
    // 第1步：创建/修复 t_tenant 表
    // ============================================================
    logger.info("[migration] 创建/修复 t_tenant 表...");

    // 先创建表（如果不存在）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_tenant (
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
    `, "创建 t_tenant 表");

    // 修复 t_tenant 表可能缺少的列（旧表可能只有部分列）
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
        `ALTER TABLE t_tenant ADD COLUMN \`${col.name}\` ${col.def}`,
        `t_tenant.${col.name}`
      );
    }

    // 插入默认租户
    try {
      // 先检查 name 列是否存在
      const [colCheck] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 't_tenant' AND COLUMN_NAME = 'name'`,
        [env.DB_NAME]
      ) as unknown as Record<string, unknown>[];
      const hasName = ((colCheck[0] as any)?.cnt ?? 0) > 0;

      const [tRows] = await conn.query("SELECT id FROM t_tenant WHERE id = 'default'") as unknown as Record<string, unknown>[];
      if ((tRows as unknown as any[]).length === 0 && hasName) {
        await safeExec(conn, `
          INSERT INTO t_tenant (id, name, contact_name, contact_phone, plan, status)
          VALUES ('default', '默认租户', '系统管理员', '13800138000', 'basic', 1)
        `, "插入默认租户");
      } else if ((tRows as unknown as any[]).length > 0 && hasName) {
        await safeExec(conn,
          `UPDATE t_tenant SET name = '默认租户' WHERE id = 'default' AND (name IS NULL OR name = '')`,
          "更新默认租户名称"
        );
      } else {
        logger.info("[migration] t_tenant 表缺少 name 列，跳过租户数据操作");
      }
    } catch (e: unknown) {
      logger.error("[migration] 租户数据操作失败:", (e as any).message);
    }

    // ============================================================
    // 第1.5步：从 init_database.sql 创建所有业务表（62张，全部 t_ 前缀）
    // ============================================================
    logger.info("[migration] 检查/创建业务表（init_database.sql）...");
    try {
      const initDbPath = findSqlFile("init_database.sql");
      if (existsSync(initDbPath)) {
        let initSql = readFileSync(initDbPath, "utf8");
        // 去掉 CREATE DATABASE / USE 语句（已在外部选择数据库）
        initSql = initSql.replace(/CREATE\s+DATABASE[^;]+;/gi, "");
        initSql = initSql.replace(/USE\s+\w+;/gi, "");
        initSql = initSql.replace(/SET\s+FOREIGN_KEY_CHECKS[^;]+;/gi, "");
        initSql = initSql.replace(/SET\s+NAMES[^;]+;/gi, "");

        // 拆分语句，只执行 CREATE TABLE 语句
        const statements = initSql
          .split(";")
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.toUpperCase().startsWith("CREATE TABLE"));

        let created = 0;
        let skipped = 0;
        for (const stmt of statements) {
          try {
            await conn.query(stmt);
            created++;
          } catch (e: any) {
            // ER_TABLE_EXISTS_ERROR = 已存在，正常跳过
            if (SKIP_ERRORS.has(e.code)) {
              skipped++;
            } else {
              logger.warn(`[migration] init_database 建表失败(${e.code}): ${String(e.message || "").slice(0, 120)}`);
            }
          }
        }
        logger.info(`[migration] init_database.sql 业务表完成（总${statements.length}张，实际建${created}，已存在跳过${skipped}）`);
      } else {
        logger.warn("[migration] init_database.sql 未找到，将仅依赖 Step5.5 兜底建表");
      }
    } catch (e: unknown) {
      // 错误不中止，后续 Step5.5 仍有兜底建表逻辑（6 张高频依赖表）
      logger.error("[migration] init_database.sql 解析失败（已启动 Step5.5 兜底建表）:", (e as any).message);
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
    // 第2.5步：t_sys_config 唯一键改为按租户隔离 (config_key, tenant_id)
    // 原 uk_config_key 仅对 config_key 全局唯一，多租户同配置键会冲突；
    // 后端读写均为 config_key + tenant_id（batchUpdateConfigs/platform-msg-config）。
    // 幂等：DROP 不存在/ADD 已存在均由 safeExec 跳过。
    // ============================================================
    logger.info("[migration] 修复 t_sys_config 唯一键为 (config_key, tenant_id)...");
    await safeExec(conn,
      "ALTER TABLE t_sys_config DROP INDEX uk_config_key, ADD UNIQUE KEY uk_config_key_tenant (config_key, tenant_id)",
      "t_sys_config.uk_config_key_tenant"
    );

    // ============================================================
    // 第3步：更新已有数据的 tenant_id
    // ============================================================
    await safeExec(conn,
      "UPDATE t_sys_user SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''",
      "更新 sys_user tenant_id"
    );
    await safeExec(conn,
      "UPDATE t_store SET tenant_id = 'default' WHERE tenant_id IS NULL OR tenant_id = ''",
      "更新 t_store tenant_id"
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

    // 5.5.1 创建 t_stock_warning 表（看板需要）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_stock_warning (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '预警ID',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        sku_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'SKU ID',
        sku_name VARCHAR(128) DEFAULT NULL COMMENT 'SKU名称',
        current_stock INT NOT NULL DEFAULT 0 COMMENT '当前库存',
        warning_threshold INT NOT NULL DEFAULT 0 COMMENT '预警阈值',
        warning_level VARCHAR(32) NOT NULL DEFAULT 'WARNING' COMMENT '预警级别: URGENT/WARNING/INFO',
        store_name VARCHAR(100) DEFAULT NULL COMMENT '门店名称',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/RESOLVED',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        KEY idx_stock_warning_sku (sku_id),
        KEY idx_stock_warning_level (warning_level),
        KEY idx_stock_warning_status (status),
        KEY idx_stock_warning_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警表'
    `, "创建 t_stock_warning 表");

    // 5.5.1b 创建 t_store_control_config 表（门店管控需要）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_store_control_config (
        id INT NOT NULL AUTO_INCREMENT COMMENT '配置ID',
        store_id INT NOT NULL COMMENT '门店ID',
        auto_open_time VARCHAR(10) DEFAULT NULL COMMENT '自动开门时间 HH:mm',
        auto_close_time VARCHAR(10) DEFAULT NULL COMMENT '自动关门时间 HH:mm',
        max_daily_orders INT DEFAULT NULL COMMENT '每日最大订单数',
        max_order_amount DECIMAL(12,2) DEFAULT NULL COMMENT '单笔最大金额',
        suspended_reason VARCHAR(255) DEFAULT NULL COMMENT '停用原因',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        UNIQUE KEY uk_store_tenant (store_id, tenant_id),
        KEY idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店管控配置表'
    `, "创建 t_store_control_config 表");

    // 5.5.2 为 t_store 表添加缺失字段（门店列表需要）
    const storeColumns = [
      { name: "miniapp_appid", def: "VARCHAR(128) DEFAULT NULL COMMENT '小程序appid'" },
      { name: "wx_merchant_name", def: "VARCHAR(128) DEFAULT NULL COMMENT '微信商户名称'" },
      { name: "wx_service_phone", def: "VARCHAR(32) DEFAULT NULL COMMENT '微信客服电话'" },
      { name: "wx_head_img", def: "VARCHAR(512) DEFAULT NULL COMMENT '微信头像URL'" },
      { name: "wx_qrcode_url", def: "VARCHAR(512) DEFAULT NULL COMMENT '微信二维码URL'" },
    ];
    for (const col of storeColumns) {
      await safeExec(conn,
        `ALTER TABLE t_store ADD COLUMN \`${col.name}\` ${col.def}`,
        `t_store.${col.name}`
      );
    }

    // 5.5.3 为 sys_user 表添加 email 字段（用户列表需要）
    await safeExec(conn,
      "ALTER TABLE t_sys_user ADD COLUMN `email` VARCHAR(128) DEFAULT NULL COMMENT '邮箱'",
      "sys_user.email"
    );

    // 5.5.3c 创建 t_brand 表（商品品牌），init_database.sql 中缺失，仅在 070_品牌表.sql 有建表
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_brand (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '品牌ID',
        name VARCHAR(64) NOT NULL COMMENT '品牌名称',
        logo VARCHAR(512) DEFAULT NULL COMMENT '品牌Logo',
        description VARCHAR(255) DEFAULT NULL COMMENT '品牌描述',
        sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
        status TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=启用 0=停用',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        PRIMARY KEY (id),
        KEY idx_brand_tenant (tenant_id),
        KEY idx_brand_sort (sort_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='品牌表'
    `, "创建 t_brand 表");

    // 5.5.3d 兜底创建 6 张核心API高频依赖表（与 init_database.sql 重复但不冲突）
    //     原因：R66-14 排查发现若 init_database.sql 解析失败或路径异常，Step1.5 会静默跳过，
    //     导致 dashboard/sales/products 等 12 个高频 API 因缺表抛 500
    const coreTablesSql: Array<[string, string]> = [
      // 商品三表（/api/admin/products 依赖）
      ["t_product_category", `
        CREATE TABLE IF NOT EXISTS t_product_category (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          parent_id BIGINT UNSIGNED DEFAULT NULL COMMENT '父分类ID',
          name VARCHAR(64) NOT NULL COMMENT '分类名称',
          icon VARCHAR(256) DEFAULT NULL COMMENT '分类图标',
          code VARCHAR(64) DEFAULT NULL COMMENT '分类编码',
          sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
          status TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=启用 0=停用',
          allow_online_sale TINYINT NOT NULL DEFAULT 1 COMMENT '是否允许线上销售 1=允许 0=禁止',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          KEY idx_product_category_parent (parent_id),
          KEY idx_product_category_status (status, sort_no),
          KEY idx_product_category_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表'
      `],
      ["t_product_spu", `
        CREATE TABLE IF NOT EXISTS t_product_spu (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          spu_code VARCHAR(64) NOT NULL COMMENT '商品编码',
          name VARCHAR(128) NOT NULL COMMENT '商品名称',
          category_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '分类ID',
          brand_id BIGINT UNSIGNED DEFAULT NULL COMMENT '品牌ID',
          brand VARCHAR(128) DEFAULT NULL COMMENT '品牌（冗余名称，迁移兼容）',
          unit VARCHAR(32) DEFAULT NULL COMMENT '单位',
          specs VARCHAR(256) DEFAULT NULL COMMENT '规格',
          alcohol_content VARCHAR(32) DEFAULT NULL COMMENT '酒精度数',
          origin VARCHAR(128) DEFAULT NULL COMMENT '产地',
          main_image VARCHAR(512) DEFAULT NULL COMMENT '主图URL',
          image_urls JSON DEFAULT NULL COMMENT '轮播图URL(JSON)',
          detail TEXT DEFAULT NULL COMMENT '商品详情HTML',
          sale_channels JSON DEFAULT NULL COMMENT '可售渠道(MINIAPP/STORE等JSON)',
          sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
          is_new TINYINT NOT NULL DEFAULT 0 COMMENT '新品标记 1=是 0=否',
          is_recommend TINYINT NOT NULL DEFAULT 0 COMMENT '推荐标记 1=是 0=否',
          description VARCHAR(512) DEFAULT NULL COMMENT '商品简介',
          marketing_tags JSON DEFAULT NULL COMMENT '营销标签(JSON)',
          status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '状态 DRAFT/ON_SALE/OFF_SALE/DELETED',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_product_spu_code (spu_code),
          KEY idx_product_spu_category_status (category_id, status),
          KEY idx_product_spu_brand (brand_id),
          KEY idx_product_spu_tenant (tenant_id),
          FULLTEXT KEY ft_product_spu_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品SPU表'
      `],
      ["t_product_sku", `
        CREATE TABLE IF NOT EXISTS t_product_sku (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'SKU ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          spu_id BIGINT UNSIGNED NOT NULL COMMENT '关联SPU ID',
          sku_code VARCHAR(64) NOT NULL COMMENT 'SKU编码',
          barcode VARCHAR(128) DEFAULT NULL COMMENT '商品条码',
          sku_name VARCHAR(128) NOT NULL COMMENT 'SKU名称',
          volume VARCHAR(32) DEFAULT NULL COMMENT '净含量(500ml/1L)',
          packaging VARCHAR(32) DEFAULT NULL COMMENT '包装类型(瓶装/罐装/桶装)',
          base_unit VARCHAR(16) NOT NULL DEFAULT '瓶' COMMENT '基础单位',
          box_unit VARCHAR(16) NOT NULL DEFAULT '箱' COMMENT '组合单位',
          box_ratio INT NOT NULL DEFAULT 1 COMMENT '箱瓶换算比例',
          temperature VARCHAR(32) NOT NULL DEFAULT 'NORMAL' COMMENT '温度属性 NORMAL/CHILLED',
          trace_enabled TINYINT NOT NULL DEFAULT 0 COMMENT '是否启用追溯 1=是 0=否',
          warning_threshold INT NOT NULL DEFAULT 0 COMMENT '库存预警阈值(瓶)',
          status TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=启用 0=停用',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_product_sku_code (sku_code),
          UNIQUE KEY uk_product_sku_barcode (barcode),
          KEY idx_product_sku_spu (spu_id),
          KEY idx_product_sku_trace (trace_enabled),
          KEY idx_product_sku_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品SKU表'
      `],
      ["t_product_price", `
        CREATE TABLE IF NOT EXISTS t_product_price (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '价格ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          sku_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU ID',
          cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '成本价',
          retail_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '统一零售价',
          wholesale_price DECIMAL(12,2) DEFAULT NULL COMMENT '批发价',
          miniapp_price DECIMAL(12,2) DEFAULT NULL COMMENT '小程序渠道价',
          store_price DECIMAL(12,2) DEFAULT NULL COMMENT '线下门店售价',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_product_price_sku (sku_id),
          KEY idx_product_price_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品价格表'
      `],
      // 销售单（Dashboard 12 个接口依赖 bill_no/business_status）
      ["t_sale_bill", `
        CREATE TABLE IF NOT EXISTS t_sale_bill (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '销售单ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          bill_no VARCHAR(64) NOT NULL COMMENT '销售单号',
          store_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '门店ID',
          customer_id BIGINT UNSIGNED DEFAULT NULL COMMENT '客户ID',
          customer_name VARCHAR(64) DEFAULT NULL COMMENT '客户名称快照',
          customer_mobile VARCHAR(20) DEFAULT NULL COMMENT '客户手机号快照',
          customer_type VARCHAR(32) NOT NULL DEFAULT 'RETAIL' COMMENT '客户类型 RETAIL/WHOLESALE',
          sale_type VARCHAR(32) NOT NULL DEFAULT 'CASH' COMMENT '销售类型 CASH/CREDIT',
          business_status VARCHAR(32) NOT NULL DEFAULT 'CREATED' COMMENT '业务状态 DRAFT/CREATED/COMPLETED/VOIDED/RETURNED',
          collection_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID' COMMENT '收款状态 UNPAID/PARTIAL/PAID/OVERDUE',
          due_date DATE DEFAULT NULL COMMENT '应收截止日期',
          statement_id BIGINT UNSIGNED DEFAULT NULL COMMENT '对账单ID',
          goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
          discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
          rounding_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '抹零金额',
          receivable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应收金额',
          received_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已收金额',
          unreceived_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未收金额',
          operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '开单人ID',
          remark VARCHAR(255) DEFAULT NULL COMMENT '客户可见备注',
          internal_remark VARCHAR(255) DEFAULT NULL COMMENT '内部备注',
          void_reason VARCHAR(255) DEFAULT NULL COMMENT '作废原因',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_sale_bill_no (bill_no),
          KEY idx_sale_bill_store (store_id),
          KEY idx_sale_bill_status (business_status),
          KEY idx_sale_bill_created (created_at),
          KEY idx_sale_bill_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售单表'
      `],
      // 采购单（采购看板依赖）
      ["t_purchase_order", `
        CREATE TABLE IF NOT EXISTS t_purchase_order (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '采购单ID',
          tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
          order_no VARCHAR(64) NOT NULL COMMENT '采购单号',
          supplier_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '供应商ID',
          supplier_name VARCHAR(128) DEFAULT NULL COMMENT '供应商名称快照',
          store_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '入库门店ID',
          order_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' COMMENT '订单状态 DRAFT/PENDING/APPROVED/PARTIAL/COMPLETED/CANCELLED',
          goods_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '商品金额',
          tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '税额',
          discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
          payable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '应付金额',
          paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '已付金额',
          unpaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '未付金额',
          expected_date DATE DEFAULT NULL COMMENT '预计到货日期',
          actual_date DATE DEFAULT NULL COMMENT '实际到货日期',
          operator_id BIGINT UNSIGNED DEFAULT NULL COMMENT '制单人ID',
          auditor_id BIGINT UNSIGNED DEFAULT NULL COMMENT '审核人ID',
          audited_at DATETIME DEFAULT NULL COMMENT '审核时间',
          remark VARCHAR(255) DEFAULT NULL COMMENT '备注',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (id),
          UNIQUE KEY uk_purchase_order_no (order_no),
          KEY idx_purchase_order_supplier (supplier_id),
          KEY idx_purchase_order_status (order_status),
          KEY idx_purchase_order_created (created_at),
          KEY idx_purchase_order_tenant (tenant_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购订单表'
      `],
    ];
    for (const [tbl, sql] of coreTablesSql) {
      await safeExec(conn, sql, `兜底创建 ${tbl}`);
    }

    // 5.5.4 为 product_spu 表添加缺失字段（商品列表需要，含 brand_id 外键列）
    const spuColumns = [
      { name: "brand_id", def: "BIGINT UNSIGNED DEFAULT NULL COMMENT '品牌ID（商品JOIN t_brand）'" },
      { name: "brand", def: "VARCHAR(128) DEFAULT NULL COMMENT '品牌（冗余名称）'" },
      { name: "unit", def: "VARCHAR(32) DEFAULT NULL COMMENT '单位'" },
      { name: "specs", def: "VARCHAR(256) DEFAULT NULL COMMENT '规格'" },
      { name: "alcohol_content", def: "VARCHAR(32) DEFAULT NULL COMMENT '酒精度数'" },
      { name: "origin", def: "VARCHAR(128) DEFAULT NULL COMMENT '产地'" },
      { name: "sale_channels", def: "JSON DEFAULT NULL COMMENT '销售渠道(JSON)'" },
      { name: "description", def: "VARCHAR(512) DEFAULT NULL COMMENT '商品简介'" },
      { name: "marketing_tags", def: "JSON DEFAULT NULL COMMENT '营销标签(JSON)'" },
    ];
    for (const col of spuColumns) {
      await safeExec(conn,
        `ALTER TABLE t_product_spu ADD COLUMN \`${col.name}\` ${col.def}`,
        `product_spu.${col.name}`
      );
    }

    // 5.5.5 创建 t_system_feedback 表（建议反馈功能）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_system_feedback (
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
    `, "创建 t_system_feedback 表");

    // 5.5.6 创建 t_error_logs 表（错误收集系统）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_error_logs (
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
    `, "创建 t_error_logs 表");

    // 5.5.7 创建 t_customer_type 表（客户类型自定义配置）
    await safeExec(conn, `
      CREATE TABLE IF NOT EXISTS t_customer_type (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '类型ID',
        tenant_id VARCHAR(36) NOT NULL DEFAULT 'default' COMMENT '租户ID',
        name VARCHAR(50) NOT NULL COMMENT '类型名称',
        code VARCHAR(32) NOT NULL COMMENT '类型编码',
        sort INT NOT NULL DEFAULT 0 COMMENT '排序号',
        status TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=启用 0=禁用',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_code_tenant (code, tenant_id),
        KEY idx_tenant (tenant_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户类型配置表'
    `, "创建 t_customer_type 表");

    // 5.5.7b 初始化默认客户类型（零售客户/批发客户）
    try {
      const [typeRows] = await conn.query(
        "SELECT id FROM t_customer_type WHERE tenant_id = 'default'"
      ) as unknown as [Record<string, unknown>[]];
      if ((typeRows as unknown as any[]).length === 0) {
        await safeExec(conn, `
          INSERT INTO t_customer_type (name, code, sort, status, tenant_id) VALUES
          ('零售客户', 'RETAIL', 1, 1, 'default'),
          ('批发客户', 'WHOLESALE', 2, 1, 'default')
        `, "初始化默认客户类型");
      }
    } catch (e: unknown) {
      logger.error("[migration] 默认客户类型初始化失败:", (e as any).message);
    }

    // ============================================================
    // 5.5.8 创建AI底座5张表（兜底，防止部署时遗漏 121_ai_base_tables.sql）
    //       5张表: t_platform_ai_config / t_tenant_ai_config / t_ai_audit_log
    //              t_ai_usage_daily / t_tenant_ai_billing
    //       第8步外部迁移也会执行本文件，此处提前兜底确保种子数据阶段表已就位
    //       SQL 使用 CREATE TABLE IF NOT EXISTS + INSERT IGNORE，重复执行无副作用
    //       依据: R70-02 任务 + 《智享AI底座-架构设计文档》v3.2 第7.1节
    // ============================================================
    try {
      const aiSqlPath = findSqlFile("121_ai_base_tables.sql");
      const aiSqlRaw = readFileSync(aiSqlPath, "utf8");
      // 预处理：移除 USE 语句、DELIMITER 行（与第8步外部迁移保持一致）
      const aiCleaned = aiSqlRaw
        .split("\n")
        .filter((line: string) => {
          const t = line.trim().toUpperCase();
          return !t.startsWith("USE ") && !t.startsWith("DELIMITER ");
        })
        .join("\n");
      // 拆分语句块并逐条执行（addTablePrefix 对已带 t_ 前缀的表名跳过，安全）
      const aiStatements = aiCleaned
        .split(";")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && !s.startsWith("--"));
      for (const stmt of aiStatements) {
        if (stmt.includes("CREATE PROCEDURE") || stmt.includes("DROP PROCEDURE")) {
          continue;
        }
        await safeExec(conn, addTablePrefix(stmt), "5.5.8 AI底座建表");
      }
      logger.info("[migration] 5.5.8 AI底座5张表兜底建表完成");
    } catch (e: unknown) {
      // 文件未找到或执行异常不中止迁移，第8步外部迁移仍有兜底
      logger.warn("[migration] 5.5.8 AI底座兜底建表跳过:", (e as any).message);
    }

    // ============================================================
    // 第6步：初始化种子数据（仅在表为空时插入，不覆盖已有数据）
    // ============================================================
    logger.info("[migration] 检查/初始化种子数据...");
    try {
      await seedData(conn);
    } catch (e: unknown) {
      logger.error("[migration] 种子数据初始化失败:", (e as any).message);
    }

    // ============================================================
    // 第7步：确保默认管理员账号存在
    // ============================================================
    logger.info("[migration] 检查/创建默认管理员账号...");
    try {
      const bcrypt = await import("bcryptjs");

      // 7.1 平台管理员 admin / Admin@2026（写入 t_sys_user）
      const [adminRows] = await conn.query(
        "SELECT id FROM t_sys_user WHERE username = 'admin' AND tenant_id = 'default'"
      ) as unknown as [Record<string, unknown>[]];
      if ((adminRows as unknown as any[]).length === 0) {
        const adminHash = bcrypt.hashSync("Admin@2026", 10);
        await conn.query(`
          INSERT INTO t_sys_user (username, password_hash, real_name, status, tenant_id, created_at, updated_at)
          VALUES ('admin', ?, '系统管理员', 1, 'default', NOW(), NOW())
        `, [adminHash]);
        logger.info("[migration] 已创建平台管理员 admin / Admin@2026");

        // 给 admin 分配超级管理员角色
        const [adminUser] = await conn.query(
          "SELECT id FROM t_sys_user WHERE username = 'admin' AND tenant_id = 'default'"
        ) as unknown as [Record<string, unknown>[]];
        const adminId = (adminUser as unknown as any[])[0]?.id;
        if (adminId) {
          // 确保超级管理员角色存在
          await safeExec(conn, `
            INSERT INTO t_sys_role (role_code, role_name, status, tenant_id, created_at, updated_at)
            VALUES ('SUPER_ADMIN', '超级管理员', 'ACTIVE', 'default', NOW(), NOW())
          `, "创建 SUPER_ADMIN 角色");
          const [roleRows] = await conn.query(
            "SELECT id FROM t_sys_role WHERE role_code = 'SUPER_ADMIN' AND tenant_id = 'default'"
          ) as unknown as [Record<string, unknown>[]];
          const roleId = (roleRows as unknown as any[])[0]?.id;
          if (roleId) {
            await conn.query(`
              INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id, created_at)
              VALUES (?, ?, 'default', NOW())
            `, [adminId, roleId]);
            logger.info("[migration] 已为 admin 分配 SUPER_ADMIN 角色");
          }
        }
      }

      // 7.2 租户管理员 tenant_admin / Admin@2026
      const [tenantRows] = await conn.query(
        "SELECT id FROM t_sys_user WHERE username = 'tenant_admin' AND tenant_id = 'default'"
      ) as unknown as [Record<string, unknown>[]];
      if ((tenantRows as unknown as any[]).length === 0) {
        const tenantHash = bcrypt.hashSync("Admin@2026", 10);
        await conn.query(`
          INSERT INTO t_sys_user (username, password_hash, real_name, status, tenant_id, created_at, updated_at)
          VALUES ('tenant_admin', ?, '租户管理员', 1, 'default', NOW(), NOW())
        `, [tenantHash]);
        logger.info("[migration] 已创建租户管理员 tenant_admin / Admin@2026");

        // 给 tenant_admin 分配管理员角色
        const [tenantUser] = await conn.query(
          "SELECT id FROM t_sys_user WHERE username = 'tenant_admin' AND tenant_id = 'default'"
        ) as unknown as [Record<string, unknown>[]];
        const tenantUserId = (tenantUser as unknown as any[])[0]?.id;
        if (tenantUserId) {
          await safeExec(conn, `
            INSERT INTO t_sys_role (role_code, role_name, status, tenant_id, created_at, updated_at)
            VALUES ('ADMIN', '管理员', 'ACTIVE', 'default', NOW(), NOW())
          `, "创建 ADMIN 角色");
          const [aRoleRows] = await conn.query(
            "SELECT id FROM t_sys_role WHERE role_code = 'ADMIN' AND tenant_id = 'default'"
          ) as unknown as [Record<string, unknown>[]];
          const aRoleId = (aRoleRows as unknown as any[])[0]?.id;
          if (aRoleId) {
            await conn.query(`
              INSERT IGNORE INTO t_sys_user_role (user_id, role_id, tenant_id, created_at)
              VALUES (?, ?, 'default', NOW())
            `, [tenantUserId, aRoleId]);
            logger.info("[migration] 已为 tenant_admin 分配 ADMIN 角色");
          }
        }
      }
    } catch (e: unknown) {
      logger.error("[migration] 默认管理员账号创建失败:", (e as any).message);
    }

    // ============================================================
    // 第8步：执行其他 SQL 迁移文件
    // ============================================================
    // 兼容 pm2 --cwd backend 启动（auto-deploy.sh）：docs/migrations 在项目根，
    // cwd 为 backend 时需回退到上级目录查找，避免外部迁移被整体跳过（R95-03 修复：
    // 此前仅查 cwd/docs/migrations，导致 086 之后的建表 SQL（t_receipt/t_print_record 等）在生产未执行）
    const migrationsDir = [
      resolve(process.cwd(), "docs/migrations"),
      resolve(process.cwd(), "../docs/migrations"),
      resolve(process.cwd(), "../../docs/migrations"),
    ].find((candidate) => existsSync(candidate));
    if (migrationsDir) {
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
          // 紧急保护（R95-03）：外部迁移含 DROP TABLE IF EXISTS（001/003 等），
          // 在已上线库上执行会删除重建核心表导致数据丢失（已在生产触发一次）。
          // 后续只允许补建缺失表，禁止任何 DROP。
          if (/DROP\s+TABLE/i.test(stmt)) {
            logger.warn(`[migration] ${file}: 跳过 DROP TABLE 语句（保护生产数据）`);
            continue;
          }
          // 自动给所有表名加 t_ 前缀
          const prefixedStmt = addTablePrefix(stmt);
          await safeExec(conn, prefixedStmt, `${file}`);
        }
      }
    }

    logger.info("[migration] 所有迁移完成");
  } catch (e: unknown) {
    logger.error("[migration] 迁移过程出错:", (e as any).message);
  } finally {
    await conn.end().catch(() => { });
  }
}
