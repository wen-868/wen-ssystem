import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";
import { AppError } from "../../shared/app-error";
import { makeBizNo } from "../../shared/id";
import logger from "../../shared/logger";

// ==================== 类型定义 ====================

/** 计数 total 行 */
interface CountTotalRow {
  total: number;
}

/** ID 行 */
interface IdRow {
  id: number;
}

/** INSERT 结果行 */
interface InsertResultRow {
  insertId: number;
  affectedRows: number;
}

/** 批发商品列表行 */
interface WholesaleProductListRow {
  spuId: number;
  spuCode: string;
  name: string;
  mainImage: string | null;
  categoryId: number;
  unit: string | null;
  specs: string | null;
  isNew: number;
  skuId: number;
  skuName: string;
  skuCode: string;
  wholesalePrice: number | string;
  retailPrice: number | string;
  minOrderQty: number;
  stockQty: number | string;
  stepPrice: number | string | null;
  stepMinQty: number | null;
}

/** 批发SPU详情行 */
interface WholesaleSpuDetailRow {
  id: number;
  spuCode: string;
  name: string;
  mainImage: string | null;
  categoryId: number;
  categoryName: string | null;
  unit: string | null;
  specs: string | null;
  alcoholContent: number | string | null;
  origin: string | null;
  imageUrls: unknown;
  detail: string | null;
  description: string | null;
  isNew: number;
  isRecommend: number;
  brandId: number | null;
  brandName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** 批发SKU行 */
interface WholesaleSkuRow {
  skuId: number;
  skuName: string;
  skuCode: string;
  barcode: string | null;
  volume: string | null;
  packaging: string | null;
  baseUnit: string | null;
  boxUnit: string | null;
  boxRatio: number | string;
  wholesalePrice: number | string;
  retailPrice: number | string;
  miniappPrice: number | string | null;
  minOrderQty: number;
  availableQty: number | string;
}

/** 商品阶梯价行 */
interface ProductStepPriceRow {
  skuId: number;
  minQty: number;
  price: number | string;
}

/** 批发分类行 */
interface WholesaleCategoryRow {
  id: number;
  name: string;
  parentId: number | null;
  sortNo: number;
  icon: string | null;
  level: number;
}

/** 批发购物车行 */
interface WholesaleCartRow {
  id: number;
  skuId: number;
  quantity: number;
  skuName: string;
  skuCode: string;
  spuId: number;
  spuName: string;
  mainImage: string | null;
  wholesalePrice: number | string;
  minOrderQty: number;
  availableQty: number | string;
  categoryId: number | null;
  categoryName: string | null;
}

/** 批发SKU校验行 */
interface WholesaleSkuCheckRow {
  id: number;
  skuName: string;
  wholesalePrice: number | string;
  minOrderQty: number;
}

/** 批发购物车现有项行 */
interface WholesaleCartExistingRow {
  id: number;
  quantity: number;
}

/** 批发购物车更新查询行 */
interface WholesaleCartUpdateRow {
  id: number;
  skuId: number;
}

/** 批发订单列表行 */
interface WholesaleOrderListRow {
  id: number;
  orderNo: string;
  orderStatus: string;
  payStatus: string;
  goodsAmount: number | string;
  discountAmount: number | string;
  shippingAmount: number | string;
  payableAmount: number | string;
  paidAmount: number | string;
  receiverName: string | null;
  receiverMobile: string | null;
  createdAt: string | Date;
  paidAt: string | Date | null;
  shippedAt: string | Date | null;
  completedAt: string | Date | null;
}

/** 批发订单项行（列表缩略） */
interface WholesaleOrderItemRow {
  orderNo: string;
  skuId: number;
  skuName: string;
  skuImage: string | null;
  quantity: number;
  unitPrice: number | string;
  subtotalAmount: number | string;
}

/** 批发订单详情行 */
interface WholesaleOrderDetailRow {
  id: number;
  orderNo: string;
  orderStatus: string;
  payStatus: string;
  goodsAmount: number | string;
  discountAmount: number | string;
  shippingAmount: number | string;
  payableAmount: number | string;
  paidAmount: number | string;
  receiverName: string | null;
  receiverMobile: string | null;
  receiverProvince: string | null;
  receiverCity: string | null;
  receiverDistrict: string | null;
  receiverAddress: string | null;
  remark: string | null;
  couponId: number | null;
  couponAmount: number | string;
  pointsUsed: number;
  pointsAmount: number | string;
  createdAt: string | Date;
  paidAt: string | Date | null;
  shippedAt: string | Date | null;
  completedAt: string | Date | null;
  cancelledAt: string | Date | null;
  cancelReason: string | null;
}

/** 批发订单详情商品项行 */
interface WholesaleOrderDetailItemRow {
  id: number;
  spuId: number;
  skuId: number;
  skuName: string;
  skuImage: string | null;
  quantity: number;
  unitPrice: number | string;
  subtotalAmount: number | string;
  specInfo: string | null;
}

// ========== 批发商品列表 ==========
export async function getWholesaleProducts(
  tenantId: string,
  params: {
    keyword?: string;
    categoryId?: number;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  }
) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  const keyword = params.keyword || "";
  const categoryId = params.categoryId;

