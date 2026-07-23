/**
 * 信用评分引擎
 * Credit Scoring Engine
 *
 * 核心功能：
 * 1. 信用评分模型（回款率、逾期次数、交易频次、交易金额）
 * 2. 自动授信（新客户默认额度 + 阶梯提额）
 * 3. 催收策略（按逾期天数分级，自动生成催收任务）
 */

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import logger from "../../shared/logger";
import type { ServiceContext } from "../../types/index";

/** t_member 客户基础信息行（queryOneWithTenant 用） */
interface CustomerBasicRow {
  id: number | string;
  name: string;
  mobile: string | null;
}

/** t_sale_bills 交易统计行（queryOneWithTenant 用） */
interface TradeStatsRow {
  totalOrders: number | string;
  totalAmount: number | string;
  paidAmount: number | string;
  overdueCount: number | string;
  lastTradeDate: string | Date | null;
}

/** t_customer_credit 授信状态行（queryOneWithTenant 用） */
interface CreditStatusRow {
  credit_limit: number | string;
  credit_used: number | string;
  credit_available: number | string;
  payment_term: string;
  status: string;
}

/** t_customer_credit ID 校验行 */
interface CreditExistingRow {
  id: number | string;
  credit_limit?: number | string;
  payment_term?: string;
}

/** 赊销拦截授信查询行（queryOneWithTenant 用，含 freeze_reason/warning_threshold） */
interface CreditInterceptRow {
  credit_limit: number | string;
  credit_used: number | string;
  credit_frozen: number | string;
  credit_available: number | string;
  status: string;
  warning_threshold: number | string;
  payment_term: string;
  freeze_reason: string | null;
}

/** 赊销拦截返回的授信摘要 */
interface CreditInterceptSummary {
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  status: string;
}

/** 逾期客户行（queryWithTenant 用，驼峰别名） */
interface OverdueCustomerRow {
  customerId: number | string;
  customerName: string | null;
  customerMobile: string | null;
  creditUsed: number | string;
  paymentTerm: string;
  creditLimit: number | string;
  lastTradeDate?: string | Date | null;
}

/** t_collection_record 当天记录校验行 */
interface CollectionExistingRow {
  id: number | string;
}

/** 评分维度权重 */
const WEIGHTS = {
  paymentRate: 0.35,    // 回款率
  overdueCount: 0.30,   // 逾期次数
  tradeFrequency: 0.20, // 交易频次
  tradeAmount: 0.15,    // 交易金额
};

/** 自动授信额度阶梯（基于评分） */
const CREDIT_TIERS = [
  { minScore: 90, maxScore: 100, limit: 500000, term: "NET_90" as const },
  { minScore: 80, maxScore: 89, limit: 200000, term: "NET_60" as const },
  { minScore: 70, maxScore: 79, limit: 100000, term: "NET_30" as const },
  { minScore: 60, maxScore: 69, limit: 50000, term: "NET_15" as const },
  { minScore: 50, maxScore: 59, limit: 20000, term: "NET_7" as const },
  { minScore: 0, maxScore: 49, limit: 0, term: "COD" as const },
];

/** 新客户默认额度 */
const DEFAULT_NEW_CUSTOMER_LIMIT = 5000;

/** 催收策略分级 */
const COLLECTION_STRATEGY = [
  { minDays: 0, maxDays: 7, level: "REMIND", method: "SMS", desc: "短信提醒" },
  { minDays: 8, maxDays: 15, level: "LIGHT", method: "PHONE", desc: "电话轻催" },
  { minDays: 16, maxDays: 30, level: "MEDIUM", method: "PHONE", desc: "电话催收" },
  { minDays: 31, maxDays: 60, level: "HEAVY", method: "VISIT", desc: "上门催收" },
  { minDays: 61, maxDays: 999, level: "SEVERE", method: "LEGAL", desc: "法律途径" },
];

/** 评分结果 */
export interface CreditScoreResult {
  customerId: number;
  customerName: string;
  customerMobile: string;
  scores: {
    paymentRate: number;
    overdueCount: number;
    tradeFrequency: number;
    tradeAmount: number;
    total: number;
  };
  stats: {
    totalOrders: number;
    totalAmount: number;
    paidAmount: number;
    overdueCount: number;
    paymentRate: number;
    avgOrderAmount: number;
    lastTradeDate: string | Date | null;
  };
  recommendation: {
    suggestedLimit: number;
    suggestedTerm: string;
    currentLimit: number;
    currentTerm: string;
    action: "UPGRADE" | "DOWNGRADE" | "MAINTAIN" | "INIT";
    reason: string;
  };
  collectionStrategy: {
    level: string;
    method: string;
    description: string;
    overdueDays: number;
    overdueAmount: number;
  } | null;
}

