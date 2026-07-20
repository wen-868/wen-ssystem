/**
 * 生产环境种子数据初始化
 *
 * 仅在对应表为空时插入，不覆盖已有数据
 * 包含：默认门店、商品分类、商品SPU/SKU、商品价格、库存余额、会员、供应商、示例销售/采购单
 *
 * 解决问题：R53-03 真实 MySQL 数据库中除 admin 用户外无业务数据，Dashboard 全部显示零
 */
import mysql from "mysql2/promise";
import logger from "./logger";

const TENANT_ID = "default";

/** 安全执行 SQL（失败时记录但不中断） */
async function safeInsert(conn: mysql.Connection, sql: string, params: unknown[] = [], label: string): Promise<void> {
    try {
        await conn.query(sql, params);
    } catch (e: unknown) {
        const err = (e ?? {}) as { code?: string; message?: string };
        // 重复主键/唯一键冲突时静默跳过
        if (err.code === "ER_DUP_ENTRY" || err.code === "ER_DUP_KEY") {
            logger.info(`[seed] ${label}: 已存在，跳过`);
            return;
        }
        logger.error(`[seed] ${label} 失败: ${err.message || String(e)}`);
    }
}

/** 检查表是否为空 */
async function isTableEmpty(conn: mysql.Connection, table: string): Promise<boolean> {
    try {
        const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\` LIMIT 1`);
        const count = (rows as unknown as Record<string, unknown>[])?.[0]?.cnt;
        return Number(count) === 0;
    } catch {
        // 表不存在时返回 false（不插入）
        return false;
    }
}

/**
 * 初始化种子数据
 * 在 migration.ts 第5.5步之后调用
 */
