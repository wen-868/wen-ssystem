import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ServiceContext, PageResult } from "../../types/index";

export interface CollectionCreateDTO {
  customerId: number;
  receivableNo?: string;
  overdueDays: number;
  overdueAmount: number;
  collectionLevel: string;
  collectionMethod: string;
  collectionContent?: string;
  contactPerson: string;
  contactResult?: string;
  promisedAmount?: number;
  promisedDate?: string | null;
  nextFollowUpDate?: string | null;
}

export interface CollectionUpdateDTO {
  contactResult?: string;
  promisedAmount?: number;
  promisedDate?: string | null;
  nextFollowUpDate?: string | null;
  collectionContent?: string;
}

export interface BatchRemindDTO {
  customerIds: number[];
  method: string;
  content: string;
  collectionLevel: string;
}

/** t_collection_record 催收记录行（queryWithTenant 用，驼峰别名，含 JOIN t_member） */
interface CollectionRecordRow {
  id: number | string;
  customerId: number | string;
  customerName: string | null;
  customerMobile?: string | null;
  receivableNo: string | null;
  overdueDays: number | string;
  overdueAmount: number | string;
  collectionLevel: string;
  collectionMethod: string;
  collectionContent: string | null;
  contactPerson: string | null;
  contactResult: string | null;
  promisedAmount: number | string | null;
  promisedDate: string | Date | null;
  nextFollowUpDate: string | Date | null;
  operatorId: number | string | null;
  createdAt: string | Date;
}

/** t_collection_record 更新后查询行（queryOneWithTenant 用，驼峰别名，含 JOIN t_member） */
interface CollectionUpdatedRow {
  id: number | string;
  customerId: number | string;
  customerName: string | null;
  contactResult: string | null;
  promisedAmount: number | string | null;
  promisedDate: string | Date | null;
  nextFollowUpDate: string | Date | null;
  collectionContent: string | null;
  createdAt: string | Date;
}

/** t_member 客户基础信息行（queryOneWithTenant 用） */
interface MemberBasicRow {
  id: number | string;
  name: string;
  mobile?: string | null;
}

/** t_collection_record ID 校验行 */
interface CollectionExistingRow {
  id: number | string;
}

/** t_customer_credit 授信使用情况行（queryOneWithTenant 用） */
interface CreditUsageRow {
  credit_used: number | string;
  credit_limit: number | string;
}

/** 逾期客户行（queryWithTenant 用，驼峰别名，含 JOIN t_member） */
interface OverdueCustomerRow {
  customerId: number | string;
  customerName: string | null;
  customerMobile: string | null;
  creditUsed: number | string;
  creditLimit: number | string;
  paymentTerm: string;
  overdueFreezeDays: number | string;
  creditStatus: string;
  estimatedOverdueDays: number | string;
  estimatedOverdueAmount: number | string;
}

/** 催收统计级别行（queryWithTenant 用，驼峰别名） */
interface CollectionLevelStatRow {
  collectionLevel: string;
  count: number;
}

/** 催收统计结果行（queryWithTenant 用，驼峰别名） */
interface CollectionResultStatRow {
  contactResult: string;
  count: number;
}

/** COUNT(*) AS count 通用行 */
interface CountRow {
  count: number;
}

/** SUM(promised_amount) AS total 行 */
interface PromisedTotalRow {
  total: number | string;
}

/** COUNT(*) AS total 通用行 */
interface CountTotalRow {
  total: number;
}