  const conditions: string[] = [
    "p.status = 'ON_SALE'",
    "pp.wholesale_price IS NOT NULL",
    "pp.wholesale_price > 0"
  ];
  const paramsList: unknown[] = [];

  if (keyword) {
    conditions.push("(p.name LIKE ? OR s.sku_name LIKE ? OR s.sku_code LIKE ?)");
    paramsList.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (categoryId) {
    conditions.push("p.category_id = ?");
    paramsList.push(categoryId);
  }

  const where = conditions.join(" AND ");

  let orderBy = "p.sort_no DESC, p.id DESC";
  if (params.sortBy === "price") {
    orderBy = `pp.wholesale_price ${params.sortOrder === "asc" ? "ASC" : "DESC"}`;
  } else if (params.sortBy === "sales") {
    orderBy = "p.sale_count DESC, p.id DESC";
  }

  const records = await queryWithTenant<WholesaleProductListRow>(
    `SELECT 
       p.id AS spuId, p.spu_code AS spuCode, p.name, p.main_image AS mainImage,
       p.category_id AS categoryId, p.unit, p.specs, p.is_new AS isNew,
       s.id AS skuId, s.sku_name AS skuName, s.sku_code AS skuCode,
       pp.wholesale_price AS wholesalePrice, pp.retail_price AS retailPrice,
       pp.min_order_qty AS minOrderQty,
       CASE 
         WHEN pss.stock_type = 'WHOLESALE' THEN COALESCE(pss.available_qty, 0)
         ELSE COALESCE(ib.available_qty, 0)
       END AS stockQty,
       psp.price AS stepPrice, psp.min_qty AS stepMinQty
     FROM t_product_spu p
     JOIN t_product_sku s ON s.spu_id = p.id
     JOIN t_product_price pp ON pp.sku_id = s.id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'WHOLESALE'
     LEFT JOIN t_product_step_price psp ON psp.sku_id = s.id
     WHERE ${where} AND p.tenant_id = ?
     GROUP BY s.id
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...paramsList, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(DISTINCT s.id) AS total
     FROM t_product_spu p
     JOIN t_product_sku s ON s.spu_id = p.id
     JOIN t_product_price pp ON pp.sku_id = s.id
     WHERE ${where} AND p.tenant_id = ?`,
    [...paramsList, tenantId],
    tenantId
  );

  // 整理数据，按SPU分组
  const spuMap = new Map<number, any>();

  for (const row of records) {
    if (!spuMap.has(row.spuId)) {
      spuMap.set(row.spuId, {
        spuId: row.spuId,
        spuCode: row.spuCode,
        name: row.name,
        mainImage: row.mainImage,
        categoryId: row.categoryId,
        unit: row.unit,
        specs: row.specs,
        isNew: row.isNew,
        minPrice: Number(row.wholesalePrice),
        skus: []
      });
    }

    const spu = spuMap.get(row.spuId);
    spu.skus.push({
      skuId: row.skuId,
      skuName: row.skuName,
      skuCode: row.skuCode,
      wholesalePrice: Number(row.wholesalePrice),
      retailPrice: Number(row.retailPrice),
      minOrderQty: row.minOrderQty || 1,
      stockQty: Number(row.stockQty || 0),
      stepPrices: []
    });

    if (Number(row.wholesalePrice) < spu.minPrice) {
      spu.minPrice = Number(row.wholesalePrice);
    }
  }

  return {
    total: Number(totalRow?.total || 0),
    page,
    pageSize,
    records: Array.from(spuMap.values())
  };
}

// ========== 批发商品详情 ==========
export async function getWholesaleProductDetail(spuId: number, tenantId: string) {
  // 获取SPU基本信息
  const spu = await queryOneWithTenant<WholesaleSpuDetailRow>(
    `SELECT p.id, p.spu_code AS spuCode, p.name, p.main_image AS mainImage,
            p.category_id AS categoryId, p.category_name AS categoryName,
            p.unit, p.specs, p.alcohol_content AS alcoholContent, p.origin,
            p.image_urls AS imageUrls, p.detail, p.description,
            p.is_new AS isNew, p.is_recommend AS isRecommend,
            p.brand_id AS brandId, p.brand_name AS brandName,
            p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM t_product_spu p
     WHERE p.id = ? AND p.tenant_id = ?`,
    [spuId, tenantId],
    tenantId
  );

  if (!spu) {
    throw new AppError("商品不存在", 404);
  }

  // 获取SKU列表（只返回有批发价的SKU）
  const skus = await queryWithTenant<WholesaleSkuRow>(
    `SELECT s.id AS skuId, s.sku_name AS skuName, s.sku_code AS skuCode,
            s.barcode, s.volume, s.packaging, s.base_unit AS baseUnit,
            s.box_unit AS boxUnit, s.box_ratio AS boxRatio,
            pp.wholesale_price AS wholesalePrice, pp.retail_price AS retailPrice,
            pp.miniapp_price AS miniappPrice, pp.min_order_qty AS minOrderQty,
            COALESCE(ib.available_qty, 0) AS availableQty
     FROM t_product_sku s
     JOIN t_product_price pp ON pp.sku_id = s.id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'WHOLESALE'
     WHERE s.spu_id = ? AND pp.wholesale_price IS NOT NULL AND pp.wholesale_price > 0
       AND s.tenant_id = ?
     ORDER BY s.id ASC`,
    [spuId, tenantId],
    tenantId
  );

  // 获取阶梯价
  const skuIds = skus.map((s: any) => s.skuId);
  let stepPrices: any[] = [];
  if (skuIds.length > 0) {
    const placeholders = skuIds.map(() => "?").join(",");
    stepPrices = await queryWithTenant<ProductStepPriceRow>(
      `SELECT sku_id AS skuId, min_qty AS minQty, price
       FROM t_product_step_price
       WHERE sku_id IN (${placeholders}) AND tenant_id = ?
       ORDER BY sku_id, min_qty ASC`,
      [...skuIds, tenantId],
      tenantId
    );
  }

  // 组装SKU数据
  const skuList = skus.map((sku: any) => {
    const skuStepPrices = stepPrices
      .filter((sp: any) => sp.skuId === sku.skuId)
      .map((sp: any) => ({
        minQty: sp.minQty,
        price: Number(sp.price)
      }));

    return {
      skuId: sku.skuId,
      skuName: sku.skuName,
      skuCode: sku.skuCode,
      barcode: sku.barcode,
      volume: sku.volume,
      packaging: sku.packaging,
      baseUnit: sku.baseUnit,
      boxUnit: sku.boxUnit,
      boxRatio: sku.boxRatio,
      wholesalePrice: Number(sku.wholesalePrice),
      retailPrice: Number(sku.retailPrice),
      miniappPrice: sku.miniappPrice ? Number(sku.miniappPrice) : undefined,
      minOrderQty: sku.minOrderQty || 1,
      availableQty: Number(sku.availableQty || 0),
      stepPrices: skuStepPrices
    };
  });

  // 计算最低批发价
  const minWholesalePrice = skuList.length > 0
    ? Math.min(...skuList.map((s: any) => s.wholesalePrice))
    : 0;

  return {
    spuId: spu.id,
    spuCode: spu.spuCode,
    name: spu.name,
    categoryId: spu.categoryId,
    categoryName: spu.categoryName,
    brandId: spu.brandId,
    brandName: spu.brandName,
    unit: spu.unit,
    specs: spu.specs,
    alcoholContent: spu.alcoholContent,
    origin: spu.origin,
    mainImage: spu.mainImage,
    imageUrls: spu.imageUrls,
    detail: spu.detail,
    description: spu.description,
    isNew: spu.isNew,
    isRecommend: spu.isRecommend,
    minWholesalePrice,
    createdAt: spu.createdAt,
    updatedAt: spu.updatedAt,
    skus: skuList
  };
}

// ========== 批发分类列表 ==========
export async function getWholesaleCategories(tenantId: string) {
  // 获取有批发商品的分类
  const rows = await queryWithTenant<WholesaleCategoryRow>(
    `SELECT DISTINCT c.id, c.name, c.parent_id AS parentId, c.sort_no AS sortNo,
            c.icon, c.level
     FROM t_product_category c
     INNER JOIN t_product_spu p ON p.category_id = c.id
     INNER JOIN t_product_sku s ON s.spu_id = p.id
     INNER JOIN t_product_price pp ON pp.sku_id = s.id
     WHERE pp.wholesale_price IS NOT NULL AND pp.wholesale_price > 0
       AND p.status = 'ON_SALE'
       AND c.status = 1 AND c.allow_online_sale = 1
       AND c.tenant_id = ?
     ORDER BY c.sort_no ASC, c.id ASC`,
    [],
    tenantId
  );

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    sortNo: row.sortNo,
    icon: row.icon || "",
    level: row.level
  }));
}

