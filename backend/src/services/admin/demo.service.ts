import { query, queryOne, transaction, connQuery, connExecute } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import type { AuthUser } from "../../middleware/auth";
import type { ResultSetHeader } from "mysql2";

/**
 * 演示数据与系统初始化服务
 * - seedDemoData：幂等填充演示业务数据（商品/客户/供应商/销售单/采购单/库存）
 * - resetSystemData：清空业务数据，保留系统账号、角色、菜单与平台配置
 */

const DEMO_TENANT = "default";

function demoNo(prefix: string) {
  return `${prefix}${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 900 + 100)}`;
}

/** 取演示操作人：优先 admin，其次任意启用用户 */
async function resolveOperatorId(tenantId: string): Promise<number> {
  const admin = await queryOne<{ id: number }>(
    "SELECT id FROM t_sys_user WHERE username = 'admin' AND status = 1 LIMIT 1"
  );
  if (admin) return admin.id;
  const anyUser = await queryOne<{ id: number }>(
    "SELECT id FROM t_sys_user WHERE status = 1 AND tenant_id = ? LIMIT 1",
    [tenantId]
  );
  if (!anyUser) throw new AppError("系统无可用操作人，请先创建管理员账号", 400);
  return anyUser.id;
}

/** 取演示门店：优先已有门店，无则创建演示门店 */
async function resolveStoreId(tenantId: string): Promise<number> {
  const store = await queryOne<{ id: number }>(
    "SELECT id FROM t_store WHERE tenant_id = ? LIMIT 1",
    [tenantId]
  );
  if (store) return store.id;
  const result = (await query(
    `INSERT INTO t_store (store_code, name, address, contact, phone, delivery_radius, status, tenant_id)
     VALUES (?, ?, ?, ?, ?, 3.00, 1, ?)`,
    ["DEMO001", "演示门店", "广东省广州市天河区演示路 1 号", "演示店长", "13800000001", tenantId]
  )) as unknown as { insertId: number };
  return result.insertId;
}

/**
 * 填充演示数据（幂等：商品表已有数据则跳过）
 */
