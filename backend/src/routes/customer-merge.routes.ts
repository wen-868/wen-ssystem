import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/async-handler.js";
import { requireAuthWithTenant } from "../shared/auth.js";
import { query, queryOne, transaction } from "../shared/db.js";
import { ok } from "../shared/response.js";

export const customerMergeRouter = Router();

// ========== 客户合并去重 ==========

// 检测重复客户（按手机号/名称）
customerMergeRouter.get("/duplicates", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { type = "mobile" } = req.query; // mobile: 按手机号, name: 按名称, all: 全部

  const duplicates: any[] = [];

  // 按手机号检测
  if (type === "mobile" || type === "all") {
    const mobileDuplicates = await query<any>(
      `SELECT mobile, COUNT(*) as count,
              GROUP_CONCAT(id ORDER BY id) as customer_ids,
              GROUP_CONCAT(name ORDER BY id) as customer_names
       FROM member
       WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
       GROUP BY mobile
       HAVING COUNT(*) > 1
       ORDER BY count DESC`,
      [tenantId]
    );

    for (const row of mobileDuplicates) {
      const customers = await query<any>(
        `SELECT id, name, mobile, address, remark, created_at
         FROM member
         WHERE tenant_id = ? AND mobile = ?
         ORDER BY created_at ASC`,
        [tenantId, row.mobile]
      );

      duplicates.push({
        type: "mobile",
        key: row.mobile,
        count: row.count,
        customers
      });
    }
  }

  // 按名称检测
  if (type === "name" || type === "all") {
    const nameDuplicates = await query<any>(
      `SELECT name, COUNT(*) as count,
              GROUP_CONCAT(id ORDER BY id) as customer_ids
       FROM member
       WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
       GROUP BY name
       HAVING COUNT(*) > 1
       ORDER BY count DESC`,
      [tenantId]
    );

    for (const row of nameDuplicates) {
      const customers = await query<any>(
        `SELECT id, name, mobile, address, remark, created_at
         FROM member
         WHERE tenant_id = ? AND name = ?
         ORDER BY created_at ASC`,
        [tenantId, row.name]
      );

      duplicates.push({
        type: "name",
        key: row.name,
        count: row.count,
        customers
      });
    }
  }

  res.json(ok({
    total: duplicates.length,
    duplicates
  }));
}));

// 获取客户关联数据（订单、收款、欠款等）
customerMergeRouter.get("/:customerId/relations", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const customerId = Number(req.params.customerId);

  const customer = await queryOne<any>(
    "SELECT id, name, mobile FROM member WHERE id = ? AND tenant_id = ?",
    [customerId, tenantId]
  );

  if (!customer) {
    res.status(404).json({ code: "404", message: "客户不存在" });
    return;
  }

  // 统计销售订单
  const salesStats = await queryOne<any>(
    `SELECT COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(paid_amount), 0) as paid_amount,
            COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount
     FROM sales_order
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  // 统计收款记录
  const paymentStats = await queryOne<any>(
    `SELECT COUNT(*) as payment_count,
            COALESCE(SUM(amount), 0) as total_received
     FROM customer_payment
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  // 统计欠款（来自customer_credit表）
  const creditInfo = await queryOne<any>(
    `SELECT credit_limit, credit_used, credit_available
     FROM customer_credit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  // 统计拜访记录
  const visitStats = await queryOne<any>(
    `SELECT COUNT(*) as visit_count
     FROM customer_visit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  res.json(ok({
    customer,
    relations: {
      sales: salesStats,
      payments: paymentStats,
      credit: creditInfo || { credit_limit: 0, credit_used: 0, credit_available: 0 },
      visits: visitStats
    }
  }));
}));

