import { query, queryOne } from "../shared/db";
import { AppError } from "../shared/app-error";
import logger from "../shared/logger";

// ========== 类型定义 ==========

/** 公开套餐（脱敏字段，供平台小程序展示） */
export interface PublicPlan {
  id: number;
  name: string;
  price: number;
  cycle: string;
  description: string;
  features: unknown;
}

/** 订阅申请记录（对外驼峰结构） */
export interface SubscriptionApplyRecord {
  id: number;
  planId: number;
  planName: string;
  company: string;
  contact: string;
  mobile: string;
  remark: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  auditRemark: string;
  auditedAt: string | null;
  createdAt: string;
}

/** 提交订阅申请入参 */
export interface SubmitSubscriptionInput {
  openid?: string;
  planId: number;
  company: string;
  contact: string;
  mobile: string;
  remark?: string;
}

interface SubscriptionPlanRow {
  id: number;
  planCode: string;
  planName: string;
  planType: string;
  price: number;
  description: string | null;
  features: unknown;
  status: string;
}

interface ApplyRow {
  id: number;
  planId: number;
  planName: string;
  company: string;
  contact: string;
  mobile: string;
  remark: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  auditRemark: string;
  auditedAt: string | null;
  createdAt: string;
}

interface IdRow {
  id: number;
}

interface CountTotalRow {
  total: number;
}

/** 套餐周期中文标签 */
const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "月",
  YEARLY: "年",
  PERMANENT: "永久",
};

/** 功能点解析：兼容 JSON 数组、JSON 字符串与纯文本，保证前端可展示 */
function parseFeatures(features: unknown): unknown {
  if (typeof features !== "string" || !features.trim()) {
    return features;
  }
  const text = features.trim();
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // JSON 解析失败时按纯文本返回，交由前端按分隔符拆分
      return text;
    }
  }
  return text;
}

function mapApplyRow(row: ApplyRow): SubscriptionApplyRecord {
  return {
    id: row.id,
    planId: row.planId,
    planName: row.planName,
    company: row.company,
    contact: row.contact,
    mobile: row.mobile,
    remark: row.remark,
    status: row.status,
    auditRemark: row.auditRemark,
    auditedAt: row.auditedAt,
    createdAt: row.createdAt,
  };
}

const APPLY_SELECT = `
  SELECT id, plan_id AS planId, plan_name AS planName, company, contact, mobile,
         remark, status, audit_remark AS auditRemark, audited_at AS auditedAt,
         created_at AS createdAt
    FROM t_platform_subscription_apply`;

// ========== 公开接口 ==========

/** 公开套餐列表：仅 ACTIVE 套餐，字段脱敏为 id/name/price/cycle/description/features */
export async function listPublicPlans(): Promise<PublicPlan[]> {
  const rows = await query<SubscriptionPlanRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, plan_type AS planType,
            price, description, features
       FROM t_subscription_plan
      WHERE status = 'ACTIVE'
      ORDER BY sort_order ASC, id ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.planName,
    price: Number(row.price),
    cycle: CYCLE_LABEL[row.planType] ?? row.planType,
    description: row.description ?? "",
    features: parseFeatures(row.features),
  }));
}