export async function seedDemoData(tenantId: string) {
  const existing = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM t_product_spu WHERE tenant_id = ?",
    [tenantId]
  );
  if ((existing?.total ?? 0) > 0) {
    return { skipped: true, message: "演示数据已存在，无需重复初始化" };
  }

  return transaction(async (conn) => {
    const operatorId = await resolveOperatorId(tenantId);
    const storeId = await resolveStoreId(tenantId);

    // 1. 商品分类（白酒 / 啤酒）
    const catRows: { id: number; name: string }[] = [];
    for (const [name, code] of [["白酒", "BAIJIU"], ["啤酒", "BEER"]] as const) {
      const [r] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_product_category (tenant_id, name, code, sort_no, status, allow_online_sale)
         VALUES (?, ?, ?, 1, 1, 1)`,
        [tenantId, name, code]
      );
      catRows.push({ id: r.insertId, name });
    }

    // 2. 商品 SPU + SKU + 价格 + 库存
    const products = [
      { name: "经典酱香白酒 53°", category: "白酒", unit: "瓶", specs: "500ml*6", cost: 128, retail: 198, wholesale: 168, stock: 120 },
      { name: "特制浓香白酒 52°", category: "白酒", unit: "瓶", specs: "500ml*6", cost: 96, retail: 158, wholesale: 128, stock: 80 },
      { name: "精酿原浆啤酒 500ml", category: "啤酒", unit: "瓶", specs: "500ml*12", cost: 6.5, retail: 12, wholesale: 9, stock: 480 },
      { name: "德式小麦白啤 500ml", category: "啤酒", unit: "瓶", specs: "500ml*12", cost: 5.8, retail: 10, wholesale: 8, stock: 360 },
    ] as const;

    const skuMap: { skuId: number; skuName: string; retail: number }[] = [];
    for (const p of products) {
      const cat = catRows.find((c) => c.name === p.category)!;
      const [spuRes] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_product_spu (spu_code, name, category_id, brand_id, unit, specs,
           main_image, sale_channels, alcohol_content, origin, sort_no, is_new, is_recommend,
           description, status, tenant_id)
         VALUES (?, ?, ?, NULL, ?, ?, NULL, CAST(? AS JSON), NULL, '中国', 1, 1, 1, ?, 'ON_SALE', ?)`,
        [demoNo("SPU"), p.name, cat.id, p.unit, p.specs, JSON.stringify(["STORE", "MINIAPP"]), `演示${p.name}`, tenantId]
      );
      const spuId = spuRes.insertId;
      const [skuRes] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_product_sku (spu_id, sku_code, barcode, sku_name, volume, packaging,
           base_unit, box_unit, box_ratio, temperature, trace_enabled, warning_threshold, tenant_id)
         VALUES (?, ?, ?, ?, 500, '瓶装', '瓶', '箱', 12, NULL, 0, 20, ?)`,
        [spuId, demoNo("SKU"), String(6900000000000 + spuId), `${p.name}（单瓶）`, tenantId]
      );
      const skuId = skuRes.insertId;
      await connExecute(
        conn,
        `INSERT INTO t_product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [skuId, p.cost, p.retail, p.wholesale, p.retail, p.retail, tenantId]
      );
      await connExecute(
        conn,
        `INSERT INTO t_inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, tenant_id)
         VALUES (?, ?, 'OFFLINE', ?, 0, ?, ?)`,
        [storeId, skuId, p.stock, p.stock, tenantId]
      );
      skuMap.push({ skuId, skuName: p.name, retail: p.retail });
    }

    // 3. 客户
    const customers = [
      { name: "红星商行", mobile: "13900000004", type: "WHOLESALE", address: "广州市越秀区" },
      { name: "天河烟酒批发部", mobile: "13900000001", type: "WHOLESALE", address: "广州市天河区" },
      { name: "海珠便利店", mobile: "13900000002", type: "RETAIL", address: "广州市海珠区" },
      { name: "珠江新城餐厅", mobile: "13900000003", type: "RETAIL", address: "广州市天河区" },
    ] as const;
    const customerRows: { id: number; name: string; mobile: string; type: string }[] = [];
    for (const c of customers) {
      const [r] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_member (name, contact, mobile, customer_type, staff_id, address, settlement_type, remark, points, level_code, status, tenant_id)
         VALUES (?, ?, ?, ?, NULL, ?, 'CASH', '演示客户', 120, 'VIP', 'ACTIVE', ?)`,
        [c.name, c.name, c.mobile, c.type, c.address, tenantId]
      );
      customerRows.push({ id: r.insertId, name: c.name, mobile: c.mobile, type: c.type });
    }

    // 4. 供应商
    const suppliers = [
      { code: "SUP001", name: "贵州茅台镇酒业", province: "贵州", city: "遵义" },
      { code: "SUP002", name: "青岛啤酒华南总代", province: "山东", city: "青岛" },
    ] as const;
    const supplierRows: { id: number; name: string }[] = [];
    for (const s of suppliers) {
      const [r] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_supplier (tenant_id, supplier_code, name, short_name, category, province, city, credit_level, settlement_type, tax_rate, status)
         VALUES (?, ?, ?, ?, '经销商', ?, ?, 'A', 'MONTHLY', 0.13, 1)`,
        [tenantId, s.code, s.name, s.name.slice(0, 6), s.province, s.city]
      );
      supplierRows.push({ id: r.insertId, name: s.name });
    }

    // 5. 销售单（今天 / 昨天 / 3 天前）
    const billSpecs = [
      { daysAgo: 0, customer: customerRows[0], items: [[0, 10], [2, 24]] },
      { daysAgo: 1, customer: customerRows[1], items: [[1, 6], [3, 12]] },
      { daysAgo: 3, customer: customerRows[2], items: [[0, 4], [2, 12]] },
    ] as const;
    for (const spec of billSpecs) {
      const billNo = demoNo("XS");
      let goods = 0;
      for (const [skuIdx, qty] of spec.items) {
        goods += skuMap[skuIdx].retail * qty;
      }
      const [billRes] = await connExecute<ResultSetHeader>(
        conn,
        `INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type,
           sale_type, business_status, collection_status, goods_amount, discount_amount, rounding_amount,
           receivable_amount, received_amount, unreceived_amount, share_collection_count, locked_amount_flag,
           operator_id, remark, internal_remark, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CREDIT', 'COMPLETED', 'PAID', ?, 0, 0, ?, ?, 0, 0, 0, ?, '演示数据', '演示数据', DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [tenantId, billNo, storeId, spec.customer.id, spec.customer.name, spec.customer.mobile, spec.customer.type,
          goods, goods, goods, operatorId, spec.daysAgo]
      );
      void billRes;
      for (const [skuIdx, qty] of spec.items) {
        await connExecute(
          conn,
          `INSERT INTO t_sale_bill_item (tenant_id, bill_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
             unit_price, price_type, subtotal_amount, trace_required)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'RETAIL', ?, 0)`,
          [tenantId, billNo, skuMap[skuIdx].skuId, skuMap[skuIdx].skuName, qty, qty, skuMap[skuIdx].retail, skuMap[skuIdx].retail * qty]
        );
      }
    }

    // 6. 采购单（已完成）
    const poNo = demoNo("CG");
    const poAmount = 3680;
    const [poRes] = await connExecute<ResultSetHeader>(
      conn,
      `INSERT INTO t_purchase_order (tenant_id, order_no, supplier_id, supplier_name, store_id, order_status,
         goods_amount, tax_amount, discount_amount, payable_amount, paid_amount, unpaid_amount,
         expected_date, actual_date, operator_id, auditor_id, audited_at, remark)
       VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, 0, 0, ?, ?, 0, CURDATE(), CURDATE(), ?, ?, NOW(), '演示数据')`,
      [tenantId, poNo, supplierRows[0].id, supplierRows[0].name, storeId, poAmount, poAmount, poAmount, operatorId, operatorId]
    );
    void poRes;
    await connExecute(
      conn,
      `INSERT INTO t_purchase_order_item (tenant_id, order_no, sku_id, sku_name, box_qty, bottle_qty, total_bottle_qty,
         unit_price, tax_rate, subtotal_amount, tax_amount, total_amount, in_stocked_qty, remark)
       VALUES (?, ?, ?, ?, 0, 20, 20, 168, 0.13, 3360, 436.8, 3796.8, 20, '演示数据')`,
      [tenantId, poNo, skuMap[0].skuId, skuMap[0].skuName]
    );

    // 7. 营销活动（满减 + 秒杀）
    const activities = [
      { code: demoNo("HD"), name: "中秋白酒满减", type: "FULL_REDUCTION", desc: "全场白酒满 1000 减 120", days: 10, status: "ACTIVE" },
      { code: demoNo("HD"), name: "周末啤酒秒杀", type: "SECKILL", desc: "精酿啤酒 5 折限量秒杀", days: -2, status: "ACTIVE" },
    ] as const;
    for (const a of activities) {
      await connExecute(
        conn,
        `INSERT INTO t_promotion_activity (activity_code, activity_name, activity_type, activity_desc,
           start_time, end_time, applicable_scope, applicable_ids, rules, max_participants, participant_count,
           status, priority, stackable, tenant_id, created_by)
         VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL ? DAY), 'ALL',
           CAST(? AS JSON), CAST(? AS JSON), 0, 0, ?, 1, 0, ?, ?)`,
        [a.code, a.name, a.type, a.desc, a.days, JSON.stringify([]), JSON.stringify({ threshold: 1000, discount: 120 }), a.status, tenantId, operatorId]
      );
    }

    // 8. 资金流水（近 3 天：两笔收入一笔支出）
    const flows = [
      { type: "SALE_INCOME", days: 0, amount: 1980, remark: "演示销售回款" },
      { type: "SALE_INCOME", days: 1, amount: 1014, remark: "演示销售回款" },
      { type: "PURCHASE_PAY", days: 2, amount: -3796.8, remark: "演示采购付款" },
    ] as const;
    let balance = 50000;
    for (const f of flows) {
      balance += f.amount;
      await connExecute(
        conn,
        `INSERT INTO t_cash_flow (tenant_id, transaction_type, transaction_date, amount, balance_before, balance_after, related_type, related_no, remark)
         VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, 'DEMO', ?, ?)`,
        [tenantId, f.type, f.days, f.amount, balance - f.amount, balance, demoNo("FL"), f.remark]
      );
    }

    return {
      skipped: false,
      message: "演示数据初始化完成",
      detail: {
        categories: catRows.length,
        products: products.length,
        customers: customerRows.length,
        suppliers: supplierRows.length,
        saleBills: billSpecs.length,
        purchaseOrders: 1,
        activities: activities.length,
        cashFlows: flows.length,
      },
    };
  });
}

/**
 * 系统初始化：清空业务数据（保留系统账号/角色/菜单/租户/平台配置）
 * confirmKey 必须为 "RESET"，防止误触
 */
export async function resetSystemData(user: AuthUser, confirmKey: string) {
  // 生产环境角色数据历史缺失（admin roles 为空），且演示账号免密登录
  // 绝不允许清空数据：仅生产管理员账号 admin 可执行系统初始化
  if (user.username !== "admin") {
    throw new AppError("仅系统管理员可执行系统初始化（演示账号无此权限）", 403);
  }
  if (confirmKey !== "RESET") {
    throw new AppError("确认口令不正确，初始化已取消", 400);
  }

  // 保留的系统/配置表前缀（其余一律视为业务数据清空）
  const keepPrefixes = [
    "t_sys_",
    "t_tenant",
    "t_store",
    "t_platform_config",
    "t_platform_ai_config",
    "t_platform_admin",
    "t_platform_menu",
    "t_platform_announcement",
  ];

  const tables = await query<{ TABLE_NAME: string }>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
  );
  const targets = tables
    .map((r) => r.TABLE_NAME)
    .filter((t) => !keepPrefixes.some((p) => t.startsWith(p)));

  if (targets.length === 0) {
    return { cleared: 0, message: "无可清理的业务数据" };
  }

  await transaction(async (conn) => {
    await connExecute(conn, "SET FOREIGN_KEY_CHECKS = 0");
    for (const table of targets) {
      await connExecute(conn, `DELETE FROM \`${table}\``).catch(() => {
        // 个别表不存在或不可删除时跳过，不阻塞整体初始化
      });
    }
    await connExecute(conn, "SET FOREIGN_KEY_CHECKS = 1");
  });

  return { cleared: targets.length, message: `系统初始化完成，已清理 ${targets.length} 张业务表数据` };
}