// 合并客户
customerMergeRouter.post("/merge", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;

  const body = z.object({
    primaryCustomerId: z.number().int().positive(), // 主客户ID（保留）
    duplicateCustomerIds: z.array(z.number().int().positive()).min(1), // 重复客户ID列表（删除）
    mergeName: z.boolean().default(true), // 是否合并名称（如果主客户名称为空）
    mergeMobile: z.boolean().default(true), // 是否合并手机号（如果主客户手机号为空）
    mergeAddress: z.boolean().default(true), // 是否合并地址（如果主客户地址为空）
    mergeRemark: z.boolean().default(false), // 是否合并备注（追加）
  }).parse(req.body);

  // 验证主客户存在
  const primaryCustomer = await queryOne<any>(
    "SELECT id, name, mobile, address, remark FROM member WHERE id = ? AND tenant_id = ?",
    [body.primaryCustomerId, tenantId]
  );

  if (!primaryCustomer) {
    res.status(404).json({ code: "404", message: "主客户不存在" });
    return;
  }

  // 验证所有重复客户存在
  const duplicateCustomers = await query<any>(
    `SELECT id, name, mobile, address, remark
     FROM member
     WHERE id IN (?) AND tenant_id = ?`,
    [body.duplicateCustomerIds, tenantId]
  );

    if (duplicateCustomers.length !== body.duplicateCustomerIds.length) {
    res.status(400).json({ code: "400", message: "部分重复客户不存在" });
    return;
  }

  await transaction(async (conn) => {
    // 1. 合并客户基本信息
    const updates: string[] = [];
    const params: any[] = [];

    if (body.mergeName && !primaryCustomer.name) {
      const firstDuplicate = duplicateCustomers.find((c: any) => c.name);
      if (firstDuplicate) {
        updates.push("name = ?");
        params.push(firstDuplicate.name);
      }
    }

    if (body.mergeMobile && !primaryCustomer.mobile) {
      const firstDuplicate = duplicateCustomers.find((c: any) => c.mobile);
      if (firstDuplicate) {
        updates.push("mobile = ?");
        params.push(firstDuplicate.mobile);
      }
    }

    if (body.mergeAddress && !primaryCustomer.address) {
      const firstDuplicate = duplicateCustomers.find((c: any) => c.address);
      if (firstDuplicate) {
        updates.push("address = ?");
        params.push(firstDuplicate.address);
      }
    }

    if (body.mergeRemark) {
      const allRemarks = [primaryCustomer.remark, ...duplicateCustomers.map((c: any) => c.remark)]
        .filter(r => r && r.trim())
        .join(" | ");
      if (allRemarks) {
        updates.push("remark = ?");
        params.push(allRemarks);
      }
    }

    if (updates.length > 0) {
      params.push(body.primaryCustomerId);
      await conn.execute(
        `UPDATE member SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    }

    // 2. 转移销售订单
    await conn.execute(
      `UPDATE sales_order SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    // 3. 转移收款记录
    await conn.execute(
      `UPDATE customer_payment SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    // 4. 转移拜访记录
    await conn.execute(
      `UPDATE customer_visit SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    // 5. 转移赊销额度（如果主客户没有，则转移第一个有额度的）
    const primaryCredit = await queryOne<any>(
      "SELECT id FROM customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [body.primaryCustomerId, tenantId]
    );

    if (!primaryCredit) {
      const firstCredit = await queryOne<any>(
        "SELECT id FROM customer_credit WHERE customer_id IN (?) AND tenant_id = ? LIMIT 1",
        [body.duplicateCustomerIds, tenantId]
      );

      if (firstCredit) {
        await conn.execute(
          "UPDATE customer_credit SET customer_id = ? WHERE id = ?",
          [body.primaryCustomerId, firstCredit.id]
        );
      }
    }

    // 6. 删除重复客户
    await conn.execute(
      "DELETE FROM member WHERE id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    // 7. 删除重复客户的赊销额度记录
    await conn.execute(
      "DELETE FROM customer_credit WHERE customer_id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    // 8. 记录操作日志
    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["customer", "MERGE", String(body.primaryCustomerId), "member",
       req.user!.id, req.user!.username,
       `合并客户: 主客户ID=${body.primaryCustomerId}, 重复客户ID=${body.duplicateCustomerIds.join(",")}`,
       tenantId]
    );
  });

  // 返回合并后的客户信息
  const mergedCustomer = await queryOne<any>(
    `SELECT id, name, mobile, address, remark, created_at
     FROM member
     WHERE id = ? AND tenant_id = ?`,
    [body.primaryCustomerId, tenantId]
  );

  res.json(ok({
    mergedCustomer,
    deletedCount: body.duplicateCustomerIds.length
  }));
}));

// 批量检测并列出所有重复组
customerMergeRouter.get("/duplicate-groups", requireAuthWithTenant, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { page = 1, pageSize = 20 } = req.query;

  // 按手机号分组
  const mobileGroups = await query<any>(
    `SELECT mobile, COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY created_at ASC) as customer_ids,
            GROUP_CONCAT(name ORDER BY created_at ASC) as customer_names
     FROM member
     WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
     GROUP BY mobile
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT ? OFFSET ?`,
    [tenantId, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  // 按名称分组
  const nameGroups = await query<any>(
    `SELECT name, COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY created_at ASC) as customer_ids
     FROM member
     WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
     GROUP BY name
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT ? OFFSET ?`,
    [tenantId, Number(pageSize), (Number(page) - 1) * Number(pageSize)]
  );

  // 统计总数
  const mobileTotal = await queryOne<any>(
    `SELECT COUNT(DISTINCT mobile) as total
     FROM member
     WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
     GROUP BY mobile
     HAVING COUNT(*) > 1`,
    [tenantId]
  );

  const nameTotal = await queryOne<any>(
    `SELECT COUNT(DISTINCT name) as total
     FROM member
     WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
     GROUP BY name
     HAVING COUNT(*) > 1`,
    [tenantId]
  );

  res.json(ok({
    mobileGroups: {
      total: mobileTotal?.length || 0,
      groups: mobileGroups
    },
    nameGroups: {
      total: nameTotal?.length || 0,
      groups: nameGroups
    }
  }));
}));
