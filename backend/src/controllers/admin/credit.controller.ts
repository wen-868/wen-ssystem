import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { ok } from "../../shared/response.js";
import * as creditLimitService from "../../services/admin/credit-limit.service.js";
import * as creditCollectionService from "../../services/admin/credit-collection.service.js";
import * as creditRiskService from "../../services/admin/credit-risk.service.js";
import * as creditScoringService from "../../services/admin/credit-scoring.service.js";
import type { ServiceContext } from "../../types/index.js";

function getServiceContext(req: any): ServiceContext {
  return {
    tenantId: req.tenantId!,
    userId: req.user!.id,
    username: req.user!.username,
    storeId: req.user!.storeId,
  };
}

export const getCreditList = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;

  const result = await creditLimitService.getCreditList(status, keyword, page, pageSize, ctx);
  res.json(ok(result));
});

export const getCreditDetail = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const record = await creditLimitService.getCreditDetail(customerId, ctx);

  if (!record) {
    res.status(404).json({ code: "404", message: "该客户尚未开通授信" });
    return;
  }

  res.json(ok(record));
});

export const initCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    creditLimit: z.number().min(0),
    paymentTerm: z.enum(["COD", "NET_7", "NET_15", "NET_30", "NET_60", "NET_90"]).default("COD"),
    lateFeeRate: z.number().min(0).max(1).default(0.0005),
    maxLateFeeRate: z.number().min(0).max(1).default(0.3),
    warningThreshold: z.number().min(0).max(1).default(0.80),
    overdueFreezeDays: z.number().int().min(0).default(15)
  }).parse(req.body);

  try {
    const result = await creditLimitService.initCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const checkCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);
  const amount = Number(req.query.amount || 0);

  try {
    const result = await creditLimitService.checkCredit(customerId, amount, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const occupyCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().max(64)
  }).parse(req.body);

  try {
    const result = await creditLimitService.occupyCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const releaseCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    amount: z.number().positive(),
    orderNo: z.string().max(64),
    remark: z.string().max(255).default("释放额度")
  }).parse(req.body);

  try {
    const result = await creditLimitService.releaseCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const freezeCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    freezeAmount: z.number().min(0).default(0),
    reason: z.string().max(255).default("手动冻结")
  }).parse(req.body);

  try {
    const result = await creditLimitService.freezeCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const unfreezeCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  const body = z.object({
    unfreezeAmount: z.number().min(0).default(0),
    reason: z.string().max(255).default("手动解冻")
  }).parse(req.body);

  try {
    const result = await creditLimitService.unfreezeCredit(customerId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const getCollectionList = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const collectionLevel = req.query.collectionLevel as string | undefined;
  const customerId = req.query.customerId as string | undefined;
  const contactResult = req.query.contactResult as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;

  const result = await creditCollectionService.getCollectionList(
    collectionLevel, customerId, contactResult, startDate, endDate, page, pageSize, ctx
  );
  res.json(ok(result));
});

export const createCollection = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);

  const body = z.object({
    customerId: z.number().int().positive(),
    receivableNo: z.string().max(64).optional(),
    overdueDays: z.number().int().min(0).default(0),
    overdueAmount: z.number().min(0).default(0),
    collectionLevel: z.enum(["REMIND", "LIGHT", "MEDIUM", "HEAVY", "SEVERE"]),
    collectionMethod: z.enum(["SMS", "PHONE", "VISIT", "LETTER", "LEGAL"]),
    collectionContent: z.string().optional(),
    contactPerson: z.string().max(64).default(""),
    contactResult: z.enum(["PROMISED", "REFUSED", "NO_ANSWER", "PARTIAL_PAID", "DISPUTED"]).optional(),
    promisedAmount: z.number().min(0).optional(),
    promisedDate: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional()
  }).parse(req.body);

  try {
    const result = await creditCollectionService.createCollection(body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

export const updateCollection = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const collectionId = Number(req.params.id);

  const body = z.object({
    contactResult: z.enum(["PROMISED", "REFUSED", "NO_ANSWER", "PARTIAL_PAID", "DISPUTED"]).optional(),
    promisedAmount: z.number().min(0).optional(),
    promisedDate: z.string().nullable().optional(),
    nextFollowUpDate: z.string().nullable().optional(),
    collectionContent: z.string().optional()
  }).parse(req.body);

  try {
    const result = await creditCollectionService.updateCollection(collectionId, body, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 404).json({ code: String(e.statusCode || 404), message: e.message });
  }
});

export const getOverdueCustomers = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const result = await creditCollectionService.getOverdueCustomers(ctx);
  res.json(ok(result));
});

export const batchRemind = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);

  const body = z.object({
    customerIds: z.array(z.number().int().positive()).min(1),
    method: z.enum(["SMS", "PHONE", "LETTER"]).default("SMS"),
    content: z.string().min(1).max(500),
    collectionLevel: z.enum(["REMIND", "LIGHT", "MEDIUM", "HEAVY", "SEVERE"]).default("REMIND")
  }).parse(req.body);

  const result = await creditCollectionService.batchRemind(body, ctx);
  res.json(ok(result));
});

export const getCollectionStatistics = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const result = await creditCollectionService.getCollectionStatistics(ctx);
  res.json(ok(result));
});

export const getRiskCustomers = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);

  const result = await creditRiskService.getRiskCustomers(page, pageSize, ctx);
  res.json(ok(result));
});

// ========== 信用评分与风控新接口 ==========

/** 评估客户信用评分 */
export const evaluateCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  try {
    const result = await creditScoringService.evaluateCreditScore(customerId, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

/** 赊销拦截检查 */
export const checkCreditIntercept = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);
  const amount = Number(req.query.amount || 0);

  try {
    const result = await creditScoringService.interceptCredit(customerId, amount, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

/** 自动授信初始化 */
export const autoInitCredit = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);
  const customerId = Number(req.params.customerId);

  try {
    const result = await creditScoringService.autoInitCredit(customerId, ctx);
    res.json(ok(result));
  } catch (e: any) {
    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });
  }
});

/** 自动生成催收任务 */
export const autoGenerateCollections = asyncHandler(async (req, res) => {
  const ctx = getServiceContext(req);

  const result = await creditScoringService.autoGenerateCollections(ctx);
  res.json(ok(result));
});

/** 获取催收策略配置 */
export const getCollectionStrategyConfig = asyncHandler(async (_req, res) => {
  const config = creditScoringService.getCollectionStrategyConfig();
  res.json(ok(config));
});

/** 获取授信阶梯配置 */
export const getCreditTiers = asyncHandler(async (_req, res) => {
  const tiers = creditScoringService.getCreditTiers();
  res.json(ok(tiers));
});
