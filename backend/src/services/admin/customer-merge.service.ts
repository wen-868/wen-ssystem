import { query, queryOne, transaction } from "../../shared/db.js";

// ========== 检测重复客户 ==========
export async function detectDuplicates(tenantId: string, type: string) {
  const duplicates: any[] = [];

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

  return {
    total: duplicates.length,
    duplicates
  };
}

// ========== 获取客户关联数据 ==========
export async function getCustomerRelations(tenantId: string, customerId: number) {
  const customer = await queryOne<any>(
    "SELECT id, name, mobile FROM member WHERE id = ? AND tenant_id = ?",
    [customerId, tenantId]
  );

  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }

  const salesStats = await queryOne<any>(
    `SELECT COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(paid_amount), 0) as paid_amount,
            COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount
     FROM sales_order
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  const paymentStats = await queryOne<any>(
    `SELECT COUNT(*) as payment_count,
            COALESCE(SUM(amount), 0) as total_received
     FROM customer_payment
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  const creditInfo = await queryOne<any>(
    `SELECT credit_limit, credit_used, credit_available
     FROM customer_credit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  const visitStats = await queryOne<any>(
    `SELECT COUNT(*) as visit_count
     FROM customer_visit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId]
  );

  return {
    customer,
    relations: {
      sales: salesStats,
      payments: paymentStats,
      credit: creditInfo || { credit_limit: 0, credit_used: 0, credit_available: 0 },
      visits: visitStats
    }
  };
}

// ========== 合并客户 ==========
export async function mergeCustomers(tenantId: string, body: {
  primaryCustomerId: number; duplicateCustomerIds: number[];
  mergeName: boolean; mergeMobile: boolean; mergeAddress: boolean; mergeRemark: boolean;
}, userId: number, username: string) {
  const primaryCustomer = await queryOne<any>(
    "SELECT id, name, mobile, address, remark FROM member WHERE id = ? AND tenant_id = ?",
    [body.primaryCustomerId, tenantId]
  );

  if (!primaryCustomer) {
    throw Object.assign(new Error("主客户不存在"), { statusCode: 404 });
  }

  const duplicateCustomers = await query<any>(
    `SELECT id, name, mobile, address, remark
     FROM member
     WHERE id IN (?) AND tenant_id = ?`,
    [body.duplicateCustomerIds, tenantId]
  );

  if (duplicateCustomers.length !== body.duplicateCustomerIds.length) {
    throw Object.assign(new Error("部分重复客户不存在"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
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
        .filter((r: any) => r && r.trim())
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

    await conn.execute(
      `UPDATE sales_order SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `UPDATE customer_payment SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `UPDATE customer_visit SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

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

    await conn.execute(
      "DELETE FROM member WHERE id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      "DELETE FROM customer_credit WHERE customer_id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `INSERT INTO operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["customer", "MERGE", String(body.primaryCustomerId), "member",
       userId, username,
       `合并客户: 主客户ID=${body.primaryCustomerId}, 重复客户ID=${body.duplicateCustomerIds.join(",")}`,
       tenantId]
    );
  });

  const mergedCustomer = await queryOne<any>(
    `SELECT id, name, mobile, address, remark, created_at
     FROM member
     WHERE id = ? AND tenant_id = ?`,
    [body.primaryCustomerId, tenantId]
  );

  return {
    mergedCustomer,
    deletedCount: body.duplicateCustomerIds.length
  };
}

// ========== 批量检测重复组 ==========
export async function getDuplicateGroups(tenantId: string, page: number, pageSize: number) {
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
    [tenantId, pageSize, (page - 1) * pageSize]
  );

  const nameGroups = await query<any>(
    `SELECT name, COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY created_at ASC) as customer_ids
     FROM member
     WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
     GROUP BY name
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, (page - 1) * pageSize]
  );

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

  return {
    mobileGroups: {
      total: mobileTotal?.length || 0,
      groups: mobileGroups
    },
    nameGroups: {
      total: nameTotal?.length || 0,
      groups: nameGroups
    }
  };
}