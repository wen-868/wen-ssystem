import { queryWithTenant, queryOneWithTenant, transaction } from "../../shared/db";

/** t_member 客户基础信息行（queryOneWithTenant 用） */
interface MemberBasicRow {
  id: number | string;
  name: string;
  mobile: string | null;
}

/** t_member 客户详情行（queryOneWithTenant 用，含 address/remark/created_at） */
interface MemberDetailRow {
  id: number | string;
  name: string;
  mobile: string | null;
  address: string | null;
  remark: string | null;
  created_at?: string | Date;
}

/** t_member 明细查询行（queryWithTenant 用，驼峰别名） */
interface MemberListRow {
  id: number | string;
  name: string;
  mobile: string | null;
  address: string | null;
  remark: string | null;
  created_at: string | Date;
}

/** 重复客户统计行（queryWithTenant 用，驼峰别名，mobile 维度） */
interface DuplicateMobileStatRow {
  mobile: string;
  count: number;
  customer_ids: string;
  customer_names: string;
}

/** 重复客户统计行（queryWithTenant 用，驼峰别名，name 维度） */
interface DuplicateNameStatRow {
  name: string;
  count: number;
  customer_ids: string;
}

/** t_sales_order 销售统计行（queryOneWithTenant 用，snake_case） */
interface SalesStatsRow {
  order_count: number;
  total_amount: number | string;
  paid_amount: number | string;
  unpaid_amount: number | string;
}

/** t_customer_payment 付款统计行（queryOneWithTenant 用，snake_case） */
interface PaymentStatsRow {
  payment_count: number;
  total_received: number | string;
}

/** t_customer_credit 授信摘要行（queryOneWithTenant 用，snake_case） */
interface CreditInfoRow {
  credit_limit: number | string;
  credit_used: number | string;
  credit_available: number | string;
}

/** t_customer_visit 拜访统计行（queryOneWithTenant 用，snake_case） */
interface VisitStatsRow {
  visit_count: number;
}

/** t_customer_credit ID 校验行 */
interface CreditIdRow {
  id: number | string;
}

/** 重复客户分组行（queryWithTenant 用，驼峰别名，含分页） */
interface DuplicateGroupRow {
  mobile?: string;
  name?: string;
  count: number;
  customer_ids: string;
  customer_names?: string;
}

/** 重复组总数行（queryOneWithTenant 用） */
interface DuplicateTotalRow {
  total: number;
}

/** 重复检测结果条目 */
interface DuplicateDetectItem {
  type: string;
  key: string;
  count: number;
  customers: MemberListRow[];
}