// ========== 获取批发购物车列表 ==========
export async function getWholesaleCart(memberId: number, tenantId: string) {
  const rows = await queryWithTenant<WholesaleCartRow>(
    `SELECT wc.id, wc.sku_id AS skuId, wc.quantity,
            s.sku_name AS skuName, s.sku_code AS skuCode,
            p.id AS spuId, p.name AS spuName, p.main_image AS mainImage,
            pp.wholesale_price AS wholesalePrice, pp.min_order_qty AS minOrderQty,
            COALESCE(ib.available_qty, 0) AS availableQty,
            pc.id AS categoryId, pc.name AS categoryName
     FROM t_wholesale_cart wc
     JOIN t_product_sku s ON s.id = wc.sku_id
     JOIN t_product_spu p ON p.id = s.spu_id
     JOIN t_product_price pp ON pp.sku_id = s.id
     LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'WHOLESALE'
     LEFT JOIN t_product_category pc ON pc.id = p.category_id
     WHERE wc.member_id = ? AND wc.tenant_id = ?
     ORDER BY wc.created_at DESC`,
    [memberId, tenantId],
    tenantId
  );

  const items = rows.map((row: any) => ({
    id: row.id,
    skuId: row.skuId,
    spuId: row.spuId,
    skuName: row.skuName,
    skuCode: row.skuCode,
    spuName: row.spuName,
    mainImage: row.mainImage,
    wholesalePrice: Number(row.wholesalePrice),
    minOrderQty: row.minOrderQty || 1,
    quantity: row.quantity,
    availableQty: Number(row.availableQty || 0),
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subtotal: Number((row.wholesalePrice * row.quantity).toFixed(2))
  }));

  // 计算合计
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
  const totalCount = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return {
    items,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalCount
  };
}

