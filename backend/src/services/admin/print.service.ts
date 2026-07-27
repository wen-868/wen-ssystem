/**
 * 打印记录服务
 *
 * 用途：App 端蓝牙打印小票留痕审计，支持销售单/销售退货/班结/日结/重打等场景。
 * 使用 queryWithTenant / queryOneWithTenant 实现租户隔离，所有查询/写入自动注入 tenant_id。
 *
 * 关联任务：R51-03 后端打印记录 API
 */

import { queryWithTenant, queryOneWithTenant } from "../../shared/db";
import type { ResultSetHeader } from "mysql2/promise";

// ==================== 类型定义 ====================

/** 单据类型枚举 */
export type PrintBillType = "SALE_BILL" | "SALE_RETURN" | "SHIFT" | "DAILY_SETTLE" | "REPRINT";

/** 打印状态枚举 */
export type PrintStatus = "SUCCESS" | "FAILED" | "PENDING";

/** 打印记录行（数据库返回结构） */
export interface PrintRecordRow {
    id: number;
    tenant_id: string;
    store_id: number | null;
    bill_type: PrintBillType;
    bill_no: string;
    printer_mac: string | null;
    print_content: string | null;
    copies: number;
    operator_id: number | null;
    status: PrintStatus;
    error_msg: string | null;
    original_id: number | null;
    created_at: string;
    updated_at: string;
}

/** 创建打印记录入参 */
export interface PrintRecordCreateInput {
    storeId?: number | null;
    billType: PrintBillType;
    billNo: string;
    printerMac?: string | null;
    printContent?: string | null;
    copies?: number;
    operatorId?: number | null;
    status?: PrintStatus;
    errorMsg?: string | null;
    originalId?: number | null;
}

/** 查询打印记录筛选条件 */
export interface PrintRecordListFilters {
    billType?: PrintBillType;
    billNo?: string;
    storeId?: number;
    status?: PrintStatus;
    operatorId?: number;
    startDate?: string;
    endDate?: string;
}

/** 分页参数 */
export interface PrintRecordPagination {
    page: number;
    pageSize: number;
}

/** 单据类型白名单（用于参数校验） */
export const BILL_TYPE_VALUES: readonly PrintBillType[] = [
    "SALE_BILL",
    "SALE_RETURN",
    "SHIFT",
    "DAILY_SETTLE",
    "REPRINT",
] as const;

/** 打印状态白名单 */
export const STATUS_VALUES: readonly PrintStatus[] = [
    "SUCCESS",
    "FAILED",
    "PENDING",
] as const;

// ==================== 服务函数 ====================

/**
 * 创建打印记录
 *
 * @param data 打印记录数据
 * @param tenantId 租户ID
 * @returns 新建记录ID
 */