// ========== 检测重复客户 ==========
export async function detectDuplicates(tenantId: string, type: string) {
  const duplicates: DuplicateDetectItem[] = [];

  if (type === "mobile" || type === "all") {
    const mobileDuplicates = await queryWithTenant<DuplicateMobileStatRow>(
      `SELECT mobile, COUNT(*) as count,
              GROUP_CONCAT(id ORDER BY id) as customer_ids,
              GROUP_CONCAT(name ORDER BY id) as customer_names
       FROM t_member
       WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
       GROUP BY mobile
       HAVING COUNT(*) > 1
       ORDER BY count DESC`,
      [tenantId],
      tenantId
    );

    for (const row of mobileDuplicates) {
      const customers = await queryWithTenant<MemberListRow>(
        `SELECT id, name, mobile, address, remark, created_at
         FROM t_member
         WHERE tenant_id = ? AND mobile = ?
         ORDER BY created_at ASC`,
        [tenantId, row.mobile],
        tenantId
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
    const nameDuplicates = await queryWithTenant<DuplicateNameStatRow>(
      `SELECT name, COUNT(*) as count,
              GROUP_CONCAT(id ORDER BY id) as customer_ids
       FROM t_member
       WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
       GROUP BY name
       HAVING COUNT(*) > 1
       ORDER BY count DESC`,
      [tenantId],
      tenantId
    );

    for (const row of nameDuplicates) {
      const customers = await queryWithTenant<MemberListRow>(
        `SELECT id, name, mobile, address, remark, created_at
         FROM t_member
         WHERE tenant_id = ? AND name = ?
         ORDER BY created_at ASC`,
        [tenantId, row.name],
        tenantId
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
  const customer = await queryOneWithTenant<MemberBasicRow>(
    "SELECT id, name, mobile FROM t_member WHERE id = ? AND tenant_id = ?",
    [customerId, tenantId],
    tenantId
  );

  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }

  const salesStats = await queryOneWithTenant<SalesStatsRow>(
    `SELECT COUNT(*) as order_count,
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(paid_amount), 0) as paid_amount,
            COALESCE(SUM(total_amount - paid_amount), 0) as unpaid_amount
     FROM t_sales_order
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId],
    tenantId
  );

  const paymentStats = await queryOneWithTenant<PaymentStatsRow>(
    `SELECT COUNT(*) as payment_count,
            COALESCE(SUM(amount), 0) as total_received
     FROM t_customer_payment
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId],
    tenantId
  );

  const creditInfo = await queryOneWithTenant<CreditInfoRow>(
    `SELECT credit_limit, credit_used, credit_available
     FROM t_customer_credit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId],
    tenantId
  );

  const visitStats = await queryOneWithTenant<VisitStatsRow>(
    `SELECT COUNT(*) as visit_count
     FROM t_customer_visit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, tenantId],
    tenantId
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
  const primaryCustomer = await queryOneWithTenant<MemberDetailRow>(
    "SELECT id, name, mobile, address, remark FROM t_member WHERE id = ? AND tenant_id = ?",
    [body.primaryCustomerId, tenantId],
    tenantId
  );

  if (!primaryCustomer) {
    throw Object.assign(new Error("主客户不存在"), { statusCode: 404 });
  }

  const duplicateCustomers = await queryWithTenant<MemberDetailRow>(
    `SELECT id, name, mobile, address, remark
     FROM t_member
     WHERE id IN (?) AND tenant_id = ?`,
    [body.duplicateCustomerIds, tenantId],
    tenantId
  );

  if (duplicateCustomers.length !== body.duplicateCustomerIds.length) {
    throw Object.assign(new Error("部分重复客户不存在"), { statusCode: 400 });
  }

  await transaction(async (conn) => {
    const updates: string[] = []; const params: (string | number | null | Date | boolean)[] = [];

    if (body.mergeName && !primaryCustomer.name) {
      const firstDuplicate = duplicateCustomers.find((c) => c.name);
      if (firstDuplicate) {
        updates.push("name = ?");
        params.push(firstDuplicate.name);
      }
    }

    if (body.mergeMobile && !primaryCustomer.mobile) {
      const firstDuplicate = duplicateCustomers.find((c) => c.mobile);
      if (firstDuplicate) {
        updates.push("mobile = ?");
        params.push(firstDuplicate.mobile);
      }
    }

    if (body.mergeAddress && !primaryCustomer.address) {
      const firstDuplicate = duplicateCustomers.find((c) => c.address);
      if (firstDuplicate) {
        updates.push("address = ?");
        params.push(firstDuplicate.address);
      }
    }

    if (body.mergeRemark) {
      const allRemarks = [primaryCustomer.remark, ...duplicateCustomers.map((c) => c.remark)]
        .filter((r) => Boolean(r && r.trim()))
        .join(" | ");
      if (allRemarks) {
        updates.push("remark = ?");
        params.push(allRemarks);
      }
    }

    if (updates.length > 0) {
      params.push(body.primaryCustomerId);
      params.push(tenantId);
      await conn.execute(
        `UPDATE t_member SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
        params
      );
    }

    await conn.execute(
      `UPDATE t_sales_order SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `UPDATE t_customer_payment SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `UPDATE t_customer_visit SET customer_id = ? WHERE customer_id IN (?) AND tenant_id = ?`,
      [body.primaryCustomerId, body.duplicateCustomerIds, tenantId]
    );

    const primaryCredit = await queryOneWithTenant<CreditIdRow>(
      "SELECT id FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
      [body.primaryCustomerId, tenantId],
      tenantId
    );

    if (!primaryCredit) {
      const firstCredit = await queryOneWithTenant<CreditIdRow>(
        "SELECT id FROM t_customer_credit WHERE customer_id IN (?) AND tenant_id = ? LIMIT 1",
        [body.duplicateCustomerIds, tenantId],
        tenantId
      );

      if (firstCredit) {
        await conn.execute(
          "UPDATE t_customer_credit SET customer_id = ? WHERE id = ? AND tenant_id = ?",
          [body.primaryCustomerId, firstCredit.id, tenantId]
        );
      }
    }

    await conn.execute(
      "DELETE FROM t_member WHERE id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      "DELETE FROM t_customer_credit WHERE customer_id IN (?) AND tenant_id = ?",
      [body.duplicateCustomerIds, tenantId]
    );

    await conn.execute(
      `INSERT INTO t_operation_log (module, action, target_id, target_type, user_id, user_name, detail, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["customer", "MERGE", String(body.primaryCustomerId), "member",
        userId, username,
        `合并客户: 主客户ID=${body.primaryCustomerId}, 重复客户ID=${body.duplicateCustomerIds.join(",")}`,
        tenantId]
    );
  });

  const mergedCustomer = await queryOneWithTenant<MemberListRow>(
    `SELECT id, name, mobile, address, remark, created_at
     FROM t_member
     WHERE id = ? AND tenant_id = ?`,
    [body.primaryCustomerId, tenantId],
    tenantId
  );

  return {
    mergedCustomer,
    deletedCount: body.duplicateCustomerIds.length
  };
}

// ========== 批量检测重复组 ==========
export async function getDuplicateGroups(tenantId: string, page: number, pageSize: number) {
  const mobileGroups = await queryWithTenant<DuplicateGroupRow>(
    `SELECT mobile, COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY created_at ASC) as customer_ids,
            GROUP_CONCAT(name ORDER BY created_at ASC) as customer_names
     FROM t_member
     WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
     GROUP BY mobile
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const nameGroups = await queryWithTenant<DuplicateGroupRow>(
    `SELECT name, COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY created_at ASC) as customer_ids
     FROM t_member
     WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
     GROUP BY name
     HAVING COUNT(*) > 1
     ORDER BY count DESC
     LIMIT ? OFFSET ?`,
    [tenantId, pageSize, (page - 1) * pageSize],
    tenantId
  );

  const mobileTotal = await queryOneWithTenant<DuplicateTotalRow>(
    `SELECT COUNT(DISTINCT mobile) as total
     FROM t_member
     WHERE tenant_id = ? AND mobile IS NOT NULL AND mobile != ''
     GROUP BY mobile
     HAVING COUNT(*) > 1`,
    [tenantId],
    tenantId
  );

  const nameTotal = await queryOneWithTenant<DuplicateTotalRow>(
    `SELECT COUNT(DISTINCT name) as total
     FROM t_member
     WHERE tenant_id = ? AND name IS NOT NULL AND name != ''
     GROUP BY name
     HAVING COUNT(*) > 1`,
    [tenantId],
    tenantId
  );

  return {
    mobileGroups: {
      total: mobileTotal?.total ?? 0,
      groups: mobileGroups
    },
    nameGroups: {
      total: nameTotal?.total ?? 0,
      groups: nameGroups
    }
  };
}