// ========== 添加到批发购物车 ==========
export async function addWholesaleCartItem(
  memberId: number,
  tenantId: string,
  skuId: number,
  quantity: number
) {
  // 校验商品是否存在且有批发价
  const sku = await queryOneWithTenant<WholesaleSkuCheckRow>(
    `SELECT s.id, s.sku_name AS skuName, pp.wholesale_price AS wholesalePrice,
            pp.min_order_qty AS minOrderQty
     FROM t_product_sku s
     JOIN t_product_price pp ON pp.sku_id = s.id
     WHERE s.id = ? AND pp.wholesale_price IS NOT NULL AND pp.wholesale_price > 0
       AND s.tenant_id = ?`,
    [skuId, tenantId],
    tenantId
  );

  if (!sku) {
    throw new AppError("批发商品不存在", 404);
  }

  const minOrderQty = sku.minOrderQty || 1;
  if (quantity < minOrderQty) {
    throw new AppError(`起订量为${minOrderQty}件`, 400);
  }

  // 检查是否已在购物车中
  const existing = await queryOneWithTenant<WholesaleCartExistingRow>(
    "SELECT id, quantity FROM t_wholesale_cart WHERE member_id = ? AND sku_id = ? AND tenant_id = ?",
    [memberId, skuId, tenantId],
    tenantId
  );

  if (existing) {
    // 更新数量
    const newQuantity = existing.quantity + quantity;
    await queryWithTenant(
      "UPDATE t_wholesale_cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
      [newQuantity, existing.id, tenantId],
      tenantId
    );
    return { id: existing.id, quantity: newQuantity, message: "已添加到购物车" };
  } else {
    // 新增
    const result = await queryWithTenant<InsertResultRow>(
      "INSERT INTO t_wholesale_cart (member_id, sku_id, quantity, tenant_id) VALUES (?, ?, ?, ?)",
      [memberId, skuId, quantity, tenantId],
      tenantId
    );
    const insertId = (result as unknown as Record<string, unknown>).insertId;
    return { id: insertId, quantity, message: "已添加到购物车" };
  }
}

