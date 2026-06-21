import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuth } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { makeBizNo } from "../shared/id.js";
import { ok } from "../shared/response.js";

export const purchaseRouter = Router();

purchaseRouter.use(requireAuth);

// 采购订单号生成：CGDD{YYMMDD}{4位序号}
async function generatePurchaseOrderNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yy}${mm}${dd}`;
  
  // 查询今天已有的最大序号
  const maxCode = await queryOne<any>(
    `SELECT order_no FROM purchase_order 
     WHERE order_no LIKE ? 
     ORDER BY order_no DESC LIMIT 1`,
    [`CGDD${datePart}%`]
  );
  
  let seq = 1;
  if (maxCode) {
    const lastSeq = parseInt(maxCode.order_no.slice(-4));
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }
  
  return `CGDD${datePart}${String(seq).padStart(4, "0")}`;
}

// GET /api/admin/purchase-orders - 列表
purchaseRouter.get("/", asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const offset = (page - 1) * pageSize;
  const keyword = String(req.query.keyword || "");
  const status = req.query.status ? String(req.query.status) : null;
  const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
  
  let sql = `SELECT po.id, po.order_no AS orderNo, po.supplier_id AS supplierId, 
                    po.supplier_name AS supplierName, po.store_id AS storeId,
                    po.order_status AS orderStatus, po.goods_amount AS goodsAmount,
                    po.tax_amount AS taxAmount, po.discount_amount AS discountAmount,
                    po.payable_amount AS payableAmount, po.paid_amount AS paidAmount,
                    po.unpaid_amount AS unpaidAmount, po.expected_date AS expectedDate,
                    po.actual_date AS actualDate, po.operator_id AS operatorId,
                    po.auditor_id AS auditorId, po.audited_at AS auditedAt,
                    po.remark, po.created_at AS createdAt, po.updated_at AS updatedAt
             FROM purchase_order po
             WHERE 1=1`;
  const params: unknown[] = [];
  
  if (keyword) {
    sql += ` AND (po.order_no LIKE ? OR po.supplier_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (status) {
    sql += ` AND po.order_status = ?`;
    params.push(status);
  }
  
  if (supplierId) {
    sql += ` AND po.supplier_id = ?`;
    params.push(supplierId);
  }
  
  sql += ` ORDER BY po.id DESC LIMIT ? OFFSET ?`;
  params.push(pageSize, offset);
  
  const records = await query<any>(sql, params);
  
  let countSql = `SELECT COUNT(*) AS total FROM purchase_order po WHERE 1=1`;
  const countParams: unknown[] = [];
  
  if (keyword) {
    countSql += ` AND (po.order_no LIKE ? OR po.supplier_name LIKE ?)`;
    countParams.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (status) {
    countSql += ` AND po.order_status = ?`;
    countParams.push(status);
  }
  
  if (supplierId) {
    countSql += ` AND po.supplier_id = ?`;
    countParams.push(supplierId);
  }
  
  const totalRow = await queryOne<any>(countSql, countParams);
  
  res.json(ok({ total: totalRow?.total ?? 0, page, pageSize, records }));
}));

