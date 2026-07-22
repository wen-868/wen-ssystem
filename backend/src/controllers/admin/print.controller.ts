/**
 * 打印记录控制器
 *
 * 用途：App 端蓝牙打印小票留痕审计 API 的请求处理层
 * 路由前缀：/api/admin/print（见 routes/print.routes.ts）
 *
 * 职责：
 *  - 参数解析与校验（zod）
 *  - 调用 service 层完成业务
 *  - 返回统一响应（ok）
 *  - 租户隔离：tenantId 统一从 req.tenantId 获取（由 tenantMiddleware 注入），不信任客户端输入
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { asyncHandler } from "../../middleware/async-handler";
import { ok } from "../../shared/response";
import { z } from "zod";
import * as printService from "../../services/admin/print.service";

// 单据类型白名单（与 service 层 BILL_TYPE_VALUES 保持一致，controller 层做早期校验给出明确 400）
const billTypeEnum = z.enum([
    "SALE_BILL",
    "SALE_RETURN",
    "SHIFT",
    "DAILY_SETTLE",
    "REPRINT",
]);

// 打印状态白名单（与 service 层 STATUS_VALUES 保持一致）
const statusEnum = z.enum(["SUCCESS", "FAILED", "PENDING"]);

/**
 * POST /records — 保存打印记录
 * operatorId 由服务端从 req.user.id 注入，不信任客户端传入（审计留痕要求操作人真实可信）
 */
export const createRecord = asyncHandler(async (req, res) => {
    const body = z
        .object({
            storeId: z.coerce.number().int().positive().optional().nullable(),
            billType: billTypeEnum,
            billNo: z.string().min(1).max(64),
            printerMac: z.string().max(32).optional().nullable(),
            printContent: z.string().optional().nullable(),
            copies: z.coerce.number().int().min(1).max(99).default(1),
            status: statusEnum.default("SUCCESS"),
            errorMsg: z.string().optional().nullable(),
            originalId: z.coerce.number().int().positive().optional().nullable(),
        })
        .parse(req.body);

    const result = await printService.createPrintRecord(
        {
            storeId: body.storeId ?? null,
            billType: body.billType,
            billNo: body.billNo,
            printerMac: body.printerMac ?? null,
            printContent: body.printContent ?? null,
            copies: body.copies,
            // 操作员由服务端注入，避免客户端伪造操作人
            operatorId: req.user?.id ?? null,
            status: body.status,
            errorMsg: body.errorMsg ?? null,
            originalId: body.originalId ?? null,
        },
        req.tenantId!
    );

    res.json(ok(result));
});

/**
 * GET /records — 查询打印记录（分页 + 筛选）
 */
export const listRecords = asyncHandler(async (req, res) => {
    const params = z
        .object({
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(100).default(20),
            billType: billTypeEnum.optional(),
            billNo: z.string().max(64).optional(),
            storeId: z.coerce.number().int().positive().optional(),
            status: statusEnum.optional(),
            operatorId: z.coerce.number().int().positive().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
        })
        .parse(req.query);

    const { page, pageSize, ...filters } = params;
    const result = await printService.listPrintRecords(
        filters,
        { page, pageSize },
        req.tenantId!
    );
    res.json(ok(result));
});

/**
 * GET /records/:id — 查询单条打印记录详情
 */
export const getRecordDetail = asyncHandler(async (req, res) => {
    const { id } = z
        .object({
            id: z.coerce.number().int().positive(),
        })
        .parse(req.params);

    const result = await printService.getPrintRecordDetail(id, req.tenantId!);
    res.json(ok(result));
});

/**
 * POST /records/:id/reprint — 重打
 * 复制原记录生成新记录（bill_type=REPRINT，original_id 关联原记录）
 * 重打发起人 operatorId 由服务端从 req.user.id 注入
 */
export const reprint = asyncHandler(async (req, res) => {
    const { id } = z
        .object({
            id: z.coerce.number().int().positive(),
        })
        .parse(req.params);

    const result = await printService.reprintRecord(
        id,
        req.user!.id,
        req.tenantId!
    );
    res.json(ok(result));
});