// ========== 更新批发购物车数量 ==========
export async function updateWholesaleCartItem(
  memberId: number,
  tenantId: string,
  cartId: number,
  quantity: number
) {
  const existing = await queryOneWithTenant<WholesaleCartUpdateRow>(
    "SELECT id, sku_id AS skuId FROM t_wholesale_cart WHERE id = ? AND member_id = ? AND tenant_id = ?",
    [cartId, memberId, tenantId],
    tenantId
  );

  if (!existing) {
    throw new AppError("购物车商品不存在", 404);
  }

  if (quantity <= 0) {
    // 数量为0时删除
    await queryWithTenant(
      "DELETE FROM t_wholesale_cart WHERE id = ? AND tenant_id = ?",
      [cartId, tenantId],
      tenantId
    );
    return { message: "已删除" };
  }

  await queryWithTenant(
    "UPDATE t_wholesale_cart SET quantity = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?",
    [quantity, cartId, tenantId],
    tenantId
  );

  return { id: cartId, quantity, message: "更新成功" };
}

// ========== 删除批发购物车商品 ==========
export async function deleteWholesaleCartItem(
  memberId: number,
  tenantId: string,
  cartId: number
) {
  const existing = await queryOneWithTenant<IdRow>(
    "SELECT id FROM t_wholesale_cart WHERE id = ? AND member_id = ? AND tenant_id = ?",
    [cartId, memberId, tenantId],
    tenantId
  );

  if (!existing) {
    throw new AppError("购物车商品不存在", 404);
  }

  await queryWithTenant(
    "DELETE FROM t_wholesale_cart WHERE id = ? AND tenant_id = ?",
    [cartId, tenantId],
    tenantId
  );

  return { message: "删除成功" };
}