/** 提交订阅申请：校验套餐 + 防重复，落库并返回申请记录 */
export async function submitSubscription(body: SubmitSubscriptionInput): Promise<SubscriptionApplyRecord> {
  const plan = await queryOne<SubscriptionPlanRow>(
    `SELECT id, plan_code AS planCode, plan_name AS planName, status
       FROM t_subscription_plan WHERE id = ?`,
    [body.planId]
  );
  if (!plan || plan.status !== "ACTIVE") {
    throw new AppError("套餐不存在或已下架", 400);
  }

  // 基础防刷：同一手机号/公司存在待审核申请时拒绝重复提交
  const dupMobile = await queryOne<IdRow>(
    `SELECT id FROM t_platform_subscription_apply WHERE mobile = ? AND status = 'PENDING'`,
    [body.mobile]
  );
  if (dupMobile) {
    throw new AppError("该手机号已有待审核的订阅申请，请勿重复提交", 400);
  }

  const dupCompany = await queryOne<IdRow>(
    `SELECT id FROM t_platform_subscription_apply WHERE company = ? AND status = 'PENDING'`,
    [body.company]
  );
  if (dupCompany) {
    throw new AppError("该公司已有待审核的订阅申请，请勿重复提交", 400);
  }

  const result = await query(
    `INSERT INTO t_platform_subscription_apply
       (openid, plan_id, plan_name, company, contact, mobile, remark, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [body.openid || "", body.planId, plan.planName, body.company, body.contact, body.mobile, body.remark || ""]
  );
  // 兼容两种返回形态：真实库 query 返回 ResultSetHeader（含 insertId），
  // mock 库 query 返回 [ResultSetHeader] 数组
  const insertResult = result as unknown as { insertId?: number } | Array<{ insertId?: number }>;
  const insertId = Array.isArray(insertResult) ? insertResult[0]?.insertId : insertResult?.insertId;
  const applyId = Number(insertId);
  if (!applyId) {
    throw new AppError("提交申请失败，请稍后重试", 500);
  }

  logger.info(
    `[平台小程序] 订阅申请提交成功 applyId=${applyId} planId=${body.planId} company=${body.company}`
  );

  return getSubscriptionApply(applyId) as Promise<SubscriptionApplyRecord>;
}

/** 查询本人申请：openid 优先，mobile 兜底 */
export async function listMySubscriptions(params: {
  openid?: string;
  mobile?: string;
}): Promise<SubscriptionApplyRecord[]> {
  const openid = (params.openid || "").trim();
  const mobile = (params.mobile || "").trim();

  if (!openid && !mobile) {
    throw new AppError("缺少 openid 或 mobile 参数", 400);
  }

  const rows = await query<ApplyRow>(
    `${APPLY_SELECT}
      WHERE ${openid ? "openid = ?" : "mobile = ?"}
      ORDER BY id DESC LIMIT 50`,
    openid ? [openid] : [mobile]
  );

  return rows.map(mapApplyRow);
}

// ========== 平台后台审核 ==========

/** 订阅申请列表：PENDING 优先，支持状态筛选与分页 */
export async function listSubscriptionApplies(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ list: SubscriptionApplyRecord[]; total: number; page: number; pageSize: number }> {
  const { status, page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  if (status) {
    conditions.push("status = ?");
    values.push(status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [totalResult, rows] = await Promise.all([
    queryOne<CountTotalRow>(
      `SELECT COUNT(*) AS total FROM t_platform_subscription_apply ${where}`,
      values
    ),
    query<ApplyRow>(
      `${APPLY_SELECT}
        ${where}
       ORDER BY FIELD(status, 'PENDING') DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset]
    ),
  ]);

  return {
    list: rows.map(mapApplyRow),
    total: Number(totalResult?.total || 0),
    page,
    pageSize,
  };
}

/** 申请详情 */
export async function getSubscriptionApply(applyId: number): Promise<SubscriptionApplyRecord | null> {
  const row = await queryOne<ApplyRow>(`${APPLY_SELECT} WHERE id = ?`, [applyId]);
  return row ? mapApplyRow(row) : null;
}

/** 审核申请：通过/驳回，写入审核人与审核时间 */
export async function auditSubscriptionApply(
  applyId: number,
  action: "APPROVED" | "REJECTED",
  auditRemark: string,
  auditedBy?: number
): Promise<SubscriptionApplyRecord> {
  const existing = await queryOne<IdRow>(
    `SELECT id FROM t_platform_subscription_apply WHERE id = ? AND status = 'PENDING'`,
    [applyId]
  );
  if (!existing) {
    throw new AppError("申请不存在或已处理", 404);
  }

  await query(
    `UPDATE t_platform_subscription_apply
        SET status = ?, audit_remark = ?, audited_by = ?, audited_at = NOW(), updated_at = NOW()
      WHERE id = ?`,
    [action, auditRemark, auditedBy ?? null, applyId]
  );

  logger.info(`[平台小程序] 订阅申请审核 applyId=${applyId} action=${action} reviewer=${auditedBy ?? "unknown"}`);

  const record = await getSubscriptionApply(applyId);
  if (!record) {
    throw new AppError("申请不存在", 404);
  }
  return record;
}