export async function getCollectionList(
  collectionLevel: string | undefined,
  customerId: string | undefined,
  contactResult: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined,
  page: number,
  pageSize: number,
  ctx: ServiceContext
): Promise<PageResult<CollectionRecordRow>> {
  const conditions: string[] = ["cr.tenant_id = ?"];
  const params: unknown[] = [ctx.tenantId];

  if (collectionLevel) {
    conditions.push("cr.collection_level = ?");
    params.push(collectionLevel);
  }
  if (customerId) {
    conditions.push("cr.customer_id = ?");
    params.push(Number(customerId));
  }
  if (contactResult) {
    conditions.push("cr.contact_result = ?");
    params.push(contactResult);
  }
  if (startDate) {
    conditions.push("cr.created_at >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("cr.created_at <= ?");
    params.push(endDate);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  const records = await queryWithTenant<CollectionRecordRow>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cr.receivable_no AS receivableNo,
            cr.overdue_days AS overdueDays, cr.overdue_amount AS overdueAmount,
            cr.collection_level AS collectionLevel, cr.collection_method AS collectionMethod,
            cr.collection_content AS collectionContent,
            cr.contact_person AS contactPerson, cr.contact_result AS contactResult,
            cr.promised_amount AS promisedAmount, cr.promised_date AS promisedDate,
            cr.next_follow_up_date AS nextFollowUpDate,
            cr.operator_id AS operatorId, cr.created_at AS createdAt
     FROM t_collection_record cr
     LEFT JOIN t_member m ON m.id = cr.customer_id
     ${where}
     ORDER BY cr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
    ctx.tenantId
  );

  const totalRow = await queryOneWithTenant<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM t_collection_record cr
     LEFT JOIN t_member m ON m.id = cr.customer_id
     ${where}`,
    params,
    ctx.tenantId
  );

  return {
    total: Number(totalRow?.total ?? 0),
    page,
    pageSize,
    records
  };
}

export async function createCollection(dto: CollectionCreateDTO, ctx: ServiceContext): Promise<CollectionRecordRow | null> {
  const customer = await queryOneWithTenant<MemberBasicRow>(
    "SELECT id, name FROM t_member WHERE id = ?",
    [dto.customerId],
    ctx.tenantId
  );
  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }

  await queryWithTenant(
    `INSERT INTO t_collection_record (customer_id, receivable_no, overdue_days, overdue_amount,
       collection_level, collection_method, collection_content, contact_person,
       contact_result, promised_amount, promised_date, next_follow_up_date, operator_id, tenant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dto.customerId, dto.receivableNo ?? null, dto.overdueDays, dto.overdueAmount,
    dto.collectionLevel, dto.collectionMethod, dto.collectionContent ?? null,
    dto.contactPerson, dto.contactResult ?? null, dto.promisedAmount ?? null,
    dto.promisedDate ?? null, dto.nextFollowUpDate ?? null, ctx.userId, ctx.tenantId],
    ctx.tenantId
  );

  const record = await queryOneWithTenant<CollectionRecordRow>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName,
            cr.receivable_no AS receivableNo,
            cr.overdue_days AS overdueDays, cr.overdue_amount AS overdueAmount,
            cr.collection_level AS collectionLevel, cr.collection_method AS collectionMethod,
            cr.collection_content AS collectionContent,
            cr.contact_person AS contactPerson, cr.contact_result AS contactResult,
            cr.promised_amount AS promisedAmount, cr.promised_date AS promisedDate,
            cr.next_follow_up_date AS nextFollowUpDate,
            cr.operator_id AS operatorId, cr.created_at AS createdAt
     FROM t_collection_record cr
     LEFT JOIN t_member m ON m.id = cr.customer_id
     WHERE cr.id = LAST_INSERT_ID() AND cr.tenant_id = ?`,
    [ctx.tenantId],
    ctx.tenantId
  );

  return record;
}

export async function updateCollection(collectionId: number, dto: CollectionUpdateDTO, ctx: ServiceContext): Promise<CollectionUpdatedRow | null> {
  const existing = await queryOneWithTenant<CollectionExistingRow>(
    "SELECT id FROM t_collection_record WHERE id = ? AND tenant_id = ?",
    [collectionId, ctx.tenantId],
    ctx.tenantId
  );
  if (!existing) {
    throw Object.assign(new Error("催收记录不存在"), { statusCode: 404 });
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (dto.contactResult !== undefined) { updates.push("contact_result = ?"); params.push(dto.contactResult); }
  if (dto.promisedAmount !== undefined) { updates.push("promised_amount = ?"); params.push(dto.promisedAmount); }
  if (dto.promisedDate !== undefined) { updates.push("promised_date = ?"); params.push(dto.promisedDate); }
  if (dto.nextFollowUpDate !== undefined) { updates.push("next_follow_up_date = ?"); params.push(dto.nextFollowUpDate); }
  if (dto.collectionContent !== undefined) { updates.push("collection_content = ?"); params.push(dto.collectionContent); }

  if (updates.length > 0) {
    await queryWithTenant(
      `UPDATE t_collection_record SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?`,
      [...params, collectionId, ctx.tenantId],
      ctx.tenantId
    );
  }

  const record = await queryOneWithTenant<CollectionUpdatedRow>(
    `SELECT cr.id, cr.customer_id AS customerId, m.name AS customerName,
            cr.contact_result AS contactResult, cr.promised_amount AS promisedAmount,
            cr.promised_date AS promisedDate, cr.next_follow_up_date AS nextFollowUpDate,
            cr.collection_content AS collectionContent,
            cr.created_at AS createdAt
     FROM t_collection_record cr
     LEFT JOIN t_member m ON m.id = cr.customer_id
     WHERE cr.id = ? AND cr.tenant_id = ?`,
    [collectionId, ctx.tenantId],
    ctx.tenantId
  );

  return record;
}

export async function getOverdueCustomers(ctx: ServiceContext): Promise<{ total: number; records: OverdueCustomerRow[] }> {
  const records = await queryWithTenant<OverdueCustomerRow>(
    `SELECT cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_used AS creditUsed, cc.credit_limit AS creditLimit,
            cc.payment_term AS paymentTerm, cc.overdue_freeze_days AS overdueFreezeDays,
            cc.status AS creditStatus,
            COALESCE(
              DATEDIFF(NOW(),
                CASE cc.payment_term
                  WHEN 'COD' THEN NOW()
                  WHEN 'NET_7' THEN DATE_SUB(NOW(), INTERVAL 7 DAY)
                  WHEN 'NET_15' THEN DATE_SUB(NOW(), INTERVAL 15 DAY)
                  WHEN 'NET_30' THEN DATE_SUB(NOW(), INTERVAL 30 DAY)
                  WHEN 'NET_60' THEN DATE_SUB(NOW(), INTERVAL 60 DAY)
                  WHEN 'NET_90' THEN DATE_SUB(NOW(), INTERVAL 90 DAY)
                END
              ), 0
            ) AS estimatedOverdueDays,
            cc.credit_used AS estimatedOverdueAmount
     FROM t_customer_credit cc
     LEFT JOIN t_member m ON m.id = cc.customer_id
     WHERE cc.credit_used > 0 AND cc.status IN ('ACTIVE', 'FROZEN') AND cc.tenant_id = ?
     ORDER BY cc.credit_used DESC`,
    [ctx.tenantId],
    ctx.tenantId
  );

  return { total: records.length, records };
}

export async function batchRemind(dto: BatchRemindDTO, ctx: ServiceContext): Promise<{
  totalRequested: number;
  successCount: number;
  failCount: number;
  errors?: string[];
}> {
  let successCount = 0;
  const errors: string[] = [];

  for (const customerId of dto.customerIds) {
    try {
      const customer = await queryOneWithTenant<MemberBasicRow>(
        "SELECT id, name, mobile FROM t_member WHERE id = ?",
        [customerId],
        ctx.tenantId
      );
      if (!customer) {
        errors.push(`客户${customerId}不存在`);
        continue;
      }

      const credit = await queryOneWithTenant<CreditUsageRow>(
        "SELECT credit_used, credit_limit FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
        [customerId, ctx.tenantId],
        ctx.tenantId
      );

      await queryWithTenant(
        `INSERT INTO t_collection_record (customer_id, overdue_days, overdue_amount,
           collection_level, collection_method, collection_content,
           contact_person, operator_id, tenant_id)
         VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?)`,
        [customerId, credit?.credit_used ?? 0, dto.collectionLevel, dto.method,
          dto.content, customer.name, ctx.userId, ctx.tenantId],
        ctx.tenantId
      );

      successCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`客户${customerId}处理失败: ${message}`);
    }
  }

  return {
    totalRequested: dto.customerIds.length,
    successCount,
    failCount: errors.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

export async function getCollectionStatistics(ctx: ServiceContext): Promise<{
  totalCollections: number;
  monthCollections: number;
  totalPromisedAmount: number;
  pendingFollowUps: number;
  byLevel: Record<string, number>;
  byResult: Record<string, number>;
}> {
  const levelStats = await queryWithTenant<CollectionLevelStatRow>(
    `SELECT collection_level AS collectionLevel, COUNT(*) AS count
     FROM t_collection_record
     WHERE tenant_id = ?
     GROUP BY collection_level
     ORDER BY FIELD(collection_level, 'REMIND', 'LIGHT', 'MEDIUM', 'HEAVY', 'SEVERE')`,
    [ctx.tenantId],
    ctx.tenantId
  );

  const resultStats = await queryWithTenant<CollectionResultStatRow>(
    `SELECT contact_result AS contactResult, COUNT(*) AS count
     FROM t_collection_record
     WHERE contact_result IS NOT NULL AND tenant_id = ?
     GROUP BY contact_result`,
    [ctx.tenantId],
    ctx.tenantId
  );

  const totalCount = await queryOneWithTenant<CountRow>(
    "SELECT COUNT(*) AS count FROM t_collection_record WHERE tenant_id = ?",
    [ctx.tenantId],
    ctx.tenantId
  );

  const promisedTotal = await queryOneWithTenant<PromisedTotalRow>(
    "SELECT COALESCE(SUM(promised_amount), 0) AS total FROM t_collection_record WHERE contact_result = 'PROMISED' AND tenant_id = ?",
    [ctx.tenantId],
    ctx.tenantId
  );

  const monthCount = await queryOneWithTenant<CountRow>(
    `SELECT COUNT(*) AS count FROM t_collection_record
     WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND tenant_id = ?`,
    [ctx.tenantId],
    ctx.tenantId
  );

  const followUpCount = await queryOneWithTenant<CountRow>(
    `SELECT COUNT(*) AS count FROM t_collection_record
     WHERE next_follow_up_date IS NOT NULL AND next_follow_up_date <= CURDATE()
       AND contact_result NOT IN ('PARTIAL_PAID') AND tenant_id = ?`,
    [ctx.tenantId],
    ctx.tenantId
  );

  const byLevel: Record<string, number> = {};
  for (const row of levelStats) {
    byLevel[row.collectionLevel] = Number(row.count);
  }

  const byResult: Record<string, number> = {};
  for (const row of resultStats) {
    byResult[row.contactResult] = Number(row.count);
  }

  return {
    totalCollections: Number(totalCount?.count ?? 0),
    monthCollections: Number(monthCount?.count ?? 0),
    totalPromisedAmount: Number(promisedTotal?.total ?? 0),
    pendingFollowUps: Number(followUpCount?.count ?? 0),
    byLevel,
    byResult
  };
}