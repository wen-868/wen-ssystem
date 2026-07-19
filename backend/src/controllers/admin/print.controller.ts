/**
 * 打印记录控制器
 *
 * 注意：禁止 try-catch（项目规则决策 3），错误统一由全局 errorHandler 处理。
 * 通过 asyncHandler 包装异步函数，自动捕获 Promise 异常并传递到 errorHandler。
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { z } from "zod";
import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import * as printService from "../../services/admin/print.service";

// ==================== Zod Schema ====================

const billTypeSchema = z.enum([
    "SALE_BILL",
    "SALE_RETURN",
    "SHIFT",
    "DAILY_SETTLE",
    "REPRINT",
]);

const statusSchema = z.enum(["SUCCESS", "FAILED", "PENDING"]);

const createRecordSchema = z.object({
    storeId: z.number().int().positive().nullable().optional(),
    billType: billTypeSchema,
    billNo: z.string().min(1).max(64),
    printerMac: z.string().max(32).nullable().optional(),
    printContent: z.string().nullable().optional(),
    copies: z.number().int().min(1).max(99).optional(),
    operatorId: z.number().int().positive().nullable().optional(),
    status: statusSchema.optional(),
    errorMsg: z.string().nullable().optional(),
    originalId: z.number().int().positive().nullable().optional(),
});

const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    billType: billTypeSchema.optional(),
    billNo: z.string().max(64).optional(),
    storeId: z.coerce.number().int().positive().optional(),
    status: statusSchema.optional(),
    operatorId: z.coerce.number().int().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

// ==================== 控制器函数 ====================

/**
 * 保存打印记录
 * POST /api/admin/print/records
 */
export const createRecord = asyncHandler(async (req, res) => {
    const body = createRecordSchema.parse(req.body);
    const result = await printService.createPrintRecord(body, req.tenantId!);
    res.json(ok(result));
});

/**
 * 查询打印记录列表（支持筛选 + 分页）
 * GET /api/admin/print/records
 */
export const listRecords = asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { page, pageSize, ...filters } = query;
    const result = await printService.listPrintRecords(
        filters,
        { page, pageSize },
        req.tenantId!
    );
    res.json(ok(result));
});

/**
 * 查询单条打印记录详情
 * GET /api/admin/print/records/:id
 */
export const getRecordDetail = asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const result = await printService.getPrintRecordDetail(id, req.tenantId!);
    res.json(ok(result));
});

/**
 * 重打 — 复制原记录生成新记录
 * POST /api/admin/print/records/:id/reprint
 */
export const reprint = asyncHandler(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const operatorId = req.user?.id ?? 0;
    if (!operatorId) {
        throw Object.assign(new Error("无法识别操作员身份"), { statusCode: 401 });
    }
    const result = await printService.reprintRecord(id, operatorId, req.tenantId!);
    res.json(ok(result));
});