export async function createPrintRecord(
    data: PrintRecordCreateInput,
    tenantId: string
): Promise<{ id: number }> {
    // 校验单据类型
    if (!BILL_TYPE_VALUES.includes(data.billType)) {
        throw Object.assign(new Error(`非法的单据类型：${data.billType}`), { statusCode: 400 });
    }
    // 校验状态（默认 SUCCESS）
    const status: PrintStatus = data.status ?? "SUCCESS";
    if (!STATUS_VALUES.includes(status)) {
        throw Object.assign(new Error(`非法的打印状态：${status}`), { statusCode: 400 });
    }
    // 校验单据编号
    if (!data.billNo || data.billNo.trim().length === 0) {
        throw Object.assign(new Error("单据编号不能为空"), { statusCode: 400 });
    }

    const copies = data.copies ?? 1;
    if (copies < 1 || copies > 99) {
        throw Object.assign(new Error("打印份数必须在 1-99 之间"), { statusCode: 400 });
    }

    const result = await queryWithTenant<ResultSetHeader>(
        `INSERT INTO t_print_record
      (store_id, bill_type, bill_no, printer_mac, print_content, copies, operator_id, status, error_msg, original_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.storeId ?? null,
            data.billType,
            data.billNo,
            data.printerMac ?? null,
            data.printContent ?? null,
            copies,
            data.operatorId ?? null,
            status,
            data.errorMsg ?? null,
            data.originalId ?? null,
        ],
        tenantId
    ) as unknown as ResultSetHeader | ResultSetHeader[];

    // queryWithTenant 对 INSERT 的返回形态：
    //  - 真实 DB：ResultSetHeader 对象（含 insertId，见 database.ts queryWithTenant 的 pool.query 分支）
    //  - mock DB：[ResultSetHeader] 数组（见 database.ts queryWithTenant 的 mock 分支）
    // 兼容两种形态提取 insertId（踩坑日志 [23]：mock 下数组访问 .insertId 为 undefined）
    const insertId =
        Number(
            Array.isArray(result) ? result[0]?.insertId : result?.insertId
        ) || 0;
    return { id: insertId };
}

/**
 * 查询打印记录列表（支持筛选 + 分页）
 *
 * @param filters 筛选条件
 * @param pagination 分页参数
 * @param tenantId 租户ID
 * @returns 分页记录列表
 */
export async function listPrintRecords(
    filters: PrintRecordListFilters,
    pagination: PrintRecordPagination,
    tenantId: string
): Promise<{
    total: number;
    page: number;
    pageSize: number;
    records: PrintRecordRow[];
}> {
    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    // 动态构建 WHERE 条件（tenant_id 由 queryWithTenant 自动注入）
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.billType) {
        conditions.push("bill_type = ?");
        values.push(filters.billType);
    }
    if (filters.billNo) {
        conditions.push("bill_no = ?");
        values.push(filters.billNo);
    }
    if (filters.storeId !== undefined) {
        conditions.push("store_id = ?");
        values.push(filters.storeId);
    }
    if (filters.status) {
        conditions.push("status = ?");
        values.push(filters.status);
    }
    if (filters.operatorId !== undefined) {
        conditions.push("operator_id = ?");
        values.push(filters.operatorId);
    }
    if (filters.startDate) {
        conditions.push("created_at >= ?");
        values.push(filters.startDate);
    }
    if (filters.endDate) {
        conditions.push("created_at <= ?");
        values.push(filters.endDate);
    }

    const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const records = await queryWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
        [...values, pageSize, offset],
        tenantId
    );

    const totalRow = await queryOneWithTenant<{ total: number }>(
        `SELECT COUNT(*) AS total FROM t_print_record ${whereClause}`,
        values,
        tenantId
    );

    return {
        total: Number(totalRow?.total ?? 0),
        page,
        pageSize,
        records,
    };
}

/**
 * 查询单条打印记录详情
 *
 * @param id 记录ID
 * @param tenantId 租户ID
 * @returns 记录详情（不存在时抛 404）
 */
export async function getPrintRecordDetail(
    id: number,
    tenantId: string
): Promise<PrintRecordRow> {
    const row = await queryOneWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     WHERE id = ?`,
        [id],
        tenantId
    );

    if (!row) {
        throw Object.assign(new Error("打印记录不存在"), { statusCode: 404 });
    }

    return row;
}

/**
 * 重打 — 复制原记录生成新记录，bill_type 标记为 REPRINT，original_id 关联原记录
 *
 * @param id 原记录ID
 * @param operatorId 操作员ID（重打发起人）
 * @param tenantId 租户ID
 * @returns 新记录ID + 原记录ID
 */
export async function reprintRecord(
    id: number,
    operatorId: number,
    tenantId: string
): Promise<{ id: number; originalId: number }> {
    // 先查询原记录（自动租户隔离，避免跨租户重打）
    const original = await queryOneWithTenant<PrintRecordRow>(
        `SELECT id, tenant_id, store_id, bill_type, bill_no, printer_mac, print_content,
            copies, operator_id, status, error_msg, original_id, created_at, updated_at
     FROM t_print_record
     WHERE id = ?`,
        [id],
        tenantId
    );

    if (!original) {
        throw Object.assign(new Error("原打印记录不存在"), { statusCode: 404 });
    }

    // 复制原记录数据，bill_type 改为 REPRINT，original_id 指向原记录
    const result = await queryWithTenant<ResultSetHeader>(
        `INSERT INTO t_print_record
      (store_id, bill_type, bill_no, printer_mac, print_content, copies, operator_id, status, error_msg, original_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            original.store_id,
            "REPRINT",
            original.bill_no,
            original.printer_mac,
            original.print_content,
            original.copies,
            operatorId,
            "PENDING",
            null,
            original.id,
        ],
        tenantId
    ) as unknown as ResultSetHeader | ResultSetHeader[];

    // 兼容 mock（数组）与真实 DB（对象）两种 INSERT 返回形态，详见踩坑日志 [23]
    const insertId =
        Number(
            Array.isArray(result) ? result[0]?.insertId : result?.insertId
        ) || 0;
    return { id: insertId, originalId: original.id };
}