// POST /api/admin/purchase-orders - 创建
purchaseRouter.post("/", asyncHandler(async (req, res) => {
  const body = z.object({
    supplierId: z.number().positive("供应商ID必须大于0"),
    storeId: z.number().positive("门店ID必须大于0"),
    expectedDate: z.string().optional(),
    remark: z.string().optional(),
    items: z.array(z.object({
      skuId: z.number().positive("SKU ID必须大于0"),
      boxQty: z.number().int().min(0).default(0),
      bottleQty: z.number().int().min(0).default(0),
      unitPrice: z.number().min(0),
      taxRate: z.number().min(0).max(1).default(0),
      remark: z.string().optional()
    })).min(1, "至少需要一个商品明细")
  }).parse(req.body);
  
  const result = await transaction(async (conn) => {
    // 获取供应商信息
    const supplier = await queryOne<any>(
      "SELECT id, name FROM supplier WHERE id = ? AND status = 1",
      [body.supplierId]
    );
    
    if (!supplier) {
      throw new Error("供应商不存在或已停用");
    }
    
    const orderNo = await generatePurchaseOrderNo();
    
    // 计算金额
    let goodsAmount = 0;
    let taxAmount = 0;
    const itemSnapshots = [];
    
    for (const item of body.items) {
      // 获取SKU信息
      const sku = await queryOne<any>(
        `SELECT s.id, s.sku_name, s.barcode, pp.retail_price, pp.wholesale_price
         FROM product_sku s
         LEFT JOIN product_price pp ON pp.sku_id = s.id
         WHERE s.id = ?`,
        [item.skuId]
      );
      
      if (!sku) {
        throw new Error(`SKU不存在：${item.skuId}`);
      }
      
      const totalBottleQty = item.boxQty * 12 + item.bottleQty; // 假设1箱=12瓶
      const subtotalAmount = item.unitPrice * totalBottleQty;
      const itemTaxAmount = Number((subtotalAmount * item.taxRate).toFixed(2));
      const totalAmount = Number((subtotalAmount + itemTaxAmount).toFixed(2));
      
      goodsAmount += subtotalAmount;
      taxAmount += itemTaxAmount;
      
      itemSnapshots.push({
        skuId: item.skuId,
        skuName: sku.sku_name,
        barcode: sku.barcode,
        boxQty: item.boxQty,
        bottleQty: item.bottleQty,
        totalBottleQty,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        subtotalAmount: Number(subtotalAmount.toFixed(2)),
        taxAmount: itemTaxAmount,
        totalAmount,
        remark: item.remark
      });
    }
    
    const discountAmount = 0; // 暂时不支持优惠
    const payableAmount = Number((goodsAmount + taxAmount - discountAmount).toFixed(2));
    
    // 插入采购订单
    await conn.execute(
      `INSERT INTO purchase_order (order_no, supplier_id, supplier_name, store_id, order_status,
                                   goods_amount, tax_amount, discount_amount, payable_amount,
                                   paid_amount, unpaid_amount, expected_date, operator_id, remark)
       VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        orderNo, body.supplierId, supplier.name, body.storeId,
        goodsAmount, taxAmount, discountAmount, payableAmount, payableAmount,
        body.expectedDate ?? null, req.user?.id ?? 0, body.remark ?? null
      ]
    );
    
    // 插入订单明细
    for (const item of itemSnapshots) {
      await conn.execute(
        `INSERT INTO purchase_order_item (order_no, sku_id, sku_name, barcode, box_qty, bottle_qty,
                                          total_bottle_qty, unit_price, tax_rate, subtotal_amount,
                                          tax_amount, total_amount, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNo, item.skuId, item.skuName, item.barcode, item.boxQty, item.bottleQty,
          item.totalBottleQty, item.unitPrice, item.taxRate, item.subtotalAmount,
          item.taxAmount, item.totalAmount, item.remark ?? null
        ]
      );
    }
    
    // 写操作日志
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'PURCHASE_ORDER', 'CREATE', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", orderNo, JSON.stringify({ orderNo, supplierId: body.supplierId })]
    );
    
    return {
      orderNo,
      supplierId: body.supplierId,
      supplierName: supplier.name,
      storeId: body.storeId,
      orderStatus: "DRAFT",
      goodsAmount,
      taxAmount,
      discountAmount,
      payableAmount,
      paidAmount: 0,
      unpaidAmount: payableAmount,
      expectedDate: body.expectedDate ?? null,
      items: itemSnapshots
    };
  });
  
  res.json(ok(result));
}));

// GET /api/admin/purchase-orders/:orderNo - 详情
purchaseRouter.get("/:orderNo", asyncHandler(async (req, res) => {
  const order = await queryOne<any>(
    `SELECT id, order_no AS orderNo, supplier_id AS supplierId, supplier_name AS supplierName,
            store_id AS storeId, order_status AS orderStatus, goods_amount AS goodsAmount,
            tax_amount AS taxAmount, discount_amount AS discountAmount,
            payable_amount AS payableAmount, paid_amount AS paidAmount,
            unpaid_amount AS unpaidAmount, expected_date AS expectedDate,
            actual_date AS actualDate, operator_id AS operatorId,
            auditor_id AS auditorId, audited_at AS auditedAt, remark,
            created_at AS createdAt, updated_at AS updatedAt
     FROM purchase_order WHERE order_no = ?`,
    [req.params.orderNo]
  );
  
  if (!order) {
    res.status(404).json({ code: "404", message: "采购订单不存在" });
    return;
  }
  
  const items = await query<any>(
    `SELECT id, sku_id AS skuId, sku_name AS skuName, barcode, box_qty AS boxQty,
            bottle_qty AS bottleQty, total_bottle_qty AS totalBottleQty,
            unit_price AS unitPrice, tax_rate AS taxRate, subtotal_amount AS subtotalAmount,
            tax_amount AS taxAmount, total_amount AS totalAmount,
            in_stocked_qty AS inStockedQty, remark
     FROM purchase_order_item WHERE order_no = ?`,
    [req.params.orderNo]
  );
  
  res.json(ok({ ...order, items }));
}));