// ========== 创建批发订单 ==========
export async function createWholesaleOrder(
  memberId: number,
  tenantId: string,
  body: {
    items: Array<{ skuId: number; quantity: number }>;
    addressId?: number;
    receiverName?: string;
    receiverMobile?: string;
    receiverProvince?: string;
    receiverCity?: string;
    receiverDistrict?: string;
    receiverAddress?: string;
    remark?: string;
    couponId?: number;
  }
) {
  if (!body.items || body.items.length === 0) {
    throw new AppError("订单商品不能为空", 400);
  }

  return await transaction(async (conn) => {
    const orderNo = makeBizNo("PF");
    let goodsAmount = 0;
    const orderItems: any[] = [];

    // 校验商品并计算金额
    for (const item of body.items) {
      const [skuRows] = await (conn as any).execute(
        `SELECT s.id, s.sku_name AS skuName, p.id AS spuId, p.name AS spuName,
                p.main_image AS mainImage, pp.wholesale_price AS wholesalePrice,
                pp.min_order_qty AS minOrderQty,
                COALESCE(ib.available_qty, 0) AS availableQty
         FROM t_product_sku s
         JOIN t_product_spu p ON p.id = s.spu_id
         JOIN t_product_price pp ON pp.sku_id = s.id
         LEFT JOIN t_inventory_balance ib ON ib.sku_id = s.id AND ib.stock_type = 'WHOLESALE'
         WHERE s.id = ? AND pp.wholesale_price IS NOT NULL AND pp.wholesale_price > 0
           AND s.tenant_id = ?
         LIMIT 1`,
        [item.skuId, tenantId]
      );
      const sku = (skuRows as any[])[0];

      if (!sku) {
        throw new AppError(`商品SKU不存在或无批发价: ${item.skuId}`, 400);
      }

      const minOrderQty = sku.minOrderQty || 1;
      if (item.quantity < minOrderQty) {
        throw new AppError(`${sku.skuName} 起订量为${minOrderQty}件`, 400);
      }

      if (item.quantity > sku.availableQty) {
        throw new AppError(`${sku.skuName} 库存不足，当前库存${sku.availableQty}件`, 400);
      }

      const unitPrice = Number(sku.wholesalePrice);
      const subtotal = Number((unitPrice * item.quantity).toFixed(2));
      goodsAmount += subtotal;

      orderItems.push({
        spuId: sku.spuId,
        skuId: sku.id,
        skuName: sku.skuName,
        skuImage: sku.mainImage,
        quantity: item.quantity,
        unitPrice,
        subtotal
      });
    }

    // 计算其他金额（简化版本，后续可扩展优惠券、运费等）
    const discountAmount = 0;
    const shippingAmount = 0;
    const payableAmount = Number((goodsAmount - discountAmount + shippingAmount).toFixed(2));

    // 获取收货地址（如果传了addressId）
    let receiver = {
      name: body.receiverName,
      mobile: body.receiverMobile,
      province: body.receiverProvince,
      city: body.receiverCity,
      district: body.receiverDistrict,
      address: body.receiverAddress
    };

    if (body.addressId) {
      const [addrRows] = await (conn as any).execute(
        `SELECT name, mobile, province, city, district, detail AS address
         FROM t_retail_consumer_address
         WHERE id = ? AND user_id = ? AND tenant_id = ?
         LIMIT 1`,
        [body.addressId, memberId, tenantId]
      );
      const addr = (addrRows as any[])[0];
      if (addr) {
        receiver = {
          name: addr.name,
          mobile: addr.mobile,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          address: addr.address
        };
      }
    }

    // 创建批发订单
    await (conn as any).execute(
      `INSERT INTO t_wholesale_order 
       (order_no, member_id, order_status, pay_status, goods_amount, discount_amount,
        shipping_amount, payable_amount, paid_amount,
        receiver_name, receiver_mobile, receiver_province, receiver_city, receiver_district,
        receiver_address, remark, coupon_id, coupon_amount, tenant_id)
       VALUES (?, ?, 'PENDING', 'UNPAID', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        orderNo,
        memberId,
        goodsAmount,
        discountAmount,
        shippingAmount,
        payableAmount,
        receiver.name || null,
        receiver.mobile || null,
        receiver.province || null,
        receiver.city || null,
        receiver.district || null,
        receiver.address || null,
        body.remark || null,
        body.couponId || null,
        tenantId
      ]
    );

    // 创建订单项
    for (const item of orderItems) {
      await (conn as any).execute(
        `INSERT INTO t_wholesale_order_item 
         (order_no, spu_id, sku_id, sku_name, sku_image, quantity,
          unit_price, subtotal_amount, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo,
          item.spuId,
          item.skuId,
          item.skuName,
          item.skuImage,
          item.quantity,
          item.unitPrice,
          item.subtotal,
          tenantId
        ]
      );

      // 扣减批发库存
      await (conn as any).execute(
        `UPDATE t_inventory_balance
         SET available_qty = available_qty - ?,
             locked_qty = locked_qty + ?,
             updated_at = NOW()
         WHERE sku_id = ? AND stock_type = 'WHOLESALE' AND tenant_id = ?`,
        [item.quantity, item.quantity, item.skuId, tenantId]
      );
    }

    // 清空购物车中已下单的商品
    const skuIds = body.items.map((item) => item.skuId);
    if (skuIds.length > 0) {
      const placeholders = skuIds.map(() => "?").join(",");
      await (conn as any).execute(
        `DELETE FROM t_wholesale_cart 
         WHERE member_id = ? AND sku_id IN (${placeholders}) AND tenant_id = ?`,
        [memberId, ...skuIds, tenantId]
      );
    }

    logger.info(`[批发订单创建] 成功 orderNo=${orderNo} memberId=${memberId} amount=${payableAmount}`);

    return {
      orderNo,
      orderStatus: "PENDING",
      payStatus: "UNPAID",
      goodsAmount,
      discountAmount,
      shippingAmount,
      payableAmount,
      items: orderItems.map((item) => ({
        skuId: item.skuId,
        skuName: item.skuName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal
      }))
    };
  });
}