export async function seedData(conn: mysql.Connection): Promise<void> {
    logger.info("[seed] 开始检查/初始化种子数据...");

    // ============================================================
    // 1. 默认门店（总店）
    // ============================================================
    if (await isTableEmpty(conn, "t_store")) {
        logger.info("[seed] t_store 为空，插入默认门店...");
        await safeInsert(conn, `
      INSERT INTO t_store (tenant_id, store_code, name, address, lng, lat, contact, phone, delivery_radius, business_status, status, fulfillment_delivery_enabled, fulfillment_pickup_enabled)
      VALUES (?, 'STORE001', '总店', '北京市朝阳区建国路88号', 116.481028, 39.906217, '店长', '13800138000', 5.00, 'OPEN', 'OPEN', 1, 1)
    `, [TENANT_ID], "插入默认门店");
    } else {
        logger.info("[seed] t_store 已有数据，跳过");
    }

    // 获取门店 ID（后续插入数据需要）
    let storeId = 1;
    try {
        const [storeRows] = await conn.query(
            "SELECT id FROM t_store WHERE tenant_id = ? AND store_code = 'STORE001' LIMIT 1",
            [TENANT_ID]
        );
        const rows = storeRows as unknown as Record<string, unknown>[];
        if (rows.length > 0) {
            storeId = Number(rows[0].id);
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取门店ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 2. 商品分类（5个：白酒/啤酒/葡萄酒/洋酒/其他）
    // ============================================================
    if (await isTableEmpty(conn, "t_product_category")) {
        logger.info("[seed] t_product_category 为空，插入5个分类...");
        const categories = [
            { code: "CAT_BAIJIU", name: "白酒", sortNo: 1 },
            { code: "CAT_BEER", name: "啤酒", sortNo: 2 },
            { code: "CAT_WINE", name: "葡萄酒", sortNo: 3 },
            { code: "CAT_SPIRITS", name: "洋酒", sortNo: 4 },
            { code: "CAT_OTHER", name: "其他", sortNo: 5 },
        ];
        for (const cat of categories) {
            await safeInsert(conn, `
        INSERT INTO t_product_category (tenant_id, parent_id, name, code, sort_no, status, allow_online_sale)
        VALUES (?, NULL, ?, ?, ?, 1, 1)
      `, [TENANT_ID, cat.name, cat.code, cat.sortNo], `插入分类 ${cat.name}`);
        }
    } else {
        logger.info("[seed] t_product_category 已有数据，跳过");
    }

    // 获取分类 ID 映射
    const categoryMap: Record<string, number> = {};
    try {
        const [catRows] = await conn.query(
            "SELECT id, code FROM t_product_category WHERE tenant_id = ? AND code IN ('CAT_BAIJIU','CAT_BEER','CAT_WINE','CAT_SPIRITS','CAT_OTHER')",
            [TENANT_ID]
        );
        for (const row of (catRows as unknown as Record<string, unknown>[])) {
            categoryMap[String(row.code)] = Number(row.id);
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取分类ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 3. 商品 SPU（每个分类2个，共10个）
    // ============================================================
    if (await isTableEmpty(conn, "t_product_spu")) {
        logger.info("[seed] t_product_spu 为空，插入10个商品...");
        const products = [
            // 白酒
            { code: "SPU_MT_53", name: "茅台飞天 53度 500ml", catCode: "CAT_BAIJIU", brand: "茅台", unit: "瓶", specs: "500ml/瓶，53度" },
            { code: "SPU_WLY_52", name: "五粮液 52度 500ml", catCode: "CAT_BAIJIU", brand: "五粮液", unit: "瓶", specs: "500ml/瓶，52度" },
            // 啤酒
            { code: "SPU_QD_TS", name: "青岛啤酒 经典10度 330ml", catCode: "CAT_BEER", brand: "青岛啤酒", unit: "罐", specs: "330ml/罐，10度" },
            { code: "SPU_SN_TS", name: "雪花啤酒 勇闯天涯 500ml", catCode: "CAT_BEER", brand: "雪花", unit: "瓶", specs: "500ml/瓶，8度" },
            // 葡萄酒
            { code: "SPU_ZY_DR", name: "张裕干红葡萄酒 750ml", catCode: "CAT_WINE", brand: "张裕", unit: "瓶", specs: "750ml/瓶，12度" },
            { code: "SPU_GY_DR", name: "长城海岸赤霞珠干红 750ml", catCode: "CAT_WINE", brand: "长城", unit: "瓶", specs: "750ml/瓶，13度" },
            // 洋酒
            { code: "SPU_HX_VS", name: "轩尼诗VSOP 干邑白兰地 700ml", catCode: "CAT_SPIRITS", brand: "轩尼诗", unit: "瓶", specs: "700ml/瓶，40度" },
            { code: "SPU_MK_12", name: "麦卡伦12年 双桶单一麦芽威士忌 700ml", catCode: "CAT_SPIRITS", brand: "麦卡伦", unit: "瓶", specs: "700ml/瓶，40度" },
            // 其他
            { code: "SPU_MT_JC", name: "茅台王子酒 酱香经典 500ml", catCode: "CAT_OTHER", brand: "茅台", unit: "瓶", specs: "500ml/瓶，53度" },
            { code: "SPU_WLJ_JC", name: "剑南春 水晶剑 52度 500ml", catCode: "CAT_OTHER", brand: "剑南春", unit: "瓶", specs: "500ml/瓶，52度" },
        ];

        for (const p of products) {
            const categoryId = categoryMap[p.catCode];
            if (!categoryId) {
                logger.warn(`[seed] 分类 ${p.catCode} 不存在，跳过商品 ${p.name}`);
                continue;
            }
            await safeInsert(conn, `
        INSERT INTO t_product_spu (tenant_id, spu_code, name, category_id, brand, unit, specs, sale_channels, sort_no, is_new, is_recommend, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, JSON_ARRAY('MINIAPP','STORE'), 0, 0, 0, 'ON_SALE')
      `, [TENANT_ID, p.code, p.name, categoryId, p.brand, p.unit, p.specs], `插入商品 ${p.name}`);
        }
    } else {
        logger.info("[seed] t_product_spu 已有数据，跳过");
    }

    // 获取 SPU ID 映射
    const spuMap: Record<string, { id: number; name: string }> = {};
    try {
        const [spuRows] = await conn.query(
            "SELECT id, spu_code, name FROM t_product_spu WHERE tenant_id = ?",
            [TENANT_ID]
        );
        for (const row of (spuRows as unknown as Record<string, unknown>[])) {
            spuMap[String(row.spu_code)] = { id: Number(row.id), name: String(row.name) };
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取SPU ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 4. 商品 SKU（每个 SPU 1个，共10个）
    // ============================================================
    if (await isTableEmpty(conn, "t_product_sku")) {
        logger.info("[seed] t_product_sku 为空，插入10个SKU...");
        const skus = [
            { spuCode: "SPU_MT_53", skuCode: "SKU_MT_53", barcode: "6901234567001", name: "茅台飞天 53度 500ml", volume: "500ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_WLY_52", skuCode: "SKU_WLY_52", barcode: "6901234567002", name: "五粮液 52度 500ml", volume: "500ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_QD_TS", skuCode: "SKU_QD_TS", barcode: "6901234567003", name: "青岛啤酒 经典10度 330ml", volume: "330ml", packaging: "罐装", boxRatio: 24 },
            { spuCode: "SPU_SN_TS", skuCode: "SKU_SN_TS", barcode: "6901234567004", name: "雪花啤酒 勇闯天涯 500ml", volume: "500ml", packaging: "瓶装", boxRatio: 12 },
            { spuCode: "SPU_ZY_DR", skuCode: "SKU_ZY_DR", barcode: "6901234567005", name: "张裕干红葡萄酒 750ml", volume: "750ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_GY_DR", skuCode: "SKU_GY_DR", barcode: "6901234567006", name: "长城海岸赤霞珠干红 750ml", volume: "750ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_HX_VS", skuCode: "SKU_HX_VS", barcode: "6901234567007", name: "轩尼诗VSOP 干邑白兰地 700ml", volume: "700ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_MK_12", skuCode: "SKU_MK_12", barcode: "6901234567008", name: "麦卡伦12年 双桶单一麦芽威士忌 700ml", volume: "700ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_MT_JC", skuCode: "SKU_MT_JC", barcode: "6901234567009", name: "茅台王子酒 酱香经典 500ml", volume: "500ml", packaging: "瓶装", boxRatio: 6 },
            { spuCode: "SPU_WLJ_JC", skuCode: "SKU_WLJ_JC", barcode: "6901234567010", name: "剑南春 水晶剑 52度 500ml", volume: "500ml", packaging: "瓶装", boxRatio: 6 },
        ];

        for (const s of skus) {
            const spu = spuMap[s.spuCode];
            if (!spu) {
                logger.warn(`[seed] SPU ${s.spuCode} 不存在，跳过 SKU ${s.name}`);
                continue;
            }
            await safeInsert(conn, `
        INSERT INTO t_product_sku (tenant_id, spu_id, sku_code, barcode, sku_name, volume, packaging, base_unit, box_unit, box_ratio, temperature, trace_enabled, warning_threshold, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, '瓶', '箱', ?, 'NORMAL', 0, 10, 1)
      `, [TENANT_ID, spu.id, s.skuCode, s.barcode, s.name, s.volume, s.packaging, s.boxRatio], `插入SKU ${s.name}`);
        }
    } else {
        logger.info("[seed] t_product_sku 已有数据，跳过");
    }

    // 获取 SKU ID 映射
    const skuMap: Record<string, { id: number; name: string; code: string }> = {};
    try {
        const [skuRows] = await conn.query(
            "SELECT id, sku_code, sku_name FROM t_product_sku WHERE tenant_id = ?",
            [TENANT_ID]
        );
        for (const row of (skuRows as unknown as Record<string, unknown>[])) {
            skuMap[String(row.sku_code)] = { id: Number(row.id), name: String(row.sku_name), code: String(row.sku_code) };
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取SKU ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 5. 商品价格（每个 SKU 1条，共10条）
    // ============================================================
    if (await isTableEmpty(conn, "t_product_price")) {
        logger.info("[seed] t_product_price 为空，插入10条价格...");
        const prices = [
            { skuCode: "SKU_MT_53", cost: 1499.00, retail: 2999.00, wholesale: 2699.00, miniapp: 2899.00, store: 2999.00 },
            { skuCode: "SKU_WLY_52", cost: 899.00, retail: 1399.00, wholesale: 1199.00, miniapp: 1299.00, store: 1399.00 },
            { skuCode: "SKU_QD_TS", cost: 2.50, retail: 5.00, wholesale: 4.00, miniapp: 4.50, store: 5.00 },
            { skuCode: "SKU_SN_TS", cost: 3.00, retail: 6.00, wholesale: 5.00, miniapp: 5.50, store: 6.00 },
            { skuCode: "SKU_ZY_DR", cost: 58.00, retail: 128.00, wholesale: 98.00, miniapp: 108.00, store: 128.00 },
            { skuCode: "SKU_GY_DR", cost: 48.00, retail: 98.00, wholesale: 78.00, miniapp: 88.00, store: 98.00 },
            { skuCode: "SKU_HX_VS", cost: 599.00, retail: 1099.00, wholesale: 949.00, miniapp: 999.00, store: 1099.00 },
            { skuCode: "SKU_MK_12", cost: 899.00, retail: 1599.00, wholesale: 1399.00, miniapp: 1499.00, store: 1599.00 },
            { skuCode: "SKU_MT_JC", cost: 199.00, retail: 399.00, wholesale: 329.00, miniapp: 359.00, store: 399.00 },
            { skuCode: "SKU_WLJ_JC", cost: 299.00, retail: 599.00, wholesale: 499.00, miniapp: 549.00, store: 599.00 },
        ];

        for (const p of prices) {
            const sku = skuMap[p.skuCode];
            if (!sku) {
                logger.warn(`[seed] SKU ${p.skuCode} 不存在，跳过价格`);
                continue;
            }
            await safeInsert(conn, `
        INSERT INTO t_product_price (tenant_id, sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [TENANT_ID, sku.id, p.cost, p.retail, p.wholesale, p.miniapp, p.store], `插入价格 ${p.skuCode}`);
        }
    } else {
        logger.info("[seed] t_product_price 已有数据，跳过");
    }

    // ============================================================
    // 6. 库存余额（每个 SKU 在总店有库存）
    // ============================================================
    if (await isTableEmpty(conn, "t_inventory_balance")) {
        logger.info("[seed] t_inventory_balance 为空，插入10条库存...");
        const stocks = [
            { skuCode: "SKU_MT_53", qty: 120 },
            { skuCode: "SKU_WLY_52", qty: 80 },
            { skuCode: "SKU_QD_TS", qty: 480 },
            { skuCode: "SKU_SN_TS", qty: 240 },
            { skuCode: "SKU_ZY_DR", qty: 60 },
            { skuCode: "SKU_GY_DR", qty: 50 },
            { skuCode: "SKU_HX_VS", qty: 30 },
            { skuCode: "SKU_MK_12", qty: 24 },
            { skuCode: "SKU_MT_JC", qty: 100 },
            { skuCode: "SKU_WLJ_JC", qty: 60 },
        ];

        for (const s of stocks) {
            const sku = skuMap[s.skuCode];
            if (!sku) {
                logger.warn(`[seed] SKU ${s.skuCode} 不存在，跳过库存`);
                continue;
            }
            await safeInsert(conn, `
        INSERT INTO t_inventory_balance (tenant_id, store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty, version)
        VALUES (?, ?, ?, 'OFFLINE', ?, 0, ?, 0)
      `, [TENANT_ID, storeId, sku.id, s.qty, s.qty], `插入库存 ${s.skuCode}`);
        }
    } else {
        logger.info("[seed] t_inventory_balance 已有数据，跳过");
    }

    // ============================================================
    // 7. 会员客户（3个）
    // ============================================================
    if (await isTableEmpty(conn, "t_member")) {
        logger.info("[seed] t_member 为空，插入3个会员...");
        const members = [
            { mobile: "13900000001", name: "张三", type: "RETAIL" },
            { mobile: "13900000002", name: "李四", type: "WHOLESALE" },
            { mobile: "13900000003", name: "王五", type: "RETAIL" },
        ];
        for (const m of members) {
            await safeInsert(conn, `
        INSERT INTO t_member (tenant_id, openid, mobile, name, customer_type, settlement_type, points, status)
        VALUES (?, NULL, ?, ?, ?, 'CASH', 0, 1)
      `, [TENANT_ID, m.mobile, m.name, m.type], `插入会员 ${m.name}`);
        }
    } else {
        logger.info("[seed] t_member 已有数据，跳过");
    }

    // 获取客户 ID 列表
    const customerIds: number[] = [];
    try {
        const [memberRows] = await conn.query(
            "SELECT id FROM t_member WHERE tenant_id = ? ORDER BY id LIMIT 3",
            [TENANT_ID]
        );
        for (const row of (memberRows as unknown as Record<string, unknown>[])) {
            customerIds.push(Number(row.id));
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取客户ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 8. 供应商（2个）
    // ============================================================
    if (await isTableEmpty(conn, "t_supplier")) {
        logger.info("[seed] t_supplier 为空，插入2个供应商...");
        const suppliers = [
            { code: "SUP_001", name: "北京酒水批发有限公司", shortName: "北京酒水", category: "批发商", province: "北京市", city: "北京市", district: "朝阳区", address: "北京市朝阳区酒厂路1号", settlementType: "MONTHLY", settlementDay: 30 },
            { code: "SUP_002", name: "上海茅台贸易有限公司", shortName: "上海茅台", category: "酒厂", province: "上海市", city: "上海市", district: "浦东新区", address: "上海市浦东新区茅台路88号", settlementType: "CASH", settlementDay: null },
        ];
        for (const s of suppliers) {
            await safeInsert(conn, `
        INSERT INTO t_supplier (tenant_id, supplier_code, name, short_name, category, province, city, district, address, credit_level, settlement_type, settlement_day, tax_rate, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'A', ?, ?, 0.1300, 1)
      `, [TENANT_ID, s.code, s.name, s.shortName, s.category, s.province, s.city, s.district, s.address, s.settlementType, s.settlementDay], `插入供应商 ${s.name}`);
        }
    } else {
        logger.info("[seed] t_supplier 已有数据，跳过");
    }

    // 获取供应商 ID 列表
    const supplierIds: number[] = [];
    try {
        const [supRows] = await conn.query(
            "SELECT id, name FROM t_supplier WHERE tenant_id = ? ORDER BY id LIMIT 2",
            [TENANT_ID]
        );
        for (const row of (supRows as unknown as Record<string, unknown>[])) {
            supplierIds.push(Number(row.id));
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取供应商ID失败: ${(e as any).message}`);
    }

    // 获取 admin 用户 ID（用于 operator_id）
    let adminUserId = 1;
    try {
        const [userRows] = await conn.query(
            "SELECT id FROM t_sys_user WHERE username = 'admin' AND tenant_id = ? LIMIT 1",
            [TENANT_ID]
        );
        const rows = userRows as unknown as Record<string, unknown>[];
        if (rows.length > 0) {
            adminUserId = Number(rows[0].id);
        }
    } catch (e: unknown) {
        logger.error(`[seed] 获取admin用户ID失败: ${(e as any).message}`);
    }

    // ============================================================
    // 9. 销售账单（让 Dashboard 显示销售数据）
    // ============================================================
    if (await isTableEmpty(conn, "t_sale_bill")) {
        logger.info("[seed] t_sale_bill 为空，插入示例销售单...");
        // 取前3个 SKU 用于销售单
        const saleSkus = Object.values(skuMap).slice(0, 3);

        if (saleSkus.length > 0 && customerIds.length > 0) {
            const now = new Date();
            const today = now.toISOString().slice(0, 10);
            const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
            const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

            // 获取价格
            const priceMap: Record<number, { retail: number; wholesale: number }> = {};
            try {
                const [priceRows] = await conn.query(
                    `SELECT sku_id, retail_price, wholesale_price FROM t_product_price WHERE tenant_id = ?`,
                    [TENANT_ID]
                );
                for (const row of (priceRows as unknown as Record<string, unknown>[])) {
                    priceMap[Number(row.sku_id)] = {
                        retail: Number(row.retail_price),
                        wholesale: Number(row.wholesale_price ?? row.retail_price),
                    };
                }
            } catch (e: unknown) {
                logger.error(`[seed] 获取价格失败: ${(e as any).message}`);
            }

            const bills = [
                // 今日销售单 1：零售客户
                {
                    billNo: "SB20260721001",
                    createdAt: `${today} 09:30:00`,
                    customerId: customerIds[0],
                    customerName: "张三",
                    customerMobile: "13900000001",
                    customerType: "RETAIL",
                    saleType: "CASH",
                    businessStatus: "COMPLETED",
                    collectionStatus: "PAID",
                    sku: saleSkus[0],
                    qty: 2,
                    priceType: "RETAIL",
                },
                // 今日销售单 2：批发客户
                {
                    billNo: "SB20260721002",
                    createdAt: `${today} 14:20:00`,
                    customerId: customerIds[1] ?? customerIds[0],
                    customerName: "李四",
                    customerMobile: "13900000002",
                    customerType: "WHOLESALE",
                    saleType: "CREDIT",
                    businessStatus: "COMPLETED",
                    collectionStatus: "UNPAID",
                    sku: saleSkus[1] ?? saleSkus[0],
                    qty: 12,
                    priceType: "WHOLESALE",
                },
                // 今日销售单 3：零售客户
                {
                    billNo: "SB20260721003",
                    createdAt: `${today} 16:45:00`,
                    customerId: customerIds[2] ?? customerIds[0],
                    customerName: "王五",
                    customerMobile: "13900000003",
                    customerType: "RETAIL",
                    saleType: "CASH",
                    businessStatus: "COMPLETED",
                    collectionStatus: "PAID",
                    sku: saleSkus[2] ?? saleSkus[0],
                    qty: 1,
                    priceType: "RETAIL",
                },
                // 昨日销售单：用于环比
                {
                    billNo: "SB20260720001",
                    createdAt: `${yesterday} 10:15:00`,
                    customerId: customerIds[0],
                    customerName: "张三",
                    customerMobile: "13900000001",
                    customerType: "RETAIL",
                    saleType: "CASH",
                    businessStatus: "COMPLETED",
                    collectionStatus: "PAID",
                    sku: saleSkus[0],
                    qty: 3,
                    priceType: "RETAIL",
                },
                // 本月销售单：用于月度统计
                {
                    billNo: "SB20260715001",
                    createdAt: `${thisMonthStart} 11:00:00`,
                    customerId: customerIds[1] ?? customerIds[0],
                    customerName: "李四",
                    customerMobile: "13900000002",
                    customerType: "WHOLESALE",
                    saleType: "CREDIT",
                    businessStatus: "COMPLETED",
                    collectionStatus: "PARTIAL",
                    sku: saleSkus[1] ?? saleSkus[0],
                    qty: 24,
                    priceType: "WHOLESALE",
                },
            ];

            for (const b of bills) {
                const price = priceMap[b.sku.id];
                if (!price) {
                    logger.warn(`[seed] SKU ${b.sku.code} 无价格，跳过销售单 ${b.billNo}`);
                    continue;
                }
                const unitPrice = b.priceType === "RETAIL" ? price.retail : price.wholesale;
                const goodsAmount = Number((unitPrice * b.qty).toFixed(2));
                const receivedAmount = b.collectionStatus === "PAID" ? goodsAmount : (b.collectionStatus === "PARTIAL" ? Number((goodsAmount * 0.5).toFixed(2)) : 0);
                const unreceivedAmount = Number((goodsAmount - receivedAmount).toFixed(2));

                await safeInsert(conn, `
          INSERT INTO t_sale_bill (tenant_id, bill_no, store_id, customer_id, customer_name, customer_mobile, customer_type, sale_type, business_status, collection_status, goods_amount, discount_amount, rounding_amount, receivable_amount, received_amount, unreceived_amount, operator_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
        `, [TENANT_ID, b.billNo, storeId, b.customerId, b.customerName, b.customerMobile, b.customerType, b.saleType, b.businessStatus, b.collectionStatus, goodsAmount, goodsAmount, receivedAmount, unreceivedAmount, adminUserId, b.createdAt, b.createdAt], `插入销售单 ${b.billNo}`);
            }
        }
    } else {
        logger.info("[seed] t_sale_bill 已有数据，跳过");
    }

    // ============================================================
    // 10. 采购订单（让 Dashboard 显示采购数据）
    // ============================================================
    if (await isTableEmpty(conn, "t_purchase_order")) {
        logger.info("[seed] t_purchase_order 为空，插入示例采购单...");
        const purchaseSkus = Object.values(skuMap).slice(0, 2);

        if (purchaseSkus.length > 0 && supplierIds.length > 0) {
            const now = new Date();
            const today = now.toISOString().slice(0, 10);
            const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

            // 获取成本价
            const costMap: Record<number, number> = {};
            try {
                const [costRows] = await conn.query(
                    `SELECT sku_id, cost_price FROM t_product_price WHERE tenant_id = ?`,
                    [TENANT_ID]
                );
                for (const row of (costRows as unknown as Record<string, unknown>[])) {
                    costMap[Number(row.sku_id)] = Number(row.cost_price);
                }
            } catch (e: unknown) {
                logger.error(`[seed] 获取成本价失败: ${(e as any).message}`);
            }

            // 获取供应商名称
            const supplierNameMap: Record<number, string> = {};
            try {
                const [supRows] = await conn.query(
                    "SELECT id, name FROM t_supplier WHERE tenant_id = ?",
                    [TENANT_ID]
                );
                for (const row of (supRows as unknown as Record<string, unknown>[])) {
                    supplierNameMap[Number(row.id)] = String(row.name);
                }
            } catch {
                // ignore
            }

            const orders = [
                // 今日采购单 1
                {
                    orderNo: "PO20260721001",
                    createdAt: `${today} 08:00:00`,
                    supplierId: supplierIds[0],
                    orderStatus: "COMPLETED",
                    sku: purchaseSkus[0],
                    qty: 60,
                },
                // 今日采购单 2
                {
                    orderNo: "PO20260721002",
                    createdAt: `${today} 13:30:00`,
                    supplierId: supplierIds[1] ?? supplierIds[0],
                    orderStatus: "APPROVED",
                    sku: purchaseSkus[1] ?? purchaseSkus[0],
                    qty: 36,
                },
                // 本月采购单
                {
                    orderNo: "PO20260710001",
                    createdAt: `${thisMonthStart} 09:00:00`,
                    supplierId: supplierIds[0],
                    orderStatus: "COMPLETED",
                    sku: purchaseSkus[0],
                    qty: 120,
                },
            ];

            for (const o of orders) {
                const cost = costMap[o.sku.id] ?? 0;
                const goodsAmount = Number((cost * o.qty).toFixed(2));
                const taxAmount = Number((goodsAmount * 0.13).toFixed(2));
                const payableAmount = Number((goodsAmount + taxAmount).toFixed(2));
                const paidAmount = o.orderStatus === "COMPLETED" ? payableAmount : 0;
                const unpaidAmount = Number((payableAmount - paidAmount).toFixed(2));
                const supplierName = supplierNameMap[o.supplierId] ?? "未知供应商";

                await safeInsert(conn, `
          INSERT INTO t_purchase_order (tenant_id, order_no, supplier_id, supplier_name, store_id, order_status, goods_amount, tax_amount, discount_amount, payable_amount, paid_amount, unpaid_amount, operator_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
        `, [TENANT_ID, o.orderNo, o.supplierId, supplierName, storeId, o.orderStatus, goodsAmount, taxAmount, payableAmount, paidAmount, unpaidAmount, adminUserId, o.createdAt, o.createdAt], `插入采购单 ${o.orderNo}`);
            }
        }
    } else {
        logger.info("[seed] t_purchase_order 已有数据，跳过");
    }

    logger.info("[seed] 种子数据初始化完成");
}