// POST /api/admin/purchase-orders/:orderNo/approve - 审核
purchaseRouter.post("/:orderNo/approve", asyncHandler(async (req, res) => {
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT order_no, order_status FROM purchase_order WHERE order_no = ? FOR UPDATE`,
      [req.params.orderNo]
    );
    
    const order = rows[0];
    if (!order) {
      throw new Error("采购订单不存在");
    }
    
    if (order.order_status !== "PENDING") {
      throw new Error("订单状态不是待审核，无法审核");
    }
    
    await conn.execute(
      `UPDATE purchase_order 
       SET order_status = 'APPROVED', auditor_id = ?, audited_at = NOW(), updated_at = NOW()
       WHERE order_no = ?`,
      [req.user?.id ?? null, req.params.orderNo]
    );
    
    // 写操作日志
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'PURCHASE_ORDER', 'APPROVE', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", req.params.orderNo, JSON.stringify({ status: "APPROVED" })]
    );
    
    return { orderNo: req.params.orderNo, orderStatus: "APPROVED" };
  });
  
  res.json(ok(result));
}));

// POST /api/admin/purchase-orders/:orderNo/cancel - 取消
purchaseRouter.post("/:orderNo/cancel", asyncHandler(async (req, res) => {
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT order_no, order_status FROM purchase_order WHERE order_no = ? FOR UPDATE`,
      [req.params.orderNo]
    );
    
    const order = rows[0];
    if (!order) {
      throw new Error("采购订单不存在");
    }
    
    if (["COMPLETED", "CANCELLED"].includes(order.order_status)) {
      throw new Error("订单状态不允许取消");
    }
    
    await conn.execute(
      `UPDATE purchase_order 
       SET order_status = 'CANCELLED', updated_at = NOW()
       WHERE order_no = ?`,
      [req.params.orderNo]
    );
    
    // 写操作日志
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'PURCHASE_ORDER', 'CANCEL', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", req.params.orderNo, JSON.stringify({ status: "CANCELLED" })]
    );
    
    return { orderNo: req.params.orderNo, orderStatus: "CANCELLED" };
  });
  
  res.json(ok(result));
}));

// POST /api/admin/purchase-orders/:orderNo/submit - 提交审核（DRAFT -> PENDING）
purchaseRouter.post("/:orderNo/submit", asyncHandler(async (req, res) => {
  const result = await transaction(async (conn) => {
    const [rows] = await conn.query<any[]>(
      `SELECT order_no, order_status FROM purchase_order WHERE order_no = ? FOR UPDATE`,
      [req.params.orderNo]
    );
    
    const order = rows[0];
    if (!order) {
      throw new Error("采购订单不存在");
    }
    
    if (order.order_status !== "DRAFT") {
      throw new Error("只有草稿状态的订单可以提交审核");
    }
    
    await conn.execute(
      `UPDATE purchase_order 
       SET order_status = 'PENDING', updated_at = NOW()
       WHERE order_no = ?`,
      [req.params.orderNo]
    );
    
    // 写操作日志
    await conn.execute(
      `INSERT INTO operation_log (operator_id, operator_name, module, action, biz_no, after_data)
       VALUES (?, ?, 'PURCHASE_ORDER', 'SUBMIT', ?, ?)`,
      [req.user?.id ?? null, req.user?.username ?? "系统用户", req.params.orderNo, JSON.stringify({ status: "PENDING" })]
    );
    
    return { orderNo: req.params.orderNo, orderStatus: "PENDING" };
  });
  
  res.json(ok(result));
}));