// ========== 获取批发订单列表 ==========
export async function getWholesaleOrders(
  memberId: number,
  tenantId: string,
  page: number,
  pageSize: number,
  status?: string
) {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ["member_id = ?"];
  const params: unknown[] = [memberId];

  if (status && status !== "ALL") {
    conditions.push("order_status = ?");
    params.push(status);
  }

  const where = conditions.join(" AND ");

  const records = await queryWithTenant<WholesaleOrderListRow>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus,
            pay_status AS payStatus, goods_amount AS goodsAmount,
            discount_amount AS discountAmount, shipping_amount AS shippingAmount,
            payable_amount AS payableAmount, paid_amount AS paidAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            created_at AS createdAt, paid_at AS paidAt,
            shipped_at AS shippedAt, completed_at AS completedAt
     FROM t_wholesale_order
     WHERE ${where} AND tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, tenantId, pageSize, offset],
    tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_wholesale_order WHERE ${where} AND tenant_id = ?`,
    [...params, tenantId],
    tenantId
  );

  // 获取每个订单的商品（取第一个商品作为缩略图）
  const orderNos = records.map((r: any) => r.orderNo);
  let orderItems: any[] = [];
  if (orderNos.length > 0) {
    const placeholders = orderNos.map(() => "?").join(",");
    orderItems = await queryWithTenant<WholesaleOrderItemRow>(
      `SELECT oi.order_no AS orderNo, oi.sku_id AS skuId, oi.sku_name AS skuName,
              oi.sku_image AS skuImage, oi.quantity, oi.unit_price AS unitPrice,
              oi.subtotal_amount AS subtotalAmount
       FROM t_wholesale_order_item oi
       WHERE oi.order_no IN (${placeholders}) AND oi.tenant_id = ?
       ORDER BY oi.id ASC`,
      [...orderNos, tenantId],
      tenantId
    );
  }

  // 组装订单数据
  const orderMap = new Map<string, any>();
  for (const item of orderItems) {
    if (!orderMap.has(item.orderNo)) {
      orderMap.set(item.orderNo, []);
    }
    orderMap.get(item.orderNo).push({
      skuId: item.skuId,
      skuName: item.skuName,
      skuImage: item.skuImage,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotalAmount)
    });
  }

  const result = records.map((order: any) => {
    const items = orderMap.get(order.orderNo) || [];
    return {
      id: order.id,
      orderNo: order.orderNo,
      orderStatus: order.orderStatus,
      payStatus: order.payStatus,
      goodsAmount: Number(order.goodsAmount),
      discountAmount: Number(order.discountAmount),
      shippingAmount: Number(order.shippingAmount),
      payableAmount: Number(order.payableAmount),
      paidAmount: Number(order.paidAmount),
      receiverName: order.receiverName,
      receiverMobile: order.receiverMobile,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      completedAt: order.completedAt,
      itemCount: items.length,
      firstItem: items[0] || null,
      items: items.slice(0, 2) // 列表只返回前2个商品
    };
  });

  return {
    total: Number(totalRow?.total || 0),
    page,
    pageSize,
    records: result
  };
}

// ========== 获取批发订单详情 ==========
export async function getWholesaleOrderDetail(
  memberId: number,
  tenantId: string,
  orderNo: string
) {
  const order = await queryOneWithTenant<WholesaleOrderDetailRow>(
    `SELECT id, order_no AS orderNo, order_status AS orderStatus,
            pay_status AS payStatus, goods_amount AS goodsAmount,
            discount_amount AS discountAmount, shipping_amount AS shippingAmount,
            payable_amount AS payableAmount, paid_amount AS paidAmount,
            receiver_name AS receiverName, receiver_mobile AS receiverMobile,
            receiver_province AS receiverProvince, receiver_city AS receiverCity,
            receiver_district AS receiverDistrict, receiver_address AS receiverAddress,
            remark, coupon_id AS couponId, coupon_amount AS couponAmount,
            points_used AS pointsUsed, points_amount AS pointsAmount,
            created_at AS createdAt, paid_at AS paidAt,
            shipped_at AS shippedAt, completed_at AS completedAt,
            cancelled_at AS cancelledAt, cancel_reason AS cancelReason
     FROM t_wholesale_order
     WHERE order_no = ? AND member_id = ? AND tenant_id = ?`,
    [orderNo, memberId, tenantId],
    tenantId
  );

  if (!order) {
    throw new AppError("订单不存在", 404);
  }

  const items = await queryWithTenant<WholesaleOrderDetailItemRow>(
    `SELECT id, spu_id AS spuId, sku_id AS skuId, sku_name AS skuName,
            sku_image AS skuImage, quantity, unit_price AS unitPrice,
            subtotal_amount AS subtotalAmount, spec_info AS specInfo
     FROM t_wholesale_order_item
     WHERE order_no = ? AND tenant_id = ?
     ORDER BY id ASC`,
    [orderNo, tenantId],
    tenantId
  );

  return {
    id: order.id,
    orderNo: order.orderNo,
    orderStatus: order.orderStatus,
    payStatus: order.payStatus,
    goodsAmount: Number(order.goodsAmount),
    discountAmount: Number(order.discountAmount),
    shippingAmount: Number(order.shippingAmount),
    payableAmount: Number(order.payableAmount),
    paidAmount: Number(order.paidAmount),
    receiver: {
      name: order.receiverName,
      mobile: order.receiverMobile,
      province: order.receiverProvince,
      city: order.receiverCity,
      district: order.receiverDistrict,
      address: order.receiverAddress
    },
    remark: order.remark,
    couponId: order.couponId,
    couponAmount: Number(order.couponAmount || 0),
    pointsUsed: order.pointsUsed || 0,
    pointsAmount: Number(order.pointsAmount || 0),
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    items: items.map((item: any) => ({
      id: item.id,
      spuId: item.spuId,
      skuId: item.skuId,
      skuName: item.skuName,
      skuImage: item.skuImage,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotalAmount),
      specInfo: item.specInfo
    }))
  };
}