/** 风险评估结果 */
export interface RiskEvaluationResult {
  customerId: number;
  customerName: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  overdueDays: number;
  overdueAmount: number;
  creditUsed: number;
  creditLimit: number;
  usageRate: number;
  shouldFreeze: boolean;
  reason: string;
}

/**
 * 评估客户信用评分
 * POST /api/admin/credits/evaluate
 */
export async function evaluateCreditScore(
  customerId: number,
  ctx: ServiceContext
): Promise<CreditScoreResult> {
  const customer = await queryOneWithTenant<CustomerBasicRow>(
    "SELECT id, name, mobile FROM t_member WHERE id = ?",
    [customerId],
    ctx.tenantId
  );
  if (!customer) {
    throw Object.assign(new Error("客户不存在"), { statusCode: 404 });
  }

  // 1. 交易统计
  const tradeStats = await queryOneWithTenant<TradeStatsRow>(
    `SELECT
       COUNT(*) AS totalOrders,
       COALESCE(SUM(pay_amount), 0) AS totalAmount,
       COALESCE(SUM(CASE WHEN status = 'PAID' THEN pay_amount ELSE 0 END), 0) AS paidAmount,
       COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END), 0) AS overdueCount,
       MAX(created_at) AS lastTradeDate
     FROM t_sale_bills
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  // 2. 当前授信状态
  const credit = await queryOneWithTenant<CreditStatusRow>(
    `SELECT credit_limit, credit_used, credit_available, payment_term, status
     FROM t_customer_credit
     WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  const totalOrders = Number(tradeStats?.totalOrders ?? 0);
  const totalAmount = Number(tradeStats?.totalAmount ?? 0);
  const paidAmount = Number(tradeStats?.paidAmount ?? 0);
  const overdueCount = Number(tradeStats?.overdueCount ?? 0);
  const paymentRate = totalAmount > 0 ? paidAmount / totalAmount : 1;
  const avgOrderAmount = totalOrders > 0 ? totalAmount / totalOrders : 0;

  // 3. 计算各维度评分（0-100）
  const paymentRateScore = Math.round(paymentRate * 100);
  const overdueScore = Math.max(0, 100 - overdueCount * 10);
  const frequencyScore = Math.min(100, Math.round(totalOrders * 5));
  const amountScore = Math.min(100, Math.round((totalAmount / 100000) * 100));

  // 加权总分
  const totalScore = Math.round(
    paymentRateScore * WEIGHTS.paymentRate +
    overdueScore * WEIGHTS.overdueCount +
    frequencyScore * WEIGHTS.tradeFrequency +
    amountScore * WEIGHTS.tradeAmount
  );

  // 4. 推荐授信额度
  const tier = CREDIT_TIERS.find((t) => totalScore >= t.minScore && totalScore <= t.maxScore)
    ?? CREDIT_TIERS[CREDIT_TIERS.length - 1];

  const currentLimit = Number(credit?.credit_limit ?? 0);
  const currentTerm = credit?.payment_term ?? "COD";

  let action: "UPGRADE" | "DOWNGRADE" | "MAINTAIN" | "INIT";
  let reason: string;

  if (!credit) {
    action = "INIT";
    reason = "新客户，建议初始化授信";
  } else if (tier.limit > currentLimit) {
    action = "UPGRADE";
    reason = `评分${totalScore}分，建议提升额度至${tier.limit}`;
  } else if (tier.limit < currentLimit && totalScore < 50) {
    action = "DOWNGRADE";
    reason = `评分${totalScore}分，建议降低额度至${tier.limit}`;
  } else {
    action = "MAINTAIN";
    reason = `评分${totalScore}分，维持当前额度`;
  }

  // 5. 催收策略
  const overdueDays = Number(credit?.credit_used ?? 0) > 0 && credit?.payment_term !== "COD"
    ? Math.max(0, Math.floor(
      (Date.now() - new Date(tradeStats?.lastTradeDate ?? Date.now()).getTime()) / 86400000
    ))
    : 0;

  const strategy = COLLECTION_STRATEGY.find((s) => overdueDays >= s.minDays && overdueDays <= s.maxDays);
  const collectionStrategy = Number(credit?.credit_used ?? 0) > 0 && overdueDays > 0 && strategy
    ? {
      level: strategy.level,
      method: strategy.method,
      description: strategy.desc,
      overdueDays,
      overdueAmount: Number(credit?.credit_used ?? 0),
    }
    : null;

  return {
    customerId,
    customerName: customer.name,
    customerMobile: customer.mobile ?? "",
    scores: {
      paymentRate: paymentRateScore,
      overdueCount: overdueScore,
      tradeFrequency: frequencyScore,
      tradeAmount: amountScore,
      total: totalScore,
    },
    stats: {
      totalOrders,
      totalAmount,
      paidAmount,
      overdueCount,
      paymentRate: Math.round(paymentRate * 100) / 100,
      avgOrderAmount: Math.round(avgOrderAmount * 100) / 100,
      lastTradeDate: tradeStats?.lastTradeDate ?? null,
    },
    recommendation: {
      suggestedLimit: credit ? tier.limit : (tier.limit > 0 ? tier.limit : DEFAULT_NEW_CUSTOMER_LIMIT),
      suggestedTerm: tier.term,
      currentLimit,
      currentTerm,
      action,
      reason,
    },
    collectionStrategy,
  };
}

/**
 * 自动授信：新客户默认额度
 */
export async function autoInitCredit(
  customerId: number,
  ctx: ServiceContext
): Promise<{ creditLimit: number; paymentTerm: string }> {
  const existing = await queryOneWithTenant<CreditExistingRow>(
    "SELECT id FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?",
    [customerId, ctx.tenantId],
    ctx.tenantId
  );
  if (existing) {
    return {
      creditLimit: Number(existing.credit_limit),
      paymentTerm: existing.payment_term ?? "COD",
    };
  }

  await queryWithTenant(
    `INSERT INTO t_customer_credit (customer_id, credit_limit, payment_term, late_fee_rate,
       max_late_fee_rate, warning_threshold, overdue_freeze_days, status, tenant_id)
     VALUES (?, ?, 'NET_7', 0.0005, 0.3, 0.80, 15, 'ACTIVE', ?)`,
    [customerId, DEFAULT_NEW_CUSTOMER_LIMIT, ctx.tenantId],
    ctx.tenantId
  );

  await queryWithTenant(
    `INSERT INTO t_credit_operation_log (customer_id, operation_type, amount, balance_before, balance_after, operator_id, remark, tenant_id)
     VALUES (?, 'ADJUST_LIMIT', ?, 0, ?, ?, '系统自动授信', ?)`,
    [customerId, DEFAULT_NEW_CUSTOMER_LIMIT, DEFAULT_NEW_CUSTOMER_LIMIT, ctx.userId, ctx.tenantId],
    ctx.tenantId
  );

  logger.info(`[Credit] Auto-init credit for customer ${customerId}: limit=${DEFAULT_NEW_CUSTOMER_LIMIT}, term=NET_7`);

  return {
    creditLimit: DEFAULT_NEW_CUSTOMER_LIMIT,
    paymentTerm: "NET_7",
  };
}

/**
 * 赊销拦截：开单前校验
 * 返回是否可以继续开单，以及拦截原因
 */
export async function interceptCredit(
  customerId: number,
  amount: number,
  ctx: ServiceContext
): Promise<{ allowed: boolean; reason: string; credit?: CreditInterceptSummary }> {
  const credit = await queryOneWithTenant<CreditInterceptRow>(
    `SELECT credit_limit, credit_used, credit_frozen, credit_available, status, warning_threshold, payment_term
     FROM t_customer_credit WHERE customer_id = ? AND tenant_id = ?`,
    [customerId, ctx.tenantId],
    ctx.tenantId
  );

  if (!credit) {
    return { allowed: true, reason: "客户无授信记录，允许现金交易" };
  }

  if (credit.status === "FROZEN") {
    return {
      allowed: false,
      reason: `授信已冻结：${credit.freeze_reason ?? "未知原因"}`,
      credit: {
        creditLimit: Number(credit.credit_limit),
        creditUsed: Number(credit.credit_used),
        creditAvailable: Number(credit.credit_available),
        status: credit.status,
      },
    };
  }

  if (credit.status === "CLOSED") {
    return {
      allowed: false,
      reason: "授信已关闭",
      credit: {
        creditLimit: Number(credit.credit_limit),
        creditUsed: Number(credit.credit_used),
        creditAvailable: Number(credit.credit_available),
        status: credit.status,
      },
    };
  }

  const available = Number(credit.credit_available);
  if (amount > available) {
    return {
      allowed: false,
      reason: `可用额度不足，当前可用：${available}，需要：${amount}`,
      credit: {
        creditLimit: Number(credit.credit_limit),
        creditUsed: Number(credit.credit_used),
        creditAvailable: available,
        status: credit.status,
      },
    };
  }

  const usageRate = Number(credit.credit_used) / Number(credit.credit_limit);
  if (usageRate >= Number(credit.warning_threshold)) {
    return {
      allowed: true,
      reason: `授信使用率已达${Math.round(usageRate * 100)}%，接近预警线`,
      credit: {
        creditLimit: Number(credit.credit_limit),
        creditUsed: Number(credit.credit_used),
        creditAvailable: available,
        status: credit.status,
      },
    };
  }

  return {
    allowed: true,
    reason: "额度充足",
    credit: {
      creditLimit: Number(credit.credit_limit),
      creditUsed: Number(credit.credit_used),
      creditAvailable: available,
      status: credit.status,
    },
  };
}

/**
 * 自动生成催收任务（按逾期天数分级）
 */
export async function autoGenerateCollections(ctx: ServiceContext): Promise<{
  generated: number;
  details: { customerId: number; customerName: string; level: string; overdueDays: number; overdueAmount: number }[];
}> {
  const overdueCustomers = await queryWithTenant<OverdueCustomerRow>(
    `SELECT cc.customer_id AS customerId, m.name AS customerName, m.mobile AS customerMobile,
            cc.credit_used AS creditUsed, cc.payment_term AS paymentTerm,
            cc.credit_limit AS creditLimit
     FROM t_customer_credit cc
     LEFT JOIN t_member m ON m.id = cc.customer_id
     WHERE cc.credit_used > 0 AND cc.status = 'ACTIVE' AND cc.payment_term != 'COD'
       AND cc.tenant_id = ?`,
    [ctx.tenantId],
    ctx.tenantId
  );

  const details: { customerId: number; customerName: string; level: string; overdueDays: number; overdueAmount: number }[] = [];

  for (const customer of overdueCustomers) {
    const overdueDays = Math.max(0, Math.floor(
      (Date.now() - new Date(customer.lastTradeDate ?? Date.now()).getTime()) / 86400000
    ));

    const strategy = COLLECTION_STRATEGY.find((s) => overdueDays >= s.minDays && overdueDays <= s.maxDays);
    if (!strategy || overdueDays <= 0) continue;

    const overdueAmount = Number(customer.creditUsed);

    // 检查是否已有当天的催收记录
    const existing = await queryOneWithTenant<CollectionExistingRow>(
      `SELECT id FROM t_collection_record
       WHERE customer_id = ? AND DATE(created_at) = CURDATE() AND collection_level = ?
       AND tenant_id = ?`,
      [customer.customerId, strategy.level, ctx.tenantId],
      ctx.tenantId
    );
    if (existing) continue;

    // 生成催收记录
    await queryWithTenant(
      `INSERT INTO t_collection_record (customer_id, overdue_days, overdue_amount,
         collection_level, collection_method, collection_content,
         contact_person, operator_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer.customerId, overdueDays, overdueAmount,
      strategy.level, strategy.method,
      `系统自动生成：逾期${overdueDays}天，${strategy.desc}`,
      customer.customerName, ctx.userId, ctx.tenantId],
      ctx.tenantId
    );

    details.push({
      customerId: Number(customer.customerId),
      customerName: customer.customerName ?? "",
      level: strategy.level,
      overdueDays,
      overdueAmount,
    });
  }

  logger.info(`[Credit] Auto-generated ${details.length} collection tasks`);

  return { generated: details.length, details };
}

/**
 * 获取催收策略配置
 */
export function getCollectionStrategyConfig() {
  return COLLECTION_STRATEGY;
}

/**
 * 获取授信阶梯配置
 */
export function getCreditTiers() {
  return CREDIT_TIERS;
}